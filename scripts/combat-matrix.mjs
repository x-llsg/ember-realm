// Synthetic stage-constrained unit fixtures. This is NOT a legal campaign or a play-time measurement.
import * as G from '../lib/realm.ts';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const OUT = fileURLToPath(new URL('../.test-results/combat-matrix/',import.meta.url));
fs.mkdirSync(OUT,{recursive:true});
const ROOT = fileURLToPath(new URL('../',import.meta.url));
const SEEDS = Number(process.env.SEEDS || 32);
const profiles = [
  [[2,2,1,0,0,0,1],[4,6,1,2,1,1,3],[4,8,1,2,1,1,3]],
  [[3,6,1,2,1,1,3],[4,14,2,3,2,2,3],[4,16,2,3,2,2,3]],
  [[3,6,1,2,1,1,3],[4,14,2,3,2,2,3],[4,16,2,3,2,2,3]],
  [[4,16,3,2,2,3,3],[4,26,4,4,4,4,3],[4,28,4,4,4,4,3]],
  [[4,12,2,2,2,2,3],[4,28,4,4,4,4,3],[4,30,4,5,4,4,3]],
  [[4,28,4,4,4,4,3],[4,36,6,6,5,5,3],[4,38,6,6,5,5,3]],
];
const researchByStage = [[],[],['steel'],['steel','wards'],['steel','wards'],['steel','wards','memory','godslayer']];

function stageWorld(s,r,index) {
  if (r===0) {
    if(index) s.world.tech=['settlement'];
  } else {
    s.guild.depths[0]=r===1?1:2;
    s.world.tech=['settlement'];
    if(r===1&&index) s.world.tech.push('runecraft');
    if(r===2&&index) s.world.tech.push('metallurgy');
    if(r>=3) {
      s.guild.depths[1]=1;s.guild.depths[2]=2;
      s.world.tech.push('metallurgy','runecraft');
      if(r!==4||index) {
        s.cleared=[0,1,2];s.guild.depths[0]=s.guild.depths[1]=s.guild.depths[2]=5;
        s.world.tech.push('citadel');
      }
      if(r===3&&index)s.world.tech.push('infernalcraft');
      if(r===4&&index)s.world.tech.push('dragoncraft');
      if(r===5) {
        s.cleared=[0,1,2,3,4];s.guild.depths=[5,5,5,5,5,0];
        s.world.tech.push('dragoncraft','infernalcraft');
        if(index)s.world.tech.push('mythic');
      }
    }
  }
  s.guild.depths[r]=index===0?0:index===1?4:5;
  s.guild.progress[r]=index===2?0:G.FRONTIER_REQUIREMENTS[s.guild.depths[r]];
  s.explored=s.guild.depths.map(x=>x?1:0);s.survey=s.guild.depths.map(x=>x?1:0);
}

export function fixture(r,index,investment='target',seed=123456) {
  let s=G.freshState(1000000);
  stageWorld(s,r,index);
  const rank=G.townRank(s);
  for(const id of Object.keys(s.buildings))s.buildings[id]=Math.min(G.buildingLimit(s,id),id==='tavern'?Math.max(1,rank):id==='fire'?1:Math.max(1,rank));
  if(rank===0)s.buildings.forge=s.buildings.shrine=0;
  s.buildings.tavern=G.buildingLimit(s,'tavern');
  s.buildings.warehouse=G.buildingLimit(s,'warehouse');
  s.population=Math.min(G.populationCap(s),12);
  s.guild.rolls=1;s.guild.applicants=[];
  s.research=researchByStage[rank].filter(id=>G.RESEARCH.find(x=>x.id===id)?.chapter<=rank);
  if(!s.world.tech.includes('metallurgy'))s.research=s.research.filter(id=>id!=='steel');
  if(!s.world.tech.includes('runecraft'))s.research=s.research.filter(id=>id!=='wards');
  if(r===5&&index===2&&!s.research.includes('godslayer'))s.research.push('godslayer');
  let [count,level,tier,upgrade,mastery,kit,slots]=profiles[r][index];
  let quality=3,apt=100,rarity=2;
  if(investment==='low') {level=Math.max(1,Math.floor(level*.65));tier=Math.max(1,tier-1);upgrade=Math.max(0,upgrade-2);mastery=Math.max(0,mastery-1);kit=Math.max(0,kit-1);quality=2;apt=90;rarity=1;}
  if(investment==='high') {level=Math.min(G.levelCap(s),level+4);upgrade=rank?Math.min(rank===1?3:8,upgrade+2):0;mastery=rank?Math.min(5,mastery+1):0;quality=5;apt=115;rarity=3;}
  assert.ok(level<=G.levelCap(s));assert.ok(tier<=G.gearTier(s));
  s.kit=kit;s.guild.doctrine.smithing=rank>=2?mastery:0;
  const element=G.enemyDefinition(s,r,index===2?'boss':'guardian').element;
  const roles=['rhea','finn','luna','kael'].slice(0,count);
  for(const role of roles) {
    const h=G.makeApplicant(s,role);
    Object.assign(h,{level,quality,aptitude:{hp:apt,attack:apt,defense:apt},mastery,origin:'行商护卫',talent:'diligent',flaw:rank?'overcome':'green',weapon:0,armor:0,xp:0,equipment:{},learnedNodes:[],activeSkill:G.DEFAULT_SKILL[role]});
    s.heroes.push(h);s.party.push(h.id);
    const magical=element!=='physical'&&G.recipeUnlockReason(s,element==='shadow'?'shadowcoat':element==='fire'?'firecoat':'dawncoat')==='';
    let weapon=role==='finn'||r===4?'bow':G.recipeUnlockReason(s,'staff')===''&&element!=='physical'?'staff':G.recipeUnlockReason(s,'pike')===''?'pike':'blade';
    if(investment==='low'&&role!=='finn')weapon='blade';
    const recipes=[weapon,...(slots===3?[magical&&investment!=='low'?(element==='shadow'?'shadowcoat':element==='fire'?'firecoat':'dawncoat'):'plate',magical&&investment!=='low'&&G.recipeUnlockReason(s,'wardstone')===''?'wardstone':'vitality']:[])];
    for(const recipe of recipes) {
      assert.equal(G.recipeUnlockReason(s,recipe),'',`${r}/${index} ${recipe} unavailable`);
      const item={id:`gear-${++s.guild.serial}`,recipe,tier,rarity,upgrade,affix:2};
      s.guild.inventory.push(item);h.equipment[G.RECIPES.find(x=>x.id===recipe).slot]=item.id;
    }
  }
  // Spend earned skill points through the real API; prioritize first branch, then other passives.
  for(const id of s.party) {
    for(const node of [...G.roleTree(s.heroes.find(h=>h.id===id).role)].filter(n=>n.branch!=='root').sort((a,b)=>(a.branch==='a'?0:1)-(b.branch==='a'?0:1)||a.depth-b.depth)) {
      if(!G.learnSkillReason(s,id,node.id))s=G.learnSkill(s,id,node.id);
    }
    const h=s.heroes.find(h=>h.id===id), firstBranch=G.roleTree(h.role).find(n=>n.branch==='a'&&n.type==='active');
    if(firstBranch&&G.unlockedSkills(h).some(x=>x.id===firstBranch.skillId))s=G.setHeroSkill(s,id,firstBranch.skillId);
  }
  for(const key of Object.keys(s.resources))s.resources[key]=G.capacity(s,key);
  // No clue/outpost/project bonuses. Resources exist only to permit battle setup, not as campaign earnings.
  s.rng=seed;s.log=[];G.validateWorld(s);G.validateGuild(s);assert.ok(G.decodeSave(JSON.stringify(s)),'fixture save roundtrip');
  return {state:s,config:{kind:'synthetic stage-constrained unit fixture',investment,rank,count,level,tier,upgrade,mastery,kit,slots,quality,apt,rarity,origin:'行商护卫',affix:'守御 (+3 defense each item)',research:s.research,tech:s.world.tech,recipes:s.guild.inventory.map(x=>x.recipe),skills:s.heroes.map(h=>({role:h.role,nodes:h.learnedNodes,active:h.activeSkill})),party:G.partyStats(s)}};
}

export function runBattle(s0,r,index,policy) {
  let s=G.beginBattle(s0,r,index===2?'boss':'guardian');
  assert.ok(s.battle,`${r}/${index}: ${index===2?G.bossReason(s0,r):G.guardianReason(s0,r)}`);
  const start=G.clone(s.battle);
  let actions=0;
  while(s.battle&&actions<260) {
    const first=s.battle.units.find(u=>u.hp>0&&!s.battle.acted.includes(u.id));
    const command=policy==='auto'?G.autoCommand(s):G.commandFor(first.id,'attack');
    assert.equal(G.commandReason(s,command),'',`Invalid ${policy} command ${command}`);
    const next=G.combat(s,command);assert.notEqual(next,s,'combat no-op');s=next;actions++;
  }
  assert.equal(s.battle,null,'unbounded fight');
  assert.ok(s.lastBattle,'missing report');
  return {...s.lastBattle,actions,down:s0.party.length-s.lastBattle.survivors,start,log:s.log.slice(0,3)};
}

function average(a){return Math.round(a.reduce((x,y)=>x+y,0)/a.length*100)/100;}
export function runMatrix() {
  const results=[],fixtures={};
  for(let r=0;r<6;r++) for(let index=0;index<3;index++) for(const investment of ['low','target','high']) {
    const made=fixture(r,index,investment);
    if(investment==='target')fixtures[`${r}-${index}`]=made;
    for(const policy of ['attack','auto']) {
      const runs=[];
      for(let j=0;j<SEEDS;j++){const state=G.clone(made.state);state.rng=(Math.imul(j+1,2654435761)>>>0)||1;runs.push(runBattle(state,r,index,policy));}
      const wins=runs.filter(x=>x.won);
      const record={region:r,index,enemy:runs[0].enemy,investment,policy,config:made.config,wins:wins.length,total:SEEDS,winRate:wins.length/SEEDS,rounds:average(runs.map(x=>x.rounds)),winRounds:wins.length?average(wins.map(x=>x.rounds)):null,down:average(runs.map(x=>x.down)),winDown:wins.length?average(wins.map(x=>x.down)):null,minRounds:Math.min(...runs.map(x=>x.rounds)),maxRounds:Math.max(...runs.map(x=>x.rounds)),enemyStats:{hp:runs[0].start.enemyMaxHp,attack:runs[0].start.enemyAttack,defense:runs[0].start.enemyDefense,element:runs[0].start.enemyElement},units:runs[0].start.units.map(u=>({role:u.role,hp:u.maxHp,attack:u.attack,defense:u.defense,resistance:u.resistance,crit:u.crit,dodge:u.dodge})),sample:{seed:2654435761,report:runs[0]},failure:runs.find(x=>!x.won)||null};
      results.push(record);console.log(`${r}/${index} ${investment.padEnd(6)} ${policy.padEnd(6)} ${wins.length}/${SEEDS} rounds ${record.winRounds??'-'} down ${record.winDown??'-'}`);
    }
  }
  const source=Object.fromEntries(['lib/tactics.ts','lib/guardian-data.ts','lib/guardian-candidates.ts','lib/guild.ts','lib/realm.ts','lib/skill-tree-data.ts'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,f))).digest('hex')]));
  fs.mkdirSync(OUT,{recursive:true});
  fs.writeFileSync(path.join(OUT,'matrix-results.json'),JSON.stringify({generated:new Date().toISOString(),label:'Synthetic battle unit fixtures; not legal campaign or fastest strategy',seeds:SEEDS,source,results},null,2));
  fs.writeFileSync(path.join(OUT,'matrix-fixtures.json'),JSON.stringify(fixtures,null,2));
  const lines=['# v11 实际引擎校准','',`每组 ${SEEDS} 个固定种子。构造的阶段单元配置，非完整合法流程、非真人时长。所有战斗由正式 API 执行。`,'','| 地区/目标 | 投资 | 普攻胜率/胜利回合/倒下 | 自动胜率/胜利回合/倒下 |','|---|---|---|---|'];
  for(let i=0;i<results.length;i+=2){const a=results[i],b=results[i+1];lines.push(`| ${a.region+1}/${a.enemy} | ${a.investment} | ${a.wins}/${SEEDS} · ${a.winRounds??'—'} · ${a.winDown??'—'} | ${b.wins}/${SEEDS} · ${b.winRounds??'—'} · ${b.winDown??'—'} |`);}
  fs.writeFileSync(path.join(OUT,'matrix-results.md'),lines.join('\n'));
  return results;
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/combat-matrix.mjs'))runMatrix();
