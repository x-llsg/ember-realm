import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/realm.ts';
import { recommendedFixture } from './difficulty-fixtures.mjs';

const copy = structuredClone;
const reload = (s) => G.decodeSave(JSON.stringify(s));
function ingredients(id = 'shadow', node = 1) {
  const region = id === 'shadow' ? 1 : id === 'fire' ? 4 : 5;
  const s = recommendedFixture(region, node);
  s.guild.potions = G.freshPotions();
  const recipe = G.POTIONS.find((p) => p.id === id);
  for (const [key, amount] of Object.entries(recipe.materials))
    s.world.materials[key] = amount * 3;
  for (const [key, amount] of Object.entries(recipe.cost))
    s.resources[key] = Math.max(s.resources[key], amount * 3);
  return s;
}
test('new saves and older v10 saves begin with zero doses; old selected potion does not create one', () => {
  const fresh = G.freshState(1000000);
  assert.deepEqual(fresh.guild.potions, { shadow: 0, fire: 0, radiant: 0 });
  const old = ingredients();
  delete old.guild.potions;
  const loaded = reload(old);
  assert.deepEqual(loaded.guild.potions, fresh.guild.potions);
  assert.equal(loaded.guild.preparation.element, 'shadow');
  assert.match(G.guardianReason(loaded, 1), /库存不足/);
  assert.equal(G.beginBattle(loaded, 1, 'guardian'), loaded);
});
test('save validation rejects malformed, negative, fractional and overflowing potion inventories', () => {
  const source = ingredients();
  for (const invalid of [null, [], {}, { fire: 0, shadow: 0 },
    { fire: 0, shadow: 0, radiant: 0, other: 0 },
    ...[-1, .5, NaN, Infinity, '1', G.potionCapacity(source) + 1]
      .map((shadow) => ({ fire: 0, shadow, radiant: 0 }))]) {
    const s = copy(source);
    s.guild.potions = invalid;
    assert.throws(() => reload(s), /药剂库存无效/);
  }
});
for (const recipe of G.POTIONS) {
  test(`${recipe.id}: crafting atomically pays every ingredient and adds exactly one saved team dose`, () => {
    const s = ingredients(recipe.id), before = copy(s);
    assert.equal(G.craftPotionReason(s, recipe.id), '');
    const next = G.craftPotion(s, recipe.id);
    assert.notEqual(next, s);
    assert.deepEqual(s, before);
    assert.equal(G.potionCount(next, recipe.id), 1);
    for (const [key, amount] of Object.entries(recipe.cost))
      assert.equal(next.resources[key], before.resources[key] - amount);
    for (const [key, amount] of Object.entries(recipe.materials))
      assert.equal(next.world.materials[key], before.world.materials[key] - amount);
    assert.deepEqual(reload(next).guild.potions, next.guild.potions);
  });
  test(`${recipe.id}: each shortage, unavailable recipe and full inventory pays nothing`, () => {
    const source = ingredients(recipe.id);
    const states = [];
    for (const [key, amount] of Object.entries(recipe.cost)) {
      const s = copy(source); s.resources[key] = amount - 1; states.push(s);
    }
    for (const [key, amount] of Object.entries(recipe.materials)) {
      const s = copy(source); s.world.materials[key] = amount - 1; states.push(s);
    }
    const locked = copy(source); locked.world.tech = []; states.push(locked);
    const full = copy(source); full.guild.potions[recipe.id] = G.potionCapacity(full); states.push(full);
    for (const s of states) {
      const before = copy(s);
      assert.notEqual(G.craftPotionReason(s, recipe.id), '');
      assert.equal(G.craftPotion(s, recipe.id), s);
      assert.deepEqual(s, before);
    }
    const almost = copy(source); almost.guild.potions[recipe.id] = G.potionCapacity(almost) - 1;
    const final = G.craftPotion(almost, recipe.id);
    assert.equal(G.potionCount(final, recipe.id), G.potionCapacity(final));
    assert.equal(G.craftPotion(final, recipe.id), final);
  });
}
test('selection alone never grants resistance or spends ingredients; cancelling allows a potion-free fight', () => {
  const s = ingredients(), before = copy(s);
  const noPotion = G.setPreparation(s, { element: 'physical' });
  const selected = G.setPreparation(noPotion, { element: 'shadow' });
  assert.deepEqual(selected.resources, before.resources);
  assert.deepEqual(selected.world.materials, before.world.materials);
  assert.deepEqual(selected.guild.potions, before.guild.potions);
  assert.equal(G.battleModifiers(selected, 1).resistance, G.battleModifiers(noPotion, 1).resistance);
  assert.deepEqual(G.createCombat(selected, 1, 'guardian').units.map((u) => u.resistance),
    G.createCombat(noPotion, 1, 'guardian').units.map((u) => u.resistance));
  assert.match(G.guardianReason(selected, 1), /镇魂药剂库存不足/);
  assert.equal(G.guardianReason(noPotion, 1), '');
  assert.ok(G.beginBattle(noPotion, 1, 'guardian').battle);
});
for (const kind of ['guardian', 'boss']) {
  test(`${kind}: starting spends one dose once, preserves resistance in its snapshot and retreat does not refund`, () => {
    const s = G.craftPotion(ingredients('shadow', kind === 'boss' ? 6 : 1), 'shadow');
    const before = copy(s);
    const unmedicated = G.createCombat(G.setPreparation(s, { element: 'physical' }), 1, kind);
    const preview = G.createCombat(copy(s), 1, kind);
    assert.equal(G.potionCount(s, 'shadow'), 1, 'snapshot preview never consumes original inventory');
    assert.ok(preview.units.every((u, i) => Math.abs(u.resistance - Math.min(.75, unmedicated.units[i].resistance + .2)) < 1e-9));
    const started = G.beginBattle(s, 1, kind);
    assert.ok(started.battle);
    assert.equal(G.potionCount(started, 'shadow'), 0);
    assert.deepEqual(started.battle.units.map((u) => u.resistance), preview.units.map((u) => u.resistance));
    assert.deepEqual(s, before);
    assert.equal(G.beginBattle(started, 1, kind), started, 'repeated start cannot consume another dose');
    const snapshot = copy(started.battle);
    const brewing = G.craftPotion(started, 'shadow');
    assert.equal(G.potionCount(brewing, 'shadow'), 1, 'town can prepare next dose during combat');
    assert.deepEqual(brewing.battle, snapshot);
    assert.equal(G.setPreparation(brewing, { element: 'fire' }), brewing);
    const restored = reload(brewing);
    assert.deepEqual(restored.battle, snapshot);
    const retreated = G.combat(started, 'retreat');
    assert.equal(retreated.battle, null);
    assert.equal(G.potionCount(retreated, 'shadow'), 0);
  });
}
test('a boss forecast needs actual inventory and leaves dose, resources, materials and random state untouched', () => {
  const empty = ingredients('shadow', 6);
  const blocked = G.forecastBattle(empty, 1);
  assert.match(blocked.reason, /库存不足/);
  assert.equal(blocked.actions, 0);
  const s = G.craftPotion(empty, 'shadow'), before = copy(s);
  const result = G.forecastBattle(s, 1);
  assert.equal(result.reason, '');
  assert.ok(result.actions > 0);
  assert.deepEqual(s, before);
});
test('an already-started v10 battle keeps its saved resistance when missing potion stock is migrated to zero', () => {
  const s = G.beginBattle(G.craftPotion(ingredients(), 'shadow'), 1, 'guardian');
  const snapshot = copy(s.battle);
  delete s.guild.potions;
  const restored = reload(s);
  assert.deepEqual(restored.guild.potions, G.freshPotions());
  assert.deepEqual(restored.battle, snapshot);
});
test('brewing while a team is away preserves the dispatched trip and does not consume a battle dose', () => {
  let s = ingredients();
  s.guild.progress[1] = 0;
  s = G.expedition(s, 1, 'survey');
  assert.ok(s.expedition);
  const before = copy(s);
  const next = G.craftPotion(s, 'shadow');
  assert.equal(G.potionCount(next, 'shadow'), 1);
  assert.deepEqual(next.expedition, before.expedition);
  assert.deepEqual(next.guild.preparation, before.guild.preparation);
  assert.equal(next.rng, before.rng);
  assert.deepEqual(s, before);
});
test('first gray-bell potion ingredients are obtainable by travel before defeating any guardian there', () => {
  let s = ingredients();
  s.world.materials.essence = 0;
  s.guild.progress[1] = 0;
  s = G.setPreparation(s, { element: 'physical' });
  assert.equal(s.guild.depths[1], 0);
  assert.equal(G.potionUnlockReason(s, 'shadow'), '');
  for (let trips = 0; s.world.materials.essence < 2 && trips < 10; trips++) {
    s = G.advance(s, Math.max(0, s.recoveryUntil - s.time));
    assert.equal(G.dispatchReason(s, 1, 'survey', 0), '');
    s = G.expedition(s, 1, 'survey');
    s = G.advance(s, Math.ceil(s.expedition.end - s.time));
  }
  assert.ok(s.world.materials.essence >= 2, 'travel yields the material without taking the first node');
  assert.equal(s.guild.depths[1], 0);
  assert.equal(G.craftPotionReason(s, 'shadow'), '');
  assert.equal(G.potionCount(G.craftPotion(s, 'shadow'), 'shadow'), 1);
});
