import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/realm.ts';
import { recommendedFixture } from './difficulty-fixtures.mjs';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
function inverse(y, shift, left) {
  let x = y >>> 0;
  for (let n = 0; n < 32; n++) x = (y ^ (left ? x << shift : x >>> shift)) >>> 0;
  return x;
}
function seed(value) {
  return inverse(inverse(inverse(Math.floor(value * 4294967296) >>> 0, 5, true), 17, false), 13, true);
}

test('previews are pure, normalized and make red exclusive to bosses across every region and node', () => {
  const s = G.freshState(71), before = structuredClone(s);
  for (let region = 0; region < 6; region++) {
    for (const kind of ['guardian', 'boss', 'expedition']) {
      for (let node = 0; node <= 5; node++) {
        for (const first of [false, true]) {
          const profile = G.dropProfile(s, region, kind, node, first);
          close(profile.rarityWeights.reduce((a, b) => a + b, 0), 1);
          assert.ok(profile.rarityWeights.every((value) => value >= 0 && value <= 1));
          assert.ok(profile.chance > 0 && profile.chance <= 1);
          assert.equal(profile.rarityWeights[5] > 0, kind === 'boss');
          const help = G.dropHelp(profile);
          assert.ok(help.title.length > 0);
          assert.match(help.body, new RegExp(`T${profile.tier}`));
          assert.match(help.body, /成功掉装后的品质概率/);
        }
      }
    }
  }
  assert.deepEqual(s, before);
});

test('every harder guardian raises equipment, blue-or-better and purple-or-better yield; gold never decreases', () => {
  const s = G.freshState(72);
  for (let region = 0; region < 6; region++) {
    let previous;
    for (let node = 0; node < 5; node++) {
      const p = G.dropProfile(s, region, 'guardian', node);
      const yields = [p.chance, p.chance * p.rarityWeights.slice(2).reduce((a, b) => a + b), p.chance * p.rarityWeights.slice(3).reduce((a, b) => a + b), p.chance * p.rarityWeights[4]];
      if (previous) yields.forEach((value, index) => assert.ok(index === 3 ? value >= previous[index] : value > previous[index]));
      previous = yields;
    }
  }
});

test('later region bands improve guardian chance and quality without promoting old easy maps to the latest tier', () => {
  const s = G.freshState(73);
  for (const node of [0, 2, 4]) {
    const profiles = [0, 1, 3, 5].map((region) => G.dropProfile(s, region, 'guardian', node));
    for (let n = 1; n < profiles.length; n++) {
      assert.ok(profiles[n].chance > profiles[n - 1].chance);
      assert.ok(profiles[n].rarityWeights[4] > profiles[n - 1].rarityWeights[4]);
    }
  }
  s.cleared = [0, 1, 2, 3, 4, 5];
  assert.equal(G.dropProfile(s, 0, 'guardian', 4).tier, 2);
  assert.equal(G.dropProfile(s, 5, 'guardian', 4).tier, 6);
});

test('real guardian drop decisions match every displayed chance on both sides of its boundary', () => {
  for (let region = 0; region < 6; region++) {
    for (let node = 0; node < 5; node++) {
      for (const offset of [-0.00001, 0.00001]) {
        const s = G.freshState(74);
        s.battle = { node };
        const p = G.dropProfile(s, region, 'guardian', node);
        s.rng = seed(p.chance + offset);
        G.monsterEquipment(s, region, 'guardian', false);
        assert.equal(s.guild.inventory.length, offset < 0 ? 1 : 0, `region ${region} node ${node} offset ${offset}`);
      }
    }
  }
});

test('displayed conditional rarity boundaries match the actual monster roller', () => {
  for (let region = 0; region < 6; region++) {
    for (const kind of ['boss', 'guardian']) {
      // Third-node first-clear guarantee isolates the quality draw without a chance draw.
      const s0 = G.freshState(75), p = G.dropProfile(s0, region, kind, 2, true);
      let cumulative = 0;
      for (let rarity = 6; rarity >= 1; rarity--) {
        const weight = p.rarityWeights[rarity - 1];
        if (!weight) continue;
        for (const value of [cumulative + 0.000001, cumulative + weight - 0.000001]) {
          const s = structuredClone(s0);
          s.rng = seed(value); s.battle = { node: 2 };
          G.monsterEquipment(s, region, kind, true);
          assert.equal(s.guild.inventory.at(-1).rarity, rarity);
        }
        cumulative += weight;
      }
    }
  }
});

test('first third-node guarantee is blue-or-better and never repeated by farming', () => {
  const s = G.freshState(76);
  for (let region = 0; region < 6; region++) {
    const first = G.dropProfile(s, region, 'guardian', 2, true);
    assert.equal(first.chance, 1);
    assert.deepEqual(first.rarityWeights.slice(0, 2), [0, 0]);
    assert.ok(G.dropProfile(s, region, 'guardian', 2, false).chance < 1);
    for (const node of [0, 1, 3, 4]) assert.equal(G.dropProfile(s, region, 'guardian', node, true).guaranteed, false);
  }
});

test('forest gear is T1 until cleared, then all new forest drop sources are T2 even without forge research', () => {
  const s = G.freshState(77);
  s.guild.inventory.push({ id: 'gear-1', recipe: 'blade', tier: 1, rarity: 3, upgrade: 2, affix: 0 });
  s.guild.serial = 1;
  const original = structuredClone(s.guild.inventory[0]);
  assert.equal(G.gearTier(s), 1);
  G.expeditionEquipment(s, 0, 2, true);
  assert.equal(s.guild.inventory.at(-1).tier, 1);
  s.cleared.push(0);
  G.expeditionEquipment(s, 0, 2, true);
  assert.equal(s.guild.inventory.at(-1).tier, 2);
  s.battle = { node: 2 };
  G.monsterEquipment(s, 0, 'guardian', true);
  assert.equal(s.guild.inventory.at(-1).tier, 2);
  G.monsterEquipment(s, 0, 'boss');
  assert.equal(s.guild.inventory.at(-1).tier, 2);
  assert.equal(G.gearTier(s), 1);
  assert.deepEqual(s.guild.inventory[0], original);
  assert.match(G.forgeReason(s, 'blade', 2), /酒馆|工艺/);
});

test('the global loot ceiling starts at T1 even on open branches and research alone cannot raise it', () => {
  const s = G.freshState(82);
  s.buildings.tavern = 1;
  s.guild.depths[0] = 3;
  s.world.tech = G.TECHNOLOGIES.map((technology) => technology.id);
  assert.equal(G.regionOpen(s, 1), true);
  assert.ok(G.gearTier(s) > 1);
  assert.equal(G.unlockedDropTier(s), 1);
  for (let region = 0; region < 6; region++) assert.equal(G.regionDropTier(s, region), 1);
  G.expeditionEquipment(s, 1, 1, true);
  assert.equal(s.guild.inventory.at(-1).tier, 1);
  s.cleared.push(0);
  assert.equal(G.unlockedDropTier(s), 2);
  assert.equal(G.regionDropTier(s, 0), 2);
  assert.equal(G.regionDropTier(s, 1), 2);
  G.expeditionEquipment(s, 1, 1, true);
  assert.equal(s.guild.inventory.at(-1).tier, 2);
});

test('defeating a harder branch boss can unlock its stage without forcing a prior forest clear', () => {
  const s = G.freshState(83);
  assert.equal(G.dropProfile(s, 1, 'boss').tier, 3);
  G.monsterEquipment(s, 1, 'boss');
  assert.equal(s.guild.inventory.at(-1).tier, 3);
  // The pure reward helper does not fabricate boss victories; the battle action owns that transition.
  assert.deepEqual(s.cleared, []);
  s.cleared.push(1);
  assert.equal(G.unlockedDropTier(s), 3);
  assert.equal(G.regionDropTier(s, 1), 3);
  assert.equal(G.regionDropTier(s, 0), 1);
  assert.equal(G.regionDropTier(s, 2), 2);
  assert.equal(G.regionDropTier(s, 3), 3);
  s.cleared.push(0);
  assert.equal(G.regionDropTier(s, 0), 2);
});

test('actual first boss victory immediately pays the previewed promoted tier and preserves the original state', () => {
  const original = recommendedFixture(0, 6);
  original.world.tech = [];
  original.guild.depths[0] = 5;
  original.cleared = [];
  const p = G.dropProfile(original, 0, 'boss');
  const before = structuredClone(original);
  let s = G.beginBattle(original, 0, 'boss');
  assert.ok(s.battle);
  s.battle.enemyHp = 1; s.battle.enemyDodge = 0; s.battle.enemyShield = 0;
  s = G.combat(s, G.commandFor(s.battle.selected, 'attack'));
  assert.equal(s.lastBattle.won, true);
  assert.ok(s.cleared.includes(0));
  assert.equal(s.lastBattle.loot.item.tier, p.tier);
  assert.equal(s.lastBattle.loot.item.tier, 2);
  assert.equal(G.gearTier(s), 1);
  assert.deepEqual(original, before);
});

test('existing cleared saves derive promotion on load without converting old gear or requiring new fields', () => {
  const s = G.freshState(78);
  s.cleared = [0, 2, 4];
  s.guild.inventory.push({ id: 'gear-1', recipe: 'blade', tier: 1, rarity: 2, upgrade: 0, affix: 0 });
  s.guild.serial = 1;
  const loaded = G.decodeSave(JSON.stringify(s));
  assert.deepEqual(loaded.guild.inventory, s.guild.inventory);
  assert.deepEqual(Array.from({ length: 6 }, (_, region) => G.regionDropTier(loaded, region)), [2, 2, 3, 4, 5, 5]);
});

test('ordinary expedition loot uses the same tier and exact chance without requiring local forging knowledge', () => {
  for (let region = 0; region < 6; region++) {
    for (const depth of [0, 2, 5]) {
      for (const offset of [-0.00001, 0.00001]) {
        const s = G.freshState(79);
        s.cleared = [region];
        const p = G.dropProfile(s, region, 'expedition', depth);
        s.rng = seed(p.chance + offset);
        G.expeditionEquipment(s, region, depth);
        assert.equal(s.guild.inventory.length, offset < 0 ? 1 : 0);
        if (s.guild.inventory.length) {
          assert.equal(s.guild.inventory[0].tier, p.tier);
          assert.ok(s.guild.inventory[0].rarity < 6);
          assert.equal(s.guild.inventory[0].setId, undefined);
        }
      }
    }
  }
});

test('an opened ruin without runecraft still pays its advertised first survey equipment pool', () => {
  const s = G.freshState(81);
  s.buildings.tavern = 1;
  s.world.tech = ['settlement'];
  s.guild.depths[0] = 3;
  assert.equal(G.regionOpen(s, 1), true);
  assert.ok(G.recipeUnlockReason(s, 'staff'));
  const p = G.dropProfile(s, 1, 'expedition', 0);
  s.rng = seed(p.chance - 0.00001);
  assert.ok(G.expeditionEquipment(s, 1, 0));
  assert.equal(s.guild.inventory.at(-1).tier, p.tier);
  assert.ok(['staff', 'shadowcoat', 'wardstone'].includes(s.guild.inventory.at(-1).recipe));
  G.expeditionEquipment(s, 1, 0, true);
  assert.equal(s.guild.inventory.length, 2);
  assert.ok(s.guild.inventory.at(-1).rarity >= 3);
});

test('loot rolls use battle RNG while previews do not consume either generator', () => {
  const s = G.freshState(80);
  s.battle = { node: 2, rng: 87 };
  const before = structuredClone(s);
  G.dropHelp(G.dropProfile(s, 0, 'guardian', 2, true));
  assert.deepEqual(s, before);
  G.monsterEquipment(s, 0, 'guardian', true);
  assert.equal(s.rng, before.rng);
  assert.notEqual(s.battle.rng, before.battle.rng);
});
