import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/realm.ts';

// Constructed mechanism fixtures, never a claim of legal campaign progression.
// Tested actions and elapsed time use public APIs. No player saves are used.
const copy = structuredClone,
  keys = Object.keys(G.RESOURCE_NAMES),
  reload = (s) => G.decodeSave(JSON.stringify(s));
const close = (a, b, m = '') =>
  assert.ok(Math.abs(a - b) < 1e-7, `${m}: ${a} != ${b}`);
const stock = (s) => ({
  resources: copy(s.resources),
  materials: copy(s.world.materials),
});
function fund(s) {
  for (const k of keys) s.resources[k] = G.capacity(s, k);
  return s;
}
function town() {
  const s = G.freshState(197723154);
  Object.assign(s.buildings, {
    fire: 1,
    warehouse: 4,
    hut: 3,
    lumber: 2,
    farm: 2,
    quarry: 2,
    market: 2,
    tavern: 2,
    forge: 2,
    shrine: 2,
  });
  s.population = 12;
  s.assigned = true;
  s.nextEventAt = 100000;
  s.guild.depths.fill(3);
  s.explored.fill(1);
  s.cleared = [1, 2, 3, 4];
  s.world.tech = G.TECHNOLOGIES.map((t) => t.id);
  s.research = ['tools', 'baskets', 'godslayer'];
  s.heroes = ['rhea', 'finn', 'luna', 'kael', 'orin', 'vera'].map((role) => {
    const h = G.makeApplicant(s, role);
    return Object.assign(h, {
      level: 10,
      xp: 0,
      quality: 3,
      origin: '初代同行者',
      aptitude: { hp: 100, attack: 100, defense: 100 },
      talent: 'veteran',
      flaw: 'overcome',
      mastery: 0,
      learnedNodes: [],
      activeSkill: G.DEFAULT_SKILL[role],
    });
  });
  s.party = s.heroes.slice(0, 4).map((h) => h.id);
  for (const k of G.MATERIAL_IDS)
    s.world.materials[k] = G.REGION_MATERIALS.includes(k) ? 30 : 0;
  fund(s);
  assert.deepEqual(reload(s), s);
  return s;
}
function action(s, fn, label = 'public action') {
  const before = copy(s),
    after = fn(s);
  assert.notEqual(after, s, label);
  assert.deepEqual(s, before, 'input immutable');
  assert.deepEqual(reload(after), after, 'result reloadable');
  return after;
}
function advance(s, n) {
  const before = copy(s),
    after = G.advance(s, n);
  assert.deepEqual(s, before);
  assert.deepEqual(reload(after), after);
  return after;
}
function charge(before, after, cost) {
  for (const k of keys)
    close(after.resources[k], before.resources[k] - (cost[k] || 0), k);
}
function eventState(id, base = town()) {
  base.event = G.EVENTS.findIndex((e) => e.id === id);
  assert.ok(base.event >= 0);
  G.prepareVisitor(base);
  return base;
}
function inverseXor(y, shift, left) {
  let x = y >>> 0;
  for (let i = 0; i < 32; i++)
    x = (y ^ (left ? x << shift : x >>> shift)) >>> 0;
  return x;
}
function seedForQ(q) {
  return inverseXor(
    inverseXor(
      inverseXor(Math.floor(q * 4294967296) >>> 0, 5, true),
      17,
      false,
    ),
    13,
    true,
  );
}
function stageState(stage) {
  const s = G.freshState(1);
  if (stage) s.guild.depths[0] = 1;
  s.cleared = Array.from({ length: [0, 0, 1, 2, 3, 5][stage] }, (_, i) => i);
  return s;
}

test('fresh v11 civic state has three invitations and no automatic resources, workers or effects', () => {
  const s = G.freshState(1);
  assert.equal(s.version, 11);
  assert.deepEqual(s.civic, G.freshCivic());
  assert.equal(s.civic.invitations, 3);
  const after = advance(s, 600);
  assert.deepEqual(stock(after), stock(s));
  assert.deepEqual(after.jobs, s.jobs);
  assert.deepEqual(G.activeBuffs(after), []);
});

test('v8 migration preserves paid progress, old early five stars, candidates, RNG and battle snapshots', () => {
  let s = town();
  s.guild.depths[0] = 5;
  s = G.startBattle(s, 0);
  assert.ok(s.battle);
  s.heroes[0].quality = 5;
  s.explored = [10, 20, 30, 40, 50, 60];
  s.guild.fiveStarMisses = 79;
  s.version = 8;
  delete s.civic;
  const before = copy(s),
    loaded = reload(s);
  assert.deepEqual(s, before);
  const { civic, ...body } = loaded;
  const { worldExploration: oldWorld, ...oldBody } = before;
  assert.deepEqual(oldWorld.relics.owned, {});
  const { worldExploration, ...preservedBody } = body;
  assert.deepEqual(preservedBody, { ...oldBody, version: 11 });
  assert.deepEqual(worldExploration.relics.owned, {});
  assert.ok(Object.values(worldExploration.facilities).every(f => !f.repaired && !f.enabled));
  assert.equal(civic.invitations, 200);
  assert.deepEqual(civic.trainingCredit, { gold: 0, food: 0 });
  assert.deepEqual(reload(loaded), loaded);
  const early = G.freshState(1);
  early.buildings.tavern = 1;
  const h = G.makeApplicant(early, 'rhea');
  h.quality = 5;
  early.heroes.push(h);
  early.version = 8;
  delete early.civic;
  assert.equal(G.recruitmentStage(reload(early)), 0);
  assert.equal(reload(early).heroes[0].quality, 5);
});

test('v9 reload preserves active buffs, renovation levels, actual training investment and fixed visitor offer', () => {
  let s = town();
  s = G.renovate(s, 'lumber');
  s = G.train(s, s.heroes[4].id);
  s = eventState('equipment_peddler', s);
  s.civic.buffs.hands = s.time + 600;
  assert.ok(s.heroes[4].trainingInvestment);
  const before = copy(s);
  assert.deepEqual(reload(s), s);
  assert.deepEqual(s, before);
  assert.deepEqual(reload(reload(s)), s);
});

test('renovation rejects unknown, unbuilt, fire and unaffordable targets without spending', () => {
  const s = G.freshState(1);
  for (const id of ['missing', 'fire', 'lumber'])
    assert.equal(G.renovate(s, id), s);
  const built = town();
  built.resources.wood = 0;
  assert.equal(G.renovate(built, 'lumber'), built);
});

test('renovation pays exactly, remains independent of expansion cap and never creates workforce or materials', () => {
  const s = town();
  s.buildings.lumber = G.buildingLimit(s, 'lumber');
  const old = copy(s),
    cost = G.renovationCost(s, 'lumber'),
    after = action(s, (x) => G.renovate(x, 'lumber'));
  charge(s, after, cost);
  assert.equal(after.civic.renovations.lumber, 1);
  assert.deepEqual(after.buildings, old.buildings);
  assert.deepEqual(after.jobs, old.jobs);
  assert.equal(after.population, old.population);
  assert.deepEqual(after.world.materials, old.world.materials);
});

test('all six production renovations add 3 percent per level, then multiply existing industry research', () => {
  const ids = {
    wood: 'lumber',
    food: 'farm',
    stone: 'quarry',
    gold: 'market',
    iron: 'forge',
    crystal: 'shrine',
  };
  for (const [k, id] of Object.entries(ids)) {
    let s = town();
    s = G.assign(s, k, 1);
    s.economy.development[G.DEVELOPMENTS.find((d) => d.resource === k).id] = 2;
    const p = G.production(s),
      after = action(s, (x) => G.renovate(x, id));
    close(G.production(after)[k], p[k] * 1.03);
    for (const other of keys.filter((x) => x !== k))
      close(G.production(after)[other], p[other]);
  }
});

test('housing renovation gives workers 1 percent; warehouse gives 4 percent ordinary capacity without filling it', () => {
  let s = town();
  for (const k of keys) s = G.assign(s, k, 1);
  const p = G.production(s),
    house = action(s, (x) => G.renovate(x, 'hut'));
  for (const k of keys) close(G.production(house)[k], p[k] * 1.01);
  const cap = Object.fromEntries(keys.map((k) => [k, G.capacity(s, k)])),
    mcap = G.materialCapacity(s, 'boards'),
    after = action(s, (x) => G.renovate(x, 'warehouse'));
  for (const k of keys)
    assert.equal(G.capacity(after, k), Math.floor(cap[k] * 1.04));
  assert.equal(G.materialCapacity(after, 'boards'), mcap);
  charge(s, after, G.renovationCost(s, 'warehouse'));
});

test('renovation levels are linear in effect, geometric in finite cost, capped at sixty and still reload', () => {
  let s = town();
  s.buildings.warehouse = 12;
  s.economy.development.storage = 12;
  s.civic.renovations.warehouse = 60;
  for (const id of ['lumber', 'forge', 'shrine', 'tavern', 'hut']) {
    let previous = 0;
    for (const level of [0, 1, 10, 59]) {
      s.civic.renovations[id] = level;
      const cost = G.renovationCost(s, id);
      assert.ok(Object.values(cost).every(Number.isFinite));
      const sum = Object.values(cost).reduce((a, b) => a + b, 0);
      assert.ok(sum > previous);
      previous = sum;
      close(G.renovationFactor(s, id), 1 + level * 0.03);
    }
    fund(s);
    s = action(s, (x) => G.renovate(x, id));
    assert.equal(G.renovationLevel(s, id), 60);
    assert.equal(G.renovate(s, id), s);
  }
});

test('lumber, forge and shrine renovations accelerate the matching workshop, preserve output and bill', () => {
  for (const [id, building] of [
    ['boards', 'lumber'],
    ['steel', 'forge'],
    ['runes', 'shrine'],
  ]) {
    let s = town();
    const before = G.workDuration(s, id),
      bill = G.processingBill(s, id),
      output = G.processingOutput(s, id);
    s.civic.renovations[building] = 10;
    const duration = G.workDuration(s, id);
    assert.ok(duration < before);
    assert.deepEqual(G.processingBill(s, id), bill);
    assert.equal(G.processingOutput(s, id), output);
    s = G.toggleWork(s, id, true);
    const stockBefore = stock(s),
      after = advance(s, duration);
    assert.equal(after.economy.crafted[id], output);
    charge(s, after, bill.cost);
    for (const m of G.MATERIAL_IDS)
      close(
        after.world.materials[m],
        stockBefore.materials[m] -
          (bill.materials[m] || 0) +
          (m === id ? output : 0),
      );
  }
});

test('six recruitment stages publish exact weights and deterministic generation honors every cumulative boundary', () => {
  const rows = [
    [65, 29, 6, 0, 0],
    [45, 32, 20, 3, 0],
    [32, 33, 26, 8, 1],
    [20, 28, 35, 15, 2],
    [12, 23, 38, 24, 3],
    [6, 17, 39, 33, 5],
  ];
  for (let stage = 0; stage < 6; stage++) {
    const s = stageState(stage);
    assert.equal(G.recruitmentStage(s), stage);
    assert.deepEqual(G.recruitmentWeights(s), rows[stage]);
    assert.equal(
      rows[stage].reduce((a, b) => a + b, 0),
      100,
    );
    let start = 0;
    for (let star = 1; star <= 5; star++) {
      const weight = rows[stage][star - 1];
      if (weight) {
        for (const q of [
          (start + 0.001) / 100,
          (start + weight - 0.001) / 100,
        ]) {
          const state = copy(s);
          state.rng = seedForQ(q);
          assert.equal(G.makeApplicant(state, 'rhea').quality, star);
        }
      }
      start += weight;
    }
  }
});

test('locked five-star pity saturates at 79 and only the first boss enables the guaranteed next candidate', () => {
  for (const stage of [0, 1]) {
    const s = stageState(stage);
    s.guild.fiveStarMisses = 79;
    for (let i = 0; i < 100; i++) {
      const h = G.makeApplicant(s, 'rhea');
      assert.ok(h.quality <= (stage ? 4 : 3));
      assert.equal(s.guild.fiveStarMisses, 79);
    }
    s.cleared = [0];
    const h = G.makeApplicant(s, 'rhea');
    assert.equal(h.quality, 5);
    assert.equal(s.guild.fiveStarMisses, 0);
  }
});

test('sequential batch hard pity coexists with fourth-batch three-star minimum and does not reroll other fields', () => {
  for (const misses of [77, 78, 79]) {
    const s = town();
    s.guild.rolls = 3;
    s.guild.fiveStarMisses = misses;
    s.rng = 123456789;
    const after = action(s, G.refreshApplicants);
    assert.ok(after.guild.applicants.some((h) => h.quality === 5));
    assert.ok(after.guild.applicants[0].quality >= 3);
    assert.ok(after.guild.fiveStarMisses <= 2);
  }
  const a = stageState(2),
    b = copy(a);
  a.rng = b.rng = seedForQ(0.2);
  a.guild.fiveStarMisses = 0;
  b.guild.fiveStarMisses = 79;
  const ordinary = G.makeApplicant(a, 'rhea'),
    pity = G.makeApplicant(b, 'rhea');
  assert.deepEqual({ ...ordinary, quality: 5 }, pity);
  assert.equal(a.rng, b.rng);
});

test('paid refresh charges one invitation plus gold; free refresh charges neither and waiting does not reroll', () => {
  const s = town();
  G.ensureApplicants(s);
  s.guild.refreshAt = s.time + 600;
  const before = copy(s),
    cost = G.refreshCost(s),
    paid = action(s, G.refreshApplicants);
  charge(before, paid, cost);
  assert.equal(paid.civic.invitations, s.civic.invitations - 1);
  const waiting = advance(paid, 600);
  assert.deepEqual(waiting.guild.applicants, paid.guild.applicants);
  const free = action(waiting, G.refreshApplicants);
  assert.equal(free.civic.invitations, waiting.civic.invitations);
  charge(waiting, free, {});
});

test('failed refresh has no letter, gold, candidate, roll-counter or RNG side effects', () => {
  for (const reason of ['letters', 'gold', 'unbuilt']) {
    const s = town();
    s.guild.refreshAt = 600;
    if (reason === 'letters') s.civic.invitations = 0;
    if (reason === 'gold') s.resources.gold = 0;
    if (reason === 'unbuilt') s.buildings.tavern = 0;
    const before = copy(s);
    assert.equal(G.refreshApplicants(s), s);
    assert.deepEqual(s, before);
  }
});

test('successful expeditions deliver one capped invitation; failures and recalls deliver none', () => {
  for (const cap of [3, 200]) {
    let s = town();
    s.civic.invitations = cap;
    s = action(s, (x) => G.expedition(x, 0, 'supply'));
    assert.equal(s.expedition.success, true);
    const after = advance(s, Math.ceil(s.expedition.end - s.time));
    assert.equal(after.civic.invitations, Math.min(200, cap + 1));
    const recalled = action(s, G.recallExpedition);
    assert.equal(advance(recalled, 1000).civic.invitations, cap);
  }
  let failed;
  for (let seed = 1; seed < 100; seed++) {
    const s = town();
    s.rng = seed;
    for (const h of s.heroes) h.level = 1;
    const x = G.expedition(s, 5, 'frontier');
    if (x.expedition && !x.expedition.success) {
      failed = x;
      break;
    }
  }
  assert.ok(failed);
  const after = advance(failed, Math.ceil(failed.expedition.end - failed.time));
  assert.equal(after.civic.invitations, failed.civic.invitations);
});

test('low-star training factors affect exact bills while trained low stars retain early immediate combat value', () => {
  const s = town(),
    h = s.heroes[0];
  h.level = 5;
  h.origin = '初代同行者';
  h.talent = 'veteran';
  for (let q = 1; q <= 5; q++) {
    h.quality = q;
    assert.deepEqual(G.trainCost(h), {
      gold: Math.ceil((30 + 5 ** 2.1 * 20) * G.TRAINING_FACTORS[q - 1]),
      food: Math.ceil(70 * G.TRAINING_FACTORS[q - 1]),
    });
  }
  const low = { ...h, quality: 1, level: 6 },
    freshGold = { ...h, quality: 5, level: 1 };
  assert.ok(
    G.individualStats(s, low).attack > G.individualStats(s, freshGold).attack,
  );
  assert.ok(
    G.individualStats(s, { ...low, quality: 5 }).attack >
      G.individualStats(s, low).attack,
  );
});

test('experience factors compose correctly with tavern renovations and lessons for frontline and academy', () => {
  for (let q = 1; q <= 5; q++) {
    const s = town();
    for (const h of s.heroes) {
      h.quality = q;
      h.xp = 0;
    }
    s.civic.renovations.tavern = 10;
    s.civic.buffs.lessons = 600;
    const expected =
      10 *
      (1 + s.buildings.tavern * 0.1) *
      G.educationMultiplier(s) *
      1.3 *
      1.4 *
      G.LEARNING_FACTORS[q - 1];
    G.awardXP(s, 10);
    close(s.heroes[0].xp, expected);
    close(s.heroes[5].xp, expected * 0.4);
    let academy = town();
    for (const h of academy.heroes) {
      h.quality = q;
      h.xp = 0;
    }
    academy.civic.renovations.tavern = 10;
    academy.civic.buffs.lessons = 600;
    academy = G.assignDuty(academy, 'academy', academy.heroes[4].id);
    const xp =
      (4 + academy.heroes[4].level * 0.5) *
      G.educationMultiplier(academy) *
      G.dutyMultiplier(academy, 'academy') *
      1.3 *
      1.4 *
      G.LEARNING_FACTORS[q - 1];
    const after = advance(academy, 10);
    close(after.heroes[5].xp, xp);
  }
});

test('discounted training uses credits first and records only newly debited ordinary stock', () => {
  const s = town();
  const h = s.heroes[4];
  s.civic.buffs.provisions = 600;
  s.civic.trainingCredit = { gold: 50, food: 7 };
  const gross = G.trainCost(h),
    bill = G.payableTrainCost(s, h);
  assert.equal(bill.gold, Math.max(0, gross.gold - 50));
  assert.equal(bill.food, Math.max(0, Math.ceil(gross.food * 0.75) - 7));
  const after = action(s, (x) => G.train(x, h.id));
  charge(s, after, bill);
  assert.deepEqual(after.heroes[4].trainingInvestment, bill);
  assert.equal(after.civic.trainingCredit.gold, Math.max(0, 50 - gross.gold));
  assert.equal(
    after.civic.trainingCredit.food,
    Math.max(0, 7 - Math.ceil(gross.food * 0.75)),
  );
});

test('retirement transfers eighty percent of actual new training payments as credit without resource refunds', () => {
  let s = town();
  const id = s.heroes[4].id;
  for (let i = 0; i < 2; i++) s = G.train(s, id);
  const investment = s.heroes.find((h) => h.id === id).trainingInvestment,
    before = stock(s),
    after = action(s, (x) => G.dismissHero(x, id));
  assert.deepEqual(stock(after), before);
  assert.deepEqual(after.civic.trainingCredit, {
    gold: Math.floor(investment.gold * 0.8),
    food: Math.floor(investment.food * 0.8),
  });
  assert.equal(G.dismissHero(after, id), after);
  const old = town(),
    retired = action(old, (x) => G.dismissHero(x, old.heroes[4].id));
  assert.deepEqual(retired.civic.trainingCredit, { gold: 0, food: 0 });
});

test('zero-cash credited training cannot recursively mint retirement credits and credits do not buy other goods', () => {
  const s = town();
  s.civic.trainingCredit = { gold: 1e6, food: 1e6 };
  s.resources.gold = 0;
  s.resources.food = 0;
  const h = s.heroes[4],
    before = stock(s),
    trained = action(s, (x) => G.train(x, h.id));
  assert.deepEqual(stock(trained), before);
  assert.deepEqual(trained.heroes[4].trainingInvestment, { gold: 0, food: 0 });
  const credits = copy(trained.civic.trainingCredit),
    retired = action(trained, (x) => G.dismissHero(x, h.id));
  assert.deepEqual(retired.civic.trainingCredit, credits);
  assert.equal(G.renovate(retired, 'tavern'), retired);
});

test('failed training preserves accumulated credit and actual investment records', () => {
  for (const blocked of ['cash', 'cap', 'away']) {
    let s = town();
    const h = s.heroes[0];
    s.civic.trainingCredit = { gold: 1, food: 1 };
    if (blocked === 'cash') s.resources.gold = 0;
    if (blocked === 'cap') h.level = 40;
    if (blocked === 'away') s = G.expedition(s, 0, 'supply');
    const before = copy(s);
    assert.equal(G.train(s, h.id), s);
    assert.deepEqual(s, before);
  }
});

test('all temporary visitor choices charge displayed stage-scaled costs, last 600 seconds and do not set permanent flags', () => {
  for (const [id, index, buff] of [
    ['laborers', 0, 'hands'],
    ['laborers', 1, 'provisions'],
    ['master_artisan', 0, 'artisan'],
    ['field_instructor', 0, 'lessons'],
  ]) {
    const s = eventState(id),
      choice = G.visitorChoice(s, index),
      oldFlags = copy(s.flags),
      after = action(s, (x) => G.chooseEvent(x, index));
    charge(s, after, choice.cost);
    assert.equal(after.civic.buffs[buff], s.time + 600);
    assert.deepEqual(after.flags, oldFlags);
    assert.equal(G.chooseEvent(after, index), after);
    assert.ok(G.buffActive(after, buff));
  }
});

test('same temporary buff refreshes expiry without multiplying its effect and only boosts its named sources', () => {
  let s = town();
  s.buildings.warehouse = 8;
  fund(s);
  for (const k of keys) s = G.assign(s, k, 1);
  const base = G.production(s);
  s = eventState('laborers', s);
  s = G.chooseEvent(s, 0);
  for (const k of keys)
    close(
      G.production(s)[k],
      base[k] * (['wood', 'food', 'stone'].includes(k) ? 1.25 : 1),
    );
  s = advance(s, 100);
  s = eventState('laborers', s);
  const before = G.production(s),
    after = action(s, (x) => G.chooseEvent(x, 0));
  assert.equal(after.civic.buffs.hands, 700);
  assert.deepEqual(G.production(after), before);
  const expired = advance(after, 600);
  assert.ok(!G.buffActive(expired, 'hands'));
  assert.deepEqual(G.production(expired), base);
});

test('buff expiry boundaries use game time consistently in production, displayed next-second ledger and pause', () => {
  let s = town();
  s = G.assign(s, 'wood', 1);
  s.resources.wood = 0;
  s.time = 599;
  s.civic.buffs.hands = 600;
  assert.ok(G.buffActive(s, 'hands'));
  const ledger = G.netProduction(s),
    after = advance(s, 1);
  assert.equal(G.buffActive(after, 'hands'), false);
  close(ledger.wood, after.resources.wood - s.resources.wood, 'expiry ledger');
  s.paused = true;
  assert.equal(G.advance(s, 600), s);
});

test('one-shot offline, fractional online and intermediate saves agree through buff expiry and parallel workshop/academy ticks', () => {
  let s = town();
  s.civic.buffs = { hands: 600, artisan: 600, lessons: 600, provisions: 600 };
  s.civic.renovations = { lumber: 2, tavern: 3 };
  s = G.assign(s, 'wood', 1);
  s.resources.wood = 0;
  s = G.toggleWork(s, 'boards', true);
  s = G.assignDuty(s, 'academy', s.heroes[4].id);
  const whole = advance(s, 620);
  let parts = s;
  for (let i = 0; i < 1240; i++) {
    parts = G.advance(parts, 0.5);
    if (i % 53 === 0) parts = reload(parts);
  }
  assert.deepEqual(parts, whole);
});

test('visitor gear is fixed on preparation, inspection and reload; price and tier never reroll', () => {
  const s = eventState('equipment_peddler'),
    offer = copy(s.civic.offer),
    rng = s.rng,
    serial = s.guild.serial,
    crafts = s.guild.crafts;
  assert.ok(offer);
  assert.equal(offer.gear.tier, G.gearTier(s));
  assert.ok(G.recipeDiscovered(s, offer.gear.recipe));
  for (let i = 0; i < 5; i++) {
    G.prepareVisitor(s);
    G.visitorChoice(s, 0);
    assert.deepEqual(reload(s), s);
  }
  assert.deepEqual(s.civic.offer, offer);
  assert.equal(s.rng, rng);
  assert.equal(s.guild.serial, serial);
  assert.equal(s.guild.crafts, crafts);
});

test('buying the fixed visitor item pays once, preserves hero equipment and craft pity, and leaves existing combat unchanged', () => {
  let s = town();
  s.guild.depths[0] = 5;
  s = G.startBattle(s, 0);
  assert.ok(s.battle);
  s = eventState('equipment_peddler', s);
  s.buildings.warehouse = 12;
  fund(s);
  const quote = copy(s.civic.offer),
    battle = copy(s.battle),
    gear = s.heroes.map((h) => copy(h.equipment)),
    crafts = s.guild.crafts;
  const after = action(s, (x) => G.chooseEvent(x, 0));
  charge(s, after, quote.cost);
  assert.deepEqual(after.guild.inventory.at(-1), quote.gear);
  assert.deepEqual(
    after.heroes.map((h) => h.equipment),
    gear,
  );
  assert.equal(after.guild.crafts, crafts);
  assert.deepEqual(after.battle, battle);
  assert.equal(after.civic.offer, null);
  assert.equal(G.chooseEvent(after, 0), after);
  const command = G.commandFor(s.party[0], 'attack');
  assert.deepEqual(
    G.combat(s, command).battle,
    G.combat(after, command).battle,
  );
});

test('unaffordable or full-inventory visitor purchase is atomic; declining and offline waiting do not award gear', () => {
  for (const reason of ['cash', 'full']) {
    const s = eventState('equipment_peddler');
    if (reason === 'cash') s.resources.gold = 0;
    else
      while (s.guild.inventory.length < G.INVENTORY_CAP)
        s.guild.inventory.push({
          id: 'gear-' + ++s.guild.serial,
          recipe: 'blade',
          tier: 1,
          rarity: 1,
          affix: 0,
          upgrade: 0,
        });
    const before = copy(s);
    assert.ok(G.eventChoiceReason(s, 0));
    assert.equal(G.chooseEvent(s, 0), s);
    assert.deepEqual(s, before);
    const waiting = advance(s, 1000);
    assert.deepEqual(waiting.civic.offer, s.civic.offer);
    assert.deepEqual(waiting.guild.inventory, s.guild.inventory);
    const declined = action(s, G.declineVisitor);
    assert.equal(declined.civic.offer, null);
    assert.deepEqual(declined.guild.inventory, s.guild.inventory);
  }
});

test('new visitor indices append to old events and real arrival prepares the displayed equipment before any choice', () => {
  assert.deepEqual(
    G.EVENTS.slice(0, 6).map((e) => e.id),
    [
      'refugees',
      'merchant',
      'waterwheel',
      'grave',
      'passing_caravan',
      'scrap_hunter',
    ],
  );
  assert.deepEqual(
    G.EVENTS.slice(6).map((e) => e.id),
    ['laborers', 'master_artisan', 'field_instructor', 'equipment_peddler'],
  );
  let arrival;
  for (let seed = 1; seed <= 150; seed++) {
    const s = town();
    s.rng = seed;
    s.nextEventAt = 1;
    s.eventDone = ['refugees'];
    const next = G.advance(s, 1);
    if (next.event === 9) {
      arrival = next;
      break;
    }
  }
  assert.ok(
    arrival,
    'bounded deterministic search finds an actual equipment visitor',
  );
  assert.ok(arrival.civic.offer);
  assert.deepEqual(reload(arrival), arrival);
});

test('malformed civic object shapes, foreign keys, invalid times, unbuilt renovations and forged training balances reject', () => {
  const cases = [
    (s) => delete s.civic,
    (s) => (s.civic.buffs = []),
    (s) => (s.civic.renovations = []),
    (s) => (s.civic.buffs.toString = 100),
    (s) => (s.civic.buffs.forever = 100),
    (s) => (s.civic.trainingCredit.extra = 1),
    (s) => (s.civic.invitations = 201),
    (s) => (s.civic.invitations = 0.5),
    (s) => (s.civic.buffs.hands = s.time + 601),
    (s) => (s.civic.buffs.hands = -1),
    (s) => (s.civic.renovations.fire = 1),
    (s) => (s.civic.renovations.lumber = 61),
    (s) => {
      s.buildings.lumber = 0;
      s.civic.renovations.lumber = 1;
    },
    (s) => (s.civic.trainingCredit.food = -1),
    (s) => (s.heroes[0].trainingInvestment = { gold: -1, food: 0 }),
  ];
  for (let i = 0; i < cases.length; i++) {
    const s = town();
    cases[i](s);
    assert.throws(() => reload(s), undefined, 'malformed civic case ' + i);
  }
});
