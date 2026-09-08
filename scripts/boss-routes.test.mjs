import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/realm.ts';

// Transition fixtures isolate access, progression and rewards. The final-blow
// helper deliberately shortens encounters; it is not a difficulty measurement.
function town(region = 0, depth = 3) {
  const s = G.freshState(1947651);
  s.world.tech = G.TECHNOLOGIES.map((t) => t.id);
  Object.assign(s.buildings, { fire: 1, hut: 2, tavern: 1, warehouse: 6 });
  s.nextEventAt = 1e8;
  s.guild.depths.fill(5);
  s.guild.depths[region] = depth;
  s.guild.intel.fill(0);
  s.cleared = [0, 1, 2, 3, 4, 5].filter((r) => r !== region);
  s.research = ['godslayer'];
  s.heroes = ['rhea', 'finn', 'luna', 'kael'].map((role) => {
    const h = G.makeApplicant(s, role);
    h.level = 15;
    return h;
  });
  s.party = s.heroes.map((h) => h.id);
  for (const id of Object.keys(s.resources)) s.resources[id] = 0;
  s.resources.food = 200;
  return s;
}

function finalBlow(s) {
  assert.ok(s.battle);
  s.battle.enemyHp = 1;
  s.battle.enemyDodge = 0;
  s.battle.enemyShield = 0;
  const next = G.combat(s, G.commandFor(s.battle.selected, 'attack'));
  assert.equal(next.battle, null);
  assert.equal(next.lastBattle.won, true);
  return next;
}

for (let region = 0; region < 6; region++) {
  test(`region ${region + 1}: third outpost opens the full-strength boss at zero intelligence`, () => {
    const locked = town(region, 2);
    assert.match(G.bossReason(locked, region), /2\/3/);
    assert.equal(G.startBattle(locked, region), locked);
    const s = town(region);
    assert.equal(G.bossReason(s, region), '');
    assert.equal(G.bossApproach(s, region).accessible, true);
    assert.equal(G.bossApproach(s, region).weakened, false);
    const b = G.startBattle(s, region).battle;
    assert.ok(b);
    assert.equal(b.enemyDefense, G.enemyDefinition(s, region, 'boss').defense);
    assert.equal(G.enemyArmor(s, region), b.enemyDefense);
  });

  test(`region ${region + 1}: fourth outpost applies the existing armor reduction; fifth-outpost combat stats are unchanged`, () => {
    const early = town(region, 3), fourth = town(region, 4), fifth = town(region, 5);
    const a = G.startBattle(early, region).battle;
    const b = G.startBattle(fourth, region).battle;
    const c = G.startBattle(fifth, region).battle;
    assert.equal(b.enemyDefense, a.enemyDefense * 0.85);
    assert.equal(c.enemyDefense, a.enemyDefense * 0.85);
    assert.equal(b.enemyHp, a.enemyHp);
    assert.equal(c.enemyHp, a.enemyHp);
    assert.equal(b.enemyAttack, a.enemyAttack);
    assert.equal(c.enemyAttack, a.enemyAttack);
    assert.equal(G.enemyArmor(fourth, region), b.enemyDefense);
    assert.equal(G.bossApproach(fourth, region).weakened, true);
  });
}

test('early boss clear persists real outposts and supply yields, then allows fourth and fifth guardians to be cleared', () => {
  let s = town(0);
  s.cleared = [];
  s.guild.depths = [3, 0, 0, 0, 0, 0];
  s.world.tech = ['settlement'];
  s.buildings.warehouse = 2;
  const before = structuredClone(s);
  const supplyAtThree = G.expeditionMaterialAmount(s, 0, 'supply');
  const freightAtThree = G.routeYield(s, 0);
  const preparation = G.battlePreparationCost(s);
  s = finalBlow(G.startBattle(s, 0));
  assert.deepEqual(s.cleared, [0]);
  assert.equal(s.guild.depths[0], 3);
  assert.equal(G.regionalDepth(s, 0), 3);
  assert.equal(G.expeditionMaterialAmount(s, 0, 'supply'), supplyAtThree);
  assert.equal(G.routeYield(s, 0), freightAtThree);
  assert.equal(s.guild.bossHunts.wins[0], 1);
  assert.equal(s.guild.bossHunts.readyAt[0], 180);
  assert.equal(s.guild.inventory.length, 1, 'boss grants exactly one item, not skipped guardian drops');
  for (const id of Object.keys(s.resources)) {
    assert.equal(s.resources[id], Math.min(G.capacity(s, id), before.resources[id] - (preparation[id] || 0) + (G.REGIONS[0].first[id] || 0)));
  }
  assert.deepEqual(G.decodeSave(JSON.stringify(s)), s, 'save reload must not synthesize fourth or fifth outposts');
  assert.equal(G.regionOpen(s, 1), true);
  assert.equal(G.regionOpen(s, 2), true);
  assert.equal(G.regionOpen(s, 3), false, 'forest boss does not open a later boss-gated region');
  assert.equal(G.bossArmorScale(s, 0), 1, 'an early first clear does not grant the fourth-outpost debuff');
  const firstRewards = structuredClone(s.resources);
  for (let node = 3; node < 5; node++) {
    s.guild.progress[0] = G.FRONTIER_REQUIREMENTS[node];
    assert.equal(G.guardianReady(s, 0), true, 'early boss clear preserves remaining guardian access');
    const cost = G.battlePreparationCost(s);
    const started = G.beginBattle(s, 0, 'guardian');
    assert.equal(started.battle?.node, node);
    s = finalBlow(started);
    assert.equal(s.guild.depths[0], node + 1);
    for (const id of Object.keys(firstRewards)) firstRewards[id] -= cost[id] || 0;
    assert.deepEqual(s.resources, firstRewards, 'returning guardians do not repeat the first-boss resource grant');
    assert.equal(s.guild.bossHunts.wins[0], 1);
  }
  assert.equal(G.bossArmorScale(s, 0), 0.85);
  assert.equal(G.expeditionMaterialAmount(s, 0, 'supply'), Math.floor(14 * G.supplyLoad(s)));
  assert.equal(G.guardianReady(s, 0), false);
  assert.deepEqual(G.decodeSave(JSON.stringify(s)), s);

  s.time = s.guild.bossHunts.readyAt[0];
  const rewards = structuredClone(s.resources), xp = s.heroes.map((h) => [h.level, h.xp]);
  const rematchCost = G.battlePreparationCost(s), inventory = s.guild.inventory.length;
  s = finalBlow(G.startBattle(s, 0));
  assert.deepEqual(s.heroes.map((h) => [h.level, h.xp]), xp, 'rematch never repeats first-clear experience');
  for (const id of Object.keys(rewards)) rewards[id] -= rematchCost[id] || 0;
  assert.deepEqual(s.resources, rewards);
  assert.equal(s.guild.inventory.length, inventory + 1, 'the repeatable boss item remains obtainable');
  assert.equal(s.guild.bossHunts.wins[0], 2);
  assert.deepEqual(s.cleared, [0]);
});

test('early final-boss victory opens the ending without completing the remaining two guardians', () => {
  let s = town(5);
  s.guild.depths.fill(3);
  s = finalBlow(G.startBattle(s, 5));
  assert.equal(s.ending, true);
  assert.equal(s.cleared.length, 6);
  assert.deepEqual(s.guild.depths, [3, 3, 3, 3, 3, 3]);
  assert.equal(s.rebuild.length, 0);
  assert.deepEqual(G.decodeSave(JSON.stringify(s)), s);
  s.guild.progress[5] = G.FRONTIER_REQUIREMENTS[3];
  assert.equal(G.guardianReason(s, 5), '');
  s = finalBlow(G.beginBattle(s, 5, 'guardian'));
  assert.equal(s.guild.depths[5], 4);
  assert.equal(s.ending, true);
  assert.equal(s.log.filter((entry) => entry.text.includes('三项重建等待')).length, 1);
});

test('first guardian rewards remain single-use while a paid rematch preserves progress, experience and resources', () => {
  let s = town(0, 2);
  s.guild.progress[0] = G.FRONTIER_REQUIREMENTS[2];
  s = finalBlow(G.beginBattle(s, 0, 'guardian'));
  assert.equal(s.guild.depths[0], 3);
  assert.equal(s.guild.inventory.length, 1);
  assert.ok(s.guild.inventory[0].rarity >= 3, 'third-outpost first clear still guarantees rare gear');
  assert.equal(s.guild.guardianHunts.readyAt[0], G.GUARDIAN_REMATCH_SECONDS);
  assert.match(G.guardianReason(s, 0, 2), /30 秒/);
  assert.equal(G.beginBattle(s, 0, 'guardian', 2), s, 'cooldown rejects the action before paying');

  s.guild.progress[0] = G.FRONTIER_REQUIREMENTS[3];
  assert.equal(G.guardianReason(s, 0), '', 'replay cooldown must not block the next new guardian');
  s = G.advance(s, G.GUARDIAN_REMATCH_SECONDS - 1);
  assert.equal(G.guardianRematchWait(s, 0), 1);
  s = G.advance(s, 1);
  assert.equal(G.guardianReason(s, 0, 2), '');
  const before = structuredClone(s), cost = G.battlePreparationCost(s);
  s.order.enabled = true;
  const replay = G.beginBattle(s, 0, 'guardian', 2);
  assert.equal(replay.order.enabled, false, 'manual farming does not silently resume a frontier order');
  assert.equal(replay.battle.node, 2);
  assert.deepEqual(G.decodeSave(JSON.stringify(replay)), replay, 'an in-progress replay can be saved');
  s = finalBlow(replay);
  assert.equal(s.guild.depths[0], before.guild.depths[0]);
  assert.equal(s.guild.progress[0], before.guild.progress[0]);
  assert.deepEqual(s.heroes.map((h) => [h.level, h.xp]), before.heroes.map((h) => [h.level, h.xp]));
  assert.deepEqual(s.cleared, before.cleared);
  assert.deepEqual(s.projects, before.projects);
  for (const id of Object.keys(s.resources)) assert.equal(s.resources[id], before.resources[id] - (cost[id] || 0));
  assert.equal(s.log.filter((entry) => entry.text.includes(`占领${G.FRONTIERS[0][2]}`)).length, 1);
  assert.equal(G.guardianRematchWait(s, 0), 30);
});

test('all five occupied guardians remain farmable after a boss clear, with ordinary local-set loot and no future-node access', () => {
  for (let region = 0; region < 6; region++) {
    let found = 0;
    for (let node = 0; node < 5; node++) {
      for (let seed = 1; seed <= 8; seed++) {
        const s = town(region, 5);
        s.cleared.push(region);
        s.ending = true;
        s.rng = (seed * 2654435761) >>> 0;
        assert.equal(G.guardianReason(s, region, node), '');
        const started = G.beginBattle(s, region, 'guardian', node);
        assert.equal(started.battle.enemyName, G.enemyDefinition(s, region, 'guardian', node).name);
        const after = finalBlow(started);
        assert.equal(after.guild.depths[region], 5);
        assert.equal(after.guild.progress[region], s.guild.progress[region]);
        assert.deepEqual(after.heroes.map((h) => h.xp), s.heroes.map((h) => h.xp));
        for (const item of after.guild.inventory) {
          found++;
          assert.ok(item.rarity >= 2 && item.rarity <= 4);
          assert.equal(item.setId, G.EQUIPMENT_SETS.find((set) => set.region === region).id);
        }
      }
    }
    assert.ok(found > 0, `region ${region + 1} has obtainable repeatable set drops`);
  }
  const s = town(0, 2);
  s.guild.progress[0] = 0;
  for (const node of [-1, 2, 3, 4, 5, 0.5, NaN]) {
    assert.ok(G.guardianReason(s, 0, node));
    assert.equal(G.beginBattle(s, 0, 'guardian', node), s);
  }
});

test('third-node replay uses the ordinary drop roll instead of replaying the first-clear guarantee', () => {
  let missed = 0, green = 0;
  for (let n = 1; n <= 64; n++) {
    const s = town(0, 3);
    s.battle = { node: 2, rng: (n * 2654435761) >>> 0 };
    const first = structuredClone(s);
    G.monsterEquipment(first, 0, 'guardian', true);
    assert.equal(first.guild.inventory.length, 1);
    assert.ok(first.guild.inventory[0].rarity >= 3);
    G.monsterEquipment(s, 0, 'guardian', false);
    if (!s.guild.inventory.length) missed++;
    if (s.guild.inventory[0]?.rarity === 2) green++;
  }
  assert.ok(missed > 0);
  assert.ok(green > 0);
});

test('guardian replay cooldown accepts older saves without its field and rejects malformed records', () => {
  const old = town(0, 3);
  delete old.guild.guardianHunts;
  const restored = G.decodeSave(JSON.stringify(old));
  assert.equal(G.guardianRematchWait(restored, 0), 0);
  assert.equal(G.guardianReason(restored, 0, 0), '');
  for (const record of [null, [], {}, { readyAt: [] }, { readyAt: [0, 0, 0, 0, 0, -1] }, { readyAt: [0, 0, 0, 0, 0, '30'] }, { readyAt: [0, 0, 0, 0, 0, 0], extra: true }]) {
    const s = town(0, 3);
    s.guild.guardianHunts = record;
    assert.throws(() => G.decodeSave(JSON.stringify(s)), /守敌再战记录无效/);
  }
});

test('guardian farming obeys inventory, supplies and real potion stock before charging for the battle', () => {
  const s = town(0, 5);
  s.guild.preparation.element = 'fire';
  assert.match(G.guardianReason(s, 0, 0), /辟火药剂库存不足/);
  const before = structuredClone(s);
  assert.equal(G.beginBattle(s, 0, 'guardian', 0), s);
  assert.deepEqual(s, before);
  s.guild.potions.fire = 1;
  const started = G.beginBattle(s, 0, 'guardian', 0);
  assert.ok(started.battle);
  assert.equal(started.guild.potions.fire, 0);
  assert.equal(started.battle.node, 0);
  assert.equal(s.guild.potions.fire, 1);
  const full = town(0, 5);
  full.guild.inventory.length = G.INVENTORY_CAP;
  assert.match(G.guardianReason(full, 0, 4), /装备库已满/);
  assert.equal(G.beginBattle(full, 0, 'guardian', 4), full);
  const hungry = town(0, 5);
  hungry.resources.food = 0;
  assert.match(G.guardianReason(hungry, 0, 4), /准备不足/);
  assert.equal(G.beginBattle(hungry, 0, 'guardian', 4), hungry);
});
