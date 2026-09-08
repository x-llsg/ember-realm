import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/realm.ts';
import { recommendedFixture } from './difficulty-fixtures.mjs';

const copy = structuredClone;
const reload = (s) => G.decodeSave(JSON.stringify(s));
// Validator-accepted combat unit fixtures, not a claimed legal playthrough.
function fixture() {
  const s = recommendedFixture(1, 6);
  s.guild.depths[0] = 5;
  s.cleared = [0];
  s.guild.preparation = { stance: 'cautious', element: 'physical', remedy: false };
  s.nextEventAt = 1e7;
  s.time = 0;
  s.combatAuto = false;
  s.jobs = Object.fromEntries(Object.keys(s.jobs).map((id) => [id, 0]));
  assert.deepEqual(reload(s), s);
  assert.equal(G.huntReason(s, 0, 'guardian', 4), '');
  return s;
}
function finish(s) {
  let count = 0;
  while (s.battle && count++ < 300) s = G.advance(s, 1);
  assert.equal(s.battle, null, 'actual automatic combat finishes within its normal round limit');
  return s;
}
function planWaiting(kind = 'guardian') {
  const s = fixture();
  if (kind === 'guardian') s.guild.guardianHunts.readyAt[0] = 30;
  else s.guild.bossHunts = { wins: [1,0,0,0,0,0], readyAt: [180,0,0,0,0,0] };
  const next = G.startHunt(s, 0, kind, kind === 'guardian' ? 4 : 0);
  assert.equal(next.hunt.enabled, true);
  assert.equal(next.battle, null);
  return next;
}

test('fresh and old saves have a disabled plan; previews neither mutate nor roll random values', () => {
  const fresh = G.freshState(81);
  assert.equal(fresh.hunt.enabled, false);
  const old = fixture(); delete old.hunt;
  assert.deepEqual(reload(old).hunt, G.freshHunt());
  const s = fixture(), before = copy(s);
  assert.match(G.huntStatus(s).target, /低语森林/);
  G.huntReason(s, 0, 'guardian', 4); G.huntStatus(s);
  assert.deepEqual(s, before);
});

test('first clears, locked regions and malformed target arguments never arm a plan or spend resources', () => {
  const s = fixture(); s.cleared = []; s.guild.depths[0] = 2;
  s.guild.progress[0] = G.FRONTIER_REQUIREMENTS[2];
  for (const args of [[0,'guardian',2], [0,'boss',0], [5,'guardian',0],
    [-1,'guardian',0], [6,'boss',0], [0,'other',0], [0,'guardian',-1],
    [0,'guardian',5], [0,'guardian',0.5]]) {
    const before = copy(s);
    assert.notEqual(G.huntReason(s, ...args), '');
    assert.equal(G.startHunt(s, ...args), s);
    assert.deepEqual(s, before);
  }
});

test('three real guardian wins pay each preparation, wait the regional cooldown and preserve fixed progression', () => {
  const initial = fixture(), original = copy(initial);
  const cost = G.battlePreparationCost(initial);
  let s = G.startHunt(initial, 0, 'guardian', 4);
  assert.deepEqual(initial, original);
  assert.equal(s.battle.hunt, true);
  assert.equal(s.battle.auto, true);
  assert.equal(s.combatAuto, false, 'farming does not overwrite the player preference');
  assert.equal(s.resources.food, initial.resources.food - cost.food);
  for (let win = 1; win <= 3; win++) {
    s = finish(s);
    assert.equal(s.lastBattle.won, true);
    assert.equal(s.hunt.wins, win);
    assert.equal(G.huntStatus(s).wait, 30);
    assert.equal(s.resources.food, initial.resources.food - cost.food * win);
    assert.deepEqual(s.guild.depths, initial.guild.depths);
    assert.deepEqual(s.guild.progress, initial.guild.progress);
    assert.deepEqual(s.cleared, initial.cleared);
    assert.equal(s.hunt.drops, s.guild.inventory.length - initial.guild.inventory.length);
    assert.deepEqual(reload(s), s);
    if (win < 3) {
      const wait = G.advance(s, 29);
      assert.equal(wait.battle, null);
      assert.equal(G.huntStatus(wait).wait, 1);
      s = G.advance(wait, 1);
      assert.equal(s.battle.node, 4);
      assert.equal(s.battle.region, 0);
      assert.equal(s.resources.food, initial.resources.food - cost.food * (win + 1));
    }
  }
  assert.ok(s.hunt.drops > 0, 'real successful rolls produced actual recorded equipment');
});

test('already cleared bosses repeat real fights at 180 seconds and only award ordinary repeat loot', () => {
  const initial = fixture();
  let s = G.startHunt(initial, 0, 'boss');
  s = finish(s);
  assert.equal(s.lastBattle.won, true);
  assert.equal(s.hunt.wins, 1); assert.equal(s.hunt.drops, 1);
  assert.equal(s.guild.inventory.length, initial.guild.inventory.length + 1);
  assert.equal(G.huntStatus(s).wait, 180);
  assert.deepEqual(s.cleared, initial.cleared);
  assert.deepEqual(s.heroes.map((h) => h.xp), initial.heroes.map((h) => h.xp), 'no repeat first-clear XP');
  const waiting = G.advance(s, 179);
  assert.equal(waiting.battle, null);
  s = G.advance(waiting, 1);
  assert.equal(s.battle.kind, 'boss');
  s = finish(s);
  assert.equal(s.hunt.wins, 2); assert.equal(s.hunt.drops, 2);
  assert.equal(s.guild.bossHunts.wins[0], 2);
});

test('normal cooldown and recovery can be queued together without advancing time or spending ahead', () => {
  const source = fixture(); source.recoveryUntil = 50;
  source.guild.guardianHunts.readyAt[0] = 30;
  const s = G.startHunt(source, 0, 'guardian', 4);
  assert.equal(s.time, 0); assert.equal(s.battle, null);
  assert.deepEqual(s.resources, source.resources); assert.equal(s.rng, source.rng);
  assert.equal(G.huntStatus(s).wait, 50);
  assert.equal(G.advance(s, 49).battle, null);
  assert.ok(G.advance(s, 50).battle);
});

test('one remaining preparation is spent once and insufficient food halts after that victory, without auto buying', () => {
  const source = fixture(); source.resources.food = G.battlePreparationCost(source).food;
  source.order.autoBuy = true;
  const s = finish(G.startHunt(source, 0, 'guardian', 4));
  assert.equal(s.lastBattle.won, true);
  assert.equal(s.hunt.enabled, false); assert.match(s.hunt.reason, /准备不足/);
  assert.equal(s.resources.food, 0); assert.equal(s.resources.gold, source.resources.gold);
  const after = G.advance(s, 120);
  assert.equal(after.hunt.wins, 1); assert.equal(after.battle, null);
  assert.equal(after.log.filter((r) => r.text.startsWith('连续刷怪已停止')).length, 1);
});

test('selected real potion doses are spent each battle and depletion halts instead of silently dropping resistance', () => {
  const source = fixture(); source.guild.preparation.element = 'shadow';
  source.guild.potions.shadow = 2;
  let s = G.startHunt(source, 0, 'guardian', 4);
  assert.equal(s.guild.potions.shadow, 1);
  s = finish(s); assert.equal(s.hunt.enabled, true);
  s = G.advance(s, 30); assert.equal(s.guild.potions.shadow, 0);
  s = finish(s); assert.equal(s.hunt.enabled, false);
  assert.equal(s.hunt.wins, 2); assert.match(s.hunt.reason, /药剂库存不足/);
  assert.equal(s.guild.preparation.element, 'shadow');
});

test('the last free inventory slot is reserved for actual boss loot and full storage halts after depositing it', () => {
  const source = fixture();
  while (source.guild.inventory.length < G.INVENTORY_CAP - 1)
    source.guild.inventory.push({ ...source.guild.inventory[0], id: `fill-${++source.guild.serial}` });
  const s = finish(G.startHunt(source, 0, 'boss'));
  assert.equal(s.lastBattle.won, true);
  assert.equal(s.guild.inventory.length, G.INVENTORY_CAP);
  assert.equal(s.hunt.enabled, false); assert.match(s.hunt.reason, /装备库已满/);
  assert.equal(s.hunt.drops, 1); assert.equal(s.lastBattle.loot.outcome, 'stored');
  assert.deepEqual(reload(s), s);
});

test('waiting plans stop for party, inventory, potion and currency changes before the next cooldown expires', () => {
  for (const [change, reason] of [
    [(s) => { s.party = []; }, /编入旅人/],
    [(s) => { s.resources.food = 0; }, /准备不足/],
    [(s) => { s.guild.preparation.remedy = true; s.resources.gold = 0; }, /准备不足/],
    [(s) => { s.guild.preparation.element = 'shadow'; s.guild.potions.shadow = 0; }, /药剂库存不足/],
    [(s) => { s.guild.depths[0] = 4; }, /亲自击败/],
    [(s) => { while (s.guild.inventory.length < G.INVENTORY_CAP) s.guild.inventory.push({ ...s.guild.inventory[0], id: `full-${++s.guild.serial}` }); }, /装备库已满/],
  ]) {
    const s = planWaiting(); change(s);
    const before = copy(s.resources), next = G.advance(s, 1);
    assert.equal(next.hunt.enabled, false); assert.match(next.hunt.reason, reason);
    assert.equal(next.battle, null); assert.deepEqual(next.resources, before);
  }
});

test('pause freezes both combat and scheduling; stopping during a fight keeps that fight but starts no next one', () => {
  const s = G.startHunt(fixture(), 0, 'guardian', 4);
  const paused = { ...s, paused: true };
  assert.equal(G.advance(paused, G.MAX_OFFLINE), paused);
  const stopped = G.stopHunt(s);
  assert.equal(stopped.hunt.enabled, false); assert.equal(stopped.battle.auto, true);
  assert.deepEqual(stopped.battle, s.battle);
  const done = finish(stopped);
  assert.equal(done.hunt.wins, 1, 'the already-started fight still counts in this session');
  assert.equal(G.advance(done, 100).battle, null);
  const waiting = planWaiting(); waiting.paused = true;
  assert.equal(G.advance(waiting, 100), waiting);
  const freshPaused = fixture(); freshPaused.paused = true;
  const armed = G.startHunt(freshPaused, 0, 'boss');
  assert.equal(armed.battle, null); assert.deepEqual(armed.resources, freshPaused.resources);
});

test('manual mode, manual commands and retreat cancel the future schedule without refunds or rewards', () => {
  for (const mode of ['manual', 'command', 'retreat']) {
    const s = G.startHunt(fixture(), 0, 'guardian', 4);
    const next = mode === 'manual' ? G.setCombatAuto(s, false)
      : G.combat(s, mode === 'retreat' ? 'retreat' : G.autoCommand(s));
    assert.equal(next.hunt.enabled, false);
    assert.deepEqual(next.resources, s.resources);
    if (mode !== 'retreat') assert.equal(next.battle.auto, false);
    if (mode === 'retreat') {
      assert.equal(next.battle, null); assert.equal(next.hunt.wins, 0);
      assert.equal(next.lastBattle.retreated, true); assert.match(next.hunt.reason, /撤退/);
      assert.equal(G.advance(next, 100).battle, null);
    }
    assert.deepEqual(reload(next), next);
  }
});

test('an underprepared party actually loses, halting future battles rather than repeatedly throwing away supplies', () => {
  const s = fixture();
  for (const h of s.heroes) { h.level = 1; h.quality = 1; h.mastery = 0; h.equipment = {}; h.learnedNodes = []; h.activeSkill = G.DEFAULT_SKILL[h.role]; }
  const done = finish(G.startHunt(s, 0, 'guardian', 4));
  assert.equal(done.lastBattle.won, false); assert.equal(done.hunt.enabled, false);
  assert.match(done.hunt.reason, /战败/); assert.equal(done.hunt.wins, 0);
  assert.equal(done.hunt.drops, 0); assert.equal(G.advance(done, 100).battle, null);
});

test('manual expedition/order/battle supersede a waiting plan, and active expedition or unrelated battle cannot start one', () => {
  for (const action of [
    (s) => G.expedition(s, 0, 'supply'),
    (s) => G.setOrder(s, { enabled: true, region: 0, route: 'supply', reserve: 0 }),
    (s) => G.beginBattle(s, 0, 'boss'),
  ]) {
    const next = action(planWaiting());
    assert.equal(next.hunt.enabled, false);
    assert.ok(next.expedition || next.battle);
    assert.notEqual(G.huntReason(next, 0, 'guardian', 4), '');
    assert.equal(G.startHunt(next, 0, 'guardian', 4), next);
  }
  const s = fixture(); s.order.enabled = true;
  const hunting = G.startHunt(s, 0, 'guardian', 4);
  assert.equal(hunting.order.enabled, false);
});

test('whole offline advancement equals fractional online steps, including a mid-fight save reload and waiting cooldown', () => {
  const s = G.startHunt(fixture(), 0, 'guardian', 4);
  const whole = G.advance(s, 367.5);
  let segmented = s;
  for (const seconds of [.5, 1, 4.5, 13, 29, .5, 30.5, 88, 200.5]) {
    segmented = reload(G.advance(segmented, seconds));
  }
  assert.equal(segmented.time, 367.5);
  assert.deepEqual(segmented, whole);
  assert.ok(whole.hunt.wins > 3);
  assert.deepEqual(reload(whole), whole);
});

test('automation runs the identical battle and reward rolls as a normal automatic rematch', () => {
  for (const kind of ['guardian', 'boss']) {
    const s = fixture(); s.combatAuto = true;
    const normal = finish(G.beginBattle(s, 0, kind, 4));
    const automated = finish(G.startHunt(s, 0, kind, 4));
    for (const key of ['lastBattle', 'guild', 'resources', 'world', 'heroes', 'cleared', 'rng', 'time'])
      assert.deepEqual(automated[key], normal[key], `${kind}: automation may schedule fights, never alter ${key}`);
  }
});

test('target stays fixed if another map is viewed or the party is reconfigured during the cooldown', () => {
  let s = planWaiting();
  s = G.rememberMap(s, 1);
  const oldParty = [...s.party];
  s = G.toggleParty(s, oldParty[3]);
  assert.equal(s.party.length, 3);
  assert.equal(s.hunt.enabled, true);
  const next = G.advance(s, 30);
  assert.equal(next.lastMap, 1);
  assert.equal(next.battle.region, 0); assert.equal(next.battle.node, 4);
  assert.equal(next.battle.units.length, 3);
  assert.deepEqual(next.battle.units.map((u) => u.id), next.party);
});

test('malformed or contradictory saved plans and farming battle markers are rejected rather than silently enabled', () => {
  const s = fixture();
  for (const hunt of [null, [], {}, { ...G.freshHunt(), enabled: 1 },
    { ...G.freshHunt(), region: 6 }, { ...G.freshHunt(), kind: 'expedition' },
    { ...G.freshHunt(), node: -1 }, { ...G.freshHunt(), wins: 1.5 },
    { ...G.freshHunt(), wins: 1, drops: 2 }, { ...G.freshHunt(), reason: 9 },
    { ...G.freshHunt(), enabled: true, reason: 'stopped' },
    { ...G.freshHunt(), enabled: true, region: 1, kind: 'boss' }]) {
    assert.throws(() => reload({ ...s, hunt }), /连续刷怪记录无效/);
  }
  for (const change of [
    (v) => { v.order.enabled = true; },
    (v) => { v.battle.hunt = 'yes'; },
    (v) => { v.battle.hunt = false; },
    (v) => { v.battle.auto = false; },
    (v) => { v.hunt.node = 3; },
    (v) => { delete v.hunt; },
  ]) {
    const next = G.startHunt(s, 0, 'guardian', 4); change(next);
    assert.throws(() => reload(next), /连续刷怪记录无效/);
  }
});
