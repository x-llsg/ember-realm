import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/realm.ts';
import { recruitingOdds } from '../lib/glossary.ts';

test('recruitment odds account for sequential hard pity and reset in every batch slot', () => {
  for (const misses of [0, 76, 77, 78, 79]) {
    const s = G.freshState(1);
  s.cleared=[0];
    s.guild.rolls = 3;
    s.guild.fiveStarMisses = misses;
    const before = structuredClone(s);
    const result = recruitingOdds(s);
    const five = result.stars[4];
    assert.equal(
      five.atLeastOneInNextBatchPercent,
      misses >= 77 ? 100 : 2.9701,
    );
    if (misses === 79)
      assert.deepEqual(
        five.nextSlotPercents.map((n) => +n.toFixed(4)),
        [100, 1, 1],
      );
    if (misses === 78)
      assert.deepEqual(
        five.nextSlotPercents.map((n) => +n.toFixed(4)),
        [1, 99.01, 1],
      );
    for (let slot = 0; slot < 3; slot++) {
      assert.ok(
        Math.abs(
          result.stars.reduce(
            (sum, row) => sum + row.nextSlotPercents[slot],
            0,
          ) - 100,
        ) < 1e-8,
      );
    }
    assert.deepEqual(s, before);
  }
});

test('three-star first-slot minimum never overrides hard five-star pity', () => {
  const s = G.freshState(1);
  s.cleared=[0];
  s.guild.rolls = 3;
  assert.equal(recruitingOdds(s).stars[0].nextSlotPercents[0], 0);
  s.guild.fiveStarMisses = 79;
  assert.equal(recruitingOdds(s).stars[4].nextSlotPercents[0], 100);
});

test('recruitment help permits affordable town refresh during a battle', () => {
  const s = G.freshState(1);
  s.cleared=[0];
  s.buildings.tavern = 1;
  s.battle = {};
  assert.equal(recruitingOdds(s).refreshReason, '');
});
