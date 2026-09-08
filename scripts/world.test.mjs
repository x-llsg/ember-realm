import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as G from '../lib/realm.ts';

// Constructed unit fixtures, plus preserved v4 regression inputs.
// These checks do not demonstrate a legal playthrough or acquisition of resources.
const legacyFixtures = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v4-campaign.json.gz', import.meta.url))).toString('utf8'));
const clone = value => structuredClone(value);
const stocks = s => ({ resources: clone(s.resources), materials: clone(s.world.materials) });
const techAtRank = [
  [], ['settlement'], ['settlement', 'metallurgy', 'runecraft'],
  ['settlement', 'metallurgy', 'runecraft', 'citadel'],
  ['settlement', 'metallurgy', 'runecraft', 'citadel', 'dragoncraft', 'infernalcraft'],
  G.TECHNOLOGIES.map(t => t.id),
];
function stage(rank = 5) {
  const s = G.freshState(1357911);
  s.world.tech = [...techAtRank[rank]];
  s.guild.depths = [5, 5, 5, 5, 5, 5];
  s.cleared = rank >= 3 ? [0, 1, 2, 3, 4] : [];
  s.buildings.fire = 1; s.buildings.hut = 2; s.buildings.tavern = 1;
  s.buildings.warehouse = G.buildingLimit(s, 'warehouse');
  s.buildings.lumber = s.buildings.forge = s.buildings.shrine = 1;
  s.population = 0; s.jobs = Object.fromEntries(Object.keys(s.jobs).map(k => [k, 0]));
  s.research = ['baskets', 'preservation'];
  s.resources = Object.fromEntries(Object.keys(s.resources).map(k => [k, G.capacity(s, k)]));
  s.world.materials = Object.fromEntries(G.MATERIAL_IDS.map(k => [k, 0]));
  s.event = null; s.nextEventAt = 1e8; s.order.enabled = false;
  return s;
}
function workFixture(recipe, batches = 5) {
  const s = stage();
  s.resources = Object.fromEntries(Object.keys(s.resources).map(k => [k, 0]));
  for (const [key, cost] of Object.entries(recipe.cost)) s.resources[key] = cost * batches;
  for (const [key, cost] of Object.entries(recipe.materials)) s.world.materials[key] = cost * batches;
  s.world.work[recipe.id] = true;
  return s;
}
function expectedAfter(s, recipe, batches) {
  const expected = stocks(s);
  for (const [key, cost] of Object.entries(recipe.cost)) expected.resources[key] -= cost * batches;
  for (const [key, cost] of Object.entries(recipe.materials)) expected.materials[key] -= cost * batches;
  expected.materials[recipe.id] += recipe.output * batches;
  return expected;
}

for (const recipe of G.WORK_RECIPES) {
  test(`${recipe.id}: consumes a complete dynamic recipe atomically only on batch completion`, () => {
    const s = workFixture(recipe), before = stocks(s), duration = G.workDuration(s, recipe.id);
    assert.ok(recipe.cost.food > 0, 'current recipe includes food; all recipe costs are read dynamically');
    G.worldTick(s, duration - 1);
    assert.deepEqual(stocks(s), before);
    assert.equal(s.world.workProgress[recipe.id], duration - 1);
    G.worldTick(s);
    const original = workFixture(recipe);
    assert.deepEqual(stocks(s), expectedAfter(original, recipe, 1));
    assert.equal(s.world.workProgress[recipe.id], 0);
  });

  test(`${recipe.id}: shortage of each ordinary input or regional material consumes nothing`, () => {
    for (const [group, costs] of [['resources', recipe.cost], ['materials', recipe.materials]]) {
      for (const [key, cost] of Object.entries(costs)) {
        const s = workFixture(recipe);
        (group === 'resources' ? s.resources : s.world.materials)[key] = cost - 1;
        s.world.workProgress[recipe.id] = 2;
        const before = stocks(s);
        assert.notEqual(G.workReason(s, recipe.id), '', `${JSON.stringify(group)}.${key}`);
        G.worldTick(s, G.workDuration(s, recipe.id) * 10);
        assert.deepEqual(stocks(s), before, `${JSON.stringify(group)}.${key} shortage partially spent a batch`);
        assert.equal(s.world.workProgress[recipe.id], 2, 'blocked time is not accrued and prior progress is retained');
      }
    }
  });

  test(`${recipe.id}: full product warehouse consumes nothing; the final free batch does not overflow`, () => {
    const s = workFixture(recipe), capacity = G.materialCapacity(s, recipe.id);
    s.world.materials[recipe.id] = capacity;
    const full = stocks(s);
    G.worldTick(s, G.workDuration(s, recipe.id) * 10);
    assert.deepEqual(stocks(s), full);
    s.world.materials[recipe.id] = capacity - recipe.output;
    const expected = expectedAfter(s, recipe, 1);
    G.worldTick(s, G.workDuration(s, recipe.id) * 10);
    assert.deepEqual(stocks(s), expected);
    assert.equal(s.world.materials[recipe.id], capacity);
    const after = stocks(s);
    G.worldTick(s, G.workDuration(s, recipe.id) * 10);
    assert.deepEqual(stocks(s), after);
  });

  test(`${recipe.id}: multi-batch processing spends only the number of fully affordable batches`, () => {
    const s = workFixture(recipe, 2), expected = expectedAfter(s, recipe, 2);
    G.worldTick(s, G.workDuration(s, recipe.id) * 10);
    assert.deepEqual(stocks(s), expected);
    assert.equal(s.world.workProgress[recipe.id], 0);
    assert.ok(Object.values(s.resources).every(x => x >= 0));
    assert.ok(Object.values(s.world.materials).every(x => x >= 0));
  });

  test(`${recipe.id}: upgrading its production building improves actual output per elapsed time`, () => {
    const slow = workFixture(recipe, 10), fast = clone(slow);
    const building = recipe.id === 'boards' ? 'lumber' : recipe.id === 'steel' ? 'forge' : 'shrine';
    fast.buildings[building] = 5;
    const slowSeconds = G.workDuration(slow, recipe.id), fastSeconds = G.workDuration(fast, recipe.id);
    assert.ok(fastSeconds < slowSeconds);
    G.worldTick(slow, fastSeconds); G.worldTick(fast, fastSeconds);
    assert.equal(slow.world.materials[recipe.id], 0);
    assert.equal(fast.world.materials[recipe.id], recipe.output);
    assert.deepEqual(stocks(fast), expectedAfter(workFixture(recipe, 10), recipe, 1));
  });

  test(`${recipe.id}: expansion at levels 4, 7 and 10 increases throughput without free inputs`, () => {
    const building = recipe.id === 'boards' ? 'lumber' : recipe.id === 'steel' ? 'forge' : 'shrine';
    for (const level of [4, 7, 10]) {
      const upgraded = workFixture(recipe, 20);
      upgraded.buildings[building] = level;
      const previous = clone(upgraded); previous.buildings[building]--;
      assert.equal(G.workStations(upgraded, recipe.id), G.workStations(previous, recipe.id) + 1);
      assert.ok(G.workDuration(upgraded, recipe.id) < G.workDuration(previous, recipe.id));
      const expected = expectedAfter(upgraded, recipe, 5);
      G.worldTick(upgraded, G.workDuration(upgraded, recipe.id) * 5);
      assert.deepEqual(stocks(upgraded), expected);
    }
  });
}

test('online single seconds, fractional frames, and offline advancement produce identical world and inventory', () => {
  const s = stage();
  s.world.work = Object.fromEntries(G.WORK_IDS.map(id => [id, true]));
  s.world.materials.timber = s.world.materials.ore = s.world.materials.essence = 100;
  s.world.workProgress = { boards: 7, steel: 11, runes: 13 };
  // Real production runs before work; enough workers and buildings to exercise that ordering.
  s.population = 6; s.jobs = { wood: 1, food: 1, stone: 1, gold: 1, iron: 1, crystal: 1 };
  s.buildings.quarry = s.buildings.market = s.buildings.farm = 1;
  for (const key of Object.keys(s.resources)) s.resources[key] = 1000;
  const before = clone(s), offline = G.advance(s, 120);
  assert.deepEqual(s, before, 'advance must not mutate its argument');
  let online = s, frames = s;
  for (let n = 0; n < 120; n++) online = G.advance(online, 1);
  for (let n = 0; n < 480; n++) frames = G.advance(frames, 0.25);
  assert.deepEqual(online, offline);
  assert.deepEqual(frames, offline);
});

for (let rank = 0; rank <= 5; rank++) {
  test(`rank ${rank}: every available building upgrade fits current-stage maximum ordinary and material storage`, () => {
    const s = stage(rank);
    for (const b of G.BUILDINGS) {
      const limit = G.buildingLimit(s, b.id);
      for (let level = 0; level < limit; level++) {
        const candidate = clone(s); candidate.buildings[b.id] = level;
        // Warehouse construction must fit its own pre-upgrade capacity to avoid a bootstrap lock.
        if (b.id !== 'warehouse') candidate.buildings.warehouse = G.buildingLimit(s, 'warehouse');
        for (const [key, amount] of Object.entries(G.buildingCost(candidate, b.id)))
          assert.ok(amount <= G.capacity(candidate, key), `${b.id} ${level}→${level + 1}: ${key} ${amount} > ${G.capacity(candidate, key)}`);
        for (const [key, amount] of Object.entries(G.buildingMaterialCost(candidate, b.id)))
          assert.ok(amount <= G.materialCapacity(candidate, key), `${b.id} ${level}→${level + 1}: ${key} material ${amount} exceeds stage capacity`);
      }
    }
  });
}

test('each town technology bill fits the maximum warehouses available before its rank increase', () => {
  const previousRank = { settlement: 0, metallurgy: 1, runecraft: 1, citadel: 2, dragoncraft: 3, infernalcraft: 3, mythic: 4 };
  for (const t of G.TECHNOLOGIES) {
    const s = stage(previousRank[t.id]);
    for (const [key, amount] of Object.entries(t.cost))
      assert.ok(amount <= G.capacity(s, key), `${t.id}: ${key} ${amount} exceeds pre-research capacity ${G.capacity(s, key)}`);
    for (const [key, amount] of Object.entries(t.materials))
      assert.ok(amount <= G.materialCapacity(s, key), `${t.id}: material ${key} exceeds pre-research capacity`);
  }
});

const oldCases = [
  ...legacyFixtures.beforeBattles.map((s, i) => [`before boss ${i}`, s]),
  ...legacyFixtures.afterVictories.map((s, i) => [`after boss ${i}`, s]),
  ['after rebuild', legacyFixtures.afterRebuild], ['completed', legacyFixtures.completed],
];
for (const [label, old] of oldCases) test(`v4 migration preserves investment and progress: ${label}`, () => {
  assert.equal(old.version, 4);
  const raw = JSON.stringify(old), migrated = G.decodeSave(raw);
  assert.equal(migrated.version, 10);
  for (const key of ['resources', 'legacyStock', 'buildings', 'heroes', 'party', 'cleared', 'projects', 'research', 'kit', 'rebuild'])
    assert.deepEqual(migrated[key], old[key], key);
  for (const key of ['inventory', 'dust', 'crafts', 'serial', 'doctrine', 'depths', 'progress', 'intel', 'outposts', 'applicants'])
    assert.deepEqual(migrated.guild[key], old.guild[key], `guild.${key}`);
  assert.equal(migrated.battle, null);
  assert.equal(JSON.stringify(old), raw, 'old fixture mutated');
  assert.deepEqual(G.decodeSave(JSON.stringify(migrated)), migrated);
});

test('v4 in-progress battle safely exits while retaining the resources already paid to start it', () => {
  const current = G.setPreparation(
    G.decodeSave(JSON.stringify(legacyFixtures.beforeBattles[5])),
    { element: 'physical' },
  );
  const started = G.startBattle(current, 5);
  assert.ok(started.battle, G.bossReason(current, 5));
  const legacy = clone(started); legacy.version = 4; delete legacy.world;
  const paid = clone(legacy.resources), people = clone(legacy.heroes), inventory = clone(legacy.guild.inventory);
  const migrated = G.decodeSave(JSON.stringify(legacy));
  assert.equal(migrated.battle, null);
  assert.deepEqual(migrated.resources, paid);
  assert.deepEqual(migrated.heroes, people);
  assert.deepEqual(migrated.guild.inventory, inventory);
  assert.deepEqual(G.decodeSave(JSON.stringify(migrated)), migrated);
});

test('v5 accepts nonlinear cleared ordering and preserves it through repeated save loads', () => {
  const cases = [
    [legacyFixtures.beforeBattles[3], [2]],
    [legacyFixtures.beforeBattles[5], [2, 0, 4, 1, 3]],
    [legacyFixtures.afterVictories[5], [2, 0, 4, 1, 3, 5]],
  ];
  for (const [base, order] of cases) {
    const legacy = clone(base); legacy.cleared = order;
    const first = G.decodeSave(JSON.stringify(legacy));
    assert.equal(first.version, 10);
    assert.deepEqual(first.cleared, order);
    const second = G.decodeSave(JSON.stringify(first)), third = G.decodeSave(JSON.stringify(second));
    assert.deepEqual(second, first); assert.deepEqual(third, second);
  }
});

test('illegal technology skips and unknown IDs never spend any ordinary or regional inventory', () => {
  const camp = G.freshState(987654321);
  camp.buildings.warehouse = 10;
  camp.resources = Object.fromEntries(Object.keys(camp.resources).map(k => [k, G.capacity(camp, k)]));
  camp.world.materials = Object.fromEntries(G.MATERIAL_IDS.map(k => [k, G.materialCapacity(camp, k)]));
  // Even abundant stocks cannot substitute for progression prerequisites.
  for (const id of [...G.TECHNOLOGIES.map(t => t.id), 'unknown-technology']) {
    const before = clone(camp);
    assert.notEqual(G.technologyReason(camp, id), '');
    assert.equal(G.studyTechnology(camp, id), camp);
    assert.deepEqual(camp, before);
  }
  const village = stage(1);
  for (const id of ['citadel', 'dragoncraft', 'infernalcraft', 'mythic']) {
    const before = clone(village);
    assert.notEqual(G.technologyReason(village, id), '');
    assert.equal(G.studyTechnology(village, id), village);
    assert.deepEqual(village, before);
  }
});

test('fully affordable technology still cannot bypass its missing depth or boss prerequisite', () => {
  const previousRank = { settlement: 0, metallurgy: 1, runecraft: 1, citadel: 2, dragoncraft: 3, infernalcraft: 3, mythic: 4 };
  for (const t of G.TECHNOLOGIES) {
    const s = stage(previousRank[t.id]);
    s.world.materials = Object.fromEntries(G.MATERIAL_IDS.map(k => [k, G.materialCapacity(s, k)]));
    // Keep the previous rank and available capacity; remove only the next milestone.
    if (t.requires.depth) {
      s.guild.depths[t.requires.depth.region] = t.requires.depth.value - 1;
      s.cleared = s.cleared.filter(r => r !== t.requires.depth.region);
    }
    if (t.requires.bossAny) s.cleared = s.cleared.filter(r => !t.requires.bossAny.includes(r));
    if (t.requires.bossAll) s.cleared = s.cleared.filter(r => r !== t.requires.bossAll[0]);
    assert.ok(G.canPay(s, t.cost), `${t.id} ordinary bill must be affordable`);
    assert.ok(G.canAffordMaterials(s, t.materials), `${t.id} material bill must be affordable`);
    assert.equal(G.capacityReason(s, t.cost), '');
    assert.equal(G.materialReason(s, t.materials), '');
    const prerequisite = G.technologyPrerequisiteReason(s, t.id);
    assert.notEqual(prerequisite, '', `${t.id} must still lack a progress prerequisite`);
    assert.equal(G.technologyReason(s, t.id), prerequisite);
    const before = clone(s);
    assert.equal(G.studyTechnology(s, t.id), s);
    assert.deepEqual(s, before);
  }
});
