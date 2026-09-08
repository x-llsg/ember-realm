import * as G from '../lib/realm.ts';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

// Every campaign mutation goes through a public action. Forecasts only inspect clones.
const routeOrder = process.env.V12_ROUTE_ORDER || 'standard';
const outputDir = new URL(`../.test-results/v13-${routeOrder}-demand/`, import.meta.url);
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
  version: 9,
  rulesRevision: 'v13-demand-driven-parallel-economy',
  visitorDeferred: [],
  visitorChoices: [],
  researchInvestments: [],
  gearOrders: [],
  loadoutInvestments: [],
  routePreparation: [],
  seed,
  economySignature:G.productionMultiplier.toString()+G.developmentCost.toString(),
  policy:
    'Legal steady growth; ordinary random applicant batches, three equipment slots, public recommended combat policy. No injected resources or progression.',
  warning:
    'All durations are simulated game-clock seconds, not measured human playtime. Forecast calls are not player actions.',
  accounting:
    'resourcesGained/producedAndLooted and resourcesSpent/spent sum positive/negative inventory changes per observed API step, including net workshop input consumption; they are not gross production. Expedition found/kept/lost separately record gross rolled rewards, stored rewards and capacity overflow.',
  stages: [],
  checks: [],
  recruitment: [],
  expeditionDispatches: [],
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
    `${message} [demand ${JSON.stringify({activeResourceGoal,activeMaterialGoal,bill:demandBill(),rates:perWorkerRates()})}]: ${JSON.stringify({ time: s.time, resources: s.resources, jobs: s.jobs, buildings: s.buildings, stats: G.partyStats(s), guild: { depths: s.guild.depths, intel: s.guild.intel, outposts: s.guild.outposts }, order: s.order })}`,
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
  if(!label.startsWith('assign:'))demandPacing.currentNoUsefulSeconds=0;
  if(!before.expedition&&next.expedition)results.expeditionDispatches.push({time:before.time,label,purpose:waitPurpose,region:next.expedition.region,route:next.expedition.route,duration:next.expedition.end-next.expedition.start});
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
  allocateDemand();
  const before = s;
  monitorWaiting(before,seconds);
  if(waitPurpose==='materials'){const kind=before.expedition?'transport':G.WORK_RECIPES.some(w=>before.world.work[w.id]&&!G.workReason(before,w.id))?'processing':G.WORK_RECIPES.some(w=>before.world.work[w.id])?'blockedWorkshop':'other';materialAudit.activitySeconds[kind]+=seconds;}
  for(const k of keys)if(before.resources[k]>=G.capacity(before,k)*0.999)fullSeconds[k]+=seconds;
  s = G.advance(s, seconds);
  clockCalls++;
  account(before, s);
  for(const w of G.WORK_RECIPES){const units=s.economy.crafted[w.id]-before.economy.crafted[w.id];if(units>0){materialAudit.produced[w.id]+=units;materialAudit.machineSeconds[w.id]+=units/G.processingOutput(before,w.id)*G.workDuration(before,w.id);}}
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
    const step = Math.min(remaining, untilReturn, 5, G.MAX_OFFLINE);
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
function allocate(){allocateDemand(true); }
function ensure(cost, label = 'resources') {
const previousGoal=activeResourceGoal; activeResourceGoal={...cost}; allocateDemand(true);
try {

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
    ensure(G.buildingCost(s,'warehouse'),'reserved warehouse expansion');
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
    if (!G.canPay(s, cost)) { economyOpportunity(cost,label); if(!G.canPay(s,cost)) tick(15); }
  }

} finally { activeResourceGoal=previousGoal; }
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
  const before={time:s.time,id:e.id,choice,cost:G.visitorChoice(s,choice).cost,reward:G.visitorChoice(s,choice).reward||{},resources:{...s.resources},population:s.population,pendingSettlers:s.pendingSettlers};
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
    const wait=cooldown>0&&(attempt>=2||s.civic.invitations<1||s.resources.gold<(quote.gold||0)+50)?cooldown:0;
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
  while (s.guild.inventory.length >= 25 && spare.length) {
    const item = spare.shift(), options = { includeSets: true, includeEnhanced: true, allowOverflow: true };
    if (G.dismantleQuote(s, [item.id], options).reason) continue;
    act((x) => G.dismantleGear(x, item.id, options), 'gear:dismantle');
  }
}
function trainMastery(id, target, label) {
  while (s.heroes.find((h) => h.id === id).mastery < target) {
    const h = s.heroes.find((entry) => entry.id === id);
    if (G.masteryUnlockReason(s, h)) return;
    const cost = G.masteryCost(h), materials = G.masteryMaterials(s, h);
    ensure(cost, label);
    ensureMaterials(materials);
    ensure(cost, 'reserved ' + label);
    assert.equal(G.masteryReason(s, s.heroes.find((entry) => entry.id === id)), '', 'mastery has a complete earned bill');
    const before = s, tier = h.mastery + 1;
    act((x) => G.mentorHero(x, id), 'mentor:' + label);
    for (const key of G.MATERIAL_IDS) assert.equal(before.world.materials[key] - s.world.materials[key], materials[key] || 0, 'mastery payment ' + key);
    results.masteryInvestments ??= [];
    results.masteryInvestments.push({ time: before.time, hero: id, tier, cost, materials, rank: G.townRank(before), level: h.level, depths: [...before.guild.depths], cleared: [...before.cleared] });
  }
}
function loadout(r, enhancement = r ? 2 : 0) {
  if(G.gearTier(s)>=2&&!s.buildings.forge)build('forge',1);
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
        for(let fundingPass=0;fundingPass<8&&(!G.canPay(s,G.recipeCost(s,recipe))||G.materialReason(s,G.recipeMaterialCost(s,recipe,G.gearTier(s))));fundingPass++){ensure(G.recipeCost(s,recipe),'final craft quote '+recipe);ensureMaterials(G.recipeMaterialCost(s,recipe,G.gearTier(s)));}
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
 if(route==='frontier')return; // Public traversal has no hard power gate; actual guardian combat still decides occupation.
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
    for(const id of s.party)trainMastery(id,Math.min(5,pass),'frontier');
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
    if(tries>2&&G.buildingLimit(s,'tavern')>=2){build('tavern',2);for(const id of s.party)trainMastery(id,Math.min(5,tries-2),'guardian');}
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
          trainMastery(id, Math.min(3, attempts + 1), 'mastery');
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
const previousMaterials=activeMaterialGoal; activeMaterialGoal={...cost};
try {

 const previousPurpose=waitPurpose;waitPurpose='materials';const enabledHere=[];
 for(const id of processed)if(cost[id]>s.world.materials[id])prepareProcessor(id);
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
    const batches=Math.ceil((need-s.world.materials[id])/G.processingOutput(s,id));
    const bill=G.processingBill(s,id);
    for(const [k,n]of Object.entries(bill.cost))resourceBill[k]=(resourceBill[k]||0)+n*batches;
    for(const [k,n]of Object.entries(bill.materials))inputBill[k]=(inputBill[k]||0)+n*batches;
   }
   ensure(resourceBill,'parallel workshop batch');
   ensureMaterials(inputBill,[...stack,...requested.map(([id])=>id)]);
   ensure(resourceBill,'parallel workshop reserved inputs');
   for(const [id]of requested)if(!s.world.work[id]){act(x=>G.toggleWork(x,id,true),'work:enable '+id);enabledHere.push(id);}
   const started=s.time;
   while(requested.some(([id,need])=>s.world.materials[id]+1e-8<need)){
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
   if(G.regionalDepth(s,r)>=1){
    ensureTransport(r,id,need);const started=s.time;
    while(s.world.materials[id]+1e-8<need){
      improveAffordable('logistics','material demand '+id); improveAffordable('food','transport food');
      const plan=G.transportPlan(s);if(plan.yields[r]<=1e-9){
        ensure({food:Math.max(10,G.routeUpkeep(s,r).food*30),gold:Math.max(10,G.routeUpkeep(s,r).gold*30)},'transport upkeep '+id);
      }
      tick(Math.min(15,Math.max(1,Math.ceil((need-s.world.materials[id])/Math.max(.0001,G.transportPlan(s).yields[r])))));
      if(s.time-started>86400)diagnostic('Transport material wait exceeded 24 game hours '+id);
    }
   }else while(s.world.materials[id]+1e-8<need){
    stopOrder();ensure({food:G.routeInfo(s,r,'supply').cost},'single pre-site material shipment');rest();
    prepareRoute(r,'supply');
    const reason=G.dispatchReason(s,r,'supply',0);if(reason)throw new NeedProgress(reason);
    act(x=>G.expedition(x,r,'supply'),'expedition:material');tick(Math.ceil(s.expedition.end-s.time));rest();visitor();
   }
  }
 }finally{
  for(const id of enabledHere)if(s.world.work[id])act(x=>G.toggleWork(x,id,false),'work:disable '+id);
  waitPurpose=previousPurpose;
 }

} finally { activeMaterialGoal=previousMaterials; }
}
let activeResourceGoal={},activeMaterialGoal={},lastAllocation=-Infinity,lastAllocationGoal='',economicBuild=false;
const demandPacing={sampling:'Actual waiting-state samples, each interval <=5 game seconds; stock fullness is estimated, not exact overflow.',materialVisibleSeconds:{},materialFullSeconds:{},usefulAffordableSeconds:0,openMapUsefulSeconds:0,openMapSeconds:0,samples:0,usefulOptions:{},longestNoUsefulSeconds:0,currentNoUsefulSeconds:0,allocationPolicy:'Rebalance at actual bill changes or once per 60 game seconds; leave unneeded workers idle.'};
let cachedRatesKey='',cachedRates={};
function perWorkerRates(){
  const key=JSON.stringify([s.buildings,s.research,s.economy.development,s.guild.depths,s.projects]);
  if(key===cachedRatesKey)return cachedRates;
  let blank=s;for(const k of keys)for(let n=0;n<s.jobs[k];n++)blank=G.assign(blank,k,-1);
  const rates={};for(const k of keys){const one=G.assign(blank,k,1);rates[k]=one===blank?0:G.production(one)[k];}
  cachedRatesKey=key;cachedRates=rates;return rates;
}
function demandBill(){
  const bill={...activeResourceGoal};
  const add=(k,n)=>{bill[k]=(bill[k]||0)+n;};
  // These are operating inputs, rather than arbitrary stock targets.
  for(let r=0;r<6;r++)if(s.economy.routes[r].enabled){const upkeep=G.routeUpkeep(s,r);for(const[k,n]of Object.entries(upkeep))add(k,n*120);}
  for(const w of G.WORK_RECIPES)if(s.world.work[w.id])for(const[k,n]of Object.entries(G.processingBill(s,w.id).cost))add(k,n*2);
  if(s.order.enabled||s.expedition){const region=s.expedition?.region??s.order.region;add('food',G.routeInfo(s,region,s.expedition?.route||s.order.route).cost*2+G.battleFood(s));}
  if(!Object.keys(activeResourceGoal).length&&!Object.keys(activeMaterialGoal).length){
    const tech=technologyOrder.map(id=>!s.world.tech.includes(id)&&technologyCandidate(id)).find(Boolean);
    if(tech)for(const[k,n]of Object.entries(tech.cost))add(k,n);
    else {
      const region=s.order.region,target=G.enemyDefinition(s,region,'guardian').targetLevel;
      const trainee=s.party.map(id=>s.heroes.find(h=>h.id===id)).find(h=>h.level<Math.min(target,G.levelCap(s)));
      if(trainee)for(const[k,n]of Object.entries(G.trainCost(trainee)))add(k,n);
    }
  }
  // Iron and crystal consume actual upstream inputs. Include the bill needed
  // to cover their shortages so specialists never starve their feeder jobs.
  const ironNeed=Math.max(0,(bill.iron||0)-s.resources.iron),crystalNeed=Math.max(0,(bill.crystal||0)-s.resources.crystal);
  if(ironNeed){add('wood',ironNeed/.12*.3);add('stone',ironNeed/.12*.6);}
  if(crystalNeed)add('gold',crystalNeed/.07*.25);
  return bill;
}
function allocateDemand(force=false){
  for(let r=0;r<6;r++)if(!s.economy.routes[r].enabled&&!(activeMaterialGoal[G.REGION_MATERIALS[r]]>s.world.materials[G.REGION_MATERIALS[r]]))while(s.economy.routes[r].crew>0)act(x=>G.assignRoute(x,r,-1),'logistics:release paused crew');
  const bill=demandBill(),goal=JSON.stringify([activeResourceGoal,activeMaterialGoal,s.population,G.transportWorkers(s)]);
  if(!force&&s.time-lastAllocation<60&&goal===lastAllocationGoal)return;
  lastAllocation=s.time;lastAllocationGoal=goal;
  const count=s.population-G.transportWorkers(s),rates=perWorkerRates(),desired=blank();
  const opening=!s.chronicle.includes('workers')&&!s.buildings.tavern;
  if(opening){if(!G.jobReason(s,'wood'))desired.wood=Math.min(2,count);if(!G.jobReason(s,'food'))desired.food=Math.min(1,count-desired.wood);}
  const weighted=keys.filter(k=>!G.jobReason(s,k)&&rates[k]>0).map(k=>({k,labor:Math.max(0,(bill[k]||0)-s.resources[k])/rates[k]})).filter(x=>x.labor>1e-6);
  if(!opening)for(const row of weighted.slice(0,count))desired[row.k]=1;
  // Assign each next resident to the longest current completion estimate.
  for(let n=Object.values(desired).reduce((a,b)=>a+b,0);!opening&&n<count&&weighted.length;n++){
    const candidate=weighted.slice().sort((a,b)=>b.labor/(desired[b.k]+1)-a.labor/(desired[a.k]+1))[0];
    desired[candidate.k]++;
  }
  for(const k of keys)while(s.jobs[k]>desired[k])act(x=>G.assign(x,k,-1),'assign:release satisfied '+k);
  for(const k of keys)while(s.jobs[k]<desired[k])act(x=>G.assign(x,k,1),'assign:active bill '+k);
}
function worthDevelopment(id,cost){
  const d=G.DEVELOPMENTS.find(d=>d.id===id),rates=G.production(s),bill=demandBill();
  const investmentLabor=Object.entries(cost).reduce((n,[k,v])=>n+v/Math.max(.01,rates[k]||perWorkerRates()[k]||0),0);
  if(d.resource){
    const missing=Math.max(0,(bill[d.resource]||0)-s.resources[d.resource]);if(!missing)return false;
    const next=G.improveDevelopment(s,id);if(next===s)return false;
    const beforeRate=rates[d.resource],afterRate=G.production(next)[d.resource];
    const saved=missing/Math.max(.01,beforeRate)-missing/Math.max(.01,afterRate);
    return saved>1&&investmentLabor<=Math.max(60,saved*2);
  }
  if(id==='logistics'){
    const next=G.improveDevelopment(s,id);if(next===s)return false;
    const saved=Object.entries(activeMaterialGoal).filter(([k,n])=>G.REGION_MATERIALS.includes(k)&&n>s.world.materials[k]).map(([k,n])=>{const r=G.REGION_MATERIALS.indexOf(k);return (n-s.world.materials[k])*(1/Math.max(.0001,G.routeYield(s,r))-1/Math.max(.0001,G.routeYield(next,r)));});
    return saved.length&&investmentLabor<=Math.max(90,Math.max(...saved)*2);
  }
  if(d.work){const need=Math.max(0,(activeMaterialGoal[d.work]||0)-s.world.materials[d.work]);return need>0&&investmentLabor<=Math.max(90,need/G.processingOutput(s,d.work)*G.workDuration(s,d.work));}
  if(id==='storage')return Object.entries(bill).some(([k,n])=>n>G.capacity(s,k));
  if(id==='education')return s.party.some(id=>s.heroes.find(h=>h.id===id).level>=G.levelCap(s));
  return false;
}
function usefulOptions(bill){
  const list=[];
  for(const d of G.DEVELOPMENTS){
    if(G.developmentReason(s,d.id))continue;
    const relevant=d.resource?bill[d.resource]>s.resources[d.resource]&&s.jobs[d.resource]>0:d.work?activeMaterialGoal[d.work]>s.world.materials[d.work]:d.id==='logistics'?Object.entries(activeMaterialGoal).some(([k,n])=>G.REGION_MATERIALS.includes(k)&&n>s.world.materials[k]&&G.routeYield(s,G.REGION_MATERIALS.indexOf(k))>0):d.id==='storage'?Object.entries(bill).some(([k,n])=>n>G.capacity(s,k)):false;
    if(relevant)list.push({kind:'development',id:d.id});
  }
  const producer={wood:'lumber',food:'farm',stone:'quarry',gold:'market',iron:'forge',crystal:'shrine'};
  for(const k of keys){
    const id=producer[k];if(!(bill[k]>s.resources[k])||!s.jobs[k]||G.buildingReason(s,id)||!G.canPay(s,G.buildingCost(s,id))||G.materialReason(s,G.buildingMaterialCost(s,id)))continue;
    list.push({kind:'building',id});
  }
  for(const r of G.RESEARCH){
    if(!Object.entries(r.production||{}).some(([k,m])=>m>1&&bill[k]>s.resources[k]))continue;
    if(!G.researchReason(s,r.id)&&G.canPay(s,r.cost)&&!G.materialReason(s,r.materials||{}))list.push({kind:'research',id:r.id});
  }
  return list;
}
function demandInvestment(bill,purpose){
  if(!economicBuild){
    const producer={wood:'lumber',food:'farm',stone:'quarry',gold:'market',iron:'forge',crystal:'shrine'},rates=G.production(s);
    const deficits=keys.filter(k=>bill[k]>s.resources[k]&&s.jobs[k]>0).sort((a,b)=>(bill[b]-s.resources[b])/Math.max(.01,rates[b])-(bill[a]-s.resources[a])/Math.max(.01,rates[a]));
    for(const k of deficits){
      const id=producer[k],cost=G.buildingCost(s,id),materials=G.buildingMaterialCost(s,id),waiting=(bill[k]-s.resources[k])/Math.max(.01,rates[k]);
      const costWait=Object.entries(cost).reduce((n,[r,v])=>n+v/Math.max(.01,rates[r]||perWorkerRates()[r]),0);
      if(waiting<180||costWait>waiting*.6||G.buildingReason(s,id)||!G.canPay(s,cost))continue;
      const before=G.production(s),level=s.buildings[id];economicBuild=true;
      try{build(id,level+1);economyPurchases.push({time:s.time,id:'building-'+id,level:level+1,purpose,cost,materials,productionBefore:before,productionAfter:G.production(s)});return true;}
      catch(error){if(!(error instanceof NeedProgress))throw error;}
      finally{economicBuild=false;}
    }
  }
  const item=usefulOptions(bill).find(o=>o.kind==='research'||o.kind==='development'&&worthDevelopment(o.id,G.developmentCost(s,o.id)));if(!item)return false;
  if(item.kind==='development')return improveAffordable(item.id,purpose);
  const r=G.RESEARCH.find(r=>r.id===item.id),beforeRate=G.production(s);
  act(x=>G.research(x,r.id),'research:'+r.id);
  economyPurchases.push({time:s.time,id:r.id,purpose,cost:r.cost,materials:r.materials||{},productionBefore:beforeRate,productionAfter:G.production(s)});return true;
}
function monitorWaiting(before,seconds){
  demandPacing.samples++;
  for(const id of G.MATERIAL_IDS){
    const raw=G.REGION_MATERIALS.indexOf(id),work=G.WORK_RECIPES.find(w=>w.id===id);
    const visible=before.world.materials[id]>0||(raw>=0?G.routeDiscovered(before,raw):before.world.tech.includes(work.tech));
    if(!visible)continue;
    demandPacing.materialVisibleSeconds[id]=(demandPacing.materialVisibleSeconds[id]||0)+seconds;
    if(before.world.materials[id]>=G.materialCapacity(before,id)*.999)demandPacing.materialFullSeconds[id]=(demandPacing.materialFullSeconds[id]||0)+seconds;
  }
  const options=usefulOptions(demandBill());
  if(options.length){demandPacing.usefulAffordableSeconds+=seconds;demandPacing.currentNoUsefulSeconds=0;}
  else {demandPacing.currentNoUsefulSeconds+=seconds;demandPacing.longestNoUsefulSeconds=Math.max(demandPacing.longestNoUsefulSeconds,demandPacing.currentNoUsefulSeconds);}
  if(waitPurpose==='map'){demandPacing.openMapSeconds+=seconds;if(options.length)demandPacing.openMapUsefulSeconds+=seconds;}
  for(const o of options){const key=o.kind+':'+o.id;demandPacing.usefulOptions[key]=(demandPacing.usefulOptions[key]||0)+seconds;}
}

const economyPurchases=[];
function improveAffordable(id,purpose){
  if(['wood','food','stone','gold','iron','crystal'].includes(id))id=G.DEVELOPMENTS.find(d=>d.resource===id).id;
  const d=G.DEVELOPMENTS.find(d=>d.id===id),level=G.developmentLevel(s,id),rank=G.townRank(s);
  const target=Math.min(G.DEVELOPMENT_MAX,3+rank*2);
  if(!d||level>=target||G.developmentReason(s,id))return false;
  if(d.resource&&(!s.jobs[d.resource]||G.production(s)[d.resource]<=0))return false;
  const cost=G.developmentCost(s,id);
  if(!worthDevelopment(id,cost))return false;
  const beforeRate=G.production(s),beforeWork=d.work?G.workDuration(s,d.work):null;
  const beforeTime=s.time;act(x=>G.improveDevelopment(x,id),'development:'+id);
  economyPurchases.push({time:beforeTime,id,level:level+1,purpose,cost,productionBefore:beforeRate,productionAfter:G.production(s),workBefore:beforeWork,workAfter:d.work?G.workDuration(s,d.work):null});
  return true;
}
function economyOpportunity(cost,purpose){return demandInvestment(Object.keys(cost).length?cost:demandBill(),purpose);}
function prepareProcessor(id){
  const key={boards:'carpentry',steel:'metalwork',runes:'inscription'}[id];
  for(let i=0;i<4&&G.processingLevel(s,id)<Math.min(8,2+G.townRank(s)*2);i++)if(!improveAffordable(key,'processing demand '+id))break;
  if(G.processingLevel(s,id)>=2&&s.economy.modes[id]!=='efficient')act(x=>G.setWorkMode(x,id,'efficient'),'processing:efficient '+id);
}
function makeRoomForTransport(region){
  if(!s.economy.routes[region].enabled&&G.transportLines(s)>=G.transportSlots(s)){
    const other=s.economy.routes.findIndex((line,r)=>r!==region&&line.enabled);
    if(other<0)diagnostic('No pausable transport line');
    act(x=>G.toggleRoute(x,other),'logistics:pause other route');
  }
}
function ensureTransport(region,material,demand){
  const rank=G.townRank(s),wantedCrew=rank>=2?2:1;
  if(!s.economy.routes[region].level){
    const quote=G.routeCost(s,region);ensure(quote.cost,'transport construction '+region);
    if(G.routeUpgradeReason(s,region))throw new NeedProgress(G.routeUpgradeReason(s,region));
    const at=s.time;act(x=>G.upgradeRoute(x,region),'logistics:build '+region);
    economyPurchases.push({time:at,id:'route-'+region,level:1,purpose:'recurring '+material+' demand '+demand,cost:quote.cost,materials:quote.materials});
  }
  makeRoomForTransport(region);
  while(s.economy.routes[region].crew<wantedCrew){
    if(G.idleWorkers(s)<=0){
      const donor=keys.filter(k=>s.jobs[k]>0).sort((a,b)=>s.jobs[b]-s.jobs[a])[0];
      if(!donor)diagnostic('No worker available for transport');
      act(x=>G.assign(x,donor,-1),'assign:transport donor');
    }
    const reason=G.routeAssignmentReason(s,region,1);if(reason)throw new NeedProgress(reason);
    act(x=>G.assignRoute(x,region,1),'logistics:crew '+region);
  }
  if(!s.economy.routes[region].enabled)act(x=>G.toggleRoute(x,region),'logistics:resume '+region);
  // Only upgrade from stock; do not recursively demand this same route's input.
  const wantedLevel=Math.min(4,1+Math.floor(rank/2));
  if(s.economy.routes[region].level<wantedLevel&&!G.routeUpgradeReason(s,region)){
    const quote=G.routeCost(s,region),level=s.economy.routes[region].level;
    act(x=>G.upgradeRoute(x,region),'logistics:upgrade '+region);
    economyPurchases.push({time:s.time,id:'route-'+region,level:level+1,purpose:'faster '+material+' supply',cost:quote.cost,materials:quote.materials});
  }
  improveAffordable('logistics','supply '+material);allocate();
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
  const target=[9,15,21,30,39,51][G.townRank(s)];
  try{people(target);}catch(error){if(!(error instanceof NeedProgress))throw error;}
  for(const id of ['tools','baskets'])if(!s.research.includes(id)&&G.researchDiscovered(s,id))study(id);
}
function productiveStudies(){return demandInvestment(demandBill(),'queued research');}
function developEconomy(){return demandInvestment(demandBill(),'current economy goal');}
function combatReady(r){
  if(s.guild.depths[r]<5||s.cleared.includes(r))return false;
  const p=G.PROJECTS[r];
  try{
    if(!s.projects[p.id]&&G.discoveryCount(s,r)>=2){
      ensure(p.cost,'project '+r);ensureMaterials(G.projectMaterialCost(s,r));
      ensure(p.cost,'reserved project '+r);
      act(x=>G.completeProject(x,r,['river','alarm','traders','chant','blood','cut'][r]),'project:chapter');
    }
    for(const id of ['steel','wards',...(r>=3?['memory']:[]),...(r===5?['godslayer']:[])])if(!s.research.includes(id)&&G.researchDiscovered(s,id))study(id);
    // No legacy population gate: actual combat forecast decides preparation.
    // No legacy forge/kit hard gate; optional unlocked kit investments remain below.
    while(s.kit<5&&!G.kitReason(s)){ensure(G.kitCost(s));ensureMaterials(G.kitMaterialCost(s));ensure(G.kitCost(s),'reserved kit');act(G.upgradeKit,'kit:upgrade');}
    ensure(G.battlePreparationCost(s),'fund actual boss preparation');
    if(G.bossReason(s,r))return false;
    if(r===4&&!s.world.tech.includes('runecraft')){autoUntil(1,'survey',()=>G.discoveryCount(s,1)>=1);autoUntil(1,'frontier',()=>s.guild.depths[1]>=1);technologies();}
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
 assert.equal(s.version,9,'current save schema');
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
  stopOrder();technologies();opportunisticCity();productiveStudies();developEconomy();economyOpportunity({},'stage development');
  for(const r of order){
    if(!G.regionOpen(s,r)||s.guild.depths[r]>=5)continue;
    const start={time:s.time,actions,resources:G.clone(s.resources),materials:G.clone(s.world.materials)};
    waitPurpose='map';if(G.discoveryCount(s,r)<1)autoUntil(r,'survey',()=>G.discoveryCount(s,r)>=1);
    const target=s.guild.depths[r]+1;
    autoUntil(r,'frontier',()=>s.guild.depths[r]>=target);
    if(s.guild.outposts[r]<Math.min(3,target)){try{outpost(r,Math.min(3,target));}catch(e){if(!(e instanceof NeedProgress))throw e;}}
    results.milestones.push({region:r,depth:s.guild.depths[r],start,gameSeconds:s.time-start.time,actions:actions-start.actions,rank:G.townRank(s),power:G.partyStats(s).power,materials:G.clone(s.world.materials)});
    waitPurpose='town';technologies();opportunisticCity();productiveStudies();developEconomy();economyOpportunity({},'stage development');break;
  }
  for(const r of order)combatReady(r);
  const after=JSON.stringify({tech:s.world.tech,depths:s.guild.depths,cleared:s.cleared});
  if(before===after)diagnostic('No legal map/technology/boss progression: '+JSON.stringify({tech:technologyOrder.filter(id=>!s.world.tech.includes(id)).map(id=>[id,G.technologyReason(s,id)]),regions:order.map(r=>[r,G.regionOpen(s,r),G.bossReason(s,r)])}));
  save();
 }
 assert.ok(s.ending&&s.cleared.length===6&&s.guild.depths.every(n=>n===5),'complete all legal v6 chapters');
 results.campaignPacing=structuredClone(demandPacing);fixtures.afterVictory=G.clone(s);results.campaign={gameSeconds:s.time,decisions:actions,clockCalls,logistics:{delivered:s.economy.routes.map(r=>r.delivered),production:{...s.economy.production},crafted:{...s.economy.crafted}},waitByPurpose:{...waitByPurpose},fullResourceSeconds:{...fullSeconds},rank:G.townRank(s),buildings:s.buildings,tech:s.world.tech,materials:s.world.materials};
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
 results.rebuild={gameSeconds:s.time,decisions:actions,projects:s.rebuild};results.fullResourceSeconds={sampling:'At the start of each waiting segment of at most 5 seconds; an estimate, not exact overflow accounting.',values:fullSeconds};results.investments=investment.map(i=>{const weights=Object.fromEntries(keys.map(k=>[k,i.productionBefore[k]>0?i.jobs[k]/i.productionBefore[k]:null]));const costKnown=Object.keys(i.cost).every(k=>weights[k]!==null);const benefit=keys.reduce((n,k)=>n+Math.max(0,i.gain[k])*(weights[k]||0),0);return {...i,baseLaborPaybackLowerBoundSeconds:costKnown&&benefit>0?Object.entries(i.cost).reduce((n,[k,v])=>n+v*weights[k],0)/benefit:null,paybackNote:'Local labor-equivalent lower bound, excludes map materials and refinery upstream inputs.'};});results.waitByPurpose=waitByPurpose;results.phaseInvestmentSeconds=phaseInvestmentSeconds;results.materialAudit=materialAudit;
 for(const k of processed){const consumed=Object.values(materialAudit.spentByAction).reduce((n,bill)=>n+(bill[k]||0),0);assert.ok(Math.abs(materialAudit.produced[k]-consumed-s.world.materials[k])<1e-6,'processed material conservation '+k);}
 assert.equal(Object.values(results.campaign.waitByPurpose).reduce((n,v)=>n+v,0),results.campaign.gameSeconds,'exclusive wait categories sum to game clock');
 results.pacing=demandPacing;results.economyPurchases=economyPurchases;results.logistics={delivered:s.economy.routes.map(r=>r.delivered),routes:s.economy.routes,development:s.economy.development,production:s.economy.production,crafted:s.economy.crafted};save();console.log('V12_RULES_CAMPAIGN_COMPLETE '+JSON.stringify({order,gameSeconds:results.campaign.gameSeconds,decisions:results.campaign.decisions,rounds:results.stages.map(x=>x?.rounds)}));
}catch(error){results.error=String(error);results.atFailure={time:s.time,actions,rank:s.world&&G.townRank?.(s)};writeFileSync(new URL('blocked-state.json',outputDir),JSON.stringify(s,null,2));save();throw error;}
