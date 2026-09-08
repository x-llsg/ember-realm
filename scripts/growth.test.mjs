import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import * as G from '../lib/realm.ts';

// CONSTRUCTED fixtures. This verifies combat and expedition rules, not a legal campaign.
mkdirSync(new URL('../.test-results/', import.meta.url), {recursive:true});
const output=new URL('../.test-results/growth-results.json', import.meta.url);
const results=[];const matrices={quality:[],boss:[],aptitude:[]};
function test(name,fn){try{const detail=fn();results.push({name,pass:true,detail});}catch(e){results.push({name,pass:false,error:e.message,stack:e.stack});}}
function fixture({quality=3,level=30,tier=4,aptitude=100,mastery=3,seed=123456789}={}){
  const s=G.freshState(seed);s.world.tech=G.TECHNOLOGIES.map(t=>t.id);
  s.buildings={fire:1,warehouse:10,hut:12,lumber:6,farm:6,quarry:6,market:6,tavern:3,forge:6,shrine:6};
  s.population=30;s.kit=5;s.resources={wood:10000,food:10000,stone:10000,gold:10000,iron:10000,crystal:10000};
  s.cleared=[0,1,2,3,4];s.survey=G.REGIONS.map(r=>r.thresholds[1]);s.guild.depths=[5,5,5,5,5,5];
  s.guild.intel=[100,100,100,100,100,100];s.guild.outposts=[3,3,3,3,3,3];
  s.guild.doctrine={logistics:6,smithing:5,scholarship:6};s.guild.preparation={stance:'balanced',element:'radiant',remedy:true};
  s.research=['tools','baskets','axes','preservation','masonry','accounts','scouting','rotation','steel','wards','memory','godslayer'];
  s.flags=['names'];s.projects={watch:'river',bell:'alarm',station:'traders',array:'chant',dragon:'blood',key:'cut'};
  s.heroes=['finn','luna','kael','ash'].map(role=>({...G.makeApplicant(s,role),quality,level,aptitude:{hp:aptitude,attack:aptitude,defense:aptitude},mastery,talent:'diligent',flaw:'overcome',equipment:{},weapon:0,armor:0}));
  s.party=s.heroes.map(h=>h.id);
  for(const h of s.heroes)for(const [slot,recipe,affix] of [['weapon',['finn','ash'].includes(h.role)?'bow':'staff',3],['armor','dawncoat',6],['charm','wardstone',1]]){
    const id=`gear-${++s.guild.serial}`;s.guild.inventory.push({id,recipe,tier,rarity:2,upgrade:2,affix});h.equipment[slot]=id;
  }
  // This constructed arena supplies one recipe's inputs; the public action
  // must still pay the bill and create an actual dose before any forecast.
  s.world.materials.runes = 1;
  assert.equal(G.craftPotionReason(s, 'radiant'), '');
  const prepared = G.craftPotion(s, 'radiant');
  assert.equal(prepared.guild.potions.radiant, 1);
  assert.equal(prepared.world.materials.runes, 0);
  return prepared;
}
function summary(s){const snapshot=JSON.stringify(s);const f=G.forecastBattle(s,5);assert.equal(JSON.stringify(s),snapshot,'forecast mutated input');assert.equal(f.reason,'');
  return{...G.partyStats(s),win:f.win,rounds:f.rounds,hpAfter:f.hp,commands:f.trace.reduce((o,c)=>(o[c]=(o[c]||0)+1,o),{})};}

test('live independent applicant generation + validator + repeatability',()=>{
  const a=fixture(),b=G.clone(a);let not300=0,allHigh=0;
  for(let i=0;i<1000;i++){
    const x=G.makeApplicant(a,'rhea'),y=G.makeApplicant(b,'rhea');assert.deepEqual(x,y);
    assert.ok(Object.values(x.aptitude).every(v=>Number.isInteger(v)&&v>=80&&v<=130));
    if(Object.values(x.aptitude).reduce((x,y)=>x+y,0)!==300)not300++;
    if(Object.values(x.aptitude).every(v=>v>=120))allHigh++;
    const v=G.clone(a);v.heroes=[x];v.party=[];G.validateGuild(v);
  }assert.ok(not300>900);return{seeds:1000,not300,allHigh};
});
test('live same level same equipment quality ratios',()=>{
  for(const level of [1,20,30,40])for(const tier of [1,4,6]){
    const row={level,tier,quality:{}};let previous=null;
    for(const quality of [1,3,5]){
      const s=fixture({level,tier,quality});const v=G.partyStats(s);row.quality[quality]=v;
      if(previous)for(const k of ['hp','attack','defense'])assert.ok(v[k]>=previous[k]);previous=v;
    }matrices.quality.push(row);
  }return{pairs:matrices.quality.length};
});
test('live native growth and mastery defense; real equipped gear enhancement is monotonic',()=>{
  let comparisons=0;
  const s=fixture({tier:4});const base=s.heroes[0];
  for(let quality=1;quality<=5;quality++)for(let level=1;level<=40;level++)for(let mastery=0;mastery<=5;mastery++){
    const hero={...base,origin:'山地猎户',quality,level,mastery};const before=G.individualStats(s,hero);
    const variants=[{...hero,level:level+1},{...hero,aptitude:{hp:130,attack:130,defense:130}}];
    if(quality<5)variants.push({...hero,quality:quality+1});if(mastery<5)variants.push({...hero,mastery:mastery+1});
    for(const next of variants){const after=G.individualStats(s,next);for(const k of ['hp','attack','defense'])assert.ok(after[k]>=before[k]);comparisons++;}
    const next=G.clone(s);next.guild.inventory.find(x=>x.id===hero.equipment.armor).upgrade++;
    const enhanced=G.individualStats(next,hero);for(const k of ['hp','attack','defense'])assert.ok(enhanced[k]>=before[k]);comparisons++;
    const trained=G.individualStats(s,{...hero,level:level+1});const multiplier=[1,1.35,1.85,2.6,3.6][quality-1]*(1+mastery*.04);
    for(const [k,gain]of Object.entries({hp:24,attack:5,defense:.8}))assert.ok(Math.abs(trained[k]-before[k]-gain*multiplier)<1e-8);
  }return{comparisons};
});
test('actual low-map dispatch guarantees success across 512 seeds per map/depth',()=>{
  let checks=0,settled=0;const ratios=[];
  for(const region of [0,1,2])for(const depth of [0,4]){
    const base=fixture({quality:5,level:40,tier:6});base.guild.depths[region]=depth;base.guild.intel[region]=0;base.guild.outposts[region]=0;
    base.cleared=base.cleared.filter(r=>r!==region);base.guild.preparation={stance:'balanced',element:'physical',remedy:false};
    const info=G.frontierInfo(base,region);assert.ok(info.ratio>=2);assert.equal(info.chance,1);assert.equal(info.guaranteed,true);
    ratios.push({region,depth,ratio:info.ratio,progress:info.progress,required:info.required});
    for(let seed=1;seed<=512;seed++){
      const s=G.clone(base);s.rng=seed;const snapshot=JSON.stringify(s);const next=G.expedition(s,region,'frontier');assert.equal(JSON.stringify(s),snapshot);
      assert.ok(next.expedition,G.dispatchReason(s,region,'frontier',0));assert.equal(next.expedition.success,true);assert.equal(next.expedition.chance,1);assert.notEqual(next.expedition.outcome,2);
      if(seed<=4){const done=G.advance(next,next.expedition.end-next.time);assert.ok(done.lastExpedition?.success);assert.notEqual(done.lastExpedition.outcome,2);assert.ok(done.recoveryUntil<=done.time);assert.ok(done.guild.depths[region]>depth||done.guild.progress[region]>base.guild.progress[region]);settled++;}
      checks++;
    }
  }return{checks,settled,ratios};
});
test('final boss level × gear tier × quality matrix; same world and preparation',()=>{
  for(const quality of [1,3,5])for(const level of [20,24,28,32,36,40])for(const tier of [2,3,4,5,6]){
    const s=fixture({quality,level,tier});matrices.boss.push({quality,level,tier,aptitude:100,...summary(s)});
  }
  const regressions=[];
  for(const row of matrices.boss){
    for(const field of ['level','tier','quality']){
      const peers=matrices.boss.filter(x=>['level','tier','quality'].every(k=>k===field||x[k]===row[k])&&x[field]>row[field]);
      for(const next of peers)if(row.win&&!next.win)regressions.push({before:row,after:next,field});
    }
  }
  // Report AI victory regressions as evidence; a strategy branch can change when stats grow.
  return{rows:matrices.boss.length,winRegressionCount:regressions.length,regressions};
});
test('aptitude 80/100/130 final boss comparison with identical training and gear',()=>{
  for(const level of [20,30,40])for(const tier of [4,5,6])for(const aptitude of [80,100,130]){
    const s=fixture({quality:3,level,tier,aptitude});matrices.aptitude.push({quality:3,level,tier,aptitude,...summary(s)});
  }return{rows:matrices.aptitude.length};
});
const report={scope:'Constructed deterministic unit/combat fixtures; not a legal playthrough or recruitment-economy claim.',config:{roles:['finn','luna','kael','ash'],mastery:3,rarity:2,upgrade:2,smithing:5,intel:100,outpost:3,bossHp:G.REGIONS[5].hp,bossAttack:G.REGIONS[5].atk,weapon:'bow/staff + pierce',armor:'dawncoat + radiant',charm:'wardstone + hp'},passed:results.filter(x=>x.pass).length,total:results.length,results,matrices};
writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify({output,passed:report.passed,total:report.total,results}));
if(report.passed!==report.total)process.exitCode=1;
