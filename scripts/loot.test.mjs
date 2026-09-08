import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/realm.ts';
import { recommendedFixture } from './difficulty-fixtures.mjs';

const item = (id = 'gear-1', rarity = 3) => ({ id, recipe: 'blade', tier: 1, rarity, affix: 0, upgrade: 0 });
const reload = (s) => G.decodeSave(JSON.stringify(s));
test('legacy saves get an empty history and no invented earlier drops', () => {
  const s = G.freshState(1);
  delete s.guild.lootHistory; delete s.guild.lootReadSerial; delete s.guild.lootSerial;
  const loaded = reload(s);
  assert.deepEqual(loaded.guild.lootHistory, []);
  assert.equal(G.lootUnread(loaded), 0);
});
test('receipts retain the original equipment snapshot after changes and removal; visitor ids are valid', () => {
  const s = G.freshState(1), gear = item('visitor-161');
  s.guild.inventory.push(gear);
  G.recordLoot(s, gear, 'visitor', '行商购入');
  gear.upgrade = 3; gear.affix = 4; s.guild.inventory = [];
  const loaded = reload(s);
  assert.equal(loaded.guild.lootHistory[0].item.upgrade, 0);
  assert.equal(loaded.guild.lootHistory[0].item.affix, 0);
  assert.equal(loaded.guild.lootHistory[0].item.id, 'visitor-161');
});
test('bounded persistent history does not change RNG, and crafting does not hide the latest monster drop', () => {
  const s = G.freshState(123), seed = s.rng;
  const monster = G.recordLoot(s, item(), 'guardian', '森林守敌');
  G.recordLoot(s, item('gear-2'), 'forge', '锻造');
  assert.equal(G.latestBattleLoot(s).serial, monster.serial);
  const read = G.readLoot(s);
  assert.equal(G.lootUnread(read), 0);
  assert.equal(G.lootUnread(s), 2);
  for (let n = 3; n < 80; n++) G.recordLoot(read, item('gear-' + n), 'expedition', '森林远征');
  assert.equal(read.guild.lootHistory.length, G.MAX_LOOT_HISTORY);
  assert.equal(G.lootUnread(read), G.MAX_LOOT_HISTORY);
  assert.equal(read.rng, seed);
  assert.deepEqual(reload(read).guild.lootHistory, read.guild.lootHistory);
});
test('all malformed receipt data is rejected instead of becoming rewards or UI exceptions', () => {
  const s = G.freshState(1); G.recordLoot(s, item(), 'boss', '森林首领');
  for (const mutate of [
    (s) => s.guild.lootHistory[0].item.recipe = 'not-a-recipe',
    (s) => s.guild.lootHistory[0].item.locked = 'yes',
    (s) => s.guild.lootHistory[0].time = 100,
    (s) => s.guild.lootHistory[0].serial = 0,
    (s) => s.guild.lootHistory[0].source = 'unknown',
    (s) => s.guild.lootReadSerial = 9,
    (s) => s.guild.lootHistory.push(s.guild.lootHistory[0]),
    (s) => s.guild.lootHistory[0].conversion = { dust: 9999 },
  ]) {
    const bad = structuredClone(s); mutate(bad);
    assert.throws(() => reload(bad), /装备收获记录无效/);
  }
});
test('full inventory expedition conversion records actual dust and matching quality material, including overflow', () => {
  const s = recommendedFixture(0, 1);
  s.guild.inventory = Array.from({ length: G.INVENTORY_CAP }, (_, n) => item('gear-' + (1000 + n)));
  s.guild.serial = 1200;
  s.guild.dust = 9998;
  for (const key of Object.keys(s.guild.salvage)) s.guild.salvage[key] = G.SALVAGE_CAP;
  const text = G.expeditionEquipment(s, 0, 1, true);
  const receipt = s.guild.lootHistory[0];
  assert.equal(receipt.outcome, 'converted');
  assert.equal(receipt.conversion.dust, 1);
  assert.equal(receipt.conversion.material, 0);
  assert.equal(receipt.conversion.lostMaterial, receipt.item.tier);
  assert.equal(receipt.conversion.lostDust + 1, receipt.item.tier * receipt.item.rarity * 4);
  assert.match(text, /材料仓满.*损失/);
  assert.equal(s.guild.inventory.length, G.INVENTORY_CAP);
  G.validateLoot(s);
});
test('actual battle reports keep their drop receipt independently of victory log and inventory', () => {
  const s = recommendedFixture(0, 6);
  s.guild.depths[0] = 5;
  let b = G.beginBattle(s, 0, 'boss');
  assert.ok(b.battle);
  b.battle.enemyHp = 1; b.battle.enemyDodge = 0; b.battle.enemyShield = 0;
  const won = G.combat(b, G.commandFor(b.battle.selected, 'attack'));
  assert.equal(won.lastBattle.won, true);
  assert.ok(won.lastBattle.loot);
  assert.equal(won.lastBattle.loot.source, 'boss');
  assert.match(won.log[0].text, /胜利/);
  assert.equal(won.lastBattle.loot.item.id, won.guild.lootHistory[0].item.id);
  assert.deepEqual(reload(won).lastBattle.loot, won.lastBattle.loot);
});
test('a retreat explicitly records no equipment drop without fabricating a history entry', () => {
  const s = recommendedFixture(0, 1);
  const begun = G.beginBattle(s, 0, 'guardian');
  assert.ok(begun.battle);
  const retreated = G.combat(begun, 'retreat');
  assert.equal(retreated.lastBattle.loot, null);
  assert.equal(retreated.guild.lootHistory.length, 0);
});
test('a victorious guardian with an unsuccessful drop roll explicitly records no drop', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const s = recommendedFixture(0, 1);
    s.rng = seed;
    const begun = G.beginBattle(s, 0, 'guardian');
    begun.battle.enemyHp = 1; begun.battle.enemyDodge = 0; begun.battle.enemyShield = 0;
    const won = G.combat(begun, G.commandFor(begun.battle.selected, 'attack'));
    if (won.lastBattle.loot === null) {
      assert.equal(won.lastBattle.won, true);
      assert.equal(won.guild.lootHistory.length, 0);
      assert.equal(reload(won).lastBattle.loot, null);
      return;
    }
  }
  assert.fail('the ordinary guardian drop table must include no-drop victories');
});
