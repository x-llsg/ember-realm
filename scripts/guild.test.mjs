import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/realm.ts';

// These deliberately constructed states are unit fixtures, not legal campaign
// completions. The separate realm.test.mjs simulation checks real progression.
const resourceKeys = Object.keys(G.RESOURCE_NAMES);
const reload = (s) => G.decodeSave(JSON.stringify(s));
const close = (actual, expected) =>
  assert.ok(
    Math.abs(actual - expected) < 1e-8,
    `expected ${expected}, received ${actual}`,
  );
function fund(s) {
  for (const k of resourceKeys) s.resources[k] = G.capacity(s, k);
  for (const id of G.MATERIAL_IDS) {
    const work = G.WORK_RECIPES.find((r) => r.id === id);
    const available = work
      ? s.world.tech.includes(work.tech)
      : G.regionOpen(s, G.REGION_MATERIALS.indexOf(id));
    s.world.materials[id] = available ? G.materialCapacity(s, id) : 0;
  }
  return s;
}
function unitState(chapters = 0, seed = 123456789) {
  const s = G.freshState(1);
  s.rng = seed;
  s.assigned = true;
  s.event = 0;
  s.order.enabled = false;
  s.cleared = Array.from({ length: chapters }, (_, r) => r);
  for (const r of s.cleared) {
    s.survey[r] = G.REGIONS[r].thresholds[1];
    s.projects[G.PROJECTS[r].id] = G.PROJECTS[r].choices[0].id;
    s.guild.depths[r] = 5;
    s.guild.intel[r] = 100;
  }
  if (!chapters) s.guild.depths[0] = 1;
  delete s.world;
  G.migrateWorld(s);
  s.research.push('baskets');
  for (const b of G.BUILDINGS) s.buildings[b.id] = G.buildingLimit(s, b.id);
  s.population = G.populationCap(s);
  G.ensureApplicants(s);
  return fund(s);
}
function hireRoles(s, roles = ['rhea', 'finn']) {
  for (const role of roles) {
    if (!s.guild.applicants.some((h) => h.role === role))
      s = G.refreshApplicants(fund(s), role);
    const candidate = s.guild.applicants.find((h) => h.role === role);
    const next = G.recruit(s, candidate.id);
    assert.notEqual(next, s, `hire ${role}`);
    s = next;
  }
  return s;
}
function forge(s, recipe) {
  const next = G.craftGear(fund(s), recipe);
  assert.notEqual(next, s, `forge ${recipe}: ${G.forgeReason(s, recipe)}`);
  return [next, next.guild.inventory.at(-1).id];
}
function challenger() {
  const s = hireRoles(unitState(), ['rhea', 'finn', 'luna']);
  // Keep this matchup below 100% so improvement assertions do not hit the cap.
  s.kit = 0;
  s.guild.depths[0] = 4;
  for (const h of s.heroes) {
    h.level = 1;
    h.quality = 1;
    h.aptitude = { hp: 100, attack: 100, defense: 100 };
    h.talent = 'diligent';
    h.flaw = 'overcome';
  }
  return s;
}

test('applicants retain identity, traits, RNG and directed refresh through reload', () => {
  const s = unitState();
  assert.equal(s.guild.applicants.length, 3);
  assert.ok(s.guild.applicants.some((h) => h.role === 'rhea'));
  assert.ok(s.guild.applicants.some((h) => h.role === 'finn'));
  const restored = reload(s);
  assert.deepEqual(restored, s);
  const next = G.refreshApplicants(s, 'luna');
  assert.deepEqual(G.refreshApplicants(restored, 'luna'), next);
  assert.equal(next.guild.applicants[0].role, 'luna');
  assert.ok(
    next.guild.applicants.every(
      (h) => !s.guild.applicants.some((old) => old.id === h.id),
    ),
  );
  assert.deepEqual(reload(next), next);
  const candidate = next.guild.applicants[0];
  const hired = G.recruit(next, candidate.id);
  assert.deepEqual(
    hired.heroes.find((h) => h.id === candidate.id),
    candidate,
  );
  assert.ok(!hired.guild.applicants.some((h) => h.id === candidate.id));
  assert.deepEqual(reload(hired), hired);
});

test('directed hiring respects unlocks and becomes free without replacing waiting candidates', () => {
  const s = unitState();
  assert.equal(G.refreshApplicants(s, 'ash'), s);
  assert.equal(G.refreshApplicants(s, 'orin'), s);
  const waiting = G.advance(s, s.guild.refreshAt - s.time);
  assert.deepEqual(waiting.guild.applicants, s.guild.applicants);
  assert.deepEqual(G.refreshCost(waiting), {});
  const free = G.refreshApplicants(waiting, 'kael');
  assert.deepEqual(free.resources, waiting.resources);
  assert.equal(free.guild.applicants[0].role, 'kael');
  for (const [chapter, role] of [
    [1, 'orin'],
    [3, 'ash'],
  ]) {
    const directed = G.refreshApplicants(unitState(chapter), role);
    assert.equal(directed.guild.applicants[0].role, role);
  }
});

test('the same role generates different names, aptitudes and integrated talents', () => {
  const s = unitState();
  const applicants = Array.from({ length: 160 }, () =>
    G.makeApplicant(s, 'rhea'),
  );
  assert.equal(new Set(applicants.map((h) => h.id)).size, applicants.length);
  for (const read of [
    (h) => h.name,
    (h) => h.talent,
    (h) => JSON.stringify(h.aptitude),
  ])
    assert.ok(new Set(applicants.map(read)).size > 1);
  for (const h of applicants) {
    assert.equal(h.role, 'rhea');
    assert.deepEqual(Object.keys(h.aptitude).sort(), [
      'attack',
      'defense',
      'hp',
    ]);
    assert.ok(
      Object.values(h.aptitude).every(
        (n) => Number.isInteger(n) && n >= 80 && n <= 130,
      ),
    );
  }
  assert.ok(
    new Set(
      applicants.map((h) =>
        Object.values(h.aptitude).reduce((a, b) => a + b, 0),
      ),
    ).size > 1,
  );
  assert.ok(
    applicants.some(
      (h) => Object.values(h.aptitude).reduce((a, b) => a + b, 0) !== 300,
    ),
  );
  const flawsByTalent = new Map();
  for (const h of applicants) {
    if (!flawsByTalent.has(h.talent)) flawsByTalent.set(h.talent, new Set());
    flawsByTalent.get(h.talent).add(h.flaw);
  }
  assert.ok(
    applicants.every((h) => h.talentVersion === 2 && h.flaw === 'overcome'),
  );
  assert.ok(
    new Set(
      applicants.map((h) => G.TALENTS.find((t) => t.id === h.talent).rarity),
    ).size >= 4,
  );
});

test('legacy talent and flaw effects are independent and paid recovery preserves the individual', () => {
  const s = hireRoles(unitState(), ['rhea']);
  const h = s.heroes[0];
  delete h.talentVersion;
  h.talent = 'scholar';
  h.flaw = 'overcome';
  const plain = G.individualStats(s, h);
  h.talent = 'hunter';
  h.flaw = 'frail';
  const affected = G.individualStats(s, h);
  close(affected.attack, plain.attack * 1.08);
  close(affected.hp, plain.hp * 0.92);
  const recovered = G.mentorHero(s, h.id, true);
  const next = recovered.heroes[0];
  assert.equal(recovered.resources.gold, s.resources.gold - 120);
  assert.equal(recovered.resources.food, s.resources.food - 60);
  assert.deepEqual(next, { ...h, flaw: 'overcome' });
  close(G.individualStats(recovered, next).hp, plain.hp);
  close(G.individualStats(recovered, next).attack, affected.attack);
  assert.equal(G.mentorHero(recovered, h.id, true), recovered);
});

test('multiple individuals may share a role and both join the four-person party', () => {
  let s = hireRoles(unitState(), ['rhea']);
  s = G.refreshApplicants(s, 'rhea');
  const second = s.guild.applicants[0].id;
  s = G.recruit(s, second);
  assert.equal(s.heroes.filter((h) => h.role === 'rhea').length, 2);
  assert.equal(s.party.length, 2);
  assert.ok(s.party.includes(second));
  s = G.toggleParty(s, s.party[0]);
  assert.deepEqual(s.party, [second]);
  assert.deepEqual(reload(s), s);
});

test('three equipment slots coexist, transfer uniquely, and unload without destroying gear', () => {
  let s = hireRoles(unitState());
  const [first, second] = s.heroes.map((h) => h.id);
  const equipped = {};
  for (const [slot, recipe] of [
    ['weapon', 'blade'],
    ['armor', 'plate'],
    ['charm', 'vitality'],
  ]) {
    let id;
    [s, id] = forge(s, recipe);
    s = G.equipGear(s, first, id);
    equipped[slot] = id;
  }
  assert.deepEqual(s.heroes[0].equipment, equipped);
  assert.equal(s.guild.inventory.length, 3);
  s = G.equipGear(s, second, equipped.weapon);
  assert.equal(s.heroes[0].equipment.weapon, undefined);
  assert.equal(s.heroes[1].equipment.weapon, equipped.weapon);
  assert.equal(s.heroes[0].equipment.armor, equipped.armor);
  assert.equal(G.dismantleGear(s, equipped.weapon), s);
  const unloaded = G.unequipGear(s, second, 'weapon');
  assert.equal(unloaded.heroes[1].equipment.weapon, undefined);
  assert.deepEqual(unloaded.guild.inventory, s.guild.inventory);
  assert.ok(
    G.individualStats(unloaded, unloaded.heroes[1]).attack <
      G.individualStats(s, s.heroes[1]).attack,
  );
  assert.deepEqual(reload(unloaded), unloaded);
  const retired = G.dismissHero(s, first);
  assert.equal(retired.heroes.length, 1);
  assert.deepEqual(retired.guild.inventory, s.guild.inventory);
  assert.notEqual(G.dismantleGear(retired, equipped.armor), retired);
});

test('all eight paid enhancements succeed without rerolling quality, affix or RNG', () => {
  let [s, id] = forge(unitState(2), 'blade');
  const original = structuredClone(s.guild.inventory[0]);
  for (let level = 1; level <= 8; level++) {
    const item = s.guild.inventory.find((g) => g.id === id);
    const price = G.enhancementCost(item);
    const materialPrice = G.enhancementMaterials(s, item);
    const before = fund(s);
    const next = G.enhanceGear(before, id);
    assert.notEqual(next, before);
    assert.deepEqual(next.guild.inventory[0], { ...original, upgrade: level });
    assert.equal(next.rng, before.rng);
    for (const [k, cost] of Object.entries(price))
      close(next.resources[k], before.resources[k] - cost);
    for (const [k, cost] of Object.entries(materialPrice))
      assert.equal(next.world.materials[k], before.world.materials[k] - cost);
    assert.ok(
      G.itemStats(next, next.guild.inventory[0]).attack >
        G.itemStats(before, item).attack,
    );
    s = next;
  }
  assert.equal(G.enhanceGear(s, id), s);
  assert.deepEqual(reload(s), s);
});

test('reforging spends dust for the chosen affix without a random roll', () => {
  let [s, id] = forge(unitState(), 'blade');
  const item = s.guild.inventory[0];
  const fire = G.AFFIXES.findIndex((a) => a.stat === 'fire');
  const target =
    item.affix === fire
      ? G.AFFIXES.findIndex((a) => a.stat === 'shadow')
      : fire;
  s.guild.dust = 100;
  const next = G.reforgeGear(s, id, target);
  assert.deepEqual(next.guild.inventory[0], { ...item, affix: target });
  assert.equal(next.guild.dust, 100 - 20 * item.tier);
  assert.equal(next.rng, s.rng);
  close(
    G.itemStats(next, next.guild.inventory[0])[G.AFFIXES[target].stat],
    G.AFFIXES[target].value,
  );
  assert.equal(G.reforgeGear(next, id, target), next);
  assert.equal(G.reforgeGear(next, id, 999), next);
});

test('a full equipment inventory can recover capacity by unloading and dismantling', () => {
  let s = hireRoles(unitState(), ['rhea']);
  let last;
  while (s.guild.inventory.length < G.INVENTORY_CAP)
    [s, last] = forge(s, 'blade');
  const hero = s.heroes[0].id;
  s = G.equipGear(s, hero, last);
  assert.match(G.forgeReason(s, 'blade'), /120/);
  assert.equal(G.craftGear(s, 'blade'), s);
  assert.equal(G.dismantleGear(s, last), s);
  s = G.unequipGear(s, hero, 'weapon');
  s = G.dismantleGear(s, last);
  assert.equal(s.guild.inventory.length, G.INVENTORY_CAP - 1);
  assert.ok(s.guild.dust > 0);
  const next = G.craftGear(s, 'blade');
  assert.notEqual(next, s);
  assert.equal(next.guild.inventory.length, G.INVENTORY_CAP);
  assert.deepEqual(reload(next), next);
});

test('three frontier failures retain progress and guarantee the next actual dispatch', () => {
  let s = challenger();
  while (G.frontierInfo(s, 0).ratio < 0.85) for (const h of s.heroes) h.level++;
  assert.ok(G.frontierInfo(s, 0).chance < 1);
  for (let failures = 1; failures <= 3; failures++) {
    const before = G.frontierInfo(s, 0).chance;
    // Explicitly inject settlement outcomes to exercise the fail-safe boundary.
    G.settleFrontier(s, { region: 0, route: 'frontier', success: false });
    assert.equal(s.guild.failures[0], failures);
    assert.equal(s.guild.progress[0], failures * 3);
    assert.ok(G.frontierInfo(s, 0).chance > before);
  }
  assert.equal(G.frontierInfo(s, 0).chance, 1);
  s = G.expedition(s, 0, 'frontier');
  assert.ok(s.expedition, G.dispatchReason(s, 0, 'frontier', 0));
  assert.equal(s.expedition.success, true);
  assert.equal(s.expedition.chance, 1);
  assert.deepEqual(reload(s).expedition, s.expedition);
  s = G.advance(s, s.expedition.end - s.time);
  assert.equal(s.guild.failures[0], 0);
  assert.ok(s.guild.progress[0] > 9);
});

test('intel and built outposts increase frontier success and progress independently', () => {
  const s = challenger();
  const before = G.frontierInfo(s, 0);
  const informed = G.clone(s);
  informed.guild.intel[0] = 60;
  const intel = G.frontierInfo(informed, 0);
  assert.ok(intel.chance > before.chance);
  assert.ok(intel.progress > before.progress);
  const supported = G.buildOutpost(s, 0);
  assert.notEqual(supported, s);
  assert.equal(supported.guild.outposts[0], 1);
  const outpost = G.frontierInfo(supported, 0);
  assert.ok(outpost.chance > before.chance);
  assert.ok(outpost.progress > before.progress);
  assert.ok(
    G.routeInfo(supported, 0, 'supply').cost < G.routeInfo(s, 0, 'supply').cost,
  );
  assert.ok(
    G.routeInfo(supported, 0, 'supply').reward.wood >
      G.routeInfo(s, 0, 'supply').reward.wood,
  );
});

test('v3 migration preserves old names, growth, upgrades, party and completed regions', () => {
  const old = unitState(2);
  old.version = 3;
  old.heroes = [
    { id: 'rhea', level: 8, xp: 30, weapon: 2, armor: 1 },
    { id: 'finn', level: 7, xp: 42, weapon: 1, armor: 3 },
  ];
  old.party = ['rhea', 'finn'];
  delete old.guild;
  delete old.world;
  const migrated = reload(old);
  assert.equal(migrated.version, 10);
  assert.equal(G.townRank(migrated), 3);
  assert.deepEqual(migrated.resources, old.resources);
  assert.deepEqual(migrated.party, old.party);
  for (const previous of old.heroes) {
    const h = migrated.heroes.find((h) => h.id === previous.id);
    for (const [key, value] of Object.entries(previous))
      assert.equal(h[key], value);
    assert.equal(h.role, previous.id);
    assert.equal(h.name, G.HEROES.find((d) => d.id === previous.id).name);
    assert.deepEqual(h.aptitude, { hp: 100, attack: 100, defense: 100 });
    assert.equal(h.flaw, 'overcome');
  }
  for (const r of old.cleared) {
    assert.equal(migrated.guild.depths[r], 5);
    assert.equal(migrated.guild.intel[r], 100);
  }
  assert.equal(migrated.guild.applicants.length, 3);
  assert.deepEqual(reload(migrated), migrated);
});

test('imports reject malformed aptitude keys, duplicate identities and regressed serials', () => {
  const source = hireRoles(unitState());
  const mutations = [
    [
      'wrong aptitude keys',
      (s) => {
        s.heroes[0].aptitude = { a: 100, b: 100, c: 100 };
      },
    ],
    [
      'array aptitude',
      (s) => {
        s.guild.applicants[0].aptitude = [100, 100, 100];
      },
    ],
    [
      'aptitude beyond independent bounds',
      (s) => {
        s.heroes[0].aptitude = { hp: 131, attack: 110, defense: 110 };
      },
    ],
    [
      'duplicate traveler',
      (s) => {
        s.guild.applicants[0].id = s.heroes[0].id;
      },
    ],
    [
      'regressed traveler serial',
      (s) => {
        s.guild.serial = 0;
      },
    ],
    [
      'unknown talent',
      (s) => {
        s.heroes[0].talent = 'unknown';
      },
    ],
    [
      'unknown flaw',
      (s) => {
        s.heroes[0].flaw = 'unknown';
      },
    ],
  ];
  for (const [label, mutate] of mutations) {
    const invalid = G.clone(source);
    mutate(invalid);
    assert.throws(() => reload(invalid), undefined, label);
  }
  const independent = G.clone(source);
  independent.heroes[0].aptitude = { hp: 110, attack: 110, defense: 110 };
  assert.deepEqual(
    reload(independent).heroes[0].aptitude,
    independent.heroes[0].aptitude,
  );
  const [equipped, gear] = forge(source, 'blade');
  const regressed = G.clone(equipped);
  regressed.guild.serial = Number(gear.split('-')[1]) - 1;
  assert.throws(() => reload(regressed), /序号/);
  const next = G.refreshApplicants(reload(equipped), 'rhea');
  assert.deepEqual(reload(next), next);
});

test('imports reject equipment in the wrong slot, shared ownership and excessive levels', () => {
  let [source, gear] = forge(hireRoles(unitState()), 'blade');
  source = G.equipGear(source, source.heroes[0].id, gear);
  for (const [label, mutate] of [
    [
      'duplicate ownership',
      (s) => {
        s.heroes[1].equipment.weapon = gear;
      },
    ],
    [
      'wrong slot',
      (s) => {
        s.heroes[0].equipment = { armor: gear };
      },
    ],
    [
      'missing item',
      (s) => {
        s.heroes[0].equipment.weapon = 'gear-999';
      },
    ],
    [
      'excess enhancement',
      (s) => {
        s.guild.inventory[0].upgrade = 9;
      },
    ],
    [
      'duplicate gear',
      (s) => {
        s.guild.inventory.push(structuredClone(s.guild.inventory[0]));
      },
    ],
  ]) {
    const invalid = G.clone(source);
    mutate(invalid);
    assert.throws(() => reload(invalid), undefined, label);
  }
});

test('potion selection reserves inventory while extra-supply resources are paid only for battle', () => {
  const s = unitState(4);
  const basic = G.battlePreparationCost(s);
  const potion = G.setPreparation(s, { element: 'fire' });
  assert.deepEqual(potion.resources, s.resources);
  const potionCost = G.battlePreparationCost(potion);
  assert.deepEqual(potionCost, basic);
  assert.equal(G.potionCount(potion, 'fire'), 0);
  assert.match(G.preparedPotionReason(potion), /库存不足/);
  const both = G.setPreparation(potion, { remedy: true });
  const cost = G.battlePreparationCost(both);
  assert.equal(cost.gold, 25);
  assert.equal(cost.food, basic.food + 30);
  assert.equal(cost.crystal, potionCost.crystal);
  assert.deepEqual(both.resources, s.resources);
  const onlySupplies = G.setPreparation(both, { element: 'physical' });
  assert.equal(G.battlePreparationCost(onlySupplies).gold, 25);
  assert.equal(G.battlePreparationCost(onlySupplies).crystal, undefined);
});

// Isolate one-time node rewards after a real combat action at a constructed lethal boundary.
function finishGuardian(s, region) {
  if (!s.party.length) {
    const h = G.makeApplicant(s, 'rhea');
    s.heroes.push(h);
    s.party = [h.id];
  }
  s.battle = G.createCombat(s, region, 'guardian');
  s.battle.enemyHp = 1;
  s.battle.enemyDodge = 0;
  return G.combat(s, G.commandFor(s.party[0], 'attack'));
}
test('second outposts boost the linked production and actual tick by 15% only once', () => {
  const linkedResources = ['wood', 'stone', 'iron', 'gold', 'crystal', 'food'];
  for (const [region, linked] of linkedResources.entries()) {
    let s = unitState();
    for (const k of resourceKeys) {
      s.jobs[k] = 1;
      s.resources[k] = G.capacity(s, k) / 2;
    }
    s.guild.depths[region] = 1;
    s.guild.progress[region] = G.FRONTIER_REQUIREMENTS[1] - 1;
    const before = G.clone(s);
    const oldRates = G.production(s);
    G.settleFrontier(s, { region, route: 'frontier', success: true });
    assert.equal(s.guild.depths[region], 1);
    s = finishGuardian(s, region);
    assert.equal(s.guild.depths[region], 2);
    const rates = G.production(s);
    const oldTick = G.advance(before, 1);
    const newTick = G.advance(s, 1);
    for (const k of resourceKeys) {
      close(rates[k], oldRates[k] * (k === linked ? 1.15 : 1));
      close(
        newTick.resources[k] - oldTick.resources[k],
        (k === linked ? oldRates[k] * 0.15 : 0) -
          (linked === 'iron'
            ? oldRates.iron *
              0.15 *
              (k === 'wood' ? 2.5 : k === 'stone' ? 5 : 0)
            : linked === 'crystal' && k === 'gold'
              ? (oldRates.crystal * 0.15 * 0.25) / 0.07
              : 0),
      );
    }
    const continued = reload(s);
    G.settleFrontier(continued, { region, route: 'frontier', success: true });
    assert.equal(continued.guild.depths[region], 2);
    assert.deepEqual(G.production(continued), rates);
  }
});

test('third outposts guarantee one rare set item; fourth armor reductions do not stack', () => {
  let s = unitState();
  const beforeCount = s.guild.inventory.length;
  const oldArmor = G.enemyArmor(s, 0);
  s.guild.depths[0] = 2;
  s.guild.progress[0] = G.FRONTIER_REQUIREMENTS[2] - 1;
  G.settleFrontier(s, { region: 0, route: 'frontier', success: true });
  s = finishGuardian(s, 0);
  assert.equal(s.guild.depths[0], 3);
  assert.equal(s.guild.inventory.length, beforeCount + 1);
  assert.ok(s.guild.inventory.at(-1).rarity >= 3);
  assert.equal(s.guild.inventory.at(-1).setId, 'wildwatch');
  const rewardCount = s.guild.inventory.length;
  const rewardDust = s.guild.dust;
  s = reload(s);
  G.settleFrontier(s, { region: 0, route: 'frontier', success: true });
  assert.equal(s.guild.inventory.length, rewardCount);
  assert.equal(s.guild.dust, rewardDust);
  assert.equal(G.enemyArmor(s, 0), oldArmor);
  s.guild.progress[0] = G.FRONTIER_REQUIREMENTS[3] - 1;
  G.settleFrontier(s, { region: 0, route: 'frontier', success: true });
  s = finishGuardian(s, 0);
  assert.equal(s.guild.depths[0], 4);
  close(G.enemyArmor(s, 0), oldArmor * 0.85);
  s.guild.progress[0] = G.FRONTIER_REQUIREMENTS[4] - 1;
  G.settleFrontier(s, { region: 0, route: 'frontier', success: true });
  s = finishGuardian(s, 0);
  assert.equal(s.guild.depths[0], 5);
  close(G.enemyArmor(s, 0), oldArmor * 0.85);
  assert.ok(
    s.guild.inventory.length >= rewardCount &&
      s.guild.inventory.length <= rewardCount + 2,
  );
  assert.equal(s.guild.dust, rewardDust);
  assert.equal(
    G.settleFrontier(s, { region: 0, route: 'frontier', success: true }),
    0,
  );
});

function battleReady(region, seed = 123456789) {
  let s = hireRoles(unitState(region, seed), ['rhea', 'finn', 'luna', 'kael']);
  s.survey[region] = G.REGIONS[region].thresholds[1];
  s.projects[G.PROJECTS[region].id] = G.PROJECTS[region].choices[0].id;
  s.guild.depths[region] = 5;
  s.guild.intel[region] = 80;
  s.kit = G.REGIONS[region].kit;
  if (region === 5) s.research.push('godslayer');
  for (const h of [...s.heroes]) {
    let gear;
    [s, gear] = forge(s, h.role === 'finn' ? 'bow' : 'blade');
    s = G.equipGear(s, h.id, gear);
  }
  assert.equal(G.bossReason(s, region), '');
  return s;
}
function openingDamage(s, region, command) {
  const battle = G.startBattle(s, region);
  assert.ok(battle.battle);
  assert.equal(G.commandReason(battle, command), '');
  const next = G.combat(battle, command);
  assert.notEqual(next, battle);
  assert.ok(
    next.battle || next.cleared.includes(region),
    'fixture must survive the opening response',
  );
  return battle.battle.enemyMaxHp - (next.battle?.enemyHp ?? 0);
}

test('training or guaranteed weapon enhancement never reduces the same command damage', () => {
  for (const seed of [17, 2026, 918273, 123456789]) {
    for (const region of [0, 2, 4, 5]) {
      const base = battleReady(region, seed);
      const commands = [
        'attack',
        'break',
        ...base.heroes
          .filter((h) => h.role !== 'luna')
          .map((h) => `hero:${h.id}`),
      ];
      const originalDamage = commands.map((c) =>
        openingDamage(base, region, c),
      );
      for (const hero of base.heroes) {
        const trained = G.train(base, hero.id);
        const enhanced = G.enhanceGear(base, hero.equipment.weapon);
        assert.notEqual(trained, base);
        assert.notEqual(enhanced, base);
        for (const [index, command] of commands.entries()) {
          const label = `seed ${seed}, region ${region}, improve ${hero.role}, ${command}`;
          assert.ok(
            openingDamage(trained, region, command) >= originalDamage[index],
            `training reduced damage: ${label}`,
          );
          assert.ok(
            openingDamage(enhanced, region, command) >= originalDamage[index],
            `enhancement reduced damage: ${label}`,
          );
        }
      }
    }
  }
});

test('forecast outcomes match actual command replay including a mid-battle save reload', () => {
  const outcomes = new Set();
  for (const [region, level] of [
    [0, 40],
    [4, 12],
    [5, 1],
  ]) {
    let source = battleReady(region);
    for (const h of source.heroes) h.level = level;
    source = G.setPreparation(source, {
      stance: 'cautious',
      element: G.ENEMIES[region].element,
      remedy: true,
    });
    if (source.guild.preparation.element !== 'physical') {
      const element = source.guild.preparation.element;
      source = G.craftPotion(fund(source), element);
      assert.equal(G.potionCount(source, element), 1);
    }
    for (const plan of ['balanced', 'attack']) {
      const untouched = G.clone(source);
      const forecast = G.forecastBattle(source, region, plan);
      assert.equal(forecast.reason, '');
      assert.ok(forecast.trace.length > 0);
      assert.deepEqual(
        source,
        untouched,
        'forecast must not spend resources or change real state',
      );
      let replay = G.startBattle(source, region);
      for (const [k, cost] of Object.entries(G.battlePreparationCost(source)))
        close(replay.resources[k], source.resources[k] - cost);
      let rounds = 0;
      let hp = replay.battle.hp;
      for (const command of forecast.trace) {
        assert.ok(
          replay.battle,
          'forecast must not contain commands after battle completion',
        );
        assert.equal(G.commandReason(replay, command), '');
        const beforeHp = replay.battle.hp;
        replay = G.combat(replay, command);
        rounds++;
        hp =
          replay.battle?.hp ??
          replay.lastBattle?.hp ??
          (replay.cleared.includes(region) ? beforeHp : 0);
        if (replay.battle && rounds === Math.ceil(forecast.trace.length / 2))
          replay = reload(replay);
      }
      assert.equal(replay.battle, null);
      assert.equal(replay.cleared.includes(region), forecast.win);
      assert.equal(rounds, forecast.actions);
      assert.equal(hp, forecast.hp);
      outcomes.add(forecast.win);
    }
  }
  assert.deepEqual(
    outcomes,
    new Set([true, false]),
    'exercise both successful and failed battle forecasts',
  );
});

test('town forging remains available during expeditions and preserves the dispatched outcome', () => {
  for (const route of ['survey', 'frontier']) {
    let source = hireRoles(unitState(2));
    for (const h of source.heroes) {
      h.level = G.levelCap(source);
      h.quality = 5;
    }
    source = fund(source);
    assert.equal(G.dispatchReason(source, 2, route, 0), '');
    const travelling = G.expedition(source, 2, route),
      before = G.clone(travelling);
    assert.ok(travelling.expedition);
    const tier = G.gearTier(travelling),
      cost = G.recipeCost(travelling, 'blade', tier),
      materials = G.recipeMaterialCost(travelling, 'blade', tier);
    const crafted = G.craftGear(travelling, 'blade', tier);
    assert.notEqual(crafted, travelling);
    assert.deepEqual(travelling, before, 'caller state is immutable');
    assert.deepEqual(
      crafted.expedition,
      travelling.expedition,
      'departure snapshot is unchanged',
    );
    assert.deepEqual(
      crafted.heroes,
      travelling.heroes,
      'new item does not replace any equipment',
    );
    assert.equal(
      crafted.guild.inventory.length,
      travelling.guild.inventory.length + 1,
    );
    assert.equal(crafted.guild.serial, travelling.guild.serial + 1);
    assert.equal(crafted.guild.crafts, travelling.guild.crafts + 1);
    for (const [k, v] of Object.entries(cost))
      close(crafted.resources[k], travelling.resources[k] - v);
    for (const [k, v] of Object.entries(materials))
      close(crafted.world.materials[k], travelling.world.materials[k] - v);
    assert.deepEqual(
      G.craftGear(reload(travelling), 'blade', tier),
      crafted,
      'save reload preserves the next forge',
    );
    assert.deepEqual(reload(crafted), crafted);
    const gear = crafted.guild.inventory.at(-1),
      hero = crafted.heroes[0];
    assert.equal(G.equipGear(crafted, hero.id, gear.id), crafted);
    assert.equal(G.unequipGear(crafted, hero.id, 'weapon'), crafted);
    const enhanced = G.enhanceGear(crafted, gear.id);
    assert.notEqual(enhanced, crafted);
    assert.equal(enhanced.guild.inventory.at(-1).upgrade, 1);
    assert.deepEqual(enhanced.expedition, crafted.expedition);
    assert.equal(
      G.reforgeGear(crafted, gear.id, (gear.affix + 1) % G.AFFIXES.length),
      crafted,
    );
    assert.equal(G.train(crafted, hero.id), crafted);
    const time = crafted.expedition.end - crafted.time + 1;
    const ordinary = G.advance(travelling, time),
      withForge = G.advance(crafted, time);
    for (const key of [
      'success',
      'chance',
      'progress',
      'intelGain',
      'clues',
      'outcome',
    ])
      assert.equal(
        withForge.lastExpedition[key],
        ordinary.lastExpedition[key],
        key,
      );
  }
});

test('forging new stock during battle leaves every combat turn unchanged', () => {
  const ready = fund(battleReady(1));
  const plan = G.forecastBattle(ready, 1);
  let ordinary = G.startBattle(ready, 1),
    withForge = G.craftGear(ordinary, 'blade', G.gearTier(ordinary));
  assert.ok(ordinary.battle);
  assert.notEqual(withForge, ordinary);
  assert.deepEqual(withForge.battle, ordinary.battle);
  for (const command of plan.trace) {
    ordinary = G.combat(ordinary, command);
    withForge = G.combat(withForge, command);
    assert.deepEqual(withForge.battle, ordinary.battle, command);
    assert.deepEqual(withForge.cleared, ordinary.cleared);
  }
});

test('busy-town forging still rejects unavailable inputs atomically and keeps fourth-craft pity', () => {
  let source = hireRoles(unitState(2));
  for (const h of source.heroes) {
    h.level = G.levelCap(source);
    h.quality = 5;
  }
  let travelling = G.expedition(fund(source), 2, 'survey');
  for (const [label, mutate, recipe, tier] of [
    [
      'gold',
      (s) => {
        s.resources.gold = 0;
      },
      'blade',
      1,
    ],
    [
      'materials',
      (s) => {
        for (const k of G.MATERIAL_IDS) s.world.materials[k] = 0;
      },
      'blade',
      2,
    ],
    ['recipe', () => {}, 'unknown', 1],
    ['tier', () => {}, 'blade', 7],
    [
      'full',
      (s) => {
        while (s.guild.inventory.length < G.INVENTORY_CAP)
          s.guild.inventory.push({
            id: 'gear-' + ++s.guild.serial,
            recipe: 'blade',
            tier: 1,
            rarity: 1,
            affix: 0,
            upgrade: 0,
          });
      },
      'blade',
      1,
    ],
  ]) {
    const blocked = G.clone(travelling);
    mutate(blocked);
    const before = G.clone(blocked);
    assert.equal(G.craftGear(blocked, recipe, tier), blocked, label);
    assert.deepEqual(blocked, before, label + ' cannot pay or consume RNG');
  }
  travelling.guild.crafts = 3;
  const result = G.craftGear(travelling, 'blade', 1);
  assert.equal(result.guild.crafts, 4);
  assert.ok(result.guild.inventory.at(-1).rarity >= 3);
});
