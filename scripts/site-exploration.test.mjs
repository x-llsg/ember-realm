import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/realm.ts';
import { recommendedFixture } from './difficulty-fixtures.mjs';

// Mechanism fixtures use legal chapter equipment, but are not acquisition playthroughs.
function ready(id = 'S01', variant = 'A') {
  const d = G.siteDefinition(id);
  const s = recommendedFixture(d.region, d.depth);
  s.guild.depths[d.region] = d.depth;
  s.guild.progress[d.region] = 0;
  s.guild.preparation = {
    stance: 'balanced',
    element: 'physical',
    remedy: false,
  };
  for (const k of G.MATERIAL_IDS)
    s.world.materials[k] = G.materialCapacity(s, k) / 2;
  G.discoverSites(s);
  s.worldExploration.sites[id].preview.variant = variant;
  s.nextEventAt = 1e8;
  return s;
}
const stock = (s) => ({
  resources: structuredClone(s.resources),
  materials: structuredClone(s.world.materials),
  potions: structuredClone(s.guild.potions),
});
const reload = (s) => G.decodeSave(JSON.stringify(s));
const options = (method = 'clever', limit = 2) => ({
  strategies: {
    A: { method, rewardKind: 'material' },
    B: { method, rewardKind: 'material' },
  },
  limit,
  reserve: {},
  maxExtraCost: {},
  maxExtraMaterials: {},
});
function resolve(s, id = 'S01') {
  s = G.startSite(s, id, 'material');
  assert.ok(s.worldExploration.activeRun);
  s = G.advance(s, s.worldExploration.activeRun.remaining);
  assert.equal(s.worldExploration.activeRun.phase, 'awaitingChoice');
  s = G.chooseSiteRoute(s, 'clever');
  assert.equal(s.worldExploration.activeRun.phase, 'resolving');
  return G.advance(
    s,
    G.siteStageSeconds(s.worldExploration.activeRun.total).resolving +
      G.siteStageSeconds(s.worldExploration.activeRun.total).returning,
  );
}
test('new and v10 saves create no population, production, free relics or facilities', () => {
  const s = G.freshState(1),
    before = stock(s),
    after = G.advance(s, 600);
  assert.deepEqual(stock(after), before);
  assert.equal(after.population, 0);
  assert.deepEqual(after.worldExploration.sites, {});
  assert.deepEqual(after.worldExploration.relics.owned, {});
  const old = ready();
  delete old.worldExploration;
  old.version = 10;
  const migrated = reload(old);
  assert.equal(migrated.version, 11);
  assert.ok(migrated.worldExploration.sites.S01);
  assert.deepEqual(stock(migrated), stock(old));
  assert.deepEqual(migrated.worldExploration.relics.owned, {});
  assert.ok(
    Object.values(migrated.worldExploration.facilities).every(
      (f) => !f.repaired && !f.enabled,
    ),
  );
  assert.deepEqual(reload(migrated), migrated);
});
test('discovery requires actual depth; merely killing a boss does not reveal its third-depth site', () => {
  const s = ready();
  s.cleared = [0];
  G.discoverSites(s);
  assert.equal(s.worldExploration.sites.S02, undefined);
  s.guild.depths[0] = 3;
  G.discoverSites(s);
  assert.ok(s.worldExploration.sites.S02);
});
for (const d of G.SITES)
  for (const variant of ['A', 'B'])
    test(`${d.id}/${variant}: paid clever route, roundtrip snapshot and unique return settlement`, () => {
      let s = ready(d.id, variant);
      const rng = s.rng,
        depths = [...s.guild.depths],
        cleared = [...s.cleared],
        inventory = structuredClone(s.guild.inventory);
      const cost = G.siteTravelQuote(s, d.id),
        extra = G.siteRouteQuote(s, d.id, 'clever'),
        before = stock(s);
      s = G.startSite(s, d.id, 'material');
      for (const [k, n] of Object.entries(cost.cost))
        assert.equal(s.resources[k], before.resources[k] - n);
      const departed = stock(s),
        snap = JSON.stringify(s.worldExploration.activeRun.combatSnapshot);
      s = reload(s);
      s = G.advance(s, s.worldExploration.activeRun.remaining);
      assert.equal(s.worldExploration.activeRun.phase, 'awaitingChoice');
      const wait = G.advance(s, 200);
      assert.equal(wait.worldExploration.activeRun.phase, 'awaitingChoice');
      assert.deepEqual(stock(wait), stock(s));
      s = G.chooseSiteRoute(s, 'clever');
      assert.equal(
        G.chooseSiteRoute(s, 'clever'),
        s,
        'duplicate confirm is inert',
      );
      for (const [k, n] of Object.entries(extra.cost))
        assert.equal(s.resources[k], departed.resources[k] - n);
      assert.equal(
        JSON.stringify(s.worldExploration.activeRun.combatSnapshot),
        snap,
      );
      s = reload(s);
      s = G.advance(s, 200);
      assert.equal(s.worldExploration.activeRun, null);
      assert.equal(s.worldExploration.sites[d.id].firstCompleted, true);
      assert.ok(s.worldExploration.relics.owned[d.relicId]);
      assert.equal(s.worldExploration.relics.owned[d.relicId].repaired, false);
      assert.deepEqual(s.guild.depths, depths);
      assert.deepEqual(s.cleared, cleared);
      assert.deepEqual(s.guild.inventory, inventory);
      assert.equal(s.rng, rng);
      assert.deepEqual(reload(s), s);
      const count = Object.keys(s.worldExploration.relics.owned).length;
      s = resolve(s, d.id);
      assert.equal(Object.keys(s.worldExploration.relics.owned).length, count);
      assert.equal(s.worldExploration.sites[d.id].lastResult.first, false);
    });
test('preview, invalid start, waiting, spending and retreat never reroll or lock reserve heroes', () => {
  let s = ready();
  const reserve = G.makeApplicant(s, 'rhea');
  s.heroes.push(reserve);
  const preview = structuredClone(s.worldExploration.sites.S01.preview);
  s = G.startSite(s, 'S01');
  assert.equal(G.heroAway(s, reserve.id), false);
  assert.equal(G.heroAway(s, s.party[0]), true);
  assert.equal(G.startSite(s, 'S01'), s);
  assert.equal(G.expedition(s, 0, 'survey'), s);
  assert.equal(G.startHunt(s, 0, 'guardian', 0), s);
  const paid = stock(s);
  s = G.recallSite(s);
  assert.deepEqual(stock(s), paid);
  assert.equal(G.heroAway(s, s.party[0]), false);
  assert.deepEqual(s.worldExploration.sites.S01.preview, preview);
  assert.equal(s.worldExploration.relics.owned.R01, undefined);
  assert.equal(G.startSite(s, 'S01'), s, 'cooldown retained after retreat');
  assert.deepEqual(reload(s), s);
});
test('overflow grants the unique relic immediately, frees the party and requires explicit receipt handling', () => {
  let s = ready('S02');
  s.world.materials.timber = G.materialCapacity(s, 'timber');
  s = resolve(s, 'S02');
  const p = s.worldExploration.sites.S02;
  assert.ok(p.pendingReceipt);
  assert.ok(s.worldExploration.relics.owned.R02);
  assert.equal(s.worldExploration.activeRun, null);
  assert.match(G.siteStartReason(s, 'S02'), /待领取/);
  assert.equal(G.siteStartReason(s, 'S01'), '');
  const serial = p.preview.serial;
  s.world.materials.timber -= 1;
  s = G.claimSite(s, 'S02');
  assert.equal(s.worldExploration.sites.S02.preview.serial, serial);
  assert.equal(
    s.worldExploration.sites.S02.pendingReceipt.remaining.materials.timber,
    1,
  );
  s = reload(s);
  s = G.readSiteReceipt(s, 'S02');
  assert.ok(s.worldExploration.sites.S02.pendingReceipt);
  s = G.discardSite(s, 'S02');
  assert.equal(s.worldExploration.sites.S02.pendingReceipt, null);
  assert.equal(s.worldExploration.sites.S02.preview.serial, serial + 1);
  assert.ok(s.worldExploration.relics.owned.R02);
  assert.deepEqual(G.claimSite(s, 'S02'), s);
  assert.deepEqual(reload(s), s);
});
test('repeat uses real trips, stops at the requested count and remains stopped after restocking', () => {
  let s = resolve(ready());
  s = G.advance(s, 30);
  s = G.setSiteRepeat(s, 'S01', options('clever', 2));
  s = G.advance(s, 600);
  assert.equal(s.worldExploration.repeatPlan.completed, 2);
  assert.equal(s.worldExploration.repeatPlan.enabled, false);
  assert.equal(s.worldExploration.activeRun, null);
  const serial = s.worldExploration.runSerial;
  for (const k in s.resources) s.resources[k] = G.capacity(s, k);
  s = G.advance(s, 300);
  assert.equal(s.worldExploration.runSerial, serial);
});
test('stopping future repeats during outbound still completes the already paid automatic trip', () => {
  let s = resolve(ready());
  s = G.advance(s, 30);
  s = G.setSiteRepeat(s, 'S01', options());
  assert.equal(s.worldExploration.activeRun.phase, 'outbound');
  s = G.setSiteRepeat(s, 'S01', null);
  s = G.advance(s, 200);
  assert.equal(s.worldExploration.activeRun, null);
  assert.equal(s.worldExploration.sites.S01.lastResult.won, true);
  assert.equal(s.worldExploration.repeatPlan.enabled, false);
});
test('changing next repeat limits cannot change the current paid trip snapshot', () => {
  let s = resolve(ready());
  s = G.advance(s, 30);
  s = G.setSiteRepeat(s, 'S01', options());
  const run = structuredClone(s.worldExploration.activeRun);
  s = G.setSiteRepeat(s, 'S01', {
    ...options('clever', 1),
    maxExtraCost: { gold: 0, wood: 0, food: 0, stone: 0 },
  });
  assert.deepEqual(s.worldExploration.activeRun, run);
  s = G.advance(s, 300);
  assert.equal(s.worldExploration.activeRun, null);
  assert.equal(s.worldExploration.repeatPlan.completed, 0);
  assert.match(s.worldExploration.repeatPlan.reason, /上限/);
});
test('unconfigured preview stops before paying and insufficient onsite supplies pause safely', () => {
  let s = resolve(ready());
  s = G.advance(s, 30);
  const variant = s.worldExploration.sites.S01.preview.variant,
    q = options();
  q.strategies[variant] = null;
  const before = stock(s);
  assert.match(G.siteRepeatReason(s, 'S01', q), /未配置/);
  assert.equal(G.setSiteRepeat(s, 'S01', q), s);
  assert.equal(s.worldExploration.activeRun, null);
  assert.deepEqual(stock(s), before);
  s = G.setSiteRepeat(s, 'S01', options());
  for (const k in s.resources) s.resources[k] = 0;
  s = G.advance(s, 60);
  assert.equal(s.worldExploration.activeRun.phase, 'awaitingChoice');
  assert.equal(s.worldExploration.repeatPlan.enabled, false);
  for (const k in s.resources) s.resources[k] = G.capacity(s, k);
  s = G.advance(s, 200);
  assert.equal(s.worldExploration.activeRun.phase, 'awaitingChoice');
  assert.deepEqual(
    reload(s),
    s,
    'failed automatic payment retains its immutable limits after loading',
  );
});
test('one long advance equals segmented save/load through choice and return', () => {
  let start = G.startSite(ready(), 'S01', 'material');
  start = G.advance(start, start.worldExploration.activeRun.remaining);
  start = G.chooseSiteRoute(start, 'clever');
  const whole = G.advance(start, 120);
  let split = start;
  for (let i = 0; i < 12; i++) split = reload(G.advance(split, 10));
  assert.deepEqual(split, whole);
});
test('corrupted new save fields cannot impersonate legacy defaults or duplicate loot', () => {
  const base = resolve(ready());
  for (const mutate of [
    (s) => delete s.worldExploration,
    (s) => (s.worldExploration.sites.S01.firstCompleted = false),
    (s) => (s.worldExploration.sites.S01.preview.seed = 0),
    (s) => (s.worldExploration.relics.owned.R01.siteId = 'S12'),
    (s) =>
      (s.worldExploration.sites.S01.lastResult.kept.materials.timber = 999),
  ]) {
    const bad = structuredClone(base);
    mutate(bad);
    assert.throws(() => reload(bad));
  }
});

test('invalid repeat requests leave an existing queued expedition or hunt entirely unchanged', () => {
  for (const queue of [
    (s) =>
      G.setOrder(s, { enabled: true, region: 0, route: 'supply', reserve: 0 }),
    (s) => G.startHunt(s, 0, 'guardian', 0),
  ]) {
    let s = resolve(ready());
    s.recoveryUntil = s.time + 120;
    s = queue(s);
    assert.ok(s.order.enabled || s.hunt.enabled);
    assert.equal(s.expedition, null);
    assert.equal(s.battle, null);
    const requests = [
      ['S99', options()],
      ['S02', options()],
      ['S01', options('assault')],
    ];
    const noCurrent = options();
    noCurrent.strategies[s.worldExploration.sites.S01.preview.variant] = null;
    requests.push(['S01', noCurrent]);
    const invalid = options();
    invalid.reserve = { gold: NaN };
    requests.push(['S01', invalid]);
    for (const [id, q] of requests) {
      const before = structuredClone(s);
      assert.ok(G.siteRepeatReason(s, id, q));
      assert.equal(G.setSiteRepeat(s, id, q), s);
      assert.deepEqual(s, before);
    }
    // Each individual payment fits, but paying the trip and onsite work does not.
    s.worldExploration.sites.S01.preview.variant = 'B';
    const travel = G.siteTravelQuote(s, 'S01'),
      extra = G.siteRouteQuote(s, 'S01', 'clever');
    assert.ok(extra.cost.food > 0);
    s.resources.food = Math.max(travel.cost.food, extra.cost.food);
    assert.equal(G.siteTravelQuote(s, 'S01').reason, '');
    assert.equal(G.siteRouteQuote(s, 'S01', 'clever').reason, '');
    const before = structuredClone(s);
    assert.match(G.siteRepeatReason(s, 'S01', options()), /不足/);
    assert.equal(G.setSiteRepeat(s, 'S01', options()), s);
    assert.deepEqual(s, before);
  }
});

test('a valid funded repeat replaces a queued plan atomically and waits for recovery without payment', () => {
  let s = resolve(ready());
  s.recoveryUntil = s.time + 120;
  s = G.startHunt(s, 0, 'guardian', 0);
  assert.equal(s.hunt.enabled, true);
  const before = stock(s),
    serial = s.worldExploration.runSerial;
  s = G.setSiteRepeat(s, 'S01', options());
  assert.equal(s.hunt.enabled, false);
  assert.equal(s.order.enabled, false);
  assert.equal(s.worldExploration.repeatPlan.enabled, true);
  assert.equal(s.worldExploration.activeRun, null);
  assert.equal(s.worldExploration.runSerial, serial);
  assert.deepEqual(stock(s), before);
  assert.deepEqual(reload(s), s);
  s = G.advance(s, 120);
  assert.equal(s.worldExploration.activeRun.phase, 'outbound');
  assert.equal(s.worldExploration.runSerial, serial + 1);
});

test('pending receipts, reserve floors and extra caps cannot replace an existing queued plan', () => {
  let s = ready('S02');
  s.world.materials.timber = G.materialCapacity(s, 'timber');
  s = resolve(s, 'S02');
  s.recoveryUntil = s.time + 120;
  s = G.setOrder(s, { enabled: true, region: 0, route: 'supply', reserve: 0 });
  assert.equal(s.order.enabled, true);
  assert.match(G.siteRepeatReason(s, 'S02', options()), /待领取/);
  assert.equal(G.setSiteRepeat(s, 'S02', options()), s);
  s = G.discardSite(s, 'S02');
  for (const q of [
    { ...options(), reserve: { food: s.resources.food } },
    { ...options(), maxExtraCost: { wood: 0, food: 0, gold: 0, stone: 0 } },
  ]) {
    const before = structuredClone(s);
    assert.match(G.siteRepeatReason(s, 'S02', q), /保留量|上限/);
    assert.equal(G.setSiteRepeat(s, 'S02', q), s);
    assert.deepEqual(s, before);
  }
});

test('all automatic snapshots and restart markers roundtrip through stop, takeover and changed next plans', () => {
  let s = resolve(ready());
  s = G.advance(s, 30);
  s = G.setSiteRepeat(s, 'S01', options());
  assert.deepEqual(reload(s), s);
  s = G.setSiteRepeat(s, 'S01', null);
  assert.deepEqual(reload(s), s);
  s = G.setSiteRepeat(s, 'S01', options('clever', 1));
  assert.equal(
    s.worldExploration.repeatPlan.startsAfterRunId,
    s.worldExploration.activeRun.id,
  );
  assert.deepEqual(reload(s), s);
  s = G.advance(s, 90);
  assert.equal(s.worldExploration.repeatPlan.completed, 0);
  assert.deepEqual(reload(s), s);
  s = G.advance(s, 120);
  assert.equal(s.worldExploration.repeatPlan.completed, 1);
  assert.equal(s.worldExploration.repeatPlan.enabled, false);
  assert.deepEqual(reload(s), s);
  s = G.advance(s, 30);
  s = G.startSite(s, 'S01');
  s = G.advance(s, s.worldExploration.activeRun.remaining);
  s = G.chooseSiteRoute(s, 'clever');
  assert.deepEqual(reload(s), s);
});

test('invalid automatic methods and payment snapshots are rejected, including after automatic control stopped', () => {
  let base = resolve(ready());
  base = G.advance(base, 30);
  base = G.setSiteRepeat(base, 'S01', options());
  for (const mutate of [
    (r) => delete r.autoMethod,
    (r) => (r.autoMethod = 'free'),
    (r) => (r.autoMethod = null),
    (r) => delete r.repeatLimits,
    (r) => (r.repeatLimits = null),
    (r) => (r.repeatLimits.reserve.food = -1),
    (r) => (r.repeatLimits.reserve.crystal = null),
    (r) => (r.repeatLimits.maxExtraCost.gold = '10'),
    (r) => (r.repeatLimits.maxExtraMaterials.unknown = 1),
    (r) => delete r.repeatLimits.maxExtraMaterials,
    (r) => (r.repeatLimits.unused = 1),
    (r) => (r.extraQuote.cost.wood = (r.extraQuote.cost.wood || 0) + 1),
    (r) => (r.travelPaid.cost.food = 0),
    (r) => (r.paidExtra.cost.food = 1),
    (r) => (r.remaining = r.total),
    (r) => (r.total = 91),
    (r) => (r.waitingReason = 'x'.repeat(301)),
    (r) => (r.combatSnapshot.site.runId = 0),
  ])
    for (const stopped of [false, true]) {
      const bad = structuredClone(base);
      if (stopped) bad.worldExploration.activeRun.automatic = false;
      mutate(bad.worldExploration.activeRun);
      assert.throws(() => reload(bad));
    }
  const manual = G.startSite(ready(), 'S01');
  manual.worldExploration.activeRun.repeatLimits = options();
  assert.throws(() => reload(manual));
});

test('repeat options and startsAfterRunId require complete finite internally consistent save fields', () => {
  let base = resolve(ready());
  base = G.advance(base, 30);
  base = G.setSiteRepeat(base, 'S01', options());
  for (const mutate of [
    (p) => delete p.startsAfterRunId,
    (p) => (p.startsAfterRunId = -1),
    (p) => (p.startsAfterRunId = 0.5),
    (p) => (p.startsAfterRunId = 99),
    (p) => (p.completed = 99),
    (p) => (p.limit = 0.5),
    (p) => (p.limit = 10001),
    (p) => (p.reserve.food = -1),
    (p) => (p.maxExtraCost.gold = null),
    (p) => (p.maxExtraMaterials.unknown = 1),
    (p) => delete p.strategies.B,
    (p) => (p.strategies.C = null),
    (p) => (p.strategies.A.method = 'free'),
    (p) => (p.strategies.A.rewardKind = 'relic'),
    (p) => (p.strategies.A.extra = 1),
    (p) => (p.strategies = { A: null, B: null }),
    (p) => (p.preparation.unknown = 1),
    (p) => (p.reason = 'already stopped'),
    (p) => (p.completed = p.limit),
    (p) => (p.extraField = true),
  ]) {
    const bad = structuredClone(base);
    mutate(bad.worldExploration.repeatPlan);
    assert.throws(() => reload(bad));
  }
  const both = structuredClone(base);
  both.order.enabled = true;
  assert.throws(() => reload(both));
});

test('pending receipt snapshots and active save objects cannot omit fields or disagree', () => {
  let base = ready('S02');
  base.world.materials.timber = G.materialCapacity(base, 'timber');
  base = resolve(base, 'S02');
  for (const mutate of [
    (p) => delete p.readyAt,
    (p) => delete p.preview.seed,
    (p) => (p.pendingReceipt.read = true),
    (p) => (p.pendingReceipt.original.materials.timber += 1),
    (p) => (p.lastResult.id = 0),
  ]) {
    const bad = JSON.parse(JSON.stringify(base));
    mutate(bad.worldExploration.sites.S02);
    assert.throws(() => reload(bad));
  }
  const active = G.startSite(ready(), 'S01');
  for (const field of [
    'paidPreparation',
    'helped',
    'waitingReason',
    'preparation',
    'repeatLimits',
  ]) {
    const bad = structuredClone(active);
    delete bad.worldExploration.activeRun[field];
    assert.throws(() => reload(bad));
  }
});

test('paused or nonpositive site tick calls never advance or charge an automatic trip', () => {
  let s = resolve(ready());
  s = G.advance(s, 30);
  s = G.setSiteRepeat(s, 'S01', options());
  for (const dt of [0, -1, NaN, Infinity]) {
    const before = structuredClone(s);
    G.siteTick(s, dt);
    assert.deepEqual(s, before);
  }
  s.paused = true;
  const before = structuredClone(s);
  G.siteTick(s, 1);
  assert.deepEqual(s, before);
});
