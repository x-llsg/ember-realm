import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as G from '../lib/realm.ts';

// Early flow: ordinary stocks are supplied by the test; actual public actions establish
// all discovery milestones. This is an integration unit fixture, not a legal playthrough.
// Migration: separate, previously generated v5 campaign regression fixtures are read intact.
const oldFixtures = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v5-campaign.json.gz', import.meta.url))).toString('utf8'));
const clone = value => structuredClone(value);
const views = ['town', 'research', 'recruit', 'heroes', 'explore', 'destiny'];
const visibleViews = s => views.filter(id => G.viewDiscovered(s, id));
const visibleResources = s => Object.keys(G.RESOURCE_NAMES).filter(id => G.resourceDiscovered(s, id));
function fundOrdinary(s0) {
  const s = clone(s0);
  for (const id of Object.keys(s.resources)) s.resources[id] = G.capacity(s, id);
  return s;
}
function action(s, fn, label) {
  const before = clone(s), next = fn(s);
  assert.notEqual(next, s, `${label} must execute`);
  assert.deepEqual(s, before, `${label} mutated its input`);
  return G.settleStory(next);
}
function build(s, id) {
  const funded = fundOrdinary(s);
  assert.equal(G.buildingReason(funded, id), '', id);
  return action(funded, x => G.build(x, id), `build ${id}`);
}
function expedition(s, route) {
  if (s.recoveryUntil > s.time) s = G.advance(s, s.recoveryUntil - s.time);
  const funded = fundOrdinary(s);
  assert.equal(G.dispatchReason(funded, 0, route, 0), '');
  const dispatched = action(funded, x => G.expedition(x, 0, route), `${route} expedition`);
  assert.ok(dispatched.expedition);
  return G.advance(dispatched, dispatched.expedition.end - dispatched.time);
}
function earlyFlow() {
  const checkpoints = {};
  let s = checkpoints.initial = G.freshState(246813579);
  s = build(s, 'fire'); checkpoints.fire = s;
  s = build(s, 'hut'); checkpoints.hut = s;
  s = action(fundOrdinary(s), x => G.hireWorker(x), 'first resident');
  s = build(s, 'lumber');
  s = action(s, x => G.assign(x, 'wood', 1), 'first wood worker');
  s = build(s, 'farm');
  s = action(fundOrdinary(s), x => G.hireWorker(x), 'second resident');
  s = action(s, x => G.assign(x, 'food', 1), 'first farmer'); checkpoints.workers = s;
  s = build(s, 'quarry');
  s = build(s, 'warehouse'); s = build(s, 'warehouse'); s = build(s, 'market');
  while (s.population < 6) s = action(fundOrdinary(s), x => G.hireWorker(x), 'hire worker');
  s = action(s, x => G.assign(x, 'wood', 1), 'assign worker');
  s = build(s, 'tavern'); checkpoints.tavern = s;
  for (const role of ['rhea', 'finn']) {
    const applicant = s.guild.applicants.find(h => h.role === role);
    assert.ok(applicant);
    s = action(fundOrdinary(s), x => G.hireApplicant(x, applicant.id), `hire ${role}`);
  }
  checkpoints.companions = s;
  // The first actual return establishes the durable expedition milestone.
  s = expedition(s, 'survey'); checkpoints.firstReturn = s;
  // The foothold is a combat milestone: prepare a full party using available
  // recruits and three-slot handcrafting, without inventing gear or later tech.
  for (const role of ['luna', 'kael']) {
    let applicant = s.guild.applicants.find(h => h.role === role);
    for (let refresh = 0; !applicant && refresh < 24; refresh++) {
      if (s.guild.refreshAt > s.time) s = G.advance(s, s.guild.refreshAt - s.time);
      s = action(fundOrdinary(s), x => G.refreshApplicants(x), 'ordinary applicant refresh');
      applicant = s.guild.applicants.find(h => h.role === role);
    }
    assert.ok(applicant, `bounded fixture recruitment finds ${role}`);
    s = action(fundOrdinary(s), x => G.hireApplicant(x, applicant.id), `hire ${role}`);
  }
  for (const id of s.party) {
    while (s.heroes.find(h => h.id === id).level < Math.min(4, G.levelCap(s)))
      s = action(fundOrdinary(s), x => G.train(x, id), 'train before frontier');
    const hero = s.heroes.find(h => h.id === id);
    for (const recipe of [hero.role === 'finn' ? 'bow' : 'blade', 'plate', 'vitality']) {
      const funded = fundOrdinary(s);
      assert.equal(G.forgeReason(funded, recipe, 1), '', recipe);
      s = action(funded, x => G.craftGear(x, recipe, 1), `craft ${recipe}`);
      const gear = s.guild.inventory.at(-1);
      s = action(s, x => G.equipGear(x, id, gear.id), `equip ${recipe}`);
    }
  }
  s = action(s, x => G.setPreparation(x, { stance: 'cautious' }), 'prepare guarded formation');
  let trips = 0;
  while (!G.guardianReady(s,0) && trips++ < 20) s = expedition(s, 'frontier');
  if(s.recoveryUntil>s.time)s=G.advance(s,s.recoveryUntil-s.time);
  s=G.resolveBattle(G.beginBattle(fundOrdinary(s),0,'guardian'));
  assert.ok(s.guild.depths[0] >= 1, 'bounded fixture setup must reach the first foothold');
  const settlement = G.TECHNOLOGIES.find(t => t.id === 'settlement');
  while (s.world.materials.timber < settlement.materials.timber && trips++ < 25) s = expedition(s, 'supply');
  s = fundOrdinary(s);
  assert.equal(G.technologyReason(s, 'settlement'), '');
  s = action(s, x => G.studyTechnology(x, 'settlement'), 'settlement technology');
  checkpoints.settlement = s;
  return checkpoints;
}
const flow = earlyFlow();

test('new arrival exposes only town and wood, regardless of abundant unseen stock', () => {
  for (const s of [flow.initial, fundOrdinary(flow.initial)]) {
    assert.deepEqual(visibleViews(s), ['town']);
    assert.deepEqual(visibleResources(s), ['wood']);
    assert.equal(G.buildingDiscovered(s, 'fire'), true);
    assert.equal(G.buildingDiscovered(s, 'hut'), false);
    assert.ok(G.RESEARCH.every(r => !G.researchDiscovered(s, r.id)));
  }
});

test('fire reveals food and shelter without revealing recruitment or advanced industry', () => {
  const s = flow.fire;
  assert.equal(G.resourceDiscovered(s, 'food'), true);
  assert.equal(G.buildingDiscovered(s, 'hut'), true);
  assert.equal(G.viewDiscovered(s, 'recruit'), false);
  assert.equal(G.viewDiscovered(s, 'research'), false);
  assert.equal(G.resourceDiscovered(s, 'iron'), false);
  assert.equal(G.buildingDiscovered(s, 'forge'), false);
});

test('an empty shelter reveals stone but needs working residents before research', () => {
  const s = flow.hut;
  assert.equal(G.resourceDiscovered(s, 'stone'), true);
  assert.equal(G.buildingDiscovered(s, 'warehouse'), false);
  assert.equal(G.viewDiscovered(s, 'research'), false);
  assert.equal(G.researchDiscovered(s, 'tools'), false);
  assert.equal(G.researchDiscovered(s, 'baskets'), false);
  assert.equal(G.researchDiscovered(s, 'axes'), false);
  assert.equal(G.viewDiscovered(s, 'explore'), false);
});

test('working lumber and farm reveal practical research and quarry before storage', () => {
  const s = flow.workers;
  assert.equal(G.viewDiscovered(s,'research'),true);
  assert.equal(G.researchDiscovered(s,'tools'),true);
  assert.equal(G.researchDiscovered(s,'baskets'),true);
  assert.equal(G.buildingDiscovered(s,'quarry'),true);
  assert.equal(G.buildingDiscovered(s,'warehouse'),false);
});

test('tavern reveals recruitment; hiring actual individuals reveals party and exploration', () => {
  assert.equal(G.viewDiscovered(flow.tavern, 'recruit'), true);
  assert.equal(G.viewDiscovered(flow.tavern, 'heroes'), false);
  assert.equal(G.viewDiscovered(flow.tavern, 'explore'), false);
  assert.equal(G.viewDiscovered(flow.companions, 'heroes'), true);
  assert.equal(G.viewDiscovered(flow.companions, 'explore'), true);
  assert.equal(G.recipeDiscovered(flow.companions, 'blade'), true);
  assert.equal(G.viewDiscovered(flow.companions, 'destiny'), false);
});

test('an actual first return reveals its material, settlement clue and journal', () => {
  const s = flow.firstReturn;
  assert.ok(s.explored[0] > 0);
  assert.equal(G.viewDiscovered(s, 'destiny'), true);
  assert.equal(G.materialDiscovered(s, 'timber'), true);
  assert.equal(G.technologyDiscovered(s, 'settlement'), true);
  assert.equal(G.technologyDiscovered(s, 'mythic'), false);
  assert.equal(G.buildingDiscovered(s, 'forge'), false);
});

test('settlement opens processing, iron and forge; shrine follows the forge', () => {
  const s = flow.settlement;
  assert.equal(G.townRank(s), 1);
  assert.equal(G.materialDiscovered(s, 'boards'), true);
  assert.equal(G.resourceDiscovered(s, 'iron'), true);
  assert.equal(G.buildingDiscovered(s, 'forge'), true);
  assert.equal(G.buildingDiscovered(s, 'shrine'), false);
  const forged = build(s, 'forge');
  assert.equal(G.buildingDiscovered(forged, 'shrine'), true);
  assert.equal(G.materialDiscovered(s, 'steel'), false);
  assert.equal(G.technologyDiscovered(s, 'metallurgy'), false);
});

function discoveryFlags(s) {
  return {
    views: Object.fromEntries(views.map(id => [id, G.viewDiscovered(s, id)])),
    resources: Object.fromEntries(Object.keys(G.RESOURCE_NAMES).map(id => [id, G.resourceDiscovered(s, id)])),
    buildings: Object.fromEntries(G.BUILDINGS.map(x => [x.id, G.buildingDiscovered(s, x.id)])),
    materials: Object.fromEntries(G.MATERIAL_IDS.map(id => [id, G.materialDiscovered(s, id)])),
    technologies: Object.fromEntries(G.TECHNOLOGIES.map(x => [x.id, G.technologyDiscovered(s, x.id)])),
    research: Object.fromEntries(G.RESEARCH.map(x => [x.id, G.researchDiscovered(s, x.id)])),
    recipes: Object.fromEntries(G.RECIPES.map(x => [x.id, G.recipeDiscovered(s, x.id)])),
  };
}

test('spending all ordinary and regional stocks cannot hide permanently discovered entries', () => {
  const samples = [...Object.values(flow), ...oldFixtures.beforeBattles.map(s => G.decodeSave(JSON.stringify(s)))];
  for (const original of samples) {
    const spent = clone(original), before = discoveryFlags(original);
    for (const key of Object.keys(spent.resources)) spent.resources[key] = 0;
    for (const key of G.MATERIAL_IDS) spent.world.materials[key] = 0;
    const after = discoveryFlags(spent);
    for (const [group, values] of Object.entries(before)) for (const [id, discovered] of Object.entries(values))
      if (discovered) assert.equal(after[group][id], true, `${group}.${id} disappeared after spending`);
  }
});

test('money alone never purchases undiscovered research or mutates any inventory', () => {
  const start = fundOrdinary(flow.initial);
  // This deliberately funded fixture tests the API barrier; no hidden research is earned.
  for (const key of Object.keys(start.resources)) start.resources[key] = 1e6;
  for (const key of G.MATERIAL_IDS) start.world.materials[key] = 10000;
  for (const r of G.RESEARCH) {
    assert.equal(G.researchDiscovered(start, r.id), false);
    assert.ok(G.canPay(start, r.cost));
    assert.ok(G.canAffordMaterials(start, r.materials || {}));
    const before = clone(start);
    assert.notEqual(G.researchReason(start, r.id), '');
    assert.equal(G.research(start, r.id), start);
    assert.deepEqual(start, before);
  }
});

function highStageResearchFixture() {
  const s = G.decodeSave(JSON.stringify(oldFixtures.beforeBattles[5]));
  s.buildings.warehouse = G.buildingLimit(s, 'warehouse');
  for (const r of G.RESEARCH) if (r.need) s.buildings[r.need] = Math.max(1, s.buildings[r.need]);
  s.guild.depths = [5, 5, 5, 5, 5, 5];
  s.explored = s.explored.map(n => Math.max(n, 1));
  s.survey = G.REGIONS.map(r => r.thresholds[1]);
  s.research = G.RESEARCH.map(r => r.id);
  for (const key of Object.keys(s.resources)) s.resources[key] = G.capacity(s, key);
  for (const key of G.MATERIAL_IDS) s.world.materials[key] = G.materialCapacity(s, key);
  s.battle = s.expedition = null;
  return s;
}

test('each missing special material blocks its discovered research with zero partial payment', () => {
  let bills = 0;
  for (const r of G.RESEARCH.filter(r => Object.keys(r.materials || {}).length)) {
    for (const [material, amount] of Object.entries(r.materials)) {
      const s = highStageResearchFixture();
      s.research = s.research.filter(id => id !== r.id);
      s.world.materials[material] = amount - 1;
      assert.equal(G.researchDiscovered(s, r.id), true, r.id);
      assert.ok(G.canPay(s, r.cost));
      const before = clone(s);
      assert.notEqual(G.researchReason(s, r.id), '');
      assert.equal(G.research(s, r.id), s);
      assert.deepEqual(s, before, `${r.id}/${material}: partial payment`);
      bills++;
    }
  }
  assert.ok(bills > 0, 'the contract includes research with special materials');
});

test('high town rank can fill omitted earlier research and pays both bills exactly once', () => {
  for (const r of G.RESEARCH.filter(r => r.chapter < 5)) {
    const s = highStageResearchFixture();
    s.research = s.research.filter(id => id !== r.id);
    assert.ok(G.townRank(s) > r.chapter);
    assert.equal(G.researchDiscovered(s, r.id), true, r.id);
    assert.equal(G.researchReason(s, r.id), '', r.id);
    const before = clone(s), learned = G.research(s, r.id);
    assert.notEqual(learned, s);
    assert.deepEqual(s, before);
    assert.equal(learned.research.filter(id => id === r.id).length, 1);
    for (const key of Object.keys(s.resources))
      assert.equal(learned.resources[key], s.resources[key] - (r.cost[key] || 0), `${r.id}/${key}`);
    for (const key of G.MATERIAL_IDS)
      assert.equal(learned.world.materials[key], s.world.materials[key] - (r.materials?.[key] || 0), `${r.id}/${key}`);
    assert.equal(G.research(learned, r.id), learned, 'already learned research cannot charge again');
  }
});

test('earned chronicle entries are recorded once and survive stock consumption and save reload', () => {
  const s = G.settleStory(flow.settlement), before = clone(s);
  assert.equal(G.settleStory(s), s);
  assert.deepEqual(s, before);
  for (const id of ['fire', 'shelter', 'tavern', 'companion', 'sample', 'settlement'])
    assert.equal(s.chronicle.filter(x => x === id).length, 1, id);
  const spent = clone(s);
  for (const key of Object.keys(spent.resources)) spent.resources[key] = 0;
  for (const key of G.MATERIAL_IDS) spent.world.materials[key] = 0;
  assert.deepEqual(G.settleStory(spent).chronicle, s.chronicle);
  const restored = G.decodeSave(JSON.stringify(spent));
  assert.deepEqual(restored.chronicle, spent.chronicle);
});

const migrationCases = [
  ...oldFixtures.beforeBattles.map((s, i) => [`before boss ${i}`, s]),
  ...oldFixtures.afterVictories.map((s, i) => [`after boss ${i}`, s]),
  ['after rebuilding', oldFixtures.afterRebuild], ['completed', oldFixtures.completed],
];
for (const [label, old] of migrationCases) test(`actual v5 regression fixture retains wealth, research and equipment: ${label}`, () => {
  assert.equal(old.version, 5, 'this case must remain an actual v5 regression input');
  const before = clone(old), migrated = G.decodeSave(JSON.stringify(old));
  assert.equal(migrated.version, 11);
  for (const key of ['resources', 'legacyStock', 'buildings', 'heroes', 'party', 'cleared', 'projects', 'research', 'kit', 'rebuild', 'world'])
    assert.deepEqual(migrated[key], old[key], key);
  const {fiveStarMisses,potions,salvage,lootHistory,lootReadSerial,lootSerial,achievements,...preservedGuild}=migrated.guild;
  assert.deepEqual(preservedGuild,old.guild);
  assert.deepEqual(potions,{shadow:0,fire:0,radiant:0},'old saves receive no free consumables');
  assert.deepEqual(salvage,{1:0,2:0,3:0,4:0,5:0,6:0},'old dust and equipment do not become free quality materials');
  assert.deepEqual(lootHistory,[],'migration must not invent historical equipment drops');
  assert.equal(lootReadSerial,0);
  assert.equal(lootSerial,0);
  assert.deepEqual(achievements,{unlocked:{},read:0,title:null},'decoding prepares empty achievement storage; normal story settlement verifies present milestones');
  assert.ok(Number.isInteger(fiveStarMisses)&&fiveStarMisses>=0&&fiveStarMisses<=79);
  for (const id of old.research) assert.equal(G.researchDiscovered(migrated, id), true, `${id} disappeared during migration`);
  for (const beat of G.STORY_BEATS.filter(b => b.when(migrated)))
    assert.equal(migrated.chronicle.filter(id => id === beat.id).length, 1);
  assert.deepEqual(G.decodeSave(JSON.stringify(migrated)), migrated);
  assert.deepEqual(old, before, 'v5 regression input mutated');
});

test('supply transport grows with town handling capacity, with preview and settlement agreeing',()=>{
  const s=G.freshState(12);s.guild.depths[0]=2;s.explored[0]=1;
  s.buildings.market=3;s.buildings.warehouse=5;
  assert.equal(G.expeditionMaterialAmount(s,0,'supply'),24);
  assert.equal(G.expeditionMaterialAmount(s,0,'survey'),4);
  s.research.push('supply_chain');assert.equal(G.expeditionMaterialAmount(s,0,'supply'),36);
  assert.match(G.expeditionMaterialPreview(s,0,'supply'),/36/);
  G.grantExpeditionMaterials(s,0,'supply',true);assert.equal(s.world.materials.timber,36);
  s.world.materials.timber=G.materialCapacity(s,'timber')-3;
  G.grantExpeditionMaterials(s,0,'supply',true);assert.equal(s.world.materials.timber,G.materialCapacity(s,'timber'));
});
test('a waterwheel visitor cannot bypass the staged rotation research',()=>{
  let s=G.freshState(1);s.resources.wood=100;s.resources.stone=100;
  s.event=G.EVENTS.findIndex(e=>e.id==='waterwheel');
  s=G.chooseEvent(s,0);assert.ok(!s.research.includes('rotation'));
});
