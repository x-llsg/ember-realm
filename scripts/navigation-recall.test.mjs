import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/realm.ts';

// External regression only. Constructed, validator-accepted unit states; not a
// legal-playthrough simulation. No browser/profile/player-save or Site writes.
// Run: node --experimental-strip-types --test <this absolute file path>
const copy = structuredClone;
const reload = s => G.decodeSave(JSON.stringify(s));
function fixture() {
  const s = G.freshState(18273645);
  s.buildings.fire = 1;
  s.buildings.hut = 1;
  s.buildings.lumber = 1;
  s.buildings.farm = 1;
  s.buildings.warehouse = 2;
  s.buildings.tavern = 1;
  s.population = 6;
  s.assigned = true;
  s.event = null;
  s.nextEventAt = 100000;
  s.guild.depths[0] = 2; // Open maps 1 and 2 in this bounded unit state.
  s.guild.progress[0] = 11;
  s.guild.intel[0] = 17;
  s.guild.failures[0] = 2;
  const h = G.makeApplicant(s, 'rhea');
  h.level = 3;
  h.quality = 5;
  h.xp = 37;
  s.heroes.push(h);
  s.party.push(h.id);
  G.ensureApplicants(s);
  for (const resource of Object.keys(G.RESOURCE_NAMES)) s.resources[resource] = G.capacity(s, resource);
  assert.deepEqual(reload(s), s, 'fixture must satisfy current validator');
  assert.equal(G.regionOpen(s, 1), true);
  assert.equal(G.regionOpen(s, 2), true);
  assert.equal(G.regionOpen(s, 5), false);
  return s;
}
function departure(route, repeat = true) {
  const s = fixture();
  assert.equal(G.dispatchReason(s, 0, route, 0), '', `${route} must be dispatchable`);
  const cost = G.routeInfo(s, 0, route).cost;
  const next = repeat
    ? G.setOrder(s, { region: 0, route, reserve: 0, autoBuy: false, enabled: true })
    : G.expedition(s, 0, route);
  assert.ok(next.expedition, `${route} must create a real expedition`);
  assert.equal(next.resources.food, s.resources.food - cost, 'departure consumes exact food before cancellation');
  assert.deepEqual(reload(next), next, 'departed fixture must serialize');
  return next;
}
function rewards(s) {
  return copy({
    resources: s.resources,
    materials: s.world.materials,
    heroes: s.heroes,
    party: s.party,
    guild: s.guild,
    survey: s.survey,
    explored: s.explored,
    projects: s.projects,
    cleared: s.cleared,
    lastExpedition: s.lastExpedition,
    peaceRuns: s.peaceRuns,
    legacy: s.legacy,
    journeys: s.journeys,
    recoveryUntil: s.recoveryUntil,
    time: s.time,
    rng: s.rng,
  });
}
function progression(s) {
  return copy({
    heroes: s.heroes,
    materials: s.world.materials,
    depths: s.guild.depths,
    progress: s.guild.progress,
    intel: s.guild.intel,
    failures: s.guild.failures,
    inventory: s.guild.inventory,
    dust: s.guild.dust,
    survey: s.survey,
    explored: s.explored,
    cleared: s.cleared,
    lastExpedition: s.lastExpedition,
    peaceRuns: s.peaceRuns,
  });
}

test('recall every route: no reward, refund, progress, XP, RNG or time advance; stops repeat and releases party', () => {
  for (const route of ['survey', 'supply', 'frontier']) {
    const before = departure(route), original = copy(before);
    assert.equal(G.heroAway(before, before.party[0]), true);
    const after = G.recallExpedition(before);
    assert.notEqual(after, before);
    assert.deepEqual(before, original, 'recall must not mutate input');
    assert.equal(after.expedition, null);
    assert.equal(after.order.enabled, false);
    assert.equal(G.heroAway(after, after.party[0]), false);
    assert.deepEqual(rewards(after), rewards(before), `${route}: cancellation must not settle any rewards or give a food refund`);
    assert.ok(after.log[0].text.includes('撤回'));
    assert.deepEqual(reload(after), after);
    assert.equal(G.recallExpedition(after), after, 'second recall must be idempotent');
  }
});

test('paused expedition can be recalled immediately, before and after save/load', () => {
  for (const loadFirst of [false, true]) {
    let before = departure('survey');
    before.paused = true;
    if (loadFirst) before = reload(before);
    const after = G.recallExpedition(before);
    assert.equal(after.paused, true);
    assert.equal(after.time, before.time);
    assert.equal(after.expedition, null);
    assert.equal(after.order.enabled, false);
    assert.deepEqual(rewards(after), rewards(before));
    assert.deepEqual(reload(after), after);
  }
});

test('cancelled pre-rolled success/failure cannot pay out later or consume frontier pity', () => {
  for (const success of [true, false]) {
    const before = departure('frontier');
    before.expedition.success = success;
    before.expedition.outcome = success ? 3 : 2;
    const due = before.expedition.end - before.time;
    const after = G.recallExpedition(reload(before));
    const late = G.advance(after, due + 10);
    assert.equal(late.expedition, null, 'disabled repeat cannot re-dispatch');
    assert.equal(late.order.enabled, false);
    assert.equal(late.battle, null, 'cancel cannot promote a trip into a guardian battle');
    assert.deepEqual(progression(late), progression(after), 'crossing the old return time must not settle rewards, XP, clues or pity');
    assert.deepEqual(reload(late), late);
  }
});

test('recall also works for a single trip and preserves the previous completed report', () => {
  let s = departure('survey', false);
  const seconds = s.expedition.end - s.time;
  s = G.advance(s, seconds);
  assert.ok(s.lastExpedition, 'fixture must have an actual completed report');
  s.order.enabled = false;
  s.recoveryUntil = s.time;
  s.resources.food = G.capacity(s, 'food');
  const previous = copy(s.lastExpedition);
  s = G.expedition(s, 0, 'supply');
  assert.ok(s.expedition);
  const after = G.recallExpedition(s);
  assert.equal(after.order.enabled, false);
  assert.deepEqual(after.lastExpedition, previous, 'cancel must not overwrite a completed report with fabricated results');
  assert.deepEqual(reload(after), after);
});

test('rememberMap accepts only open integer maps, mutates no gameplay state, and is idempotent', () => {
  const s = fixture();
  const original = copy(s);
  const next = G.rememberMap(s, 2);
  assert.equal(next.lastMap, 2);
  assert.notEqual(next, s);
  assert.deepEqual(s, original);
  const expected = copy(s); expected.lastMap = 2;
  assert.deepEqual(next, expected, 'map browsing must change only lastMap');
  assert.equal(G.rememberMap(next, 2), next);
  for (const invalid of [-1, 3, 4, 5, 6, 1.5, NaN, Infinity, undefined, null, '1']) {
    assert.equal(G.rememberMap(next, invalid), next, `${String(invalid)} must not replace an open-map choice`);
  }
  const unopened = G.freshState(42);
  assert.equal(G.rememberMap(unopened, 1), unopened, 'a brand-new game cannot reveal another map through memory');
  assert.deepEqual(reload(next), next);
});

test('remembered map survives gathering, training, departure, recall, time advance and save roundtrip', () => {
  let s = G.rememberMap(fixture(), 2);
  s.resources.wood -= 30;
  const gathered = G.gather(s, 'wood');
  assert.notEqual(gathered, s, 'cross-operation check must execute an actual gather');
  s = gathered;
  const trained = G.train(s, s.party[0]);
  assert.notEqual(trained, s, 'cross-operation check must execute actual training');
  s = trained;
  assert.equal(s.lastMap, 2);
  s = G.expedition(s, 0, 'survey');
  assert.ok(s.expedition);
  assert.equal(s.lastMap, 2, 'a background trip must not replace the map the player chose to browse');
  s = reload(G.recallExpedition(s));
  assert.equal(s.lastMap, 2);
  s = G.advance(s, 3);
  assert.equal(s.lastMap, 2);
  s = G.rememberMap(s, 1);
  assert.equal(s.lastMap, 1, 'an explicit new selection takes precedence');
  assert.deepEqual(reload(s), s);
});
