import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/realm.ts';

// Deliberately constructed unit fixtures, not claims of legal campaign completion.
// The last two population tests exercise public build/hire/assign actions.
const keys=Object.keys(G.RESOURCE_NAMES);
function fund(s){for(const k of keys)s.resources[k]=G.capacity(s,k);return s;}
function base(seed=7,role='rhea'){
  let s=G.freshState(seed);s.rng=seed;s.assigned=true;s.population=6;
  for(const k of ['fire','hut','lumber','farm','quarry','market','tavern'])s.buildings[k]=1;
  s.buildings.warehouse=2;s.research=['tools','baskets'];s.jobs={wood:2,food:2,stone:1,gold:1,iron:0,crystal:0};
  fund(s);s.guild.applicants=[G.makeApplicant(s,role)];s=G.recruit(s,s.guild.applicants[0].id);return fund(s);
}
function craft(s,recipe='blade',tier=1){
  fund(s);for(const k of G.MATERIAL_IDS)s.world.materials[k]=G.materialCapacity(s,k);
  const next=G.craftGear(s,recipe,tier);assert.notEqual(next,s,`craft ${recipe} T${tier}`);return next;
}
function readyForRunecraft(){
  const s=base();s.world.tech=['settlement'];s.guild.depths[0]=1;s.guild.depths[1]=1;s.explored[0]=1;s.explored[1]=1;
  s.buildings.warehouse=4;s.research.push('axes');fund(s);s.world.materials.boards=12;s.world.materials.essence=10;return s;
}
function frontierFixture(){
  const s=base();s.world.tech=['settlement','runecraft'];s.guild.depths[0]=2;s.explored[0]=1;s.explored[1]=1;
  s.research.push('axes');s.buildings.warehouse=6;fund(s);return s;
}
function hasDestination(s,goal){
  assert.ok(G.viewDiscovered(s,goal.view),`hidden view: ${JSON.stringify(goal)}`);
  if(goal.building)assert.ok(G.buildingVisible(s,goal.building),`hidden building: ${goal.building}`);
  if(goal.research){
    const known=G.TECHNOLOGIES.some(t=>t.id===goal.research)?G.technologyDiscovered(s,goal.research):G.researchDiscovered(s,goal.research);
    assert.ok(known,`hidden research: ${goal.research}`);
  }
  if(goal.region!==undefined)assert.ok(G.regionOpen(s,goal.region),`closed region: ${goal.region}`);
}

test('first survey does not recommend an impossible departure across random starting individuals',()=>{
  let low=0;
  for(let seed=1;seed<=40;seed++)for(const role of ['rhea','finn','luna','kael']){
    let s=craft(base(seed,role));s=G.equipGear(s,s.party[0],s.guild.inventory.at(-1).id);fund(s);
    const reason=G.dispatchReason(s,0,'survey',0),goal=G.objective(s);hasDestination(s,goal);
    if(!reason)continue;
    low++;assert.notEqual(goal.view,'explore',`${seed}/${role}: ${reason}`);
    if(goal.view==='heroes'&&goal.tab==='training'){
      assert.ok(goal.hero);assert.notEqual(G.train(s,goal.hero),s,'recommended training is executable');
    }
  }
  assert.ok(low>0,'fixture must cover insufficient first-survey power');
});

test('a surplus same-slot weapon cannot trap the first-expedition objective',()=>{
  let s=craft(craft(base()));
  for(const item of s.guild.inventory){
    s=G.equipGear(s,s.party[0],item.id);
    assert.equal(G.dispatchReason(s,0,'survey',0),'');
    const goal=G.objective(s);assert.equal(goal.view,'explore');assert.equal(goal.route,'survey');
  }
});

test('first survey lacking food points to food preparation and preserves its route',()=>{
  let s=craft(base());s=G.equipGear(s,s.party[0],s.guild.inventory.at(-1).id);
  s.resources.food=0;s.jobs.food=0;s.jobs.wood=4;
  const goal=G.objective(s);hasDestination(s,goal);
  assert.equal(goal.view,'town');assert.equal(goal.tab,'workers');
  assert.match(goal.title+goal.detail,/口粮|农夫/);
});

test('runecraft missing crystal first reveals an executable forge prerequisite',()=>{
  let s=readyForRunecraft();s.resources.crystal=0;
  let goal=G.objective(s);hasDestination(s,goal);assert.equal(goal.building,'forge');
  s=G.build(s,'forge');assert.equal(s.buildings.forge,1);fund(s);s.resources.crystal=0;
  goal=G.objective(s);hasDestination(s,goal);assert.equal(goal.building,'shrine');
});

test('readiness never labels a weaker higher-tier spare as an improvement',()=>{
  let s=craft(frontierFixture());const old=s.guild.inventory.at(-1);old.rarity=4;old.upgrade=8;old.affix=0;
  s=G.equipGear(s,s.party[0],old.id);s=craft(s,'blade',2);const spare=s.guild.inventory.at(-1);spare.rarity=1;spare.affix=0;
  const before=G.frontierInfo(s,1).effective,after=G.frontierInfo(G.equipGear(s,s.party[0],spare.id),1).effective;
  assert.ok(after<before,'fixture must actually reduce local effective power');
  const goal=G.objective(s);hasDestination(s,goal);
  assert.ok(!(goal.tab==='inventory'&&goal.title.includes(G.gearName(spare))),JSON.stringify({before,after,goal}));
});

test('negative wood production points at a supply action instead of an unaffordable technology',()=>{
  const s=readyForRunecraft();s.buildings.forge=3;s.population=15;fund(s);s.resources.iron=0;s.resources.wood=100;
  s.jobs={wood:1,food:1,stone:3,gold:0,iron:10,crystal:0};
  assert.ok(G.netProduction(s).wood<0);const goal=G.objective(s);hasDestination(s,goal);
  assert.equal(goal.view,'town',JSON.stringify(goal));assert.ok(['workers','workshop','build','ledger'].includes(goal.tab));
  assert.match(goal.title+goal.detail,/木|消耗|上游|生产/);
});

test('a full roster with an available different-class bench member recommends assembling it',()=>{
  let s=frontierFixture();
  for(const recipe of ['blade','plate','vitality']){s=craft(s,recipe,2);s=G.equipGear(s,s.party[0],s.guild.inventory.at(-1).id);}
  while(s.heroes.length<12){s.guild.applicants=[G.makeApplicant(s,s.heroes.length===1?'finn':'rhea')];fund(s);s=G.recruit(s,s.guild.applicants[0].id);}
  s.party=[s.heroes[0].id];const available=s.heroes[1];assert.equal(available.role,'finn');
  const goal=G.objective(s);hasDestination(s,goal);assert.equal(goal.view,'heroes');assert.ok(!goal.tab||goal.tab==='roster');
  assert.notEqual(G.toggleParty(s,available.id),s,'existing different role can join now');
});

test('frontier at or above the 0.85 effective-power gate is sent to the current region',()=>{
  let s=frontierFixture();
  for(const role of ['finn','luna','kael']){s.guild.applicants=[G.makeApplicant(s,role)];fund(s);s=G.recruit(s,s.guild.applicants[0].id);}
  while(G.frontierInfo(s,1).ratio<0.85){
    const h=s.heroes.find(h=>h.level<G.levelCap(s));assert.ok(h,'fixture can meet frontier gate via training');fund(s);s=G.train(s,h.id);
  }
  const goal=G.objective(s);assert.equal(goal.view,'explore');assert.equal(goal.tab,'frontier');assert.equal(goal.region,1);
  assert.equal(G.dispatchReason(s,1,'frontier',0),'');
});

test('before upgrading settlement, insufficient capacity points at an available warehouse',()=>{
  const s=base();s.explored[0]=1;s.guild.depths[0]=1;s.buildings.warehouse=0;s.research=['tools'];
  fund(s);s.world.materials.timber=6;const goal=G.objective(s);hasDestination(s,goal);
  assert.equal(goal.building,'warehouse');assert.equal(G.buildingReason(s,'warehouse'),'');
  assert.notEqual(G.build(s,'warehouse'),s);
});

test('six residents fit in the first house and can satisfy the early objective through public actions',()=>{
  let s=G.freshState(9);s.resources.wood=12;s=G.build(s,'fire');fund(s);
  let goal=G.objective(s);assert.equal(goal.building,'hut');hasDestination(s,goal);
  s=G.build(s,'hut');assert.equal(G.populationCap(s),6);fund(s);
  assert.equal(G.viewDiscovered(s,'research'),false);
  goal=G.objective(s);assert.equal(goal.tab,'workers');
  while(s.population<6){fund(s);const next=G.hireWorker(s);assert.notEqual(next,s);s=next;}
  assert.ok(G.idleWorkers(s)>0);fund(s);s=G.build(s,'lumber');s=G.assign(s,'wood',1);assert.equal(s.assigned,true);
  fund(s);s=G.build(s,'farm');s=G.assign(s,'food',1);s=G.settleStory(s);
  fund(s);s=G.build(s,'quarry');fund(s);s=G.research(s,'tools');assert.ok(s.research.includes('tools'));
  assert.notEqual(G.objective(s).title,goal.title,'completed population objective advances');
});

test('later boss access is not gated by population or full housing',()=>{
  const s=frontierFixture();s.guild.depths[1]=1;s.survey[1]=G.REGIONS[1].thresholds[1];s.projects.bell='alarm';s.kit=1;
  s.population=6;s.buildings.hut=1;
  const goal=G.objective(s);hasDestination(s,goal);assert.notEqual(goal.building,'hut');
  s.guild.depths[1]=5;s.guild.intel[1]=0;fund(s);assert.equal(G.bossReason(s,1),'');
  assert.notEqual(G.build(s,'hut'),s);
});

test('no idle residents is resolved by reallocating an existing worker, not recruiting an adventurer',()=>{
  let s=readyForRunecraft();s.buildings.forge=1;s.buildings.shrine=1;fund(s);s.resources.crystal=0;
  assert.equal(G.idleWorkers(s),0);const goal=G.objective(s);hasDestination(s,goal);
  assert.equal(goal.view,'town');assert.equal(goal.tab,'workers');
  s=G.assign(s,'wood',-1);assert.equal(G.idleWorkers(s),1);s=G.assign(s,'crystal',1);assert.equal(s.jobs.crystal,1);
  assert.ok(G.netProduction(s).crystal>0,'reallocation creates the required resource source');
});

test('the final project returns to an undiscovered prerequisite region before its hidden technology',()=>{
  const s=base();s.world.tech=['settlement','runecraft','citadel','dragoncraft','mythic'];s.research.push('axes');
  s.buildings.warehouse=6;s.guild.depths=[2,5,0,5,5,1];s.explored=[1,1,0,1,1,1];s.cleared=[1,3,4];
  for(const r of [1,3,4,5])s.survey[r]=G.REGIONS[r].thresholds[1];
  for(const r of [1,3,4])s.projects[G.PROJECTS[r].id]=G.PROJECTS[r].choices[0].id;
  fund(s);for(const k of G.MATERIAL_IDS)s.world.materials[k]=G.materialCapacity(s,k);s.world.materials.steel=0;s.world.materials.ore=0;
  assert.equal(G.technologyDiscovered(s,'metallurgy'),false);assert.equal(G.objectiveRegion(s),5);
  const goal=G.objective(s);hasDestination(s,goal);
  if(goal.view==='research')assert.equal(G.technologyPrerequisiteReason(s,goal.research),'');
});

test('a full equipment inventory does not recommend an impossible craft',()=>{
  let s=frontierFixture();
  s=craft(s);s=G.equipGear(s,s.party[0],s.guild.inventory.at(-1).id);
  while(s.guild.inventory.length<36){s=craft(s);s.guild.inventory.at(-1).rarity=1;s.guild.inventory.at(-1).affix=0;}
  for(const g of s.guild.inventory){g.rarity=1;g.affix=0;}
  const goal=G.objective(s);hasDestination(s,goal);
  assert.ok(!(goal.tab==='forge'&&G.forgeReason(s,goal.recipe||'blade').includes('已满')),JSON.stringify(goal));
});
