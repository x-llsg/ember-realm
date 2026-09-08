import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/realm.ts';

function market() {
  const s = G.freshState(101);
  Object.assign(s.buildings, {
    fire: 1,
    hut: 1,
    market: 1,
    warehouse: 12,
    forge: 1,
    shrine: 1,
  });
  s.world.tech = G.TECHNOLOGIES.map((t) => t.id);
  s.research = ['baskets', 'preservation'];
  return s;
}
const goods = ['wood', 'food', 'stone', 'iron', 'crystal'];

test('market lists every discovered basic commodity without an extra boss-count gate', () => {
  const s = G.freshState(102);
  s.buildings.market = 1;
  for (const k of Object.keys(G.RESOURCE_NAMES))
    assert.equal(
      G.tradeUnlocked(s, k),
      k !== 'gold' && G.resourceVisible(s, k),
    );
  assert.equal(G.tradeUnlocked(s, 'iron'), false);
  assert.equal(G.tradeUnlocked(s, 'crystal'), false);
  s.world.tech.push('settlement');
  assert.equal(G.tradeUnlocked(s, 'iron'), true);
  s.world.tech.push('runecraft');
  assert.equal(G.tradeUnlocked(s, 'crystal'), true);
  assert.deepEqual(
    s.cleared,
    [],
    'newly discovered resources can trade before the old boss-count requirement',
  );
  for (const id of ['gold', ...G.MATERIAL_IDS, 'missing']) {
    assert.equal(G.tradeUnlocked(s, id), false, id);
    assert.equal(G.trade(s, id, true, 'max'), s, id);
  }
  s.buildings.market = 0;
  for (const k of goods) assert.equal(G.tradeUnlocked(s, k), false);
});

test('one, one hundred and one thousand lots settle exactly like repeated single-lot trades', () => {
  for (const k of goods)
    for (const buy of [true, false])
      for (const batches of [1, 100, 1000]) {
        const s = market();
        s.resources[k] = buy ? 0 : G.TRADE_BATCH_SIZE * batches;
        s.resources.gold = buy ? G.capacity(s, 'gold') : 0;
        const before = structuredClone(s),
          quote = G.tradeQuote(s, k, buy, batches);
        assert.equal(quote.reason, '');
        assert.equal(quote.batches, batches);
        assert.equal(quote.amount, batches * 20);
        const bulk = G.trade(s, k, buy, batches);
        let singles = s;
        for (let i = 0; i < batches; i++) singles = G.trade(singles, k, buy);
        assert.deepEqual(
          bulk.resources,
          singles.resources,
          `${k} ${buy ? 'buy' : 'sell'} ×${batches}`,
        );
        assert.deepEqual(s, before, 'input state stays unchanged');
        assert.equal(
          bulk.log.length,
          s.log.length + 1,
          'bulk transaction records a single atomic settlement',
        );
      }
});

test('bulk purchases cap both cost and warehouse room, and the preview matches settlement', () => {
  const s = market();
  s.resources.gold = 28 * 2 + 13;
  let quote = G.tradeQuote(s, 'wood', true, 1000);
  assert.equal(quote.batches, 2);
  assert.equal(quote.amount, 40);
  assert.equal(quote.gold, 56);
  assert.equal(quote.limited, true);
  const bought = G.trade(s, 'wood', true, 1000);
  assert.equal(bought.resources.gold, 13);
  assert.equal(bought.resources.wood, s.resources.wood + quote.amount);
  assert.equal(G.trade(bought, 'wood', true, 1000), bought);
  s.resources.gold = G.capacity(s, 'gold');
  s.resources.wood = G.capacity(s, 'wood') - 45.5;
  quote = G.tradeQuote(s, 'wood', true, 'max');
  assert.equal(quote.batches, 2);
  const filled = G.trade(s, 'wood', true, 'max');
  assert.equal(filled.resources.wood, G.capacity(s, 'wood') - 5.5);
  assert.equal(G.trade(filled, 'wood', true, 'max'), filled);
});

test('bulk sales cap owned stock and gold room without truncating proceeds or losing fractional stock', () => {
  const s = market(),
    price = G.tradePrice(s, 'stone', false);
  s.resources.stone = 65.25;
  s.resources.gold = G.capacity(s, 'gold') - price * 2 - 0.5;
  const quote = G.tradeQuote(s, 'stone', false, 'max');
  assert.equal(quote.batches, 2);
  const sold = G.trade(s, 'stone', false, 'max');
  assert.equal(sold.resources.stone, 25.25);
  assert.equal(sold.resources.gold, G.capacity(s, 'gold') - 0.5);
  assert.equal(G.trade(sold, 'stone', false, 'max'), sold);
  s.resources.gold = 0;
  assert.equal(
    G.tradeQuote(s, 'stone', false, 'max').batches,
    3,
    'maximum is recalculated from current stock',
  );
});

test('invalid quantities, locked commodities and empty stock cannot mutate the state', () => {
  const s = market();
  for (const quantity of [
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    'all',
    null,
  ]) {
    assert.ok(G.tradeQuote(s, 'wood', true, quantity).reason);
    assert.equal(G.trade(s, 'wood', true, quantity), s);
  }
  assert.equal(G.trade(s, 'wood', 'buy', 1), s);
  for (const buy of [true, false]) {
    s.resources.gold = s.resources.wood = 0;
    assert.equal(G.trade(s, 'wood', buy, 'max'), s);
  }
});

test('maximum transactions retain the existing bid-ask spread and cannot create gold', () => {
  for (const k of goods) {
    const s = market();
    s.resources[k] = 0;
    s.resources.gold = 10000;
    const bought = G.trade(s, k, true, 'max'),
      sold = G.trade(bought, k, false, 'max');
    assert.ok(G.tradePrice(s, k, false) < G.tradePrice(s, k, true));
    assert.equal(sold.resources[k], 0);
    assert.ok(sold.resources.gold < s.resources.gold, k);
  }
});
