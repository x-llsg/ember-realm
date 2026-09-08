import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import * as G from '../lib/realm.ts';

// The first-research path starts at freshState and uses only real public actions.
// No stock injection, event choices, permanent visitor boosts, or state rewrites occur.
// Only explicitly labelled legacy/invalid-job unit fixtures are constructed later.
const clone = x => structuredClone(x);
const keys = Object.keys(G.RESOURCE_NAMES);
function firstResearch(seed = 246813579) {
  let s = G.freshState(seed);
  const trace = [], stages = { initial: clone(s) }, gatherCounts = {};
  function act(label, fn) {
    const before = clone(s), next = fn(s);
    assert.notEqual(next, s, `${label} must execute`);
    assert.deepEqual(s, before, `${label} mutated input`);
    s = G.settleStory(next);
    assert.deepEqual(s.flags, [], 'no permanent visitor benefits are allowed');
    assert.deepEqual(s.eventDone, [], 'no event option is selected');
    assert.ok(keys.every(k => s.resources[k] <= G.capacity(s, k) + 1e-8));
    trace.push({label,time:s.time,resources:clone(s.resources),population:s.population,jobs:clone(s.jobs)});
  }
  function wait(seconds) { if (seconds > 0) act(`wait ${seconds}`, x => G.advance(x, seconds)); }
  function gather(id) {
    wait(G.gatherCooldown(s, id));
    assert.equal(G.gatherReason(s, id), '', `gather ${id}`);
    act(`gather ${id}`, x => G.gather(x, id));
    gatherCounts[id] = (gatherCounts[id] || 0) + 1;
  }
  function afford(cost) {
    for (const [id, amount] of Object.entries(cost)) {
      assert.ok(amount <= G.capacity(s, id), `reachable capacity for ${id}`);
      let attempts = 0;
      while (s.resources[id] + 1e-8 < amount) {
        assert.ok(++attempts < 200, `bounded reachable source for ${id}`);
        assert.equal(G.resourceDiscovered(s, id), true, `${id} must already be discovered`);
        gather(id);
      }
    }
    assert.ok(G.canPay(s, cost));
  }
  function build(id) {
    assert.equal(G.buildingDiscovered(s, id), true, `${id} must be discovered before the path builds it`);
    afford(G.buildingCost(s, id));
    assert.equal(G.buildingReason(s, id), '', id);
    act(`build ${id}`, x => G.build(x, id));
  }
  function resident() { afford({food:10});act('accept resident', x => G.hireWorker(x)); }
  function assign(job) { assert.equal(G.jobReason(s, job), '');act(`assign ${job}`, x => G.assign(x, job, 1)); }
  build('fire'); stages.fire = clone(s);
  build('hut'); stages.hut = clone(s);
  resident(); stages.resident = clone(s);
  build('lumber'); stages.lumber = clone(s);
  assign('wood'); stages.woodWorker = clone(s);
  build('farm'); stages.farm = clone(s);
  resident(); assign('food'); stages.foodWorker = clone(s);
  build('quarry'); stages.quarry = clone(s);
  resident(); assign('stone'); stages.stoneWorker = clone(s);
  const research = G.RESEARCH.find(r => r.id === 'tools');
  assert.equal(G.researchDiscovered(s, research.id), true);
  afford(research.cost);
  assert.equal(G.researchReason(s, research.id), '');
  stages.beforeResearch = clone(s);
  act(`research ${research.id}`, x => G.research(x, research.id));
  stages.researched = clone(s);
  return {state:s,stages,trace,gatherCounts,seconds:s.time,actions:trace.filter(x=>!x.label.startsWith('wait ')).length};
}
const run = firstResearch();
mkdirSync(new URL('../.test-results/',import.meta.url),{recursive:true});
writeFileSync(new URL('../.test-results/first-research-public-actions.json', import.meta.url), JSON.stringify({
  scope:'Real freshState -> public actions -> first research. No resource injection or visitor benefit.',
  seconds:run.seconds,actions:run.actions,gatherCounts:run.gatherCounts,trace:run.trace,final:run.state,
}, null, 2));

test('an isolated new arrival earns no passive resources or residents by waiting', () => {
  const s = G.freshState(123456789), waited = G.advance(s, 300);
  assert.equal(s.population, 0);assert.ok(Object.values(s.jobs).every(n=>n===0));
  assert.deepEqual(waited.resources, s.resources);
  assert.equal(waited.population, 0);
  assert.deepEqual(waited.jobs, s.jobs);
  assert.deepEqual(waited.flags, []);
});

test('six real timed 2-wood pickups are required before the 12-wood fire', () => {
  let s = G.freshState(246813579);
  assert.equal(G.buildingCost(s,'fire').wood, 12);
  for(let n=1;n<=6;n++) {
    if(G.gatherCooldown(s,'wood')) s=G.advance(s,G.gatherCooldown(s,'wood'));
    const before=s.resources.wood;s=G.gather(s,'wood');
    assert.equal(s.resources.wood-before,2);assert.equal(s.resources.wood,n*2);
    assert.equal(G.gather(s,'wood'),s,'a click during cooldown must do nothing');
    if(n<6)assert.equal(G.build(s,'fire'),s);
  }
  const lit=G.build(s,'fire');assert.equal(lit.buildings.fire,1);
  assert.ok(Object.values(lit.resources).every(n=>n===0));
  assert.equal(lit.population,0);assert.ok(Object.values(lit.jobs).every(n=>n===0));
  assert.equal(G.manualAmount(lit,'wood'),4);
  assert.equal(G.manualAmount(lit,'food'),3);
});

test('fire -> shelter -> resident -> lumber -> wood worker -> farm -> food worker progressively opens the path', () => {
  const x=run.stages;
  assert.deepEqual(G.BUILDINGS.filter(b=>G.buildingDiscovered(x.fire,b.id)&&!x.fire.buildings[b.id]).map(b=>b.id),['hut']);
  assert.equal(G.viewDiscovered(x.hut,'research'),false);
  assert.equal(G.buildingDiscovered(x.hut,'lumber'),false);
  assert.equal(G.buildingDiscovered(x.resident,'lumber'),true);
  assert.equal(G.buildingDiscovered(x.resident,'farm'),false);
  assert.equal(G.production(x.lumber).wood,0,'building alone is not a worker');
  assert.equal(G.buildingDiscovered(x.woodWorker,'farm'),true);
  assert.ok(G.production(x.woodWorker).wood>0);
  assert.equal(G.production(x.farm).food,0,'new farm does not appoint a worker');
  assert.equal(G.viewDiscovered(x.farm,'research'),false);
  assert.ok(G.production(x.foodWorker).food>0);
  assert.equal(G.viewDiscovered(x.foodWorker,'research'),true);
  assert.equal(G.buildingDiscovered(x.foodWorker,'quarry'),true);
});

test('real zero-stock public actions reach the first research without events or injected resources', () => {
  assert.deepEqual(run.state.research,['tools']);
  assert.equal(run.state.population,3);
  assert.equal(run.state.jobs.wood,1);assert.equal(run.state.jobs.food,1);assert.equal(run.state.jobs.stone,1);
  assert.deepEqual(run.state.flags,[]);assert.deepEqual(run.state.eventDone,[]);
  assert.ok(Object.values(run.state.world.materials).every(n=>n===0));
  assert.deepEqual(G.decodeSave(JSON.stringify(run.state)),run.state);
  const cost=G.RESEARCH.find(r=>r.id==='tools').cost;
  for(const k of keys)assert.equal(run.state.resources[k],run.stages.beforeResearch.resources[k]-(cost[k]||0));
});

test('first-research reachability does not depend on a lucky visitor seed', () => {
  for(const seed of [1,42,987654321]) {
    const other=firstResearch(seed);
    assert.ok(other.state.research.includes('tools'));
    assert.deepEqual(other.state.flags,[]);assert.deepEqual(other.state.eventDone,[]);
  }
});

test('new buildings do not create workers and absent buildings cannot generate worker output', () => {
  const blank=G.freshState(123), invalid=clone(blank);
  invalid.buildings.fire=1;invalid.population=3;invalid.jobs.wood=1;invalid.jobs.food=1;invalid.jobs.stone=1;
  assert.ok(Object.values(G.production(invalid)).every(n=>n===0));
  assert.deepEqual(G.advance(invalid,30).resources,invalid.resources);
  for(const id of keys)assert.equal(G.assign(run.stages.fire,id,1),run.stages.fire);
  assert.equal(run.stages.resident.population,1);
  assert.ok(Object.values(run.stages.resident.jobs).every(n=>n===0));
});

test('legacy unsupported wood and food assignments can be manually released before building their workplaces', () => {
  const legacy=clone(run.stages.fire);legacy.population=3;legacy.jobs.wood=1;legacy.jobs.food=1;
  const before=clone(legacy), wood=G.assign(legacy,'wood',-1), food=G.assign(wood,'food',-1);
  assert.deepEqual(legacy,before);
  assert.equal(G.idleWorkers(food),3);assert.equal(food.population,3);
  assert.deepEqual(food.resources,legacy.resources);
  assert.equal(G.assign(food,'wood',1),food,'missing lumber building still blocks reassignment');
});

test('loading an old valid-shape fire-only save returns unsupported jobs to idle without losing wealth or people', () => {
  // Constructed representation of the previous fire action, not a v7 legal new state.
  const legacy=clone(run.stages.fire);legacy.population=3;legacy.jobs.wood=1;legacy.jobs.food=1;
  legacy.resources.food=30;legacy.resources.stone=8;legacy.resources.gold=20;
  const before=clone(legacy), restored=G.decodeSave(JSON.stringify(legacy));
  assert.deepEqual(legacy,before);
  assert.equal(restored.population,3);assert.equal(G.idleWorkers(restored),3);
  assert.ok(Object.values(restored.jobs).every(n=>n===0));
  assert.deepEqual(restored.resources,legacy.resources);
  assert.deepEqual(G.decodeSave(JSON.stringify(restored)),restored);
  assert.equal(G.buildingDiscovered(restored,'hut'),true);
});

test('every objective along the earned early path points to a currently discovered destination', () => {
  for(const [name,s]of Object.entries(run.stages)) {
    const goal=G.objective(s);
    assert.equal(G.viewDiscovered(s,goal.view),true,`${name}: ${goal.title}`);
    if(goal.building)assert.equal(G.buildingDiscovered(s,goal.building),true,`${name}: hidden ${goal.building}`);
    if(goal.research)assert.equal(G.researchDiscovered(s,goal.research)||G.technologyDiscovered(s,goal.research),true,`${name}: hidden ${goal.research}`);
  }
});

test('learned early discovery survives spending and moving a worker back to idle', () => {
  // The workers story has already been earned, even though no research has been bought yet.
  const earned=run.stages.foodWorker;
  assert.ok(earned.chronicle.includes('workers'));
  const moved=G.assign(earned,'food',-1);
  assert.equal(G.viewDiscovered(moved,'research'),true,'first discovered research entry must persist after reassignment');
  assert.equal(G.buildingDiscovered(moved,'quarry'),true,'already revealed quarry must persist after reassignment');
  const spent=clone(moved);for(const key of keys)spent.resources[key]=0;
  assert.equal(G.viewDiscovered(spent,'research'),true);
});
