import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/realm.ts';
import { combatRecommendation } from '../lib/combat-recommendation.ts';
import { recommendedFixture } from './difficulty-fixtures.mjs';

function fixture(stage, branch = 'metal') {
  const s = G.freshState(156393);
  const metal = branch === 'metal';
  s.world.tech = ['settlement', metal ? 'metallurgy' : 'runecraft'];
  s.guild.depths[0] = 2;
  s.guild.depths[metal ? 2 : 1] = 1;
  if (stage >= 2) {
    s.world.tech.push('citadel');
    s.cleared.push(metal ? 2 : 1);
    s.guild.depths[metal ? 2 : 1] = 3;
  }
  if (stage >= 3) {
    s.world.tech.push(metal ? 'infernalcraft' : 'dragoncraft');
    s.guild.depths[metal ? 3 : 4] = 2;
  }
  if (stage >= 4) {
    s.world.tech.push('mythic');
    s.cleared.push(3, 4);
    s.guild.depths[3] = s.guild.depths[4] = 3;
    s.guild.depths[5] = stage === 4 ? 1 : 4;
  }
  for (const id of Object.keys(s.buildings))
    s.buildings[id] = G.buildingLimit(s, id);
  s.population = G.populationCap(s);
  const h = G.makeApplicant(s, 'rhea');
  Object.assign(h, { level: G.MASTERY_STAGES[stage - 1].level, mastery: stage - 1, origin: '边境流民' });
  s.heroes = [h];
  s.party = [h.id];
  for (const id of Object.keys(s.resources)) s.resources[id] = G.capacity(s, id);
  for (const id of G.MATERIAL_IDS) s.world.materials[id] = G.materialCapacity(s, id);
  assert.ok(G.decodeSave(JSON.stringify(s)), `stage ${stage} fixture remains a valid save`);
  return s;
}

for (const branch of ['metal', 'rune']) for (let stage = 1; stage <= 5; stage++) {
  test(`${branch}: mastery ${stage} requires earned progress and charges every material exactly once`, () => {
    const s = fixture(stage, branch), h = s.heroes[0];
    assert.equal(G.masteryLimit(s), stage);
    assert.equal(G.masteryReason(s, h), '');
    const cost = G.masteryCost(h), materials = G.masteryMaterials(s, h), original = structuredClone(s);
    const next = G.mentorHero(s, h.id);
    assert.notEqual(next, s);
    assert.deepEqual(s, original);
    assert.equal(next.heroes[0].mastery, stage);
    for (const id of Object.keys(s.resources))
      assert.equal(s.resources[id] - next.resources[id], cost[id] || 0, id);
    for (const id of G.MATERIAL_IDS)
      assert.equal(s.world.materials[id] - next.world.materials[id], materials[id] || 0, id);
    assert.equal(next.rng, s.rng, 'paid mastery does not roll stats or recruits');
    assert.deepEqual(G.decodeSave(JSON.stringify(next)), next);
    const beforeStats = G.individualStats(s, h), afterStats = G.individualStats(next, next.heroes[0]);
    for (const id of ['hp', 'attack', 'defense'])
      assert.ok(Math.abs(afterStats[id] / beforeStats[id] - (1 + stage * .04) / (1 + (stage - 1) * .04)) < 1e-10, id);
  });
}

test('wealth, character level and research alone cannot replace actual frontier or boss milestones', () => {
  for (let stage = 1; stage <= 5; stage++) {
    const s = fixture(stage), h = s.heroes[0];
    if (stage === 1) s.guild.depths[2] = 0;
    if (stage === 2) s.cleared = [];
    if (stage === 3) s.guild.depths[3] = 1;
    if (stage === 4) s.guild.depths[5] = 0;
    if (stage === 5) s.guild.depths[5] = 3;
    assert.ok(G.masteryUnlockReason(s, h));
    assert.equal(G.mentorHero(s, h.id), s);
    const locked = fixture(stage);
    locked.heroes[0].level--;
    assert.match(G.masteryReason(locked, locked.heroes[0]), /需要角色达到/);
    assert.equal(G.mentorHero(locked, locked.heroes[0].id), locked);
  }
  const early = fixture(1);
  early.guild.depths[1] = early.guild.depths[2] = 5;
  early.cleared = [0, 1, 2];
  assert.equal(G.masteryLimit(early), 1, 'finishing both second-stage regions without citadel cannot buy later tiers');
});

test('every missing currency or material blocks mastery atomically; origin discount applies to the complete bill', () => {
  for (let stage = 1; stage <= 5; stage++) {
    const s = fixture(stage), h = s.heroes[0];
    for (const [id, cost] of Object.entries(G.masteryCost(h))) {
      const poor = structuredClone(s); poor.resources[id] = cost - 1;
      assert.ok(G.masteryReason(poor, poor.heroes[0]));
      assert.equal(G.mentorHero(poor, h.id), poor);
    }
    for (const [id, cost] of Object.entries(G.masteryMaterials(s, h))) {
      const poor = structuredClone(s); poor.world.materials[id] = cost - 1;
      assert.ok(G.masteryReason(poor, poor.heroes[0]));
      assert.equal(G.mentorHero(poor, h.id), poor);
    }
    const hermit = { ...h, origin: '隐修者' };
    for (const [id, cost] of Object.entries(G.masteryCost(h)))
      assert.equal(G.masteryCost(hermit)[id], Math.ceil(cost * .85));
    for (const [id, cost] of Object.entries(G.masteryMaterials(s, h)))
      assert.equal(G.masteryMaterials(s, hermit)[id], Math.ceil(cost * .85));
  }
});

test('every published encounter recommendation has attainable mastery before that encounter', () => {
  for (let region = 0; region < 6; region++) for (let node = 1; node <= 6; node++) {
    const q = combatRecommendation(region, node), s = recommendedFixture(region, node);
    assert.ok(q.mastery <= G.masteryLimit(s), `${region + 1}-${node}: recommended mastery must be open`);
    if (q.mastery) assert.ok(q.level >= G.MASTERY_STAGES[q.mastery - 1].level);
  }
});

test('old paid mastery survives imports and legacy flaw recovery never buys or resets mastery', () => {
  const s = G.freshState(47135);
  const h = G.makeApplicant(s, 'rhea');
  Object.assign(h, { level: 1, mastery: 5, flaw: 'frail' });
  delete h.talentVersion;
  s.heroes = [h];
  s.buildings.tavern = 2;
  s.buildings.warehouse = 1;
  s.resources.gold = 150; s.resources.food = 100;
  const restored = G.decodeSave(JSON.stringify(s));
  assert.ok(restored);
  assert.equal(restored.heroes[0].mastery, 5);
  assert.equal(G.mentorHero(restored, h.id), restored);
  const next = G.mentorHero(restored, h.id, true);
  assert.equal(next.heroes[0].mastery, 5);
  assert.equal(next.heroes[0].flaw, 'overcome');
  assert.equal(restored.resources.gold - next.resources.gold, 120);
  assert.equal(restored.resources.food - next.resources.food, 60);
  assert.deepEqual(next.world.materials, restored.world.materials);
});
