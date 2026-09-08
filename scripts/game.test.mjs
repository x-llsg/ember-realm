import assert from 'node:assert/strict';
import test from 'node:test';
import * as G from '../lib/game.ts';

test('opening economy, worker constraints, production and atomic payment',()=>{
 let s=G.freshState(1000);s=G.build(s,'fire');assert.equal(s.population,3);assert.equal(s.resources.wood,8);assert.equal(G.build(s,'fire'),s);assert.equal(G.assign(s,'stone',1),s);assert.equal(G.assign(s,'wood',1).jobs.wood,2);
 s=G.assign(s,'wood',1);assert.equal(G.assign(s,'food',1),s);s=G.advance(s,100);assert.ok(s.resources.wood>100);assert.equal(s.resources.food,95);const before=s;s=G.build(s,'hut');assert.equal(before.buildings.hut,0);assert.equal(s.buildings.hut,1);assert.ok(s.resources.wood>=0);
 const paused={...s,paused:true};assert.equal(G.advance(paused,100),paused);assert.equal(G.gather(s,'iron'),s);const g=G.gather(s,'wood');assert.equal(G.gather(g,'stone'),g);
});

function basicTown(){let s=G.build(G.freshState(1000),'fire');s=G.advance(s,300);s=G.build(s,'quarry');s=G.assign(s,'stone',1);s=G.advance(s,120);s=G.build(s,'hut');s=G.hireWorker(s);s=G.build(s,'market');s=G.assign(s,'gold',1);s=G.advance(s,200);s=G.build(s,'tavern');s=G.recruit(s,'rhea');s=G.recruit(s,'finn');return s;}
test('telegraphed heavy attacks reward guarding and final judgment seals healing',()=>{
 let s=basicTown();for(let i=0;i<2;i++){s=G.expedition(s,0);s=G.advance(s,30);}s=G.startBattle(s,0);s.battle.round=3;const attack=G.combat(s,'attack'),guard=G.combat(s,'guard');assert.ok(guard.battle.hp>attack.battle.hp);s.battle.region=5;s.battle.enemyHp=10000;assert.equal(G.combat(s,'heal'),s);
});
test('expedition and boss gates reject illegal transitions and rewards settle once',()=>{
 let s=basicTown();assert.equal(s.heroes.length,2);assert.equal(G.startBattle(s,0),s);assert.equal(G.expedition(s,1),s);s=G.expedition(s,0);assert.ok(s.expedition);assert.equal(G.expedition(s,0),s);assert.equal(G.toggleParty(s,'rhea'),s);s=G.advance(s,30);assert.equal(s.explored[0],1);const gold=s.resources.gold;s=G.advance(s,30);assert.equal(s.explored[0],1);assert.ok(s.resources.gold>=gold);
 s=G.expedition(s,0);s=G.advance(s,30);s=G.startBattle(s,0);assert.ok(s.battle);assert.equal(G.expedition(s,0),s);const retreat=G.combat(s,'retreat');assert.equal(retreat.battle,null);assert.equal(retreat.heroes.length,2);assert.deepEqual(retreat.cleared,[]);
});
test('save round trip preserves pending expedition and combat, rejects malformed data',()=>{
 let s=basicTown();s=G.expedition(s,0);assert.deepEqual(G.decodeSave(JSON.stringify(s)),s);s=G.advance(s,50);s=G.expedition(s,0);s=G.advance(s,50);s=G.startBattle(s,0);s=G.combat(s,'attack');assert.deepEqual(G.decodeSave(JSON.stringify(s)),s);
 for(const mutate of [x=>x.resources.food=-1,x=>x.jobs.wood=99,x=>x.party.push('bogus'),x=>x.cleared=[5],x=>x.battle.energy=99,x=>x.expedition={},x=>x.explored=[1],x=>x.heroes[0].level=999,x=>x.gatherAt=x.time+100,x=>x.lastEvent=1e8]){const bad=G.clone(s);mutate(bad);assert.throws(()=>G.decodeSave(JSON.stringify(bad)));}
 const future=G.expedition(G.combat(s,'retreat'),0);future.expedition.start=future.time+10000;future.expedition.end=future.expedition.start+30;assert.throws(()=>G.decodeSave(JSON.stringify(future)));
});

test('full campaign is reachable using only legal economy and combat actions',()=>{
 let s=basicTown(),waited=s.time;const wait=()=>{s=G.advance(s,15);waited+=15;if(waited>20000)throw Error('Campaign economy stalled');};
 const afford=(cost)=>{while(!G.canPay(s,cost)){for(const k of ['iron','crystal'])if(cost[k]&&s.resources[k]<cost[k]&&G.canPay(s,{gold:k==='iron'?25:35}))s=G.trade(s,k,true);if(!G.canPay(s,cost))wait();}};
 const construct=(id)=>{afford(G.buildingCost(s,id));const next=G.build(s,id);assert.notEqual(next,s,`Can build ${id}`);s=next;};
 construct('hut');while(s.population<G.populationCap(s)){afford({food:12});s=G.hireWorker(s);}while(G.idleWorkers(s)>0){s=G.assign(s,s.jobs.gold<4?'gold':s.jobs.food<3?'food':'wood',1);}for(const id of ['lumber','farm','market','forge'])construct(id);construct('quarry');construct('market');
 let battleRounds=[];
 for(let region=0;region<6;region++){
  for(const hero of G.HEROES.filter(h=>h.unlock<=region&&!s.heroes.some(x=>x.id===h.id))){afford(hero.cost);s=G.recruit(s,hero.id);}
  if(s.heroes.length>4){for(const id of [...s.party])s=G.toggleParty(s,id);for(const id of ['rhea','luna','kael',region>=4?'ash':'orin'])s=G.toggleParty(s,id);}
  const targetLevel=Math.min(G.levelCap(s),2+region*2);for(const hero of s.heroes.filter(h=>s.party.includes(h.id))){while(s.heroes.find(h=>h.id===hero.id).level<targetLevel){afford(G.trainCost(s.heroes.find(h=>h.id===hero.id)));const next=G.train(s,hero.id);assert.notEqual(next,s);s=next;}}
  if(region>=1&&s.buildings.forge<region+1)construct('forge');
  if(region===2){construct('shrine');for(const id of ['steel','wards']){const r=G.RESEARCH.find(r=>r.id===id);afford(r.cost);s=G.research(s,id);}}
  if(region===4){for(const id of ['memory','godslayer']){const r=G.RESEARCH.find(r=>r.id===id);afford(r.cost);s=G.research(s,id);}}
  assert.ok(G.partyStats(s).power>=G.REGIONS[region].power,`Power meets region ${region}`);
  for(let i=0;i<2;i++){afford({food:G.REGIONS[region].cost});s=G.expedition(s,region);assert.ok(s.expedition);s=G.advance(s,100);waited+=100;}
  afford({food:150});s=G.startBattle(s,region);assert.ok(s.battle);let turns=0;
  while(s.battle&&turns++<100){const b=s.battle,heavy=G.intent(b).heavy;const killSkill=b.energy>=2&&b.enemyHp<=b.attack*1.7;const command=killSkill?'skill':heavy?(region===3&&b.energy>=2?'skill':'guard'):b.hp<b.maxHp*.58?'heal':b.energy>=2?'skill':'attack';s=G.combat(s,command);}
  assert.ok(s.cleared.includes(region),`Victory in region ${region}, ${turns} turns`);assert.equal(G.startBattle(s,region),s);G.decodeSave(JSON.stringify(s));battleRounds.push(turns);
 }
 assert.equal(s.ending,true);assert.equal(s.cleared.length,6);assert.ok(Object.values(s.resources).every(v=>Number.isFinite(v)&&v>=0));console.log(JSON.stringify({campaignGameMinutes:Math.round(waited/60),battleRounds,finalPower:G.partyStats(s).power}));
});
