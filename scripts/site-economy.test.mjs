import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/realm.ts';
import * as E from '../lib/economy.ts';
import * as C from '../lib/campaign.ts';
import * as S from '../lib/site-economy.ts';
import * as R from '../lib/relics.ts';
import { SITE_ECONOMY_IDS } from '../lib/relic-data.ts';
import { recommendedFixture } from './difficulty-fixtures.mjs';

// Synthetic mechanism fixtures: these prove payment and state transitions,
// not a legal six-chapter playthrough or economic pacing.
function fixture() {
  const s = G.freshState(170);
  s.paused = false;
  s.time = 100;
  s.cleared = [0, 1, 2, 3, 4, 5];
  s.guild.depths.fill(5);
  s.explored.fill(1);
  s.survey.fill(1);
  s.world.tech = C.TECHNOLOGIES.map((t) => t.id);
  s.population = 30;
  for (const k of Object.keys(s.buildings)) s.buildings[k] = 4;
  s.buildings.hut = 10;
  s.economy.development.logistics = 12;
  for (const k of Object.keys(s.jobs)) {
    s.jobs[k] = 0;
    s.resources[k] = E.baseCapacity(s, k) * 0.6;
  }
  for (const k of C.MATERIAL_IDS)
    s.world.materials[k] = C.materialCapacity(s, k) * 0.3;
  s.worldExploration = {
    ...S.freshWorldEconomy(),
    sites: Object.fromEntries(
      SITE_ECONOMY_IDS.map((id) => [id, { firstCompleted: true }]),
    ),
    activeRun: null,
  };
  return s;
}
function restored(s, id, mode = 'A') {
  const f = s.worldExploration.facilities[id];
  f.repaired = true;
  f.repairQuote = S.repairBaseQuote(id, 'facilityRepair');
  f.mode = mode;
  return f;
}
function own(s, id) {
  S.awardSiteRelic(s, 'S' + id.slice(1));
  s.worldExploration.relics.owned[id].repaired = true;
}

test('new economy has twelve closed facilities and no free relics or workers', () => {
  const s = fixture();
  assert.equal(Object.keys(s.worldExploration.facilities).length, 12);
  assert.equal(S.facilityWorkers(s), 0);
  assert.equal(S.relicWorkers(s), 0);
  assert.equal(Object.keys(s.worldExploration.relics.owned).length, 0);
  const before = structuredClone(s.resources);
  S.siteEconomyTick(s, 600);
  assert.deepEqual(s.resources, before);
  assert.equal(S.validateWorldEconomy(s), true);
});
test('six chapters odd/even repairs pay once and finish after real time, closed', () => {
  for (const id of SITE_ECONOMY_IDS) {
    let s = fixture();
    for (const k of Object.keys(s.resources))
      s.resources[k] = E.baseCapacity(s, k);
    const q = S.facilityRepairQuote(s, id);
    assert.equal(q.reason, '');
    const before = s.resources.gold;
    s = S.repairFacility(s, id);
    assert.equal(s.resources.gold, before - q.cost.gold);
    assert.equal(S.repairFacility(s, id), s);
    assert.equal(s.worldExploration.facilities[id].repaired, false);
    s.paused = true;
    S.siteEconomyTick(s, q.seconds);
    assert.equal(
      s.worldExploration.facilities[id].operation.remainingSeconds,
      q.seconds,
    );
    s.paused = false;
    S.siteEconomyTick(s, q.seconds - 1);
    assert.equal(s.worldExploration.facilities[id].repaired, false);
    S.siteEconomyTick(s, 1);
    assert.equal(s.worldExploration.facilities[id].repaired, true);
    assert.equal(s.worldExploration.facilities[id].enabled, false);
    // Independent funded repair transaction; this is not an income simulation.
    for (const k of Object.keys(s.resources))
      s.resources[k] = E.baseCapacity(s, k) * 0.6;
    S.awardSiteRelic(s, id);
    const r = 'R' + id.slice(1),
      rq = R.relicRepairQuote(s, r);
    assert.equal(rq.reason, '');
    s = R.repairRelic(s, r);
    assert.equal(R.repairRelic(s, r), s);
    S.siteEconomyTick(s, rq.seconds);
    assert.equal(s.worldExploration.relics.owned[r].repaired, true);
    assert.deepEqual(s.worldExploration.relics.town, []);
    assert.equal(S.validateWorldEconomy(s), true);
  }
});
test('all 24 modes use whole input/output transactions and exact clocks', () => {
  assert.equal(S.FACILITY_MODES.length, 24);
  for (const def of S.FACILITY_MODES) {
    let s = fixture();
    restored(s, def.siteId, def.mode);
    const q = S.facilityModeQuote(s, def.siteId, def.mode);
    assert.equal(q.reason, '', def.id);
    const resources = structuredClone(s.resources),
      materials = structuredClone(s.world.materials),
      potions = structuredClone(s.guild.potions);
    s = S.toggleFacility(s, def.siteId, true);
    assert.equal(S.facilityWorkers(s), 1);
    S.siteEconomyTick(s, def.seconds - 1);
    assert.deepEqual(s.resources, resources, def.id + ' no early payment');
    S.siteEconomyTick(s, 1);
    for (const k of Object.keys(resources))
      assert.ok(
        Math.abs(
          s.resources[k] -
            (resources[k] - (q.cost[k] || 0) + (q.outputCost[k] || 0)),
        ) < 1e-7,
        def.id + ' ' + k,
      );
    for (const k of Object.keys(materials))
      assert.ok(
        Math.abs(
          s.world.materials[k] -
            (materials[k] -
              (q.materials[k] || 0) +
              (q.outputMaterials[k] || 0)),
        ) < 1e-7,
        def.id + ' ' + k,
      );
    for (const k of Object.keys(potions))
      assert.equal(s.guild.potions[k], potions[k] + (q.outputPotions[k] || 0));
    assert.equal(s.worldExploration.facilities[def.siteId].completed, 1);
    assert.equal(S.validateWorldEconomy(s), true, def.id);
  }
});
test('full output, missing inputs and retain lines stop without paying or freeing workers', () => {
  let s = fixture();
  restored(s, 'S01');
  s = S.toggleFacility(s, 'S01', true);
  s.world.materials.timber = C.materialCapacity(s, 'timber');
  const gold = s.resources.gold;
  S.siteEconomyTick(s, 1000);
  assert.equal(s.resources.gold, gold);
  assert.equal(s.worldExploration.facilities.S01.progress, 0);
  assert.equal(S.facilityWorkers(s), 1);
  s.world.materials.timber = 0;
  s.resources.food = 0;
  S.siteEconomyTick(s, 1000);
  assert.equal(s.resources.gold, gold);
  s.resources.food = 24;
  s.economy.reserve = 0.5;
  S.siteEconomyTick(s, 1000);
  assert.equal(s.resources.gold, gold);
  s = S.toggleFacility(s, 'S01', false);
  assert.equal(S.facilityWorkers(s), 0);
});
test('close preserves progress; paid mode change resets and needs reactivation', () => {
  let s = fixture();
  restored(s, 'S01');
  s = S.toggleFacility(s, 'S01', true);
  S.siteEconomyTick(s, 20);
  s = S.toggleFacility(s, 'S01', false);
  S.siteEconomyTick(s, 30);
  assert.equal(s.worldExploration.facilities.S01.progress, 20);
  s = S.toggleFacility(s, 'S01', true);
  const cost = S.facilityChangeQuote(s, 'S01', 'B');
  const gold = s.resources.gold;
  s = S.setFacilityMode(s, 'S01', 'B');
  assert.equal(s.resources.gold, gold - cost.cost.gold);
  assert.equal(s.worldExploration.facilities.S01.progress, 0);
  assert.equal(S.facilityWorkers(s), 0);
  S.siteEconomyTick(s, 15);
  assert.equal(s.worldExploration.facilities.S01.mode, 'B');
  assert.equal(s.worldExploration.facilities.S01.enabled, false);
});
test('shared population and transport slots cannot be over-allocated', () => {
  let s = fixture();
  s.population = 1;
  restored(s, 'S01');
  restored(s, 'S02');
  s = S.toggleFacility(s, 'S01', true);
  assert.equal(S.toggleFacility(s, 'S02', true), s);
  s.population = 30;
  s.economy.development.logistics = 0;
  s.economy.routes[0] = { level: 1, crew: 1, enabled: true, delivered: 0 };
  assert.equal(S.toggleFacility(s, 'S02', true), s);
  assert.equal(E.freeEconomyWorkers(s), 28);
  assert.equal(E.transportLines(s), 2);
});
test('R01 prepays real maintenance, supports one line and keeps balance when removed', () => {
  let s = fixture();
  own(s, 'R01');
  s = R.configureTownRelic(s, 'R01', { mode: 'hand', target: 'boards' });
  s.world.work.boards = true;
  const food = s.resources.food;
  assert.equal(S.relicWorkers(s), 1);
  E.relicProcessingTick(s, 1);
  assert.equal(s.resources.food, food - 6);
  assert.equal(s.worldExploration.relics.runtime.handSeconds, 59);
  assert.equal(s.world.workProgress.boards, 1.25);
  s = R.configureTownRelic(s, 'R01', null);
  assert.equal(S.relicWorkers(s), 0);
  assert.equal(s.worldExploration.relics.runtime.handSeconds, 59);
  s = R.configureTownRelic(s, 'R01', { mode: 'hand', target: 'boards' });
  E.relicProcessingTick(s, 1);
  assert.equal(s.resources.food, food - 6);
});
test('R03 splits real batches with proportional time and no free material', () => {
  let s = fixture();
  own(s, 'R03');
  const workDev = E.DEVELOPMENTS.find((d) => d.work === 'boards');
  s.economy.development[workDev.id] = 4;
  s = R.configureTownRelic(s, 'R03', { target: 'boards' });
  assert.equal(s.worldExploration.relics.town.length, 1);
  s.world.work.boards = true;
  const duration = C.workDuration(s, 'boards'),
    output = E.processingOutput(s, 'boards'),
    before = s.world.materials.boards,
    bill = E.processingBill(s, 'boards');
  E.relicProcessingTick(s, duration / output);
  assert.equal(s.world.materials.boards, before + 1);
  assert.equal(
    s.worldExploration.relics.runtime.processing.boards.remaining,
    output - 1,
  );
  E.relicProcessingTick(s, duration - duration / output);
  assert.equal(s.world.materials.boards, before + output);
  assert.ok(
    s.resources.wood <= E.baseCapacity(s, 'wood') * 0.6 - bill.cost.wood + 1e-8,
  );
});
test('R05 both routes keep slots but only current route supplies', () => {
  let s = fixture();
  own(s, 'R05');
  for (const r of [0, 1])
    s.economy.routes[r] = { level: 1, crew: 1, enabled: true, delivered: 0 };
  s = R.configureTownRelic(s, 'R05', { routes: [0, 1], counts: [1, 2] });
  const before = s.world.materials.essence;
  E.economyTick(s);
  assert.equal(s.world.materials.essence, before);
  assert.equal(E.transportLines(s), 2);
  assert.equal(E.transportWorkers(s), 2);
  E.economyTick(s);
  assert.ok(s.world.materials.essence > before);
});
test('R09 changes payment and timer, removes unfinished old-price work', () => {
  let s = fixture();
  own(s, 'R09');
  restored(s, 'S01');
  s = S.toggleFacility(s, 'S01', true);
  S.siteEconomyTick(s, 20);
  s = R.configureTownRelic(s, 'R09', { target: 'S01' });
  assert.equal(s.worldExploration.facilities.S01.progress, 0);
  const q = S.facilityModeQuote(s, 'S01', 'A');
  assert.equal(q.cost.food, 18);
  assert.equal(q.cost.wood, 12);
  assert.equal(q.seconds, 132);
  S.siteEconomyTick(s, 20);
  s = R.configureTownRelic(s, 'R09', null);
  assert.equal(s.worldExploration.facilities.S01.progress, 0);
});
test('R07 only promotes a real upstream arrival and cannot consume one board twice', () => {
  function ready(arrived) {
    let s = fixture();
    own(s, 'R07');
    restored(s, 'S04', 'A');
    restored(s, 'S05', 'A');
    s = R.configureTownRelic(s, 'R07', { source: 'boards', target: 'S05' });
    s = S.toggleFacility(s, 'S04', true);
    s = S.toggleFacility(s, 'S05', true);
    s.world.materials.boards = 1;
    for (const id of ['S04', 'S05']) {
      s.worldExploration.facilities[id].progress = 149;
      s.worldExploration.facilities[id].batchQuote = {
        ...S.facilityModeQuote(s, id, 'A'),
        reason: '',
      };
    }
    if (arrived) s.worldExploration.relics.runtime.arrivals.boards = 1;
    return s;
  }
  const linked = ready(true);
  S.siteEconomyTick(linked, 1);
  assert.equal(linked.worldExploration.facilities.S05.completed, 1);
  assert.equal(linked.worldExploration.facilities.S04.completed, 0);
  assert.equal(linked.world.materials.boards, 0);
  const ordinary = ready(false);
  S.siteEconomyTick(ordinary, 1);
  assert.equal(ordinary.worldExploration.facilities.S04.completed, 1);
  assert.equal(ordinary.worldExploration.facilities.S05.completed, 0);
});
test('R11 counts whole batches when R03 subdivides and survives reload', () => {
  let s = fixture();
  own(s, 'R03');
  own(s, 'R11');
  const d = E.DEVELOPMENTS.find((x) => x.work === 'boards');
  s.economy.development[d.id] = 4;
  const choices = E.processingVariants(s, 'boards');
  assert.ok(choices.length >= 2);
  s = R.configureTownRelic(s, 'R03', { target: 'boards' });
  s = R.configureTownRelic(s, 'R11', {
    target: 'boards',
    recipes: [choices[0].variant, choices[1].variant],
    counts: [2, 3],
    skipBlocked: false,
  });
  s.world.work.boards = true;
  const perItem = C.workDuration(s, 'boards') / E.processingOutput(s, 'boards');
  E.relicProcessingTick(s, perItem);
  assert.equal(s.worldExploration.relics.runtime.sequenceBatches, 0);
  const resumed = structuredClone(s);
  resumed.worldExploration = JSON.parse(
    JSON.stringify(resumed.worldExploration),
  );
  for (let n = 0; n < 180; n++) {
    E.relicProcessingTick(s, 1);
    E.relicProcessingTick(resumed, 1);
  }
  assert.deepEqual(s.worldExploration, resumed.worldExploration);
  assert.deepEqual(s.resources, resumed.resources);
  assert.ok(s.world.materials.boards > E.processingOutput(s, 'boards'));
});
test('R01 cannot borrow locked or unfunded work and never creates an extra station', () => {
  let s = fixture();
  own(s, 'R01');
  s.world.work.boards = true;
  s.world.work.steel = true;
  s.world.materials.ore = 0;
  s = R.configureTownRelic(s, 'R01', {
    mode: 'lend',
    source: 'steel',
    target: 'boards',
  });
  E.relicProcessingTick(s, 1);
  assert.equal(s.world.workProgress.boards, 1);
  assert.equal(s.worldExploration.relics.runtime.handSeconds, 0);
  s = R.configureTownRelic(s, 'R01', null);
  s.buildings.forge = 0;
  assert.notEqual(
    R.townRelicReason(s, 'R01', {
      mode: 'lend',
      source: 'steel',
      target: 'boards',
    }),
    '',
  );
});
test('repair and batch snapshots reject changed bills, and combat loadout excludes reserves', () => {
  let s = fixture();
  restored(s, 'S01');
  s = S.toggleFacility(s, 'S01', true);
  S.siteEconomyTick(s, 1);
  const bad = structuredClone(s);
  bad.worldExploration.facilities.S01.batchQuote.cost.gold = 0;
  assert.equal(S.validateWorldEconomy(bad), false);
  own(s, 'R02');
  const a = G.makeApplicant(s, 'kael'),
    b = G.makeApplicant(s, 'rhea');
  s.heroes = [a, b];
  s.party = [a.id];
  s = R.assignCombatRelic(s, 'R02', b.id);
  assert.deepEqual(R.combatRelicLoadout(s), {});
  s = R.assignCombatRelic(s, 'R02', a.id);
  assert.deepEqual(R.combatRelicLoadout(s), { [a.id]: 'R02' });
});
test('facility clocks match segmented save/load and reject invalid new state', () => {
  let a = fixture();
  restored(a, 'S01');
  a = S.toggleFacility(a, 'S01', true);
  const b = structuredClone(a);
  S.siteEconomyTick(a, 360);
  for (let n = 0; n < 6; n++) {
    S.siteEconomyTick(b, 60);
    b.worldExploration = JSON.parse(JSON.stringify(b.worldExploration));
  }
  assert.deepEqual(a.worldExploration, b.worldExploration);
  assert.deepEqual(a.resources, b.resources);
  const bad = structuredClone(a);
  bad.worldExploration.facilities.S01.progress = -1;
  assert.equal(S.validateWorldEconomy(bad), false);
  bad.worldExploration = structuredClone(a.worldExploration);
  bad.worldExploration.relics.runtime.handSeconds = 61;
  assert.equal(S.validateWorldEconomy(bad), false);
});

const TOWN_RELICS = ['R01', 'R03', 'R05', 'R07', 'R09', 'R11'];
const restoreSave = (s) => G.decodeSave(JSON.stringify(s));

// Pairwise mechanism fixture with a fully valid v11 save shape. Chapter clears,
// discoveries, stock, development and previously restored facilities are
// arranged explicitly; this is not an acquisition/balance playthrough. Relic
// repair payments and all subsequent work use shipping actions and ticks.
function pairFixture() {
  const s = recommendedFixture(5, 6);
  s.cleared = [0, 1, 2, 3, 4, 5];
  s.ending = true;
  s.guild.depths.fill(5);
  s.guild.progress.fill(0);
  s.world.tech = C.TECHNOLOGIES.map((t) => t.id);
  s.population = Math.min(G.populationCap(s), 30);
  s.economy.development.logistics = 12;
  for (const k of Object.keys(s.jobs)) s.jobs[k] = 0;
  for (const id of C.WORK_IDS) {
    const dev = E.DEVELOPMENTS.find((d) => d.work === id);
    s.economy.development[dev.id] = 4;
    s.world.work[id] = false;
  }
  s.worldExploration = G.freshWorldExploration();
  G.discoverSites(s, false);
  for (const d of G.SITES) {
    s.worldExploration.sites[d.id].firstCompleted = true;
    s.worldExploration.sites[d.id].routesCompleted = ['clever'];
    S.awardSiteRelic(s, d.id);
  }
  for (const k of Object.keys(s.resources))
    s.resources[k] = G.capacity(s, k) * 0.7;
  for (const k of C.MATERIAL_IDS)
    s.world.materials[k] = C.materialCapacity(s, k) * 0.2;
  s.nextEventAt = 1e8;
  assert.deepEqual(restoreSave(s), s);
  return s;
}

function repairedPair(pair) {
  let s = pairFixture();
  let seconds = 0;
  for (const id of pair) {
    const q = R.relicRepairQuote(s, id),
      before = structuredClone(s.resources);
    assert.equal(q.reason, '');
    s = R.repairRelic(s, id);
    for (const [k, n] of Object.entries(q.cost))
      assert.equal(s.resources[k], before[k] - n);
    assert.equal(s.worldExploration.relics.owned[id].operation.paid, true);
    assert.equal(R.repairRelic(s, id), s, 'repair cannot be paid twice');
    assert.deepEqual(restoreSave(s), s, 'prepaid repair reload is exact');
    seconds = Math.max(seconds, q.seconds);
  }
  const whole = G.advance(s, seconds);
  let split = G.advance(restoreSave(s), 1);
  assert.deepEqual(
    restoreSave(split),
    split,
    'repair in progress reload is exact',
  );
  split = G.advance(restoreSave(split), seconds - 1);
  assert.deepEqual(split, whole, 'repair completion does not charge again');
  for (const id of pair)
    assert.equal(whole.worldExploration.relics.owned[id].repaired, true);
  return whole;
}

function configurePair(s, pair, separate = false) {
  for (const [index, id] of pair.entries()) {
    const target = separate && index === 1 ? 'steel' : 'boards';
    const options =
      id === 'R01'
        ? { mode: 'hand', target }
        : id === 'R03'
          ? { target }
          : id === 'R05'
            ? { routes: [0, 1], counts: [2, 3] }
            : id === 'R07'
              ? { source: target, target: target === 'boards' ? 'S05' : 'S07' }
              : id === 'R09'
                ? { target: pair.includes('R07') && !separate ? 'S05' : 'S01' }
                : {
                    target,
                    recipes: E.processingVariants(s, target)
                      .slice(0, 2)
                      .map((v) => v.variant),
                    counts: [2, 3],
                    skipBlocked: false,
                  };
    if (id === 'R05')
      for (const r of [0, 1])
        s.economy.routes[r] = {
          level: 1,
          crew: 1,
          enabled: true,
          delivered: 0,
        };
    if (id === 'R07' || id === 'R09') restored(s, options.target);
    assert.equal(
      R.townRelicReason(s, id, options),
      '',
      `${pair.join(' + ')}/${id} deploy`,
    );
    s = R.configureTownRelic(s, id, options);
  }
  for (const id of C.WORK_IDS) s.world.work[id] = true;
  for (const cfg of s.worldExploration.relics.town)
    if (['R07', 'R09'].includes(cfg.id))
      s = S.toggleFacility(s, cfg.target, true);
  assert.equal(s.worldExploration.relics.town.length, 2);
  assert.deepEqual(restoreSave(s), s);
  return s;
}

for (let i = 0; i < TOWN_RELICS.length; i++)
  for (let j = i + 1; j < TOWN_RELICS.length; j++) {
    const pair = [TOWN_RELICS[i], TOWN_RELICS[j]];
    test(`${pair.join(' + ')}: paid repair, two-slot coexistence and segmented full-save clocks`, () => {
      const repaired = repairedPair(pair);
      // Different processing targets (or different linked facilities) exercise
      // the same scheduler without implicitly sharing its one selected target.
      const separable =
        pair.every((id) => ['R01', 'R03', 'R07', 'R11'].includes(id)) ||
        pair.join() === 'R07,R09';
      for (const separate of separable ? [false, true] : [false]) {
        let start = configurePair(structuredClone(repaired), pair, separate);
        start = G.advance(start, 1);
        assert.deepEqual(
          restoreSave(start),
          start,
          'paid support / open batch reload',
        );
        if (pair.includes('R01'))
          assert.ok(start.worldExploration.relics.runtime.handSeconds > 0);
        const whole = G.advance(start, 360);
        let split = restoreSave(start);
        for (const dt of [1, 17, 59, 113, 170])
          split = restoreSave(G.advance(split, dt));
        assert.deepEqual(
          split,
          whole,
          `${pair.join(' + ')}: continuous and segmented execution`,
        );
        assert.equal(S.validateWorldEconomy(whole), true);
        assert.ok(
          C.WORK_IDS.some(
            (id) => whole.economy.crafted[id] > start.economy.crafted[id],
          ),
        );
        for (const [k, n] of Object.entries(whole.resources))
          assert.ok(n >= 0 && n <= G.capacity(whole, k) + 1e-7);
        for (const [k, n] of Object.entries(whole.world.materials))
          assert.ok(n >= 0 && n <= C.materialCapacity(whole, k) + 1e-7);
        if (pair.includes('R05'))
          for (const r of [0, 1])
            assert.ok(whole.economy.routes[r].delivered > 0);
        for (const cfg of whole.worldExploration.relics.town)
          if (['R07', 'R09'].includes(cfg.id))
            assert.ok(
              whole.worldExploration.facilities[cfg.target].completed > 0,
            );
      }
    });
  }

test('R01 and R11 charge one maintenance purchase and the two real recipe bills', () => {
  let s = repairedPair(['R01', 'R11']);
  s = R.configureTownRelic(s, 'R01', { mode: 'hand', target: 'boards' });
  s = R.configureTownRelic(s, 'R11', {
    target: 'boards',
    recipes: ['original', 'joinery'],
    counts: [1, 1],
    skipBlocked: false,
  });
  s.world.work.boards = true;
  const before = structuredClone(s),
    bills = [];
  for (const variant of ['original', 'joinery']) {
    const view = structuredClone(s);
    view.economy.variants.boards = variant;
    bills.push({
      bill: E.processingBill(view, 'boards'),
      seconds: C.workDuration(view, 'boards'),
      output: E.processingOutput(view, 'boards'),
    });
  }
  E.relicProcessingTick(s, bills[0].seconds / 1.25);
  assert.equal(s.worldExploration.relics.runtime.sequenceIndex, 1);
  assert.deepEqual(restoreSave(s), s);
  const paid = restoreSave(s);
  E.relicProcessingTick(s, bills[1].seconds / 1.25);
  E.relicProcessingTick(paid, bills[1].seconds / 1.25);
  assert.deepEqual(paid, s, 'loading cannot re-charge maintained support');
  for (const k of Object.keys(s.resources))
    assert.ok(
      Math.abs(
        s.resources[k] -
          (before.resources[k] -
            bills.reduce((n, q) => n + (q.bill.cost[k] || 0), 0) -
            (k === 'food' ? 6 : 0)),
      ) < 1e-7,
      k,
    );
  assert.equal(
    s.world.materials.boards,
    before.world.materials.boards + bills[0].output + bills[1].output,
  );
  assert.equal(s.world.materials.timber, before.world.materials.timber - 1);
  assert.equal(s.worldExploration.relics.runtime.sequenceIndex, 0);
});

test('R01 lending cannot occupy another relic source/target and leaves no free worker', () => {
  for (const other of ['R03', 'R07', 'R11']) {
    let s = repairedPair(['R01', other]);
    s = R.configureTownRelic(s, 'R01', {
      mode: 'lend',
      source: 'steel',
      target: 'boards',
    });
    const blocked =
      other === 'R03'
        ? { target: 'steel' }
        : other === 'R07'
          ? { source: 'steel', target: 'S07' }
          : {
              target: 'steel',
              recipes: ['original', 'crucible'],
              counts: [2, 3],
              skipBlocked: false,
            };
    if (other === 'R07') restored(s, 'S07');
    assert.match(R.townRelicReason(s, other, blocked), /借出加工线/);
    assert.equal(R.configureTownRelic(s, other, blocked), s);
    assert.equal(S.relicWorkers(s), 1);
    assert.deepEqual(restoreSave(s), s);
  }
});

test('R03 plus R11 counts exactly two and three whole batches across partial-save resumes', () => {
  let s = repairedPair(['R03', 'R11']);
  s = R.configureTownRelic(s, 'R03', { target: 'boards' });
  s = R.configureTownRelic(s, 'R11', {
    target: 'boards',
    recipes: ['original', 'joinery'],
    counts: [2, 3],
    skipBlocked: false,
  });
  s.world.work.boards = true;
  const before = structuredClone(s),
    expected = structuredClone(s.resources);
  let output = 0;
  for (const [index, count] of [
    [0, 2],
    [1, 3],
  ])
    for (let batch = 0; batch < count; batch++) {
      const duration = C.workDuration(s, 'boards'),
        pieces = E.processingOutput(s, 'boards'),
        bill = E.processingBill(s, 'boards');
      assert.equal(pieces, 2);
      E.relicProcessingTick(s, duration / pieces);
      assert.equal(s.worldExploration.relics.runtime.sequenceIndex, index);
      assert.equal(
        s.worldExploration.relics.runtime.sequenceBatches,
        batch,
        'one item is not a whole batch',
      );
      s = restoreSave(s);
      E.relicProcessingTick(s, duration / pieces);
      assert.equal(
        s.worldExploration.relics.runtime.sequenceIndex,
        batch + 1 === count ? 1 - index : index,
      );
      assert.equal(
        s.worldExploration.relics.runtime.sequenceBatches,
        batch + 1 === count ? 0 : batch + 1,
      );
      for (const [k, n] of Object.entries(bill.cost))
        expected[k] -= Math.ceil(n / pieces - 1e-8) * pieces;
      output += pieces;
      s = restoreSave(s);
    }
  assert.deepEqual(s.resources, expected);
  assert.equal(
    s.world.materials.boards,
    before.world.materials.boards + output,
  );
  assert.equal(s.world.materials.timber, before.world.materials.timber - 2);
  assert.equal(s.worldExploration.relics.runtime.sequenceIndex, 0);
});

test('R07 plus R09 consumes one real arriving board once and pays the substituted facility bill', () => {
  let s = repairedPair(['R07', 'R09']);
  const dev = E.DEVELOPMENTS.find((d) => d.work === 'boards');
  s.economy.development[dev.id] = 0;
  restored(s, 'S04');
  restored(s, 'S05');
  s = R.configureTownRelic(s, 'R07', { source: 'boards', target: 'S05' });
  s = R.configureTownRelic(s, 'R09', { target: 'S05' });
  s = S.toggleFacility(s, 'S04', true);
  s = S.toggleFacility(s, 'S05', true);
  // Arrange two already quoted batches one second before completion. With
  // only one board arriving this tick, normal S04 order must yield to R07.
  for (const id of ['S04', 'S05']) {
    const q = S.facilityModeQuote(s, id, 'A');
    s.worldExploration.facilities[id].batchQuote = { ...q, reason: '' };
    s.worldExploration.facilities[id].progress = q.seconds - 1;
  }
  const facility = S.facilityModeQuote(s, 'S05', 'A'),
    original = S.FACILITY_MODES.find((d) => d.id === 'S05A');
  assert.equal(
    facility.cost.food,
    original.cost.food - Math.floor(original.cost.food * 0.25),
  );
  assert.equal(facility.seconds, original.seconds * 1.1);
  s.world.materials.boards = 0;
  s.world.work.boards = true;
  s.world.workProgress.boards = C.workDuration(s, 'boards') - 1;
  const processing = E.processingBill(s, 'boards'),
    before = structuredClone(s);
  assert.equal(E.processingOutput(s, 'boards'), 1);
  s = restoreSave(s);
  C.worldTick(s, 1);
  assert.equal(s.worldExploration.relics.runtime.arrivals.boards, 1);
  assert.equal(s.world.materials.boards, 1);
  s = restoreSave(s);
  S.siteEconomyTick(s, 1);
  assert.equal(s.worldExploration.facilities.S05.completed, 1);
  assert.equal(s.worldExploration.facilities.S04.completed, 0);
  assert.equal(s.world.materials.boards, 0);
  for (const [k, n] of Object.entries(s.resources))
    assert.ok(
      Math.abs(
        n -
          (before.resources[k] -
            (processing.cost[k] || 0) -
            (facility.cost[k] || 0) +
            (facility.outputCost[k] || 0)),
      ) < 1e-7,
      k,
    );
  for (const [k, n] of Object.entries(s.world.materials))
    assert.ok(
      Math.abs(
        n -
          (before.world.materials[k] -
            (processing.materials[k] || 0) -
            (facility.materials[k] || 0) +
            (facility.outputMaterials[k] || 0) +
            (k === 'boards' ? 1 : 0)),
      ) < 1e-7,
      k,
    );
  assert.deepEqual(restoreSave(s), s);
});
