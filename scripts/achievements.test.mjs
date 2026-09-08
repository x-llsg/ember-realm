import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/realm.ts';
import { recommendedFixture } from './difficulty-fixtures.mjs';
const reload = (s) => G.decodeSave(JSON.stringify(s));

test('a fresh game shows only the first flame milestone and grants no free rewards', () => {
  const s = G.freshState(1234), before = structuredClone(s);
  assert.deepEqual(G.ACHIEVEMENTS.filter((a) => a.visible(s)).map((a) => a.id), ['first-fire']);
  assert.equal(G.settleAchievements(s), s);
  assert.deepEqual(s, before);
  assert.equal(G.ACHIEVEMENTS.length, 24);
});
test('story settlement discovers achievements once without touching RNG, currency or generic logs', () => {
  const s = G.freshState(1234); s.buildings.fire = 1;
  const first = G.settleStory(s);
  assert.equal(first.guild.achievements.unlocked['first-fire'], s.time);
  assert.equal(G.achievementUnread(first), 1);
  assert.equal(first.rng, s.rng);
  assert.deepEqual(first.resources, s.resources);
  assert.equal(G.settleStory(first), first);
  const read = G.readAchievements(first);
  assert.equal(G.achievementUnread(read), 0);
  assert.equal(G.settleStory(read), read);
  assert.deepEqual(reload(read), read);
});
test('old saves backfill only milestones demonstrated by current state, at the recording day', () => {
  const s = recommendedFixture(1, 4);
  delete s.guild.achievements;
  s.time = 1500;
  s.guild.crafts = 0; s.guild.inventory = []; s.heroes.forEach((h) => h.equipment = {});
  const loaded = G.settleStory(reload(s));
  const expected = G.ACHIEVEMENTS.filter((a) => a.progress(s) >= a.target).map((a) => a.id).sort();
  assert.deepEqual(Object.keys(loaded.guild.achievements.unlocked).sort(), expected);
  assert.ok(Object.values(loaded.guild.achievements.unlocked).every((time) => time === 1500));
  assert.equal(loaded.guild.achievements.unlocked['first-craft'], undefined);
  assert.equal(loaded.guild.achievements.unlocked['legendary-gear'], undefined);
});
test('recorded achievements remain after their equipment is removed and titles have no numerical bonus', () => {
  const s = G.freshState(23);
  s.guild.inventory = [{ id: 'gear-1', recipe: 'blade', tier: 1, rarity: 5, affix: 0, upgrade: 0 }];
  s.guild.serial = 1;
  const achieved = G.settleAchievements(s);
  achieved.guild.inventory = [];
  const titled = G.selectAchievementTitle(achieved, 'legendary-gear');
  assert.equal(G.achievementTitle(titled), '珍宝收藏家');
  assert.deepEqual(titled.resources, achieved.resources);
  assert.equal(titled.rng, achieved.rng);
  assert.deepEqual(reload(titled).guild.achievements, titled.guild.achievements);
  assert.equal(G.selectAchievementTitle(titled, 'boss-5'), titled);
  assert.equal(G.achievementTitle(G.selectAchievementTitle(titled, null)), '');
});
test('unvisited regions remain undisclosed and invalid achievement data is rejected', () => {
  const s = G.freshState(0);
  assert.equal(G.ACHIEVEMENTS.filter((a) => a.id.startsWith('boss-')).some((a) => a.visible(s)), false);
  for (const a of [null, [], {}, { unlocked: { unknown: 0 }, read: 0, title: null },
    { unlocked: { 'first-fire': 1 }, read: 0, title: null },
    { unlocked: {}, read: 1, title: null }, { unlocked: {}, read: 0, title: 'boss-5' }]) {
    const bad = structuredClone(s); bad.guild.achievements = a;
    assert.throws(() => reload(bad), /成就记录无效/);
  }
});
