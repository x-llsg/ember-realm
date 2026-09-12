import * as G from '../lib/realm.ts';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

// Every campaign mutation goes through a public action. Forecasts only inspect clones.
const routeOrder = process.env.V7_ROUTE_ORDER || process.env.V6_ROUTE_ORDER || 'standard';
const outputDir = new URL(`../.test-results/v7-${routeOrder}/`, import.meta.url);
mkdirSync(outputDir, { recursive: true });
const seed = Number(process.env.REALM_TEST_SEED || 123456789);
assert.ok(
  Number.isInteger(seed) && seed > 0 && seed <= 0xffffffff,
  'valid reproducible 32-bit seed',
);
let s = G.freshState(seed),
  actions = 0,
  clockCalls = 0;
const keys = Object.keys(G.RESOURCE_NAMES);
const blank = () => Object.fromEntries(keys.map((k) => [k, 0]));
const results = {
  version: 7,
  rulesRevision: 'individual-turns-guardians-skill-trees',
  visitorDeferred: [],
  visitorChoices: [],
  researchInvestments: [],
  gearOrders: [],
  loadoutInvestments: [],
  routePreparation: [],
  seed,
  policy:
    'Legal steady growth; ordinary random applicant batches, three equipment slots, public recommended combat policy. No injected resources or progression.',
  warning:
    'All durations are simulated game-clock seconds, not measured human playtime. Forecast calls are not player actions.',
  accounting:
    'resourcesGained/producedAndLooted and resourcesSpent/spent sum positive/negative inventory changes per observed API step, including net workshop input consumption; they are not gross production. Expedition found/kept/lost separately record gross rolled rewards, stored rewards and capacity overflow.',
  stages: [],
  checks: [],
  recruitment: [],
  applicantRefreshes: [],
  actionKinds: {},
  totals: {
    producedAndLooted: blank(),
    spent: blank(),
    expeditionFound: blank(),
    expeditionKept: blank(),
    expeditionLost: blank(),
    trips: 0,
    failures: 0,
  },
};
const fixtures = {
  beforeBattles: [],
  afterVictories: [],
  afterVictory: null,
  afterRebuild: null,
  completed: null,
};
function save() {
  writeFileSync(
    new URL('fixtures.json', outputDir),
    JSON.stringify(fixtures, null, 2),
  );
  writeFileSync(
    new URL('balance-results.json', outputDir),
    JSON.stringify(results, null, 2),
  );
  writeFileSync(
    new URL('campaign.json', outputDir),
    JSON.stringify(results, null, 2),
  );
}
function diagnostic(message) {
  writeFileSync(
    new URL('blocked-state.json', outputDir),
    JSON.stringify(s, null, 2),
  );
  throw Error(
    `${message}: ${JSON.stringify({ time: s.time, resources: s.resources, jobs: s.jobs, buildings: s.buildings, stats: G.partyStats(s), guild: { depths: s.guild.depths, intel: s.guild.intel, outposts: s.guild.outposts }, order: s.order })}`,
  );
}
function account(before, after) {
  for (const k of keys) {
    const delta = after.resources[k] - before.resources[k];
    if (delta > 0) results.totals.producedAndLooted[k] += delta;
    else results.totals.spent[k] -= delta;
  }
}
function act(fn, label) {
  const before = s,
    original = JSON.stringify(s),
    next = fn(s);
  if (next === before) diagnostic('Blocked action ' + label);
  assert.equal(
    JSON.stringify(before),
    original,
    'public action mutated its input: ' + label,
  );
  account(before, next);
  if(!results.beforeFirstExpedition&&!before.expedition&&next.expedition&&before.explored.every(n=>n===0)){
    results.beforeFirstExpedition={time:before.time,actions,research:[...before.research],rank:G.townRank(before),stats:G.partyStats(before),resources:{...before.resources},discoverable:G.RESEARCH.filter(r=>G.researchDiscovered(before,r.id)).map(r=>r.id)};
    assert.deepEqual([...before.research].sort((a,b)=>a.localeCompare(b)),['baskets','tools'],'exactly two opening studies before first expedition');
  }
  if(label.startsWith('research:')){
    const id=label.slice(9),r=G.RESEARCH.find(r=>r.id===id);
    results.researchInvestments.push({id,time:before.time,rank:G.townRank(before),cost:r.cost,materials:r.materials||{},jobs:{...before.jobs},productionBefore:G.production(before),productionAfter:G.production(next)});
  }
  if(label.startsWith('gear:craft '))results.gearOrders.push({time:before.time,rank:G.townRank(before),recipe:label.slice(11),tier:G.gearTier(before),cost:G.recipeCost(before,label.slice(11)),materials:G.recipeMaterialCost(before,label.slice(11)),research:[...before.research],production:G.production(before)});
  const materialCategory=label.startsWith('gear:craft')?'craft':label.startsWith('gear:enhance')?'enhance':label.split(':')[0];
  materialAudit.spentByAction[materialCategory]??={};
  for(const k of G.MATERIAL_IDS){const amount=before.world.materials[k]-next.world.materials[k];if(amount>0)materialAudit.spentByAction[materialCategory][k]=(materialAudit.spentByAction[materialCategory][k]||0)+amount;}
  s = next;
  actions++;
  results.actionKinds[label.split(':')[0]] =
    (results.actionKinds[label.split(':')[0]] || 0) + 1;
  for (const k of keys)
    assert.ok(
      s.resources[k] >= -1e-7 && s.resources[k] <= G.capacity(s, k) + 1e-7,
      label + ': resource bounds ' + k,
    );
}
function advance(seconds) {
  if (seconds <= 0) return;
  const before = s;
  if(waitPurpose==='materials'){const kind=before.expedition?'transport':G.WORK_RECIPES.some(w=>before.world.work[w.id]&&!G.workReason(before,w.id))?'processing':G.WORK_RECIPES.some(w=>before.world.work[w.id])?'blockedWorkshop':'other';materialAudit.activitySeconds[kind]+=seconds;}
  for(const k of keys)if(before.resources[k]>=G.capacity(before,k)*0.999)fullSeconds[k]+=seconds;
  s = G.advance(s, seconds);
  clockCalls++;
  account(before, s);
  for(const w of G.WORK_RECIPES){const units=s.world.materials[w.id]-before.world.materials[w.id];if(units>0){materialAudit.produced[w.id]+=units;materialAudit.machineSeconds[w.id]+=units/w.output*G.workDuration(before,w.id);}}
  const trips = s.explored.reduce((v, n, i) => v + n - before.explored[i], 0);
  if (trips) {
    assert.equal(
      trips,
      1,
      'campaign clock must observe each individual expedition settlement',
    );
    results.totals.trips++;
    const report = s.lastExpedition;
    if (!report.success) results.totals.failures++;
    for (const [field, total] of [
      ['found', 'expeditionFound'],
      ['kept', 'expeditionKept'],
      ['lost', 'expeditionLost'],
    ])
      for (const k of keys) results.totals[total][k] += report[field][k] || 0;
  }
}
function tick(seconds) {
  waitByPurpose[waitPurpose]=(waitByPurpose[waitPurpose]||0)+seconds;
  let remaining = seconds;
  while (remaining > 0) {
    const untilReturn = s.expedition
      ? Math.max(1, Math.ceil(s.expedition.end - s.time))
      : remaining;
    const step = Math.min(remaining, untilReturn, G.MAX_OFFLINE);
    advance(step);
    remaining -= step;
  }
}
function rest() {
  if (s.recoveryUntil > s.time) tick(Math.ceil(s.recoveryUntil - s.time));
}
function stopOrder() {
  if(waitPurpose==='materials'&&s.order.enabled&&s.expedition&&s.expedition.start===s.time)materialAudit.surplusReturnSeconds+=Math.ceil(s.expedition.end-s.time);
  if (s.order.enabled)
    act((x) => G.setOrder(x, { enabled: false }), 'order:stop');
  if (s.expedition) tick(Math.ceil(s.expedition.end - s.time));
  rest();
}
function allocate() {
  const n = s.population;
  const desired =
    n < 6
      ? { wood: 2, food: 1, stone: 0, gold: 0, iron: 0, crystal: 0 }
      : n < 12
        ? { wood: 2, food: 1, stone: 1, gold: 2, iron: 0, crystal: 0 }
        : n < 18
          ? { wood: 3, food: 2, stone: 2, gold: 3, iron: 1, crystal: 1 }
          : n < 24
            ? { wood: 3, food: 3, stone: 3, gold: 5, iron: 2, crystal: 2 }
            : n < 30
              ? { wood: 4, food: 3, stone: 4, gold: 7, iron: 4, crystal: 2 }
              : { wood: 5, food: 4, stone: 5, gold: 9, iron: 4, crystal: 3 };
  let remaining=n;
  const available=keys.filter(k=>!G.jobReason(s,k));
  for(const k of keys){desired[k]=available.includes(k)?Math.min(desired[k],remaining):0;remaining-=desired[k];}
  if(remaining&&available.length)desired[available.includes('wood')?'wood':available[0]]+=remaining;
  assert.ok(Object.values(desired).every(v=>v>=0),'zero-population allocator must never request a negative job');
  assert.ok(Object.values(desired).reduce((a,b)=>a+b,0)<=n,'allocated jobs fit actual residents');
  for (const k of keys)
    while (s.jobs[k] > desired[k])
      act((x) => G.assign(x, k, -1), 'assign:remove ' + k);
  for (const k of keys)
    while (s.jobs[k] < desired[k])
      act((x) => G.assign(x, k, 1), 'assign:add ' + k);
}
function ensure(cost, label = 'resources') {
  const sources={stone:'quarry',gold:'market',iron:'forge',crystal:'shrine'};
  for(const [k,n] of Object.entries(cost))if(n>0&&s.resources[k]<n&&sources[k]&&!s.buildings[sources[k]]) {
    if(G.buildingReason(s,sources[k])){
      // Early building inputs may be gathered by hand before their industry exists.
      if(G.MANUAL[k]&&s.buildings[G.MANUAL[k].need])continue;
      throw new NeedProgress('Source needs progress: '+sources[k]+' / '+label);
    }
    build(sources[k],1);
  }
  for(const [k,n] of Object.entries(cost))if(n>0&&s.resources[k]<n&&!G.jobReason(s,k)&&s.jobs[k]===0){
    const donor=keys.find(j=>s.jobs[j]>1);
    if(donor)act(x=>G.assign(x,donor,-1),'assign:resource donor');
    if(G.idleWorkers(s)>0)act(x=>G.assign(x,k,1),'assign:resource needed');
  }

  while (G.capacityReason(s, cost)) {
    if (
      s.buildings.warehouse >= G.buildingLimit(s,'warehouse')
    )
      throw new NeedProgress('Cost exceeds current stage capacity '+label);
    ensure(G.buildingCost(s, 'warehouse'), 'warehouse expansion');
    ensureMaterials(G.buildingMaterialCost(s,'warehouse'));
    act((x) => G.build(x, 'warehouse'), 'build:warehouse');
  }
  const started = s.time;
  while (!G.canPay(s, cost)) {
    if (s.time - started > 86400)
      diagnostic('Resource wait exceeded 24 game hours ' + label);
    for (const [k, amount] of Object.entries(cost)) {
      if (s.resources[k] + 1e-8 >= amount || G.production(s)[k] > 0) continue;
      if (!G.gatherReason(s, k)) act((x) => G.gather(x, k), 'gather:' + k);
      else if (G.tradeUnlocked(s, k) && !G.tradeReason(s, k, true))
        act((x) => G.trade(x, k, true), 'trade:buy ' + k);
      else if (
        G.jobReason(s, k) &&
        G.gatherReason(s, k).startsWith('需要') &&
        !G.tradeUnlocked(s, k)
      )
        diagnostic('No unlocked material source for ' + k + ' / ' + label);
    }
    if (!G.canPay(s, cost)) tick(15);
  }
}
function build(id, level = 1) {
  while (s.buildings[id] < level) {
    if (G.buildingReason(s, id)) throw new NeedProgress(G.buildingReason(s,id));
    ensure(G.buildingCost(s, id), 'building ' + id);
    ensureMaterials(G.buildingMaterialCost(s,id));
    ensure(G.buildingCost(s,id),'reserved building '+id);
    const rateBefore=G.production(s),cost=G.buildingCost(s,id),materials=G.buildingMaterialCost(s,id),at=s.time;
    act((x) => G.build(x, id), 'build:' + id);
    investment.push({time:at,id,cost,materials,jobs:{...s.jobs},productionBefore:rateBefore,gain:Object.fromEntries(keys.map(k=>[k,G.production(s)[k]-rateBefore[k]]))});
    allocate();
  }
}
function people(n) {
  build('hut', Math.ceil((n - 3) / 3));
  while (s.population < n) {
    ensure({ food: 10 }, 'resident');
    act(G.hireWorker, 'resident:hire');
    allocate();
  }
}
function visitor() {
  if(s.event===null)return;
  const e=G.EVENTS[s.event],preferred=['refugees','merchant','waterwheel'].includes(e.id)?1:0;
  const choices=[preferred,1-preferred],choice=choices.find(i=>!G.eventChoiceReason(s,i));
  if(choice===undefined){
    if(e.repeat){act(G.declineVisitor,'visitor:decline');return;}
    const entry={time:s.time,id:e.id,reasons:e.choices.map((_,i)=>G.eventChoiceReason(s,i))};
    const last=results.visitorDeferred.at(-1);
    if(!last||last.id!==entry.id||JSON.stringify(last.reasons)!==JSON.stringify(entry.reasons))results.visitorDeferred.push(entry);
    return; // A full reward inventory postpones this optional visitor, never the campaign.
  }
  const before={time:s.time,id:e.id,choice,cost:e.choices[choice].cost,reward:e.choices[choice].reward||{},resources:{...s.resources},population:s.population,pendingSettlers:s.pendingSettlers};
  act(x=>G.chooseEvent(x,choice),'visitor:'+e.id);
  for(const k of keys)assert.ok(Math.abs(s.resources[k]-(before.resources[k]-(before.cost[k]||0)+(before.reward[k]||0)))<1e-6,'visitor exact finite resource settlement '+k);
  const after=s;assert.equal(G.chooseEvent(s,choice),after,'visitor second click does not charge or grant again');
  results.visitorChoices.push({...before,afterResources:{...s.resources},afterPopulation:s.population,afterPendingSettlers:s.pendingSettlers});
}

function study(id) {
  if (s.research.includes(id)) return;
  const r = G.RESEARCH.find((r) => r.id === id);
  if (!G.researchDiscovered(s,id)) throw new NeedProgress('Study is not discovered: '+id);
  if(r.discovery&&G.discoveryCount(s,r.discovery)<1)throw new NeedProgress('Study needs survey evidence: '+id);
  ensure(r.cost, 'research ' + id);
  ensureMaterials(r.materials||{});
  ensure(r.cost, 'reserved research ' + id);
  const reason=G.researchReason(s,id);if(reason)throw new NeedProgress('Research prerequisite '+id+': '+reason);
  act((x) => G.research(x, id), 'research:' + id);
}
function hire(id, method) {
  const h = s.guild.applicants.find((h) => h.id === id);
  ensure(G.recruitmentCost(h), 'recruit ' + h.role);
  act((x) => G.hireApplicant(x, id), 'recruit:' + method);
  results.recruitment.push({
    time: s.time,
    method,
    ...G.clone(s.heroes.find((h) => h.id === id)),
  });
}
function role(role) {
  const h = s.heroes.find((h) => h.role === role);
  if (h) return h.id;
  assert.ok(G.roleOpen(s, role), 'role is unlocked ' + role);
  let candidate = s.guild.applicants.find((h) => h.role === role);
  for(let attempt=0;!candidate&&attempt<24;attempt++) {
    const cooldown=Math.max(0,Math.ceil(s.guild.refreshAt-s.time));
    const quote=G.refreshCost(s);
    // Pay at most twice per search, preserving gold for hiring; otherwise wait for a free batch.
    const wait=cooldown>0&&(attempt>=2||s.resources.gold<(quote.gold||0)+50)?cooldown:0;
    if(wait)tick(wait);
    ensure(G.refreshCost(s),'ordinary applicant refresh');
    const time=s.time,cost=G.refreshCost(s),gold=s.resources.gold;
    act(x=>G.refreshApplicants(x),'recruit:random refresh');
    assert.ok(Math.abs(s.resources.gold-(gold-(cost.gold||0)))<1e-6,'ordinary refresh uses the displayed current fee');
    results.applicantRefreshes.push({roleSought:role,attempt:attempt+1,time,wait,cost,candidates:s.guild.applicants.map(h=>({id:h.id,role:h.role,quality:h.quality}))});
    candidate = s.guild.applicants.find((h) => h.role === role);
  }
  if(!candidate)diagnostic('Target role absent after 24 ordinary random refreshes: '+role);
  hire(candidate.id, 'ordinary applicant ' + role);
  return candidate.id;
}
function team(roles) {
  const ids = roles.map(role);
  for (const id of s.party)
    if (!ids.includes(id)) act((x) => G.toggleParty(x, id), 'party:remove');
  for (const id of ids)
    if (!s.party.includes(id)) act((x) => G.toggleParty(x, id), 'party:add');
}
function train(level) {
  for (const id of s.party)
    while (
      s.heroes.find((h) => h.id === id).level < Math.min(level, G.levelCap(s))
    ) {
      ensure(G.trainCost(s.heroes.find((h) => h.id === id)), 'hero training');
      act((x) => G.train(x, id), 'train:hero');
    }
}
function cleanupInventory() {
  if (s.expedition || s.battle) return;
  const worn = new Set(s.heroes.flatMap((h) => Object.values(h.equipment)));
  const spare = s.guild.inventory
    .filter((g) => !worn.has(g.id))
    .sort((a, b) => a.tier - b.tier || a.rarity - b.rarity);
  while (s.guild.inventory.length >= 25 && spare.length)
    act((x) => G.dismantleGear(x, spare.shift().id), 'gear:dismantle');
}
function loadout(r, enhancement = r ? 2 : 0) {
  const fundingStart={time:s.time,actions,stats:G.partyStats(s),spent:{...results.totals.spent},wait:{...waitByPurpose},research:[...s.research]};
  stopOrder();
  cleanupInventory();
  for (const id of s.party) {
    const h = s.heroes.find((h) => h.id === id);
    const weapon =
      r === 4
        ? 'bow'
        : ['kael', 'luna'].includes(h.role) && r >= 1
          ? 'staff'
          : r >= 1 && ['orin', 'rhea'].includes(h.role)
            ? 'pike'
            : h.role === 'finn' || h.role === 'ash'
              ? 'bow'
              : 'blade';
    const armor = [
      'plate',
      'shadowcoat',
      'plate',
      'shadowcoat',
      'firecoat',
      'dawncoat',
    ][r];
    const charm = r >= 3 ? 'wardstone' : 'vitality';
    for (const recipe of [weapon, armor, charm].map(id=>G.recipeUnlockReason(s,id)?({weapon:r===4?'bow':'blade',armor:'plate',charm:'vitality'}[G.RECIPES.find(x=>x.id===id).slot]):id)) {
      const slot = G.RECIPES.find((x) => x.id === recipe).slot;
      const wornElsewhere = new Set(
        s.heroes
          .filter((x) => x.id !== id)
          .flatMap((x) => Object.values(x.equipment)),
      );
      let item = s.guild.inventory
        .filter(
          (g) =>
            g.recipe === recipe && g.tier === G.gearTier(s) && !wornElsewhere.has(g.id),
        )
        .sort((a, b) => b.rarity - a.rarity || b.upgrade - a.upgrade)[0];
      if (!item) {
        cleanupInventory();
        ensure(G.recipeCost(s, recipe), 'craft ' + recipe);
        ensureMaterials(G.recipeMaterialCost(s,recipe,G.gearTier(s)));
        ensure(G.recipeCost(s,recipe),'reserved craft '+recipe);
        if (G.forgeReason(s, recipe))
          diagnostic(
            'Craft prerequisite ' + recipe + ': ' + G.forgeReason(s, recipe),
          );
        act((x) => G.craftGear(x, recipe), 'gear:craft ' + recipe);
        item = s.guild.inventory.at(-1);
      }
      if (s.heroes.find((h) => h.id === id).equipment[slot] !== item.id)
        act((x) => G.equipGear(x, id, item.id), 'gear:equip ' + slot);
      while (
        s.guild.inventory.find((g) => g.id === item.id).upgrade < enhancement
      ) {
        ensure(
          G.enhancementCost(s.guild.inventory.find((g) => g.id === item.id)),
          'equipment enhancement',
        );
        ensureMaterials(G.enhancementMaterials(s,s.guild.inventory.find(g=>g.id===item.id)));
        ensure(G.enhancementCost(s.guild.inventory.find(g=>g.id===item.id)),'reserved enhancement');
        act((x) => G.enhanceGear(x, item.id), 'gear:enhance');
      }
    }
  }
  assert.ok(
    s.party.every(
      (id) =>
        Object.keys(s.heroes.find((h) => h.id === id).equipment).length === 3,
    ),
    'all active adventurers wear three actual items',
  );
  results.loadoutInvestments.push({region:r,tier:G.gearTier(s),enhancement,start:fundingStart,time:s.time,actions:actions-fundingStart.actions,stats:G.partyStats(s),spent:Object.fromEntries(keys.map(k=>[k,results.totals.spent[k]-fundingStart.spent[k]])),wait:Object.fromEntries(Object.keys(waitByPurpose).map(k=>[k,waitByPurpose[k]-(fundingStart.wait[k]||0)]))});
}
function prepareRoute(r,route){
 stopOrder();
 const ready=()=>route==='frontier'?G.frontierInfo(s,r).ratio>=.85:G.partyStats(s).power>=G.routeInfo(s,r,route).power;
 if(ready())return;
 const before={time:s.time,stats:G.partyStats(s),frontier:G.frontierInfo(s,r),levels:s.party.map(id=>s.heroes.find(h=>h.id===id).level)};
 for(let pass=0;pass<12&&!ready();pass++){
  const previous=G.partyStats(s).power;
  const currentLevel=Math.max(...s.party.map(id=>s.heroes.find(h=>h.id===id).level));
  if(route==='frontier'&&pass===0)loadout(r,r?2:0);
  if(!ready()&&currentLevel<G.levelCap(s))train(Math.min(G.levelCap(s),currentLevel+2));
  if(!ready()&&pass>0){
   loadout(r,Math.min(8,2+pass));
   if(G.buildingLimit(s,'tavern')>=2){
    build('tavern',2);
    for(const id of s.party){const h=s.heroes.find(h=>h.id===id);if(h.mastery<Math.min(5,pass)){ensure(G.masteryCost(h),'frontier mastery');act(x=>G.mentorHero(x,id),'mentor:frontier');}}
   }
  }
  if(!ready()&&G.partyStats(s).power<=previous&&pass>2)throw new NeedProgress('Insufficient prepared route '+r+'/'+route+': '+JSON.stringify({frontier:G.frontierInfo(s,r),levelCap:G.levelCap(s),tier:G.gearTier(s)}));
 }
 if(!ready())throw new NeedProgress('No legal preparation meets '+r+'/'+route+': '+JSON.stringify(G.frontierInfo(s,r)));
 results.routePreparation.push({region:r,route,before,after:{time:s.time,stats:G.partyStats(s),frontier:G.frontierInfo(s,r),levels:s.party.map(id=>s.heroes.find(h=>h.id===id).level)}});
}
function fightGuardian(r){
  stopOrder();rest();
  let tries=0;
  while(G.guardianReady(s,r)){
    ensure(G.battlePreparationCost(s),'guardian preparation');
    const preview=G.resolveBattle(G.beginBattle(s,r,'guardian'));
    if(preview.guild.depths[r]>s.guild.depths[r]){
      const depth=s.guild.depths[r];act(x=>G.beginBattle(x,r,'guardian'),'combat:guardian start');
      let steps=0;while(s.battle&&steps++<500)act(x=>G.combat(x,G.recommendedCommand(x)),'combat:guardian turn');
      assert.equal(s.guild.depths[r],depth+1,'guardian forecast replays through real commands');roundtrip('guardian');break;
    }
    if(++tries>8)diagnostic('Guardian preparation failed '+r+'/'+s.guild.depths[r]);
    const target=G.enemyDefinition(s,r,'guardian').targetLevel;
    train(Math.min(G.levelCap(s),Math.max(target,...s.party.map(id=>s.heroes.find(h=>h.id===id).level+2))));
    loadout(r,Math.min(8,tries>1?tries:0));
    if(tries>2&&G.buildingLimit(s,'tavern')>=2){build('tavern',2);for(const id of s.party){const h=s.heroes.find(h=>h.id===id);if(h.mastery<Math.min(5,tries-2)){ensure(G.masteryCost(h),'guardian mastery');act(x=>G.mentorHero(x,id),'mentor:guardian');}}}
  }
}
function autoUntil(r, route, predicate) {
  if (predicate()) return;
  prepareRoute(r,route);
  ensure({ food: G.routeInfo(s, r, route).cost + 20 }, 'dispatch reserve');
  rest();
  if (G.partyStats(s).power < G.routeInfo(s, r, route).power)
    train(
      Math.min(
        G.levelCap(s),
        Math.max(
          ...s.party.map((id) => s.heroes.find((h) => h.id === id).level),
        ) + 2,
      ),
    );
  act(
    (x) =>
      G.setOrder(x, {
        enabled: true,
        region: r,
        route,
        reserve: 20,
        autoBuy: true,
      }),
    'order:' + route,
  );
  let loops = 0;
  while (!predicate()) {
    if (++loops > 1000)
      diagnostic('Automatic route did not reach target ' + route);
    if(route==='frontier'&&G.guardianReady(s,r)&&!s.expedition){fightGuardian(r);if(predicate())break;act(x=>G.setOrder(x,{enabled:true,region:r,route,reserve:20,autoBuy:true}),'order:after guardian');}
    if (s.expedition) tick(Math.ceil(s.expedition.end - s.time));
    else {
      if (s.order.reason.includes('战力')){
        prepareRoute(r,route);
        act(x=>G.setOrder(x,{enabled:true,region:r,route,reserve:20,autoBuy:true}),'order:resume prepared');
      }
      tick(15);
    }
  }
  stopOrder();
  visitor();
}
function outpost(r, level) {
  while (s.guild.outposts[r] < level) {
    ensure(G.outpostCost(s, r), 'outpost ' + r);
    act((x) => G.buildOutpost(x, r), 'outpost:upgrade');
  }
}
function roundtrip(label) {
  assert.deepEqual(
    G.decodeSave(JSON.stringify(s)),
    s,
    'save roundtrip ' + label,
  );
}
function withoutEquipment(state) {
  let bare = state;
  for (const id of bare.party)
    for (const slot of ['weapon', 'armor', 'charm'])
      bare = G.unequipGear(bare, id, slot);
  return bare;
}
function resolveChapter(r) {
  rest();
  act(
    (x) =>
      G.setPreparation(x, {
        stance: 'balanced',
        element: G.ENEMIES[r].element,
        remedy: true,
      }),
    'preparation:counter enemy',
  );
  ensure(G.battlePreparationCost(s), 'battle preparation');
  let forecast = G.forecastBattle(s, r),
    attempts = 0;
  while (!forecast.win && attempts < 6) {
    results.stages[r].preparationAttempts.push({
      level: Math.min(
        ...s.party.map((id) => s.heroes.find((h) => h.id === id).level),
      ),
      stats: G.partyStats(s),
      forecast,
    });
    train(
      Math.min(
        G.levelCap(s),
        Math.max(
          ...s.party.map((id) => s.heroes.find((h) => h.id === id).level),
        ) + 2,
      ),
    );
    if (r) {
      loadout(r, Math.min(8, 3 + attempts));
      for (const id of s.party) {
        const h = s.heroes.find((h) => h.id === id);
        if (h.mastery < Math.min(3, attempts + 1)) {
          build('tavern',2);
          ensure(G.masteryCost(h), 'mastery');
          act((x) => G.mentorHero(x, id), 'mentor:mastery');
        }
      }
    }
    act(
      (x) => G.setPreparation(x, { stance: 'cautious' }),
      'preparation:cautious',
    );
    ensure(G.battlePreparationCost(s));
    forecast = G.forecastBattle(s, r);
    attempts++;
  }
  if (!forecast.win)
    diagnostic(
      'No win found using the public combat policy for chapter ' + (r + 1),
    );
  const bare = withoutEquipment(s),
    naive = G.forecastBattle(s, r, 'attack');
  const stage = results.stages[r];
  Object.assign(stage, {
    gameSecondsBeforeBattle: s.time,
    heroLevels: s.party.map((id) => s.heroes.find((h) => h.id === id).level),
    stats: G.partyStats(s),
    profile: G.partyProfile(s),
    forecastRounds: forecast.rounds,
    attackOnly: { win: naive.win, rounds: naive.rounds },
    withoutEquipment: {
      stats: G.partyStats(bare),
      forecast: G.forecastBattle(bare, r),
    },
    equipment: s.party.map((id) => ({
      id,
      role: s.heroes.find((h) => h.id === id).role,
      equipment: G.clone(s.heroes.find((h) => h.id === id).equipment),
    })),
  });
  fixtures.beforeBattles[r] = G.clone(s);
  roundtrip('before chapter ' + (r + 1));
  act((x) => G.startBattle(x, r), 'combat:start');
  let rounds = 0;
  while (s.battle && rounds++ < 500)
    act((x) => G.combat(x, G.recommendedCommand(x)), 'combat:turn');
  assert.ok(s.cleared.includes(r), 'chapter victory ' + (r + 1));
  assert.equal(
    rounds,
    forecast.actions,
    'forecast matches actual public-command battle',
  );
  stage.rounds = s.lastBattle.rounds;
  stage.actions = rounds;
  fixtures.afterVictories[r] = G.clone(s);
  roundtrip('after chapter ' + (r + 1));
}

// Public campaign data supplies all live technology and processor costs.
const fullSeconds=Object.fromEntries(keys.map(k=>[k,0])), investment=[];
let waitPurpose='town'; const waitByPurpose={}, phaseInvestmentSeconds={};
const materialAudit={produced:{boards:0,steel:0,runes:0},machineSeconds:{boards:0,steel:0,runes:0},spentByAction:{},activitySeconds:{transport:0,processing:0,blockedWorkshop:0,other:0},surplusReturnSeconds:0};
class NeedProgress extends Error {}
const rawRegions={timber:0,essence:1,ore:2,ember:3,scale:4,star:5};
const processed=['boards','steel','runes'];
const technologyOrder=['settlement','metallurgy','runecraft','citadel','dragoncraft','infernalcraft','mythic'];
const order=routeOrder==='branch'?[0,2,4,1,3,5]:[0,1,2,3,4,5];
function ensureMaterials(cost,stack=[]) {
 const previousPurpose=waitPurpose;waitPurpose='materials';const enabledHere=[];
 try{
  for(const [id,need]of Object.entries(cost))if(need>G.materialCapacity(s,id))throw new NeedProgress('Material capacity requires town progress: '+id+' '+need+'/'+G.materialCapacity(s,id));
  const requested=Object.entries(cost).filter(([id,need])=>processed.includes(id)&&s.world.materials[id]<need);
  if(requested.length){
   const inputBill={},resourceBill={};
   for(const [id,need]of Object.entries(cost))if(!processed.includes(id))inputBill[id]=(inputBill[id]||0)+need;
   for(const [id,need]of requested){
    if(stack.includes(id))diagnostic('Circular production chain '+[...stack,id].join(' -> '));
    const recipe=G.WORK_RECIPES.find(x=>x.id===id);
    if(!recipe||!s.world.tech.includes(recipe.tech))throw new NeedProgress('Workshop technology not learned: '+id);
    const batches=Math.ceil((need-s.world.materials[id])/recipe.output);
    for(const [k,n]of Object.entries(recipe.cost))resourceBill[k]=(resourceBill[k]||0)+n*batches;
    for(const [k,n]of Object.entries(recipe.materials))inputBill[k]=(inputBill[k]||0)+n*batches;
   }
   ensure(resourceBill,'parallel workshop batch');
   ensureMaterials(inputBill,[...stack,...requested.map(([id])=>id)]);
   ensure(resourceBill,'parallel workshop reserved inputs');
   for(const [id]of requested)if(!s.world.work[id]){act(x=>G.toggleWork(x,id,true),'work:enable '+id);enabledHere.push(id);}
   const started=s.time;
   while(requested.some(([id,need])=>s.world.materials[id]<need)){
    for(const [id,need]of requested)if(s.world.materials[id]>=need&&s.world.work[id])act(x=>G.toggleWork(x,id,false),'work:disable '+id);
    const pending=requested.filter(([id,need])=>s.world.materials[id]<need);
    tick(Math.max(1,Math.min(15,...pending.map(([id])=>Math.ceil(G.workDuration(s,id)-s.world.workProgress[id])))));
    if(s.time-started>86400)diagnostic('Parallel workshop bill stalled beyond 24 game hours');
   }
   assert.ok(G.canAffordMaterials(s,cost),'parallel processors preserved the complete material bill');
   return;
  }
  for(const [id,need]of Object.entries(cost)){
   if(s.world.materials[id]>=need)continue;
   if(!Object.hasOwn(rawRegions,id))diagnostic('Unknown material '+id);
   const r=rawRegions[id];
   if(!G.regionOpen(s,r))throw new NeedProgress('Material source is not open: '+id+' / region '+r);
   while(s.world.materials[id]<need){
    stopOrder();ensure({food:G.routeInfo(s,r,'supply').cost},'single material shipment');rest();
    prepareRoute(r,'supply');
    const reason=G.dispatchReason(s,r,'supply',0);if(reason)throw new NeedProgress(reason);
    act(x=>G.expedition(x,r,'supply'),'expedition:material');tick(Math.ceil(s.expedition.end-s.time));rest();visitor();
   }
  }
 }finally{
  for(const id of enabledHere)if(s.world.work[id])act(x=>G.toggleWork(x,id,false),'work:disable '+id);
  waitPurpose=previousPurpose;
 }
}
function technologyCandidate(id){
  const def=G.TECHNOLOGIES.find(x=>x.id===id);
  if(!def)diagnostic('Missing technology data schema '+id);
  const q=def.requires;
  if(q.allTech?.some(id=>!s.world.tech.includes(id)))return null;
  if(q.anyTech?.length&&!q.anyTech.some(id=>s.world.tech.includes(id)))return null;
  if(q.depth&&(s.cleared.includes(q.depth.region)?5:s.guild.depths[q.depth.region])<q.depth.value)return null;
  if(q.bossAny?.length&&!q.bossAny.some(r=>s.cleared.includes(r)))return null;
  if(q.bossAll?.some(r=>!s.cleared.includes(r)))return null;
  return def;
}
function technologies(){
  let changed=false;
  for(const id of technologyOrder){
    if(s.world.tech.includes(id))continue;
    const def=technologyCandidate(id);if(!def)continue;
    try{
      ensure(def.cost,'technology '+id);ensureMaterials(def.materials);
      ensure(def.cost,'reserved technology '+id);
      const reason=G.technologyReason(s,id);if(reason)continue;
      act(x=>G.studyTechnology(x,id),'technology:'+id);results.technologyMilestones.push({id,rank:G.townRank(s),gameSeconds:s.time,decisions:actions,waitByPurpose:{...waitByPurpose}});changed=true;
    }catch(e){if(!(e instanceof NeedProgress))throw e;}
  }
  return changed;
}
function opportunisticCity(){
  let changed=false;
  for(let pass=0;pass<20;pass++){
    const before=actions;
    for(const id of ['hut','lumber','farm','quarry','market','warehouse','tavern','forge','shrine']){
      if(G.buildingReason(s,id)||!G.canPay(s,G.buildingCost(s,id))||G.materialReason(s,G.buildingMaterialCost(s,id)))continue;
      build(id,s.buildings[id]+1);
    }
    while(s.population<G.populationCap(s)&&s.resources.food>=10){act(G.hireWorker,'resident:hire');allocate();}
    for(const id of ['tools','baskets'])if(!s.research.includes(id)&&G.researchDiscovered(s,id))study(id);
    if(actions===before)break;changed=true;
  }
  return changed;
}
function productiveStudies(){
 const priorities=['axes','preservation','scouting','masonry','accounts','rotation','hot_blast','resonance','assembly','irrigation','banking','blast_furnace','ley_grid'];
 let bought=0;
 for(const id of priorities){
  if(bought>=2)break;
  if(s.research.includes(id)||!G.researchDiscovered(s,id))continue;
  try{study(id);bought++;}catch(e){if(!(e instanceof NeedProgress))throw e;results.deferred.push({time:s.time,study:id,reason:e.message});}
 }
}
function developEconomy(){
 const rank=G.townRank(s),limit=G.buildingLimit(s,'lumber'),target=Math.max(1,limit-1),budget=1200+rank*1800;
 const started=s.time;const entries=[];
 const candidates=['hut','warehouse','market','lumber','quarry','forge','shrine','farm'];
 for(let pass=0;pass<14;pass++){
  const before=actions;
  for(const id of candidates){
   const desired=id==='hut'||id==='warehouse'?G.buildingLimit(s,id):target;
   if(s.buildings[id]>=desired||G.buildingReason(s,id))continue;
   const cost=G.buildingCost(s,id),materials=G.buildingMaterialCost(s,id),rates=G.production(s);
   const ordinaryWait=Math.max(0,...Object.entries(cost).map(([k,n])=>Math.max(0,n-s.resources[k])/(rates[k]||.01)));
   const materialWait=Object.entries(materials).reduce((n,[k,v])=>n+Math.max(0,v-s.world.materials[k])*(processed.includes(k)?G.workDuration(s,k):(G.regionOpen(s,rawRegions[k])?G.routeInfo(s,rawRegions[k],'supply').duration/4:Infinity)),0);
   const affordable=G.canPay(s,cost)&&!G.materialReason(s,materials);
   if(!affordable&&((phaseInvestmentSeconds[rank]||0)+s.time-started>=budget||ordinaryWait+materialWait>900+rank*300))continue;
   try{build(id,s.buildings[id]+1);entries.push({id,ordinaryWait,materialWait,affordable});}catch(e){if(!(e instanceof NeedProgress))throw e;}
   while(s.population<G.populationCap(s)){ensure({food:10});act(G.hireWorker,'resident:hire');allocate();}
  }
  if(actions===before)break;
 }
 phaseInvestmentSeconds[rank]=(phaseInvestmentSeconds[rank]||0)+s.time-started;
 results.economyDecisions??=[];if(entries.length)results.economyDecisions.push({rank,gameSeconds:s.time,waitSeconds:s.time-started,target,buildings:{...s.buildings},population:s.population,entries});
}
function combatReady(r){
  if(s.guild.depths[r]<5||s.cleared.includes(r))return false;
  const p=G.PROJECTS[r];
  try{
    if(!s.projects[p.id]){
      ensure(p.cost,'project '+r);ensureMaterials(G.projectMaterialCost(s,r));
      ensure(p.cost,'reserved project '+r);
      act(x=>G.completeProject(x,r,['river','alarm','traders','chant','blood','cut'][r]),'project:chapter');
    }
    for(const id of ['steel','wards',...(r>=3?['memory']:[]),...(r===5?['godslayer']:[])])if(!s.research.includes(id)&&G.researchDiscovered(s,id))study(id);
    if(s.population<G.REGIONS[r].population)people(G.REGIONS[r].population);
    if(s.buildings.forge<G.REGIONS[r].kit)build('forge',G.REGIONS[r].kit);
    while(s.kit<5&&!G.kitReason(s)){ensure(G.kitCost(s));ensureMaterials(G.kitMaterialCost(s));ensure(G.kitCost(s),'reserved kit');act(G.upgradeKit,'kit:upgrade');}
    if(G.bossReason(s,r))return false;
    if(r===4&&!s.world.tech.includes('runecraft')){autoUntil(1,'survey',()=>s.guild.intel[1]>=60&&G.discoveryCount(s,1)===2);autoUntil(1,'frontier',()=>s.guild.depths[1]>=1);technologies();}
    const dragonBefore=r===4?{gameSeconds:s.time,decisions:actions,stats:G.partyStats(s),forecast:G.forecastBattle(s,r),spent:G.clone(results.totals.spent),materials:G.clone(s.world.materials)}:null;
    loadout(r,r===4?4:r?2:0);
    let dragonEquipment=null;
    if(r===4){
      act(x=>G.setPreparation(x,{stance:'balanced',element:'fire',remedy:true}),'preparation:dragon');ensure(G.battlePreparationCost(s));rest();dragonEquipment={gameSeconds:s.time,stats:G.partyStats(s),forecast:G.forecastBattle(s,r),spent:G.clone(results.totals.spent)};
      for(let tries=0;tries<8;tries++){rest();ensure(G.battlePreparationCost(s));const prediction=G.forecastBattle(s,r);if(prediction.win&&prediction.rounds<=20)break;const level=Math.max(...s.party.map(id=>s.heroes.find(h=>h.id===id).level));if(level>=G.levelCap(s))break;train(Math.min(G.levelCap(s),level+2));}
      rest();ensure(G.battlePreparationCost(s));
      results.dragonTraining.push({before:dragonBefore,afterEquipment:dragonEquipment,after:{gameSeconds:s.time,decisions:actions,stats:G.partyStats(s),profile:G.partyProfile(s),levels:s.party.map(id=>s.heroes.find(h=>h.id===id).level),forecast:G.forecastBattle(s,r),attackOnly:G.forecastBattle(s,r,'attack')},spent:Object.fromEntries(keys.map(k=>[k,results.totals.spent[k]-dragonBefore.spent[k]])),waitSeconds:s.time-dragonBefore.gameSeconds});
    }
    for(const id of ['logistics','scholarship','smithing']){
      const n=Math.min(10,2+G.townRank(s)*2);if(s.guild.doctrine[id]<n&&G.canPay(s,G.doctrineCost(s,id)))act(x=>G.studyDoctrine(x,id),'doctrine:'+id);
    }
    results.stages[r]??={chapter:r+1,region:G.REGIONS[r].name,layers:[],preparationAttempts:[]};
    resolveChapter(r);return true;
  }catch(e){if(e instanceof NeedProgress){results.deferred.push({time:s.time,region:r,reason:e.message});return false;}throw e;}
}
try{
 assert.equal(s.version, 11,'current save schema');
 results.order=order;results.deferred=[];results.milestones=[];results.technologyMilestones=[];results.dragonTraining=[];
 assert.equal(s.population,0);assert.deepEqual(s.jobs,blank());assert.deepEqual(s.resources,blank());
 act(x=>G.gather(x,'wood'),'gather:opening');build('fire');
 assert.equal(s.population,0,'fire does not create residents');assert.deepEqual(s.jobs,blank(),'fire does not assign jobs');assert.deepEqual(s.resources,blank(),'fire gives no hidden stock');
 fixtures.afterFire=G.clone(s);const fireWait=G.advance(s,60);assert.deepEqual(fireWait.resources,s.resources,'no unbuilt production after fire');
 allocate();
 build('hut');people(3);build('lumber');build('farm');
 assert.ok(s.jobs.wood>0&&s.jobs.food>0,'manual opening establishes actual wood and food industries');
 build('quarry');build('warehouse');build('market');people(6);build('tavern');
 team(['rhea','finn','luna','kael']);opportunisticCity();
 let attempts=0;
 while(!s.ending&&attempts++<160){
  const before=JSON.stringify({tech:s.world.tech,depths:s.guild.depths,cleared:s.cleared});
  stopOrder();technologies();opportunisticCity();productiveStudies();developEconomy();
  for(const r of order){
    if(!G.regionOpen(s,r)||s.guild.depths[r]>=5)continue;
    const start={time:s.time,actions,resources:G.clone(s.resources),materials:G.clone(s.world.materials)};
    waitPurpose='map';autoUntil(r,'survey',()=>s.guild.intel[r]>=60&&G.discoveryCount(s,r)===2);
    const target=s.guild.depths[r]+1;
    autoUntil(r,'frontier',()=>s.guild.depths[r]>=target);
    if(s.guild.outposts[r]<Math.min(3,target)){try{outpost(r,Math.min(3,target));}catch(e){if(!(e instanceof NeedProgress))throw e;}}
    results.milestones.push({region:r,depth:s.guild.depths[r],start,gameSeconds:s.time-start.time,actions:actions-start.actions,rank:G.townRank(s),power:G.partyStats(s).power,materials:G.clone(s.world.materials)});
    waitPurpose='town';technologies();opportunisticCity();productiveStudies();developEconomy();break;
  }
  for(const r of order)combatReady(r);
  const after=JSON.stringify({tech:s.world.tech,depths:s.guild.depths,cleared:s.cleared});
  if(before===after)diagnostic('No legal map/technology/boss progression: '+JSON.stringify({tech:technologyOrder.filter(id=>!s.world.tech.includes(id)).map(id=>[id,G.technologyReason(s,id)]),regions:order.map(r=>[r,G.regionOpen(s,r),G.bossReason(s,r)])}));
  save();
 }
 assert.ok(s.ending&&s.cleared.length===6&&s.guild.depths.every(n=>n===5),'complete all legal v6 chapters');
 fixtures.afterVictory=G.clone(s);results.campaign={gameSeconds:s.time,decisions:actions,clockCalls,waitByPurpose:{...waitByPurpose},fullResourceSeconds:{...fullSeconds},rank:G.townRank(s),buildings:s.buildings,tech:s.world.tech,materials:s.world.materials};
 for(const hero of G.HEROES)if(G.roleOpen(s,hero.id))role(hero.id);
 people(36);build('shrine',Math.min(5,G.buildingLimit(s,'shrine')));
 for(let r=0;r<6;r++){rest();ensure({food:G.routeInfo(s,r,'supply').cost});act(x=>G.expedition(x,r,'supply'),'expedition:peace');tick(Math.ceil(s.expedition.end-s.time));}
 for(const p of G.REBUILD){ensure(p.cost);act(x=>G.rebuildTown(x,p.id),'rebuild:'+p.id);}
 fixtures.afterRebuild=G.clone(s);fixtures.completed=G.clone(s);roundtrip('complete v6 rebuild');
 assert.equal(s.rebuild.length,G.REBUILD.length);
 let offlineStart=G.setOrder(fixtures.beforeBattles[2],{enabled:true,region:0,route:'supply',reserve:20,autoBuy:true});
 for(const recipe of G.WORK_RECIPES)if(offlineStart.world.tech.includes(recipe.tech))offlineStart=G.toggleWork(offlineStart,recipe.id,true);
 const offlineWhole=G.advance(offlineStart,28800);let offlineParts=offlineStart;for(let i=0;i<960;i++)offlineParts=G.advance(offlineParts,30);assert.deepEqual(offlineWhole,offlineParts,'8-hour v6 workshop/auto-supply equivalence');
 results.checks.push({name:'zero-stock zero-population start; finite visitors are atomic and repeat clicks do nothing',passed:true},{name:'all 30 sites/six bosses/rebuilding via public APIs',passed:true},{name:'all recorded battle and ending saves roundtrip exactly',passed:true},{name:'8-hour active workshop/auto-supply equivalence',passed:true});
 results.rebuild={gameSeconds:s.time,decisions:actions,projects:s.rebuild};results.fullResourceSeconds={sampling:'At the start of each bounded waiting segment; an estimate, not exact overflow accounting.',values:fullSeconds};results.investments=investment.map(i=>{const weights=Object.fromEntries(keys.map(k=>[k,i.productionBefore[k]>0?i.jobs[k]/i.productionBefore[k]:null]));const costKnown=Object.keys(i.cost).every(k=>weights[k]!==null);const benefit=keys.reduce((n,k)=>n+Math.max(0,i.gain[k])*(weights[k]||0),0);return {...i,baseLaborPaybackLowerBoundSeconds:costKnown&&benefit>0?Object.entries(i.cost).reduce((n,[k,v])=>n+v*weights[k],0)/benefit:null,paybackNote:'Local labor-equivalent lower bound, excludes map materials and refinery upstream inputs.'};});results.waitByPurpose=waitByPurpose;results.phaseInvestmentSeconds=phaseInvestmentSeconds;results.materialAudit=materialAudit;
 for(const k of processed){const consumed=Object.values(materialAudit.spentByAction).reduce((n,bill)=>n+(bill[k]||0),0);assert.equal(materialAudit.produced[k],consumed+s.world.materials[k],'processed material conservation '+k);}
 assert.equal(Object.values(results.campaign.waitByPurpose).reduce((n,v)=>n+v,0),results.campaign.gameSeconds,'exclusive wait categories sum to game clock');
 save();console.log('V7_RULES_CAMPAIGN_COMPLETE '+JSON.stringify({order,gameSeconds:results.campaign.gameSeconds,decisions:results.campaign.decisions,rounds:results.stages.map(x=>x?.rounds)}));
}catch(error){results.error=String(error);results.atFailure={time:s.time,actions,rank:s.world&&G.townRank?.(s)};writeFileSync(new URL('blocked-state.json',outputDir),JSON.stringify(s,null,2));save();throw error;}
