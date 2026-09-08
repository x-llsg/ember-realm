import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/realm.ts';

// Deliberately constructed UNIT fixtures. No player saves or Site files are read
// or written. These checks do not claim a legal campaign completion.
// Run: node --experimental-strip-types --test pity-origin-tests.mjs
function fiveStarFixture(){ const s=G.freshState(1); s.cleared=[0]; s.guild.depths[0]=5; return s; }
const copy = structuredClone;
const reload = (s) => G.decodeSave(JSON.stringify(s));
const close = (a, b, label = '') =>
  assert.ok(Math.abs(a - b) < 1e-8, `${label}: ${a} != ${b}`);
const keys = Object.keys(G.RESOURCE_NAMES);
function fund(s) {
  for (const key of keys) s.resources[key] = G.capacity(s, key);
  return s;
}
function town(seed = 123456789) {
  const s = fiveStarFixture();
  s.rng = seed;
  s.assigned = true;
  s.event = 0;
  s.order.enabled = false;
  s.guild.depths[0] = 5;
  delete s.world;
  G.migrateWorld(s);
  s.research.push('baskets');
  for (const b of G.BUILDINGS) s.buildings[b.id] = G.buildingLimit(s, b.id);
  s.population = G.populationCap(s);
  G.ensureApplicants(s);
  return fund(s);
}
function person(s, origin = '中性单元夹具', role = 'rhea', level = 4) {
  const h = G.makeApplicant(s, role);
  delete h.talentVersion; // Explicit legacy trait fixture.
  Object.assign(h, {
    origin,
    level,
    xp: 0,
    quality: 3,
    mastery: 2,
    talent: 'diligent',
    flaw: 'overcome',
    weapon: 1,
    armor: 1,
  });
  h.aptitude = { hp: 110, attack: 105, defense: 120 };
  s.heroes.push(h);
  return h;
}
function masteryTown() {
  const s = town();
  s.world.tech = ['settlement', 'metallurgy', 'citadel', 'infernalcraft'];
  s.guild.depths[2] = 3;
  s.guild.depths[3] = 2;
  s.cleared = [0, 2];
  for (const b of G.BUILDINGS) s.buildings[b.id] = G.buildingLimit(s, b.id);
  for (const id of G.MATERIAL_IDS) s.world.materials[id] = Math.min(200, G.materialCapacity(s, id));
  return fund(s);
}
function gear(s, h, recipe, affix = 2) {
  const item = {
    id: `gear-${++s.guild.serial}`,
    recipe,
    tier: 1,
    rarity: 3,
    upgrade: 2,
    affix,
  };
  s.guild.inventory.push(item);
  h.equipment[G.RECIPES.find((r) => r.id === recipe).slot] = item.id;
  return item;
}
function payment(before, after, cost) {
  for (const k of keys)
    close(before.resources[k] - after.resources[k], cost[k] || 0, k);
}
function inverseXor(y, shift, left) {
  let x = y >>> 0;
  for (let i = 0; i < 32; i++)
    x = (y ^ (left ? x << shift : x >>> shift)) >>> 0;
  return x;
}
function seedForQ(q) {
  const output = Math.floor(q * 4294967296) >>> 0;
  return inverseXor(
    inverseXor(inverseXor(output, 5, true), 17, false),
    13,
    true,
  );
}
function batchSeed(predicate, requested) {
  for (let seed = 1; seed <= 100000; seed++) {
    const s = fiveStarFixture();
    s.rng = seed;
    const people = [
      G.makeApplicant(s, requested),
      G.makeApplicant(s),
      G.makeApplicant(s),
    ];
    if (predicate(people)) return seed;
  }
  assert.fail('bounded deterministic seed search found no fixture');
}
const allMissSeed = batchSeed((h) => h.every((x) => x.quality < 5));
const earlyFiveSeed = batchSeed(
  (h) => h[0].quality === 5 && h.slice(1).every((x) => x.quality < 5),
);

test('fresh count, exact 79/80 boundary, natural reset and unchanged RNG consumption', () => {
  assert.equal(fiveStarFixture().guild.fiveStarMisses, 0);
  assert.equal(G.FIVE_STAR_PITY, 80);
  for (const [q, expected] of [
    [0.2, 1],
    [0.6, 2],
    [0.8, 3],
    [0.96, 4],
    [0.995, 5],
  ]) {
    const ordinary = fiveStarFixture(),
      pity = fiveStarFixture();
    ordinary.rng = pity.rng = seedForQ(q);
    ordinary.guild.fiveStarMisses = 78;
    pity.guild.fiveStarMisses = 79;
    const a = G.makeApplicant(ordinary, 'rhea'),
      b = G.makeApplicant(pity, 'rhea');
    assert.equal(a.quality, expected);
    assert.equal(ordinary.guild.fiveStarMisses, expected === 5 ? 0 : 79);
    assert.equal(b.quality, 5);
    assert.equal(pity.guild.fiveStarMisses, 0);
    assert.deepEqual(
      { ...a, quality: 5 },
      b,
      'forcing five must not reroll any other field',
    );
    assert.equal(ordinary.rng, pity.rng);
  }
});

test('every rolling window of 80 generated candidates contains five stars', () => {
  for (const seed of [1, 123456789, 4294967295]) {
    const s = fiveStarFixture();
    s.rng = seed;
    let run = 0;
    for (let j = 0; j < 3000; j++) {
      const h = G.makeApplicant(s);
      run = h.quality === 5 ? 0 : run + 1;
      assert.ok(run < 80);
      assert.equal(s.guild.fiveStarMisses, run);
      assert.ok(G.ORIGINS.some((o) => o.name === h.origin));
    }
  }
});

test('initial three count once; reopening applicants does not consume draws', () => {
  const s = fiveStarFixture();
  s.buildings.tavern = 1;
  s.rng = 123456789;
  const control = copy(s);
  const expected = [
    G.makeApplicant(control, 'rhea'),
    G.makeApplicant(control, 'finn'),
    G.makeApplicant(control),
  ];
  G.ensureApplicants(s);
  assert.deepEqual(s.guild.applicants, expected);
  assert.equal(s.guild.fiveStarMisses, control.guild.fiveStarMisses);
  assert.equal(s.rng, control.rng);
  const before = copy(s);
  G.ensureApplicants(s);
  assert.deepEqual(s, before);
});

test('three-person refresh resets within slots and coexists with fourth-batch three-star pity', () => {
  for (const misses of [77, 78, 79]) {
    const s = town();
    s.rng = allMissSeed;
    s.guild.fiveStarMisses = misses;
    s.guild.rolls = 3;
    const next = G.refreshApplicants(s);
    assert.notEqual(next, s);
    const index = 79 - misses;
    assert.equal(next.guild.applicants[index].quality, 5);
    assert.ok(next.guild.applicants[0].quality >= 3);
    assert.equal(next.guild.fiveStarMisses, 2 - index);
    assert.equal(
      s.guild.fiveStarMisses,
      misses,
      'public action must not mutate input',
    );
  }
  const s = town();
  s.rng = earlyFiveSeed;
  s.guild.fiveStarMisses = 78;
  const next = G.refreshApplicants(s);
  assert.equal(next.guild.applicants[0].quality, 5);
  assert.ok(next.guild.applicants.slice(1).every((h) => h.quality < 5));
  assert.equal(next.guild.fiveStarMisses, 2);
});

test('paid/free/directed refresh all count; rejected actions and hiring do not', () => {
  const s = town();
  s.rng = allMissSeed;
  s.guild.fiveStarMisses = 79;
  const paid = G.refreshApplicants(s);
  payment(s, paid, G.refreshCost(s));
  assert.equal(paid.guild.applicants[0].quality, 5);
  const waiting = G.advance(s, s.guild.refreshAt - s.time);
  assert.equal(waiting.guild.fiveStarMisses, 79);
  assert.deepEqual(waiting.guild.applicants, s.guild.applicants);
  assert.deepEqual(G.refreshCost(waiting), {});
  const free = G.refreshApplicants(waiting);
  payment(waiting, free, {});
  assert.equal(free.guild.applicants[0].quality, 5);
  const directed = G.refreshApplicants(s, 'luna');
  assert.equal(directed.guild.applicants[0].role, 'luna');
  assert.equal(directed.guild.applicants[0].quality, 5);
  for (const mutate of [
    (x) => {
      x.resources.gold = 0;
    },
    (x) => {
      x.buildings.tavern = 0;
    },
  ]) {
    const bad = copy(s);
    mutate(bad);
    const before = copy(bad);
    assert.equal(G.refreshApplicants(bad), bad);
    assert.deepEqual(bad, before);
  }
  const hired = G.hireApplicant(paid, paid.guild.applicants[0].id);
  assert.notEqual(hired, paid);
  assert.equal(hired.guild.fiveStarMisses, paid.guild.fiveStarMisses);
  const retired = G.dismissHero(hired, hired.heroes[0].id);
  assert.equal(retired.guild.fiveStarMisses, hired.guild.fiveStarMisses);
  assert.equal(retired.rng, hired.rng);
});

test('0/77/78/79 round-trip and next refresh are deterministic', () => {
  for (const m of [0, 77, 78, 79]) {
    const s = town();
    s.guild.fiveStarMisses = m;
    const restored = reload(s);
    assert.deepEqual(restored, s);
    assert.deepEqual(reload(restored), restored);
    assert.deepEqual(G.refreshApplicants(restored), G.refreshApplicants(s));
  }
});

test('present malformed pity fields reject; missing field follows accepted v6 legacy policy', () => {
  const source = town();
  for (const invalid of [
    null,
    false,
    true,
    '',
    '79',
    -1,
    0.5,
    80,
    1e9,
    [],
    {},
    NaN,
    Infinity,
  ]) {
    const bad = copy(source);
    bad.guild.fiveStarMisses = invalid;
    assert.throws(() => reload(bad), `invalid pity ${JSON.stringify(invalid)}`);
  }
  for (const mutate of [
    (x) => {
      x.guild.applicants = null;
    },
    (x) => {
      x.guild.applicants = [null];
    },
    (x) => {
      x.guild.rolls = -1;
    },
  ]) {
    const bad = copy(source);
    delete bad.guild.fiveStarMisses;
    mutate(bad);
    assert.throws(() => reload(bad));
  }
});

test('legacy batch credit and last visible five-star credit persist without regenerating people', () => {
  const cases = [
    { rolls: 0, stars: [], expected: 0 },
    { rolls: 1, stars: [1, 2, 3], expected: 3 },
    { rolls: 20, stars: [1, 2, 3], expected: 60 },
    { rolls: 27, stars: [1, 2, 3], expected: 79 },
    { rolls: 200, stars: [], expected: 79 },
    { rolls: 200, stars: [5, 2, 3], expected: 2 },
    { rolls: 200, stars: [5, 5, 3], expected: 1 },
    { rolls: 200, stars: [1, 2, 5], expected: 0 },
  ];
  for (const row of cases) {
    const s = town();
    s.guild.rolls = row.rolls;
    s.guild.applicants = s.guild.applicants.slice(0, row.stars.length);
    row.stars.forEach((q, i) => {
      s.guild.applicants[i].quality = q;
    });
    delete s.guild.fiveStarMisses;
    const before = copy(s),
      migrated = reload(s);
    assert.equal(migrated.guild.fiveStarMisses, row.expected);
    assert.deepEqual(migrated.guild.applicants, before.guild.applicants);
    assert.equal(migrated.rng, before.rng);
    assert.deepEqual(reload(migrated), migrated);
    assert.deepEqual(s, before);
  }
  const existing = town();
  existing.guild.fiveStarMisses = 13;
  existing.guild.rolls = 200;
  assert.equal(reload(existing).guild.fiveStarMisses, 13);
});

const neutral = {
  hp: 1,
  attack: 1,
  defense: 1,
  pierce: 0,
  ranged: 0,
  resistance: 0,
  trainingGold: 1,
  trainingFood: 1,
  experience: 1,
  mastery: 1,
};
const effects = [
  { name: '边境流民', ...neutral, hp: 1.12, trainingFood: 0.8 },
  { name: '旧王国佣兵', ...neutral, attack: 1.08, trainingGold: 0.9 },
  { name: '山地猎户', ...neutral, pierce: 0.12, ranged: 0.2 },
  { name: '行商护卫', ...neutral, defense: 1.15, trainingGold: 0.85 },
  { name: '学徒出身', ...neutral, attack: 1.04, experience: 1.25 },
  { name: '隐修者', ...neutral, resistance: 0.1, mastery: 0.85 },
];

for (const effect of effects)
  test(`${effect.name}: exact equipped stats, training/mastery charges and unchanged investment`, () => {
    const s = masteryTown(),
      h = person(s, effect.name, 'rhea', 22);
    gear(s, h, 'blade');
    gear(s, h, 'plate');
    gear(s, h, 'vitality');
    const before = copy(s),
      baseline = G.individualStats(s, { ...h, origin: '中性单元夹具' });
    const stats = G.individualStats(s, h),
      actualEffect = G.originEffect(h);
    for (const k of Object.keys(neutral)) close(actualEffect[k], effect[k], k);
    for (const k of ['hp', 'attack', 'defense'])
      close(stats[k], baseline[k] * effect[k], k);
    close(stats.pierce, baseline.pierce + effect.pierce);
    close(stats.ranged, baseline.ranged + effect.ranged);
    for (const k of ['fire', 'shadow', 'radiant'])
      close(stats[k], baseline[k] + effect.resistance);
    assert.deepEqual(
      s,
      before,
      'derived origin effects must not write into hero/equipment',
    );
    const training = {
      gold: Math.ceil((30 + 20 * h.level ** 2.1) * 0.85 * effect.trainingGold * .75),
      food: Math.ceil((20 + 10 * h.level) * effect.trainingFood * .75),
    };
    assert.deepEqual(G.trainCost(h), training);
    const trained = G.train(s, h.id);
    assert.notEqual(trained, s);
    payment(s, trained, training);
    assert.deepEqual(trained.heroes[0], { ...h, level: h.level + 1,trainingInvestment:training });
    const mastery = {
      gold: Math.ceil(4000 * effect.mastery),
      food: Math.ceil(1800 * effect.mastery),
      iron: Math.ceil(180 * effect.mastery),
      crystal: Math.ceil(90 * effect.mastery),
    };
    assert.deepEqual(G.masteryCost(h), mastery);
    const mentored = G.mentorHero(s, h.id);
    assert.notEqual(mentored, s);
    payment(s, mentored, mastery);
    const materials = { boards: Math.ceil(30 * effect.mastery), steel: Math.ceil(18 * effect.mastery), ember: Math.ceil(8 * effect.mastery) };
    assert.deepEqual(G.masteryMaterials(s, h), materials);
    for (const key of G.MATERIAL_IDS) assert.equal(s.world.materials[key] - mentored.world.materials[key], materials[key] || 0, key);
    assert.deepEqual(mentored.heroes[0], { ...h, mastery: h.mastery + 1 });
    assert.deepEqual(trained.guild.inventory, before.guild.inventory);
    assert.deepEqual(mentored.guild.inventory, before.guild.inventory);
    assert.deepEqual(reload(s), s);
  });

test('origin/talent/flaw compose in the documented order; caps remain personal', () => {
  const s = town(),
    h = person(s);
  gear(s, h, 'blade');
  gear(s, h, 'plate');
  const base = G.individualStats(s, h);
  close(
    G.individualStats(s, {
      ...h,
      origin: '旧王国佣兵',
      talent: 'hunter',
      flaw: 'hesitant',
    }).attack,
    base.attack * 1.08 * 0.94 * 1.08,
  );
  close(
    G.individualStats(s, { ...h, origin: '边境流民', flaw: 'frail' }).hp,
    base.hp * 1.12 * 0.92,
  );
  close(
    G.individualStats(s, { ...h, origin: '行商护卫', flaw: 'reckless' })
      .defense,
    Math.max(0, base.defense * 1.15 - 2),
  );
  const hunter = person(s, '山地猎户', 'finn');
  hunter.talent = 'breaker';
  gear(s, hunter, 'pike', 3);
  gear(s, hunter, 'plate', 3);
  gear(s, hunter, 'wardstone', 3);
  const hunterStats = G.individualStats(s, hunter);
  close(hunterStats.pierce, 0.75);
  close(hunterStats.ranged, 1);
  for (const [recipe, element, affix] of [
    ['firecoat', 'fire', 4],
    ['shadowcoat', 'shadow', 5],
    ['dawncoat', 'radiant', 6],
  ]) {
    const monk = person(s, '隐修者');
    monk.talent = 'warden';
    gear(s, monk, recipe, affix);
    gear(s, monk, 'wardstone', affix);
    close(G.individualStats(s, monk)[element], 0.75);
  }
});

test('all origins retain positive training growth, and discounted actions remain atomic', () => {
  for (const e of effects) {
    const s = masteryTown(),
      h = person(s, e.name, 'rhea', 22);
    assert.equal(G.masteryReason(s, h), '', 'the atomicity fixture has all progression and material prerequisites');
    gear(s, h, 'blade');
    const base = G.individualStats(s, h),
      next = G.individualStats(s, { ...h, level: h.level + 1 });
    const multiplier =
      G.POTENTIAL_GROWTH[h.quality - 1] * (1 + h.mastery * 0.04);
    for (const [k, gain] of Object.entries({ hp: 24, attack: 5, defense: 0.8 }))
      close(
        next[k] - base[k],
        ((gain * multiplier * h.aptitude[k]) / 100) * e[k],
      );
    for (const [action, cost] of [
      [(x) => G.train(x, h.id), G.trainCost(h)],
      [(x) => G.mentorHero(x, h.id), G.masteryCost(h)],
    ]) {
      const bad = copy(s);
      const k = Object.keys(cost)[0];
      bad.resources[k] = cost[k] - 1;
      const before = copy(bad);
      assert.equal(action(bad), bad);
      assert.deepEqual(bad, before);
    }
  }
  const s = town(),
    h = person(s, '隐修者');
  h.flaw = 'frail';
  const fixed = G.mentorHero(s, h.id, true);
  payment(s, fixed, { gold: 120, food: 60 });
  assert.equal(fixed.heroes[0].flaw, 'overcome');
});

test('six origins award exact expedition XP to active and reserve heroes, including diligent and green', () => {
  for (const e of effects)
    for (const active of [true, false]) {
      const s = town(),
        h = person(s, e.name),
        companion = person(s, '中性单元夹具', 'finn');
      h.flaw = 'green';
      s.party = [active ? h.id : companion.id];
      const sent = G.expedition(s, 0, 'survey');
      assert.notEqual(sent, s, G.dispatchReason(s, 0, 'survey', 0));
      const journey = copy(sent.expedition);
      const expected =
        (25 + journey.region * 14) *
        (1 + journey.depth * 0.3) *
        (journey.success ? 1 : 0.4) *
        (active ? 1 : 0.4) *
        (1 + s.buildings.tavern * 0.1) *
        1.3 *
        0.9 *
        e.experience * 1.2;
      const end = G.advance(sent, journey.end - sent.time);
      assert.equal(end.expedition, null);
      assert.equal(end.heroes[0].level, h.level);
      close(end.heroes[0].xp, expected, `${e.name} active=${active}`);
      assert.equal(end.guild.fiveStarMisses, sent.guild.fiveStarMisses);
    }
});

test('boss victory awards the same origin XP factor to active and reserve heroes', () => {
  for (const offset of [0, 3]) {
    let s = town();
    s.cleared=[];
    s.guild.depths[0] = 5;
    s.guild.intel[0] = 100;
    s.survey[0] = G.REGIONS[0].thresholds[1];
    s.projects[G.PROJECTS[0].id] = G.PROJECTS[0].choices[0].id;
    for (let i = 0; i < effects.length; i++) {
      const h = person(s, effects[i].name, G.HEROES[i].id, 7);
      h.quality = 5;
      h.flaw = 'green';
    }
    s.party = Array.from(
      { length: 4 },
      (_, i) => s.heroes[(i + offset) % 6].id,
    );
    // XP attribution needs an actual victory from a developed party. Build its
    // equipment through the already available handcrafting and enhancement APIs.
    for (const id of s.party) {
      const hero = s.heroes.find(h => h.id === id);
      for (const recipe of [hero.role === 'finn' ? 'bow' : 'blade', 'plate', 'vitality', 'cap', 'grips', 'boots']) {
        fund(s);
        assert.equal(G.forgeReason(s, recipe, 1), '', recipe);
        const crafted = G.craftGear(s, recipe, 1);
        assert.notEqual(crafted, s, `craft ${recipe}`);
        const itemId = crafted.guild.inventory.at(-1).id;
        s = crafted;
        for (let level = 1; level <= 2; level++) {
          fund(s);
          const enhanced = G.enhanceGear(s, itemId);
          assert.notEqual(enhanced, s, `enhance ${recipe} +${level}`);
          s = enhanced;
        }
        const equipped = G.equipGear(s, id, itemId);
        assert.notEqual(equipped, s, `equip ${recipe}`);
        s = equipped;
      }
    }
    s = G.setPreparation(fund(s), { stance: 'cautious' });
    let battle = G.startBattle(s, 0);
    assert.notEqual(battle, s, G.bossReason(s, 0));
    for (let rounds = 0; battle.battle && rounds < 50; rounds++)
      battle = G.combat(battle, G.recommendedCommand(battle));
    assert.ok(
      battle.cleared.includes(0),
      'constructed strong team must win boss-XP fixture',
    );
    for (let i = 0; i < s.heroes.length; i++) {
      const h = s.heroes[i];
      const expected =
        90 *
        (s.party.includes(h.id) ? 1 : 0.4) *
        (1 + s.buildings.tavern * 0.1) *
        1.3 *
        0.9 *
        effects[i].experience;
      close(battle.heroes[i].xp, expected, effects[i].name);
      assert.equal(battle.heroes[i].level, h.level);
    }
  }
});

test('legacy known/unknown origins, characters and worn equipment survive repeated load unchanged', () => {
  for (const origin of [
    ...effects.map((e) => e.name),
    '初代同行者',
    '旧档自定义出身',
    '__proto__',
    'constructor',
  ]) {
    const s = town(),
      h = person(s, origin);
    gear(s, h, 'blade');
    gear(s, h, 'plate');
    gear(s, h, 'vitality');
    s.party = [h.id];
    const before = copy(s);
    delete s.guild.fiveStarMisses;
    const migrated = reload(s),
      again = reload(migrated);
    assert.deepEqual(migrated.heroes, before.heroes);
    assert.deepEqual(migrated.guild.inventory, before.guild.inventory);
    assert.deepEqual(migrated.resources, before.resources);
    assert.deepEqual(again, migrated);
    assert.deepEqual(
      G.individualStats(migrated, migrated.heroes[0]),
      G.individualStats(again, again.heroes[0]),
    );
    const base = G.individualStats(s, { ...h, origin: '中性单元夹具' });
    if (origin === '初代同行者') {
      const stats = G.individualStats(s, h);
      close(stats.hp, base.hp * 1.06);
      close(stats.attack, base.attack * 1.04);
    } else if (!effects.some((e) => e.name === origin))
      assert.deepEqual(G.individualStats(s, h), base);
  }
  const legacy = town();
  legacy.version = 3;
  legacy.heroes = [{ id: 'rhea', level: 4, xp: 42, weapon: 2, armor: 1 }];
  legacy.party = ['rhea'];
  delete legacy.guild;
  delete legacy.world;
  const migrated = reload(legacy);
  assert.equal(migrated.heroes[0].origin, '初代同行者');
  for (const [k, v] of Object.entries(legacy.heroes[0]))
    assert.equal(migrated.heroes[0][k], v);
  assert.deepEqual(reload(migrated), migrated);
});

test('present malformed origins reject without narrowing accepted historical strings', () => {
  const s = town();
  person(s);
  for (const origin of [null, [], {}, 123, false, 'a'.repeat(41)]) {
    const bad = copy(s);
    bad.heroes[0].origin = origin;
    assert.throws(() => reload(bad));
  }
});
