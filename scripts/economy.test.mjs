import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/realm.ts';
import * as L from '../lib/game.ts';

const resources = Object.keys(G.RESOURCE_NAMES);
// Synthetic unit fixtures isolate economy rules. These assigned chapter/building
// states are not evidence of a legal playthrough; realm.test.mjs owns that check.
// Keep this suite independent of generated, potentially older-version fixtures.
function unitState(chapters = 5) {
  const s = G.freshState(1);
  s.assigned = true;
  s.cleared = Array.from({ length: chapters }, (_, r) => r);
  for (const r of s.cleared) {
    s.survey[r] = G.REGIONS[r].thresholds[1];
    s.projects[G.PROJECTS[r].id] = G.PROJECTS[r].choices[0].id;
    s.guild.depths[r] = 5;
    s.guild.intel[r] = 100;
  }
  // A pre-boss fixture may already be a village after reaching the forest.
  if (!chapters) s.guild.depths[0] = 1;
  delete s.world;
  G.migrateWorld(s);
  s.research.push('baskets');
  for (const b of G.BUILDINGS) s.buildings[b.id] = G.buildingLimit(s, b.id);
  s.population = G.populationCap(s);
  for (const id of G.MATERIAL_IDS) {
    const work = G.WORK_RECIPES.find((r) => r.id === id);
    const available = work ? s.world.tech.includes(work.tech) : G.regionOpen(s, G.REGION_MATERIALS.indexOf(id));
    s.world.materials[id] = available ? G.materialCapacity(s, id) : 0;
  }
  s.heroes = ['rhea', 'finn', 'luna', 'kael'].map((role) => {
    const h = G.makeApplicant(s, role);
    h.level = Math.min(12, G.levelCap(s));
    return h;
  });
  s.party = s.heroes.map((h) => h.id);
  s.kit = Math.min(5, chapters);
  for (const k of resources) s.resources[k] = G.capacity(s, k);
  return quiet(s);
}
function stageState(rank) {
  const s = G.freshState(1);
  s.buildings.fire = 1;
  s.buildings.tavern = 1;
  const depths = [
    [0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0], [2, 1, 1, 0, 0, 0],
    [2, 5, 1, 0, 0, 0], [2, 5, 1, 2, 2, 0], [2, 5, 1, 5, 5, 0],
  ];
  s.guild.depths = [...depths[rank]];
  s.cleared = rank >= 5 ? [1, 3, 4] : rank >= 3 ? [1] : [];
  for (const r of s.cleared) {
    s.survey[r] = G.REGIONS[r].thresholds[1];
    s.projects[G.PROJECTS[r].id] = G.PROJECTS[r].choices[0].id;
  }
  delete s.world;
  G.migrateWorld(s);
  assert.equal(G.townRank(s), rank);
  // The finite, rank-0 baskets research is an explicit storage investment.
  if (rank > 0) s.research.push('baskets');
  s.buildings.warehouse = G.buildingLimit(s, 'warehouse');
  G.validateWorld(s);
  return s;
}
const base = () => unitState();
function quiet(s) {
  for (const k of resources) s.jobs[k] = 0;
  s.order.enabled = false;
  s.expedition = null;
  s.recoveryUntil = 0;
  s.event = 0;
  return s;
}
test('opening gathering builds the two camp warehouses, then progression stops expansion', () => {
  // The separate onboarding suite legally reaches this facility milestone.
  let s = G.freshState(1);
  for(const id of ['fire','hut','lumber','farm','quarry'])s.buildings[id]=1;
  s.assigned=true;s.chronicle=['fire','shelter','resident','workers'];
  const max = G.buildingLimit(s, 'warehouse');
  assert.equal(max, 2);
  for (let level = 0; level < max; level++) {
    const cost = G.buildingCost(s, 'warehouse');
    assert.equal(G.capacityReason(s, cost), '');
    let ticks = 0;
    while (!G.canPay(s, cost) && ticks++ < 3000) {
      s = G.gather(s, 'wood');
      s = G.gather(s, 'stone');
      s = G.advance(s, 1);
    }
    assert.ok(G.canPay(s, cost));
    s = G.build(s, 'warehouse');
    assert.equal(s.buildings.warehouse, level + 1);
  }
  assert.equal(G.build(s, 'warehouse'), s);
  assert.ok(G.BUILDINGS.filter((b) => !['fire', 'hut', 'warehouse', 'tavern'].includes(b.id)).every((b) => G.buildingLimit(s, b.id) <= 2));
});
test('every construction level and chapter cost fits reachable finite storage', () => {
  const s = unitState(5);
  for (const b of G.BUILDINGS)
    for (let level = 0; level < b.max; level++) {
      const quote = G.clone(s);
      quote.buildings[b.id] = level;
      assert.equal(
        G.capacityReason(s, G.buildingCost(quote, b.id)),
        '',
        b.id + level,
      );
    }
  for (const item of [...G.PROJECTS, ...G.RESEARCH, ...G.REBUILD])
    assert.equal(G.capacityReason(s, item.cost), '', item.id);
  // v5 hires actual applicants; the old six template prices are no longer used.
  s.cleared = [0, 1, 2, 3, 4, 5];
  const veteran = G.makeApplicant(s, 'ash');
  veteran.quality = 5;
  veteran.level = G.levelCap(s);
  veteran.mastery = 4;
  for (const [label, cost] of [
    ['recruitment', G.recruitmentCost(veteran)],
    ['training', G.trainCost(veteran)],
    ['mastery', G.masteryCost(veteran)],
    ['enhancement', G.enhancementCost({ tier: 6, upgrade: 7 })],
    ...G.RECIPES.map((r) => [r.id, G.recipeCost(s, r.id)]),
    ...Object.keys(s.guild.doctrine).map((id) => {
      s.guild.doctrine[id] = 9;
      return [id, G.doctrineCost(s, id)];
    }),
    ...G.REGIONS.map((_, r) => {
      s.guild.outposts[r] = 2;
      return [`outpost ${r}`, G.outpostCost(s, r)];
    }),
  ])
    assert.equal(G.capacityReason(s, cost), '', label);
});

test('each stage can afford every permitted building level, including each warehouse before expansion', () => {
  for (let rank = 0; rank <= 5; rank++) {
    const stage = stageState(rank);
    for (const b of G.BUILDINGS) {
      if (rank === 0 && b.chapter > 0) continue;
      const limit = G.buildingLimit(stage, b.id);
      for (let existing = 0; existing < limit; existing++) {
        const quote = G.clone(stage);
        quote.buildings[b.id] = existing;
        const label = `rank ${rank}, ${b.id} ${existing} -> ${existing + 1}`;
        // For a warehouse, quote now holds its PRE-purchase capacity.
        assert.equal(G.capacityReason(quote, G.buildingCost(quote, b.id)), '', label);
        const materials = G.buildingMaterialCost(quote, b.id);
        for (const [id, n] of Object.entries(materials)) {
          assert.ok(n <= G.materialCapacity(quote, id), `${label}: ${id} capacity`);
          if (id === 'boards') assert.ok(quote.world.tech.includes('settlement'), label);
          if (id === 'steel') assert.ok(quote.world.tech.includes('metallurgy'), label);
          if (id === 'runes') assert.ok(quote.world.tech.includes('runecraft'), label);
          if (id === 'star') assert.equal(G.regionOpen(quote, 5), true, label);
        }
        if (rank <= 1) {
          assert.equal(materials.steel, undefined, label);
          assert.equal(materials.runes, undefined, label);
        }
      }
    }
  }
});

test('each next-stage technology fits previous-stage stores and uses already reachable materials', () => {
  for (const tech of G.TECHNOLOGIES) {
    const s = stageState(tech.rank - 1);
    // The camp/village can advance forest routes without completing another technology.
    if (tech.rank >= 2) s.guild.depths[0] = Math.max(s.guild.depths[0], 2);
    const q = tech.requires;
    if (q.depth) s.guild.depths[q.depth.region] = Math.max(s.guild.depths[q.depth.region], q.depth.value);
    for (const r of q.bossAll || q.bossAny?.slice(0, 1) || []) {
      if (!s.cleared.includes(r)) s.cleared.push(r);
      s.guild.depths[r] = 5;
    }
    assert.equal(G.capacityReason(s, tech.cost), '', `${tech.id}: ordinary resource storage`);
    for (const [id, n] of Object.entries(tech.materials)) {
      assert.ok(n <= G.materialCapacity(s, id), `${tech.id}: ${id} material capacity`);
      const region = G.REGION_MATERIALS.indexOf(id);
      if (region >= 0) assert.equal(G.regionOpen(s, region), true, `${tech.id}: ${id} source is reachable first`);
      const recipe = G.WORK_RECIPES.find((r) => r.id === id);
      if (recipe) assert.ok(s.world.tech.includes(recipe.tech), `${tech.id}: ${id} can already be processed`);
    }
  }
});
test('three manual actions have independent timers and research changes actual amounts', () => {
  let s = G.freshState(1);s.buildings.fire=1;s.buildings.hut=1;s.chronicle=['workers'];
  s = G.advance(s, 3);
  const food = G.gather(s, 'food'),
    stone = G.gather(food, 'stone'),
    wood = G.gather(stone, 'wood');
  assert.equal(wood.resources.food - s.resources.food, 3);
  assert.equal(wood.resources.stone - s.resources.stone, 3);
  assert.ok(Math.abs(wood.resources.wood - s.resources.wood - 4) < 1e-9);
  assert.equal(G.gather(wood, 'wood'), wood);
  s.buildings.hut = 1;
  s.resources.wood = 75;
  s.resources.stone = 35;
  const studied = G.research(s, 'tools');
  assert.ok(studied.research.includes('tools'));
  assert.equal(G.manualAmount(studied, 'wood'), 6);
  assert.equal(G.manualAmount(studied, 'food'), 4);
});
test('full and partially full workshops never waste inputs; visible net rates match the tick', () => {
  const s = quiet(base());
  s.projects = {};
  s.jobs.iron = 2;
  s.jobs.crystal = 2;
  s.resources.iron = G.capacity(s, 'iron');
  s.resources.crystal = G.capacity(s, 'crystal');
  assert.deepEqual(G.advance(s, 1).resources, s.resources);
  s.resources.iron -= 0.03;
  s.resources.crystal -= 0.01;
  const p = G.netProduction(s),
    next = G.advance(s, 1);
  assert.ok(Math.abs(next.resources.iron - s.resources.iron - 0.03) < 1e-9);
  assert.ok(
    Math.abs(next.resources.crystal - s.resources.crystal - 0.01) < 1e-9,
  );
  for (const k of resources) {
    assert.ok(next.resources[k] <= G.capacity(s, k));
    assert.ok(Math.abs(next.resources[k] - s.resources[k] - p[k]) < 1e-8);
  }
  assert.ok(s.resources.wood - next.resources.wood < 0.6);
  assert.ok(s.resources.gold - next.resources.gold < 0.5);
});
test('market rejects overflowing trades and records successful transactions', () => {
  const s = quiet(base());
  s.resources.wood = G.capacity(s, 'wood');
  assert.ok(G.tradeReason(s, 'wood', true).includes('空位'));
  assert.equal(G.trade(s, 'wood', true), s);
  s.resources.wood = 0;
  s.resources.gold = G.capacity(s, 'gold');
  const bought = G.trade(s, 'wood', true);
  assert.equal(bought.resources.wood, 20);
  assert.ok(bought.log[0].text.includes('买入 20 木材'));
});
test('automatic grain procurement charges only for grain that fits', () => {
  let s = quiet(base());
  s.buildings.warehouse = 0;
  s.research = s.research.filter(
    (r) => !['baskets', 'preservation'].includes(r),
  );
  s.resources = { wood: 0, food: 85, stone: 0, gold: 100, iron: 0, crystal: 0 };
  s.projects.watch = 'forest';
  s = G.setOrder(s, {
    region: 1,
    route: 'survey',
    reserve: 20,
    autoBuy: true,
    enabled: true,
  });
  assert.ok(s.expedition);
  assert.equal(s.resources.gold, 79);
  assert.ok(s.log.some((l) => l.text.includes('买入 15 口粮')));
});
test('grain reserve can accumulate across affordable purchases below the gold cap', () => {
  let s = unitState(0);
  s.buildings.warehouse = 0;
  s.research = s.research.filter(
    (r) => !['baskets', 'preservation'].includes(r),
  );
  s.resources.food = 0;
  s.resources.gold = 100;
  s.jobs.gold = 6;
  s.jobs.food = 0;
  const exploredBefore = s.explored[0];
  s = G.setOrder(s, {
    region: 0,
    route: 'supply',
    reserve: 60,
    autoBuy: true,
    enabled: true,
  });
  s = G.advance(s, 120);
  assert.ok(s.explored[0] > exploredBefore);
  assert.ok(s.resources.gold <= 100);
});

test('all random outcomes retain clues, differ in loot, and survive save reload', () => {
  const reports = [];
  for (let outcome = 0; outcome < 4; outcome++) {
    let s = unitState(0);
    s.survey[0] = 0;
    s.projects = {};
    s.resources.food = G.capacity(s, 'food');
    s = G.expedition(s, 0, 'survey');
    const replay = G.decodeSave(JSON.stringify(s));
    assert.equal(replay.expedition.outcome, s.expedition.outcome);
    s.expedition.outcome = outcome;
    for (const k of resources) s.resources[k] = 0;
    s = G.advance(s, s.expedition.end - s.time);
    assert.equal(s.survey[0], 1);
    reports.push(s.lastExpedition.found);
    if (outcome === 2) assert.equal(s.recoveryUntil - s.time, 25);
  }
  assert.ok(reports[2].wood < reports[0].wood);
  assert.ok(reports[1].wood > reports[0].wood);
  assert.ok(reports[3].wood > reports[1].wood);
});
test('repeated visitors cannot be double-claimed or auto-claimed offline', () => {
  const s = quiet(base());
  s.event = G.EVENTS.findIndex((e) => e.id === 'passing_caravan');
  s.resources.gold = G.capacity(s, 'gold');
  assert.ok(G.eventChoiceReason(s, 0));
  assert.equal(G.chooseEvent(s, 0), s);
  s.resources.gold = 0;
  const taken = G.chooseEvent(s, 0);
  assert.equal(taken.resources.gold, 12);
  assert.equal(G.chooseEvent(taken, 0), taken);
  const waiting = G.advance(s, 28800);
  assert.equal(waiting.resources.gold, 0);
  assert.equal(waiting.event, s.event);
  const declined = G.declineVisitor(s);
  assert.equal(declined.event, null);
  assert.ok(declined.nextEventAt - s.time >= 90);
});
test('v1 and v2 surplus is conserved, capped, and reloadable; new production does not add sealed stock', () => {
  const old = L.freshState(0);
  for (const k of resources) old.resources[k] = 1e9;
  const migrated = G.decodeSave(JSON.stringify(old));
  for (const k of resources)
    assert.equal(migrated.resources[k] + migrated.legacyStock[k], 1e9);
  assert.deepEqual(G.decodeSave(JSON.stringify(migrated)), migrated);
  const v2 = base();
  v2.version = 2;
  // v2 stored six fixed identities, not v4 traveler IDs or guild records.
  v2.heroes = v2.heroes.map((h) => ({
    id: h.role,
    level: h.level,
    xp: h.xp,
    weapon: 0,
    armor: 0,
  }));
  v2.party = v2.heroes.map((h) => h.id);
  delete v2.guild;
  delete v2.world;
  delete v2.buildings.warehouse;
  for (const k of resources) v2.resources[k] = 1e8;
  const converted = G.decodeSave(JSON.stringify(v2));
  assert.equal(converted.version, 10);
  assert.deepEqual(G.decodeSave(JSON.stringify(converted)), converted);
  for (const k of resources)
    assert.equal(converted.resources[k] + converted.legacyStock[k], 1e8);
  assert.deepEqual(
    G.advance(converted, 28800).legacyStock,
    converted.legacyStock,
  );
});
test('current saves reject impossible capacities and corrupted new fields', () => {
  for (const mutate of [
    (s) => (s.resources.wood = 121),
    (s) => (s.rng = 0),
    (s) => (s.gatherTimes.food = 100),
    (s) => (s.legacyStock.wood = 1e9 + 1),
    (s) => (s.lastExpedition = { outcome: 99 }),
  ]) {
    const s = G.freshState(1);
    mutate(s);
    assert.throws(() => G.decodeSave(JSON.stringify(s)));
  }
});
