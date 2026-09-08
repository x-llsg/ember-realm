import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/realm.ts';

// Constructed mechanism fixtures, NOT legal campaign playthroughs. All tested
// changes run through public actions/advance. Fixture construction isolates
// economic rules; it is never evidence for human playtime or campaign pacing.
const copy=structuredClone;
const reload=s=>G.decodeSave(JSON.stringify(s));
const close=(a,b,label='')=>assert.ok(Math.abs(a-b)<1e-7,`${label}: ${a} != ${b}`);
function town() {
  const s=G.freshState(197723154);
  Object.assign(s.buildings,{fire:1,warehouse:4,hut:3,lumber:2,farm:2,quarry:2,market:2,tavern:2,forge:2,shrine:2});
  s.population=12;s.assigned=true;s.nextEventAt=100000;
  s.guild.depths.fill(3);s.explored.fill(1);s.cleared=[1,2,3,4];
  s.world.tech=G.TECHNOLOGIES.map(t=>t.id);s.research=['tools','baskets','godslayer'];
  s.heroes=['rhea','finn','luna','kael','orin','vera'].map(role=>{
    const h=G.makeApplicant(s,role); delete h.talentVersion;
    Object.assign(h,{level:20,quality:3,aptitude:{hp:100,attack:100,defense:100},talent:'diligent',flaw:'overcome',mastery:0,learnedNodes:[],activeSkill:G.DEFAULT_SKILL[role]});
    return h;
  });
  s.party=s.heroes.slice(0,4).map(h=>h.id);
  for(const k of Object.keys(G.RESOURCE_NAMES))s.resources[k]=G.capacity(s,k);
  for(const k of G.MATERIAL_IDS)s.world.materials[k]=G.REGION_MATERIALS.includes(k)?30:0;
  assert.deepEqual(reload(s),s);return s;
}
function action(s,fn,label='action') {
  const before=copy(s),after=fn(s);
  assert.notEqual(after,s,`${label} must execute`);assert.deepEqual(s,before,`${label} preserves input`);
  assert.deepEqual(reload(after),after,`${label} produces loadable save`);return after;
}
function route(s,r,crew=1) {
  if(!s.economy.routes[r].level)s=action(s,x=>G.upgradeRoute(x,r),`route ${r}`);
  for(let i=0;i<crew;i++)s=action(s,x=>G.assignRoute(x,r,1),`crew ${r}`);
  return s;
}
function ticking(s,seconds) {
  const before=copy(s),after=G.advance(s,seconds);assert.deepEqual(s,before);
  assert.deepEqual(reload(after),after,'advanced save must roundtrip');return after;
}
function inputs(s) {return {resources:copy(s.resources),materials:copy(s.world.materials)};}

test('v8 new game starts with zero stock, zero workers, zero transport/work/order income',()=>{
  const s=G.freshState(1),after=G.advance(s,600);
  assert.equal(s.version, 10);assert.deepEqual(after.resources,s.resources);assert.deepEqual(after.world.materials,s.world.materials);
  assert.equal(G.transportWorkers(after),0);assert.equal(G.transportLines(after),0);
  assert.ok(after.economy.routes.every(r=>!r.enabled&&!r.crew&&!r.level&&!r.delivered));
  assert.deepEqual(G.production(after),s.resources);assert.deepEqual(after.economy.production,s.economy.production);
  assert.deepEqual(after.economy.crafted,s.economy.crafted);assert.deepEqual(reload(after),after);
});

test('discovery or full road progress alone cannot build transport before defeating the first guardian',()=>{
  for(let r=0;r<6;r++){
    const s=town();s.cleared=s.cleared.filter(x=>x!==r);s.guild.depths[r]=0;s.guild.progress[r]=G.FRONTIER_REQUIREMENTS[0];
    assert.equal(G.routeDiscovered(s,r),true);assert.match(G.routeUpgradeReason(s,r),/第一据点/);
    assert.equal(G.upgradeRoute(s,r),s);assert.equal(G.assignRoute(s,r,1),s);
  }
});

test('transport upgrade pays the displayed finite bill, creates no stock and earns nothing until staffed',()=>{
  const s=town(),bill=G.routeCost(s,0),before=inputs(s),after=action(s,x=>G.upgradeRoute(x,0));
  for(const k of Object.keys(s.resources))close(after.resources[k],before.resources[k]-(bill.cost[k]||0));
  for(const k of G.MATERIAL_IDS)close(after.world.materials[k],before.materials[k]-(bill.materials[k]||0));
  assert.equal(after.economy.routes[0].level,1);assert.equal(G.routeYield(after,0),0);
  assert.deepEqual(inputs(ticking(after,20)),inputs(after));
});

test('production jobs and transport crew share the same finite resident pool; pause does not free assigned workers',()=>{
  let s=town();s.population=3;s=route(s,0,2);
  assert.equal(G.transportWorkers(s),2);assert.equal(G.idleWorkers(s),1);assert.equal(G.freeEconomyWorkers(s),1);
  s=action(s,x=>G.assign(x,'wood',1));assert.equal(G.idleWorkers(s),0);
  assert.equal(G.assignRoute(s,0,1),s);assert.equal(G.assign(s,'food',1),s);
  s=action(s,x=>G.toggleRoute(x,0));assert.equal(G.idleWorkers(s),0);assert.equal(G.transportWorkers(s),2);
  s=action(s,x=>G.assignRoute(x,0,-1));assert.equal(G.idleWorkers(s),1);assert.equal(G.transportWorkers(s),1);
  s=action(s,x=>G.assign(x,'food',1));assert.equal(G.freeEconomyWorkers(s),0);
});

test('adding a worker to a paused staffed line cannot exceed the active transport-slot limit',()=>{
  let s=town();s=route(s,0);s=route(s,1);s=action(s,x=>G.toggleRoute(x,1));s=route(s,2);
  assert.equal(G.transportLines(s),2);assert.equal(G.transportSlots(s),2);assert.equal(s.economy.routes[1].crew,1);
  assert.ok(G.routeAssignmentReason(s,1,1));assert.equal(G.assignRoute(s,1,1),s);
  assert.equal(G.toggleRoute(s,1),s);assert.deepEqual(reload(s),s);
});

test('removing final route worker pauses route and returns worker; a fourth worker is impossible',()=>{
  let s=route(town(),0,3);assert.equal(G.assignRoute(s,0,1),s);
  for(let i=0;i<3;i++)s=action(s,x=>G.assignRoute(x,0,-1));
  assert.equal(s.economy.routes[0].crew,0);assert.equal(s.economy.routes[0].enabled,false);
  assert.equal(G.routeYield(s,0),0);assert.equal(G.transportWorkers(s),0);assert.equal(G.assignRoute(s,0,-1),s);
});

test('main expedition, staffed logistics and workshop progress together without consuming the main party for hauling',()=>{
  let s=route(town(),0);s=action(s,x=>G.toggleWork(x,'boards',true));
  s=action(s,x=>G.expedition(x,2,'frontier'));
  const expedition=copy(s.expedition),party=copy(s.party),before=inputs(s),duration=G.workDuration(s,'boards');
  const seconds=Math.min(duration,Math.floor(expedition.end-s.time)-1);assert.ok(seconds>0);
  const after=ticking(s,seconds);
  assert.deepEqual(after.party,party);assert.deepEqual(after.expedition,expedition);
  assert.ok(after.economy.routes[0].delivered>0);assert.ok(after.world.workProgress.boards>0||after.economy.crafted.boards>0);
  assert.ok(after.resources.food<before.resources.food);assert.ok(after.resources.gold<before.resources.gold);
  assert.equal(after.economy.routes[0].crew,1);
});

test('no food or no gold pauses all transportation without losing the other input',()=>{
  for(const absent of ['food','gold']){
    let s=route(town(),0);s=route(s,1);s.resources[absent]=0;
    const before=inputs(s),after=ticking(s,5);
    assert.deepEqual(inputs(after),before);assert.equal(after.economy.routes[0].delivered,0);assert.equal(after.economy.routes[1].delivered,0);
  }
});

test('full destination material stops only that route and consumes no upkeep for that route',()=>{
  let s=route(town(),0);s.world.materials.timber=G.materialCapacity(s,'timber');
  assert.equal(G.transportPlan(s).yields[0],0);const before=inputs(s);s=ticking(s,4);assert.deepEqual(inputs(s),before);
  s=route(s,1);const plan=G.transportPlan(s),after=ticking(s,1);
  assert.equal(plan.yields[0],0);assert.ok(plan.yields[1]>0);close(after.resources.food,s.resources.food-plan.food);
  close(after.resources.gold,s.resources.gold-plan.gold);close(after.world.materials.essence,s.world.materials.essence+plan.yields[1]);
});

test('transport lines share scarce upkeep proportionally with no first-region priority',()=>{
  let s=route(town(),0);s=route(s,1);
  const plentiful=G.transportPlan(s);s.resources.food=plentiful.food*.4;
  const plan=G.transportPlan(s),after=ticking(s,1);
  for(const r of [0,1]){close(plan.yields[r]/plentiful.yields[r],.4);close(after.economy.routes[r].delivered,plan.yields[r]);}
  close(after.resources.food,0);close(after.resources.gold,s.resources.gold-plan.gold);
});

test('near-capacity delivery only pays for material that actually fits',()=>{
  const s=route(town(),0);const allowed=G.routeYield(s,0)/3;
  s.world.materials.timber=G.materialCapacity(s,'timber')-allowed;
  const after=ticking(s,1);close(after.world.materials.timber,G.materialCapacity(s,'timber'));
  close(after.economy.routes[0].delivered,allowed);close(s.resources.food-after.resources.food,allowed*3);
  close(s.resources.gold-after.resources.gold,allowed);
});

for(const id of G.WORK_IDS)for(const mode of ['steady','efficient','rush'])test(`${id} ${mode}: completed batches use exact displayed bill and output; upstream stock is conserved`,()=>{
  let s=town();const development={boards:'carpentry',steel:'metalwork',runes:'inscription'}[id];
  s.economy.development[development]=4;
  s=action(s,x=>G.setWorkMode(x,id,mode));s=action(s,x=>G.toggleWork(x,id,true));
  const bill=G.processingBill(s,id),output=G.processingOutput(s,id),duration=G.workDuration(s,id),before=inputs(s);
  let after=ticking(s,duration-1);assert.deepEqual(inputs(after),before,'no charge before batch completion');
  after=ticking(after,1);assert.equal(after.economy.crafted[id],output);assert.equal(output,2);
  for(const k of Object.keys(s.resources))close(after.resources[k],before.resources[k]-(bill.cost[k]||0),k);
  for(const k of G.MATERIAL_IDS)close(after.world.materials[k],before.materials[k]-(bill.materials[k]||0)+(k===id?output:0),k);
  assert.equal(after.world.workProgress[id],0);
});

test('rush is faster and uses more inputs; efficient is slower and uses fewer actual inputs',()=>{
  for(const id of G.WORK_IDS){
    const s=town();s.economy.development[{boards:'carpentry',steel:'metalwork',runes:'inscription'}[id]]=2;
    const steady=G.processingBill(s,id),time=G.workDuration(s,id);
    const efficient=G.setWorkMode(s,id,'efficient'),rush=G.setWorkMode(s,id,'rush');
    assert.ok(G.workDuration(efficient,id)>time);assert.ok(G.workDuration(rush,id)<time);
    for(const [k,n]of Object.entries(steady.cost)){assert.ok(G.processingBill(efficient,id).cost[k]<=n);assert.ok(G.processingBill(rush,id).cost[k]>=n);}
    for(const [k,n]of Object.entries(steady.materials)){close(G.processingBill(efficient,id).materials[k],n*.75);close(G.processingBill(rush,id).materials[k],n*1.5);}
  }
});

test('paused, full-output, missing-resource and missing-raw-input workshops never consume unrelated stock',()=>{
  for(const id of G.WORK_IDS)for(const reason of ['paused','full','resource','material']){
    let s=town();s=G.toggleWork(s,id,reason!=='paused');
    const bill=G.processingBill(s,id);
    if(reason==='full')s.world.materials[id]=G.workshopTarget(s,id);
    if(reason==='resource')s.resources[Object.keys(bill.cost)[0]]=0;
    if(reason==='material')s.world.materials[Object.keys(bill.materials)[0]]=0;
    const before=inputs(s),progress=s.world.workProgress[id],after=ticking(s,G.workDuration(s,id)+1);
    assert.deepEqual(inputs(after),before,`${id}/${reason}`);assert.equal(after.world.workProgress[id],progress);assert.equal(after.economy.crafted[id],0);
  }
});

test('batch output never overfills output target or charges for a partial batch',()=>{
  let s=town();s.economy.development.carpentry=4;s.economy.development.storage=2;
  s=G.setWorkTarget(s,'boards',.25);s=G.toggleWork(s,'boards',true);
  s.world.materials.boards=G.workshopTarget(s,'boards')-1;
  const before=inputs(s),after=ticking(s,100);assert.deepEqual(inputs(after),before);assert.equal(after.economy.crafted.boards,0);
});

test('resource reserve blocks workshop and logistics at the same visible capacity percentage',()=>{
  let s=route(town(),0);s.economy.development.storage=2;
  s=G.setResourceReserve(s,.25);s=G.toggleWork(s,'boards',true);
  s.resources.food=G.capacity(s,'food')*.25;s.resources.gold=G.capacity(s,'gold')*.25;
  assert.equal(G.transportPlan(s).food,0);assert.ok(G.workReason(s,'boards'));
  const before=inputs(s),after=ticking(s,100);assert.deepEqual(inputs(after),before);
});

test('lower output target and mode switch retain existing stock and completed partial progress',()=>{
  let s=town();s.economy.development.carpentry=2;s.economy.development.storage=2;s=G.toggleWork(s,'boards',true);
  s=ticking(s,3);const progress=s.world.workProgress.boards;
  s.world.materials.boards=G.materialCapacity(s,'boards')*.75;
  const stock=inputs(s);s=action(s,x=>G.setWorkTarget(x,'boards',.25));s=action(s,x=>G.setWorkMode(x,'boards','efficient'));
  assert.deepEqual(inputs(s),stock);assert.equal(s.world.workProgress.boards,progress);
  const after=ticking(s,20);assert.deepEqual(inputs(after),stock);assert.equal(after.world.workProgress.boards,progress);
});

test('development unlocks modes and stock controls; none is freely usable before its threshold',()=>{
  let s=town();assert.equal(G.setWorkMode(s,'boards','rush'),s);assert.equal(G.setWorkTarget(s,'boards',.5),s);assert.equal(G.setResourceReserve(s,.1),s);
  s=action(s,x=>G.improveDevelopment(x,'carpentry'));assert.equal(G.setWorkMode(s,'boards','rush'),s);
  s=action(s,x=>G.improveDevelopment(x,'carpentry'));s=action(s,x=>G.setWorkMode(x,'boards','rush'));
  s=action(s,x=>G.improveDevelopment(x,'storage'));s=action(s,x=>G.improveDevelopment(x,'storage'));
  s=action(s,x=>G.setWorkTarget(x,'boards',.5));s=action(s,x=>G.setResourceReserve(x,.1));
});

test('online, segmented offline and saved intermediate economy ticks are identical across parallel systems',()=>{
  let s=route(town(),0);s=route(s,1);s=G.assign(s,'wood',1);s=G.assign(s,'food',2);s=G.assign(s,'gold',1);
  for(const id of G.WORK_IDS)s=G.toggleWork(s,id,true);
  s.resources.gold=G.capacity(s,'gold')*.4;s=G.toggleCivicOrder(s);s=G.assignDuty(s,'academy',s.heroes[4].id);
  s=G.expedition(s,2,'frontier');assert.ok(s.expedition);
  const whole=ticking(s,300);let parts=s;
  for(let i=0;i<300;i++){parts=G.advance(parts,1);if(i%31===0)parts=reload(parts);}
  assert.deepEqual(parts,whole);
});

test('v7 migration preserves heroes, applicants, equipment, RNG, progression, partial workshop and battle state',()=>{
  let s=town();s.guild.depths[0]=5;s=G.startBattle(s,0);assert.ok(s.battle);
  s=G.combat(s,G.commandFor(s.party[0],'attack'));s.world.work.boards=true;s.world.workProgress.boards=3;
  s.version=7;delete s.economy;
  const before=copy(s),loaded=reload(s);assert.deepEqual(s,before);assert.equal(loaded.version, 10);
  const {economy,civic,...body}=loaded;const {civic:oldCivic,...oldBody}=before;assert.deepEqual(body,{...oldBody,version:10});
  assert.deepEqual(civic,{...oldCivic,invitations:Math.min(200,3+before.explored.reduce((a,b)=>a+b,0))});
  assert.equal(loaded.rng,before.rng);assert.deepEqual(loaded.heroes,before.heroes);assert.deepEqual(loaded.guild.applicants,before.guild.applicants);
  assert.ok(economy.routes.every(r=>r.level>0&&!r.crew&&!r.enabled&&r.delivered===0));
  assert.equal(G.transportWorkers(loaded),0);assert.deepEqual(reload(loaded),loaded);
});

test('business and research during manual battle change town state without changing any combat snapshot or action result',()=>{
  let s=town();s.guild.depths[0]=5;s=G.startBattle(s,0);assert.ok(s.battle);const battle=copy(s.battle);
  let changed=action(s,x=>G.improveDevelopment(x,'forestry'));
  changed=action(changed,x=>G.upgradeRoute(x,0));changed=action(changed,x=>G.assignRoute(x,0,1));
  changed=action(changed,x=>G.toggleWork(x,'boards',true));
  const research=G.RESEARCH.find(r=>!changed.research.includes(r.id)&&!G.researchReason(changed,r.id)&&G.canPay(changed,r.cost)&&!G.materialReason(changed,r.materials||{}));
  assert.ok(research,'fixture exposes an affordable ordinary research');changed=action(changed,x=>G.research(x,research.id));
  assert.deepEqual(changed.battle,battle);const advanced=ticking(changed,30);assert.deepEqual(advanced.battle,battle);
  const command=G.commandFor(s.party[0],'attack');assert.deepEqual(G.combat(s,command).battle,G.combat(advanced,command).battle);
});

test('an unlearned advancement technology with all prerequisites and its paid bill can complete during combat',()=>{
  let s=town();s.world.tech=s.world.tech.filter(id=>id!=='mythic');s.buildings.warehouse=12;
  for(const k of Object.keys(s.resources))s.resources[k]=G.capacity(s,k);
  const technology=G.TECHNOLOGIES.find(t=>t.id==='mythic');
  for(const [k,n]of Object.entries(technology.materials))s.world.materials[k]=n;
  s.guild.depths[0]=5;assert.equal(G.technologyReason(s,'mythic'),'');
  s=G.startBattle(s,0);assert.ok(s.battle);assert.ok(!s.world.tech.includes('mythic'));
  const before=inputs(s),battle=copy(s.battle);assert.equal(G.technologyReason(s,'mythic'),'');
  const after=action(s,x=>G.studyTechnology(x,'mythic'),'advancement technology during battle');
  assert.ok(after.world.tech.includes('mythic'));assert.deepEqual(after.battle,battle);
  for(const k of Object.keys(s.resources))close(after.resources[k],before.resources[k]-(technology.cost[k]||0));
  for(const k of G.MATERIAL_IDS)close(after.world.materials[k],before.materials[k]-(technology.materials[k]||0));
  const command=G.commandFor(s.party[0],'attack');assert.deepEqual(G.combat(s,command).battle,G.combat(after,command).battle);
});

test('duties accept only distinct reserve heroes; joining the party deletes the previous duty assignment',()=>{
  let s=town(); const id=s.heroes[4].id;
  assert.equal(G.assignDuty(s,'transport',s.party[0]),s);
  s=action(s,x=>G.assignDuty(x,'transport',id));assert.ok(G.dutyMultiplier(s,'transport')>1);
  assert.equal(G.assignDuty(s,'workshop',id),s);
  s=action(s,x=>G.toggleParty(x,s.party[3]));s=action(s,x=>G.toggleParty(x,id));
  assert.equal(G.dutyMultiplier(s,'transport'),1);
  assert.equal(s.economy.duties.transport,undefined);
  s=action(s,x=>G.toggleParty(x,id));assert.equal(G.dutyMultiplier(s,'transport'),1);
});

test('academy experience applies diligent, green and apprentice-origin modifiers to each pupil',()=>{
  for(const [talent,flaw,origin,multiplier]of [['veteran','overcome','初代同行者',1],['diligent','overcome','初代同行者',1.3],['veteran','green','初代同行者',.9],['veteran','overcome','学徒出身',1.25],['diligent','green','学徒出身',1.3*.9*1.25]]){
    let s=town();const pupil=s.heroes[5];Object.assign(pupil,{level:10,xp:0,talent,flaw,origin});
    s=G.assignDuty(s,'academy',s.heroes[4].id);
    const expected=(4+s.heroes[4].level*.5)*G.educationMultiplier(s)*G.dutyMultiplier(s,'academy')*multiplier*[1.6,1.4,1.2,1.05,1][pupil.quality-1];
    const before=inputs(s),after=ticking(s,10);close(after.heroes[5].xp,expected,`${talent}/${flaw}/${origin}`);
    assert.equal(after.heroes[5].level,10);close(after.resources.food,before.resources.food-4);close(after.resources.gold,before.resources.gold-2);
  }
});

test('academy clamps surplus experience when a constructed overfilled pupil reaches the phase cap',()=>{
  let s=town();Object.assign(s.heroes[5],{level:39,xp:50000});s=G.assignDuty(s,'academy',s.heroes[4].id);
  const after=ticking(s,10);assert.equal(after.heroes[5].level,40);assert.equal(after.heroes[5].xp,60+10*40**2);
});

test('all teaching pupils at level cap do not consume food/gold when there is no possible experience gain',()=>{
  let s=town();for(const h of s.heroes)h.level=40;
  s=G.assignDuty(s,'academy',s.heroes[4].id);const before=inputs(s),heroes=copy(s.heroes),after=ticking(s,10);
  assert.deepEqual(after.heroes,heroes);assert.deepEqual(inputs(after),before);
});

test('visible next-second resource ledger agrees with real advance across teaching charge boundaries',()=>{
  for(const time of [0,8,9,10]){
    let s=town();s.time=time;s=G.assignDuty(s,'academy',s.heroes[4].id);
    const before=copy(s),ledger=G.netProduction(s),after=G.advance(s,1);assert.deepEqual(s,before);
    for(const k of Object.keys(s.resources))close(ledger[k],after.resources[k]-s.resources[k],`${time}/${k}`);
  }
});

test('malicious numeric, population, transport, role and economy schema fields reject on reload',()=>{
  const cases=[
    s=>{delete s.economy;},s=>{s.economy.extra=1;},s=>{s.economy.development.forestry=13;},
    s=>{s.economy.development.storage=-1;},s=>{s.economy.routes[0].level=5;},
    s=>{s.economy.routes[0].crew=1;},s=>{s.economy.routes[0].enabled=true;},
    s=>{s.economy.routes[0].delivered=-1;},s=>{s.economy.reserve=.99;},
    s=>{s.economy.targets.boards=0;},s=>{s.economy.modes.boards='instant';},
    s=>{s.economy.duties={transport:'missing'};},s=>{s.economy.duties={transport:s.heroes[4].id,workshop:s.heroes[4].id};},
    s=>{s.economy.legacy.industry=11;},s=>{s.economy.production.wood=NaN;},
    s=>{s.economy.orderProgress=121;},s=>{s.economy.orders=1.5;},
    s=>{s.economy.routes[0]={level:1,crew:3,enabled:true,delivered:0};s.population=1;},
    s=>{for(let r=0;r<3;r++)s.economy.routes[r]={level:1,crew:1,enabled:true,delivered:0};},
    s=>{s.guild.depths[0]=0;s.economy.routes[0]={level:1,crew:0,enabled:false,delivered:0};},
  ];
  for(const mutate of cases){const s=town();mutate(s);assert.throws(()=>reload(s));}
});

test('order batch thresholds are 2/6/10 commerce; changing size resets progress and refuses unearned sizes',()=>{
  for(const [level,allowed]of [[0,[1]],[1,[1]],[2,[1,4]],[5,[1,4]],[6,[1,4,16]],[9,[1,4,16]],[10,[1,4,16,64]]]){
    const s=town();s.economy.development.commerce=level;s.economy.orderProgress=5;
    assert.deepEqual(G.orderBatches(s),allowed);
    for(const n of [1,4,16,64])if(allowed.includes(n)){const after=action(s,x=>G.setOrderBatch(x,n));assert.equal(after.economy.orderBatch,n);assert.equal(after.economy.orderProgress,0);assert.deepEqual(inputs(after),inputs(s));}else assert.equal(G.setOrderBatch(s,n),s);
  }
});

test('batch orders scale their actual inputs and gold together; missing inputs or full gold never debit stock',()=>{
  for(const batch of [1,4,16,64])for(const block of ['none','missing','full']){
    let s=town();s.economy.development.commerce=10;s.economy.development.storage=12;s.buildings.warehouse=12;
    for(const k of Object.keys(s.resources))s.resources[k]=G.capacity(s,k);s.resources.gold=0;
    const single=G.civicOrder(s);s=G.setOrderBatch(s,batch);const quote=G.civicOrder(s);
    for(const [k,n]of Object.entries(single.cost))assert.equal(quote.cost[k],n*batch);
    assert.equal(quote.gold,single.gold*batch);assert.equal(quote.seconds,single.seconds);
    if(block==='missing')s.resources[Object.keys(quote.cost)[0]]=0;
    if(block==='full')s.resources.gold=G.capacity(s,'gold');
    s=G.toggleCivicOrder(s);const before=inputs(s),after=ticking(s,quote.seconds);
    if(block==='none'){
      assert.equal(after.economy.orders,1);assert.equal(after.economy.orderProgress,0);
      for(const k of Object.keys(s.resources))close(after.resources[k],before.resources[k]-(quote.cost[k]||0)+(k==='gold'?quote.gold:0));
    }else {assert.deepEqual(inputs(after),before);assert.equal(after.economy.orders,0);assert.equal(after.economy.orderProgress,0);}
  }
});

test('optional order batch field preserves old v8 saves and rejects invalid or not-yet-earned values',()=>{
  const old=town();delete old.economy.orderBatch;assert.deepEqual(reload(old),old);assert.equal(G.civicOrder(old).gold,G.civicOrder(town()).gold);
  for(const batch of [3,0,-1,NaN,4,64]){const s=town();s.economy.orderBatch=batch;assert.throws(()=>reload(s));}
});

test('new journey keeps industrial operating permissions and chosen policies but creates no stock or passive workers',()=>{
  let s=town();s.rebuild=G.REBUILD.map(r=>r.id);s.economy.development.forestry=12;s.economy.development.carpentry=2;s.economy.development.metalwork=2;s.economy.development.inscription=2;s.economy.development.storage=2;
  s=G.setWorkMode(s,'boards','efficient');s=G.setWorkMode(s,'steel','rush');s=G.setWorkTarget(s,'boards',.25);s=G.setResourceReserve(s,.1);
  const old=copy(s),after=G.newJourney(s);assert.deepEqual(s,old);assert.equal(after.economy.legacy.industry,1);assert.deepEqual(after.economy.modes,s.economy.modes);assert.deepEqual(after.economy.targets,s.economy.targets);assert.equal(after.economy.reserve,.1);
  assert.ok(G.stockControlsUnlocked(after));for(const id of G.WORK_IDS)assert.ok(G.workModesUnlocked(after,id));
  assert.ok(Object.values(after.resources).every(n=>n===0));assert.ok(Object.values(after.world.materials).every(n=>n===0));assert.equal(after.population,0);assert.equal(G.transportWorkers(after),0);assert.ok(Object.values(after.jobs).every(n=>n===0));
  assert.deepEqual(reload(after),after);const later=ticking(after,600);assert.deepEqual(inputs(later),inputs(after));assert.deepEqual(G.production(later),after.resources);
  assert.notEqual(G.setWorkMode(after,'runes','efficient'),after);assert.notEqual(G.setWorkTarget(after,'runes',.5),after);assert.notEqual(G.setResourceReserve(after,.25),after);
});
