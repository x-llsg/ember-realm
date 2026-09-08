import assert from 'node:assert/strict';
import * as G from '../lib/realm.ts';
import { combatRecommendation } from '../lib/combat-recommendation.ts';

export const difficultySeeds = (count) => Array.from({ length: count }, (_, i) => Math.imul(i + 1, 2654435761) >>> 0);

export function nakedDifficultyVariants(region,node) {
  const rank=G.townRank(recommendedFixture(region,node));
  return [
    {bare:true},
    {bare:true,baseline:true},
    ...[1,2,3,4,5].map(quality=>({bare:true,quality})),
    {bare:true,quality:5,aptitude:130},
    ...G.TREE_ROLES.filter(t=>t.townRank<=rank).flatMap(role=>[
      {bare:true,quality:3,roles:Array(4).fill(role.id)},
      ...['a','b','c'].map(branch=>({bare:true,quality:5,aptitude:130,branch,roles:Array(4).fill(role.id)})),
    ]),
  ];
}

export function recommendedFixture(region, node, { bare = false, baseline = false, roles, quality, branch, aptitude = 100 } = {}) {
  const q = combatRecommendation(region, node);
  let s = G.freshState(1000000);
  s.world.tech = [...q.tech];
  if (region) s.guild.depths[0] = region === 1 ? 1 : 2;
  if (region >= 3) { s.guild.depths[1] = 1; s.guild.depths[2] = 2; }
  if (q.tech.includes('citadel')) { s.cleared = [2]; s.guild.depths[2] = 5; }
  if (region === 5) { s.cleared = [2,3,4]; s.guild.depths[3] = s.guild.depths[4] = 5; }
  s.guild.depths[region] = node - 1;
  s.guild.progress[region] = node === 6 ? 0 : G.FRONTIER_REQUIREMENTS[node - 1];
  s.explored = s.guild.depths.map(x => x ? 1 : 0);
  s.survey = s.guild.depths.map(x => x ? 1 : 0);
  if (q.research.includes('godslayer')) s.survey[5] = G.REGIONS[5].thresholds[0];
  const rank = G.townRank(s);
  for (const id of Object.keys(s.buildings)) s.buildings[id] = Math.min(G.buildingLimit(s,id), id === 'tavern' ? Math.max(1,rank) : id === 'fire' ? 1 : rank);
  s.buildings.tavern = Math.max(1,s.buildings.tavern);
  s.buildings.warehouse = G.buildingLimit(s,'warehouse');
  s.population = Math.min(G.populationCap(s),12);
  s.research = baseline ? [] : [...q.research];
  s.kit = baseline ? 0 : q.kit;
  s.guild.doctrine.smithing = baseline ? 0 : q.smithing;
  s.guild.preparation = { ...s.guild.preparation, element: q.element, stance: q.stance, remedy: q.remedy };
  if (q.element !== 'physical') s.guild.potions[q.element] = 1;
  assert.ok(q.level <= G.levelCap(s), `${region}/${node} level legal`);
  assert.ok(q.tier <= G.gearTier(s), `${region}/${node} tier legal`);
  for (let i = 0; i < q.count; i++) {
    const role = roles?.[i] || q.roles[i];
    const h = G.makeApplicant(s,role);
    Object.assign(h,{level:q.level,quality:quality ?? (baseline ? 3 : q.quality),aptitude:{hp:aptitude,attack:aptitude,defense:aptitude},mastery:baseline ? 0 : q.mastery,origin:q.origin,talent:q.talent,talentVersion:2,flaw:'overcome',weapon:0,armor:0,xp:0,equipment:{},learnedNodes:[],activeSkill:G.DEFAULT_SKILL[role]});
    s.heroes.push(h); s.party.push(h.id);
    if (!bare) {
      const magical = q.element !== 'physical';
      const coat = q.element === 'shadow' ? 'shadowcoat' : q.element === 'fire' ? 'firecoat' : 'dawncoat';
      const recipes = {
        weapon: role === 'finn' || region === 4 ? 'bow' : magical && !G.recipeUnlockReason(s,'staff') ? 'staff' : !G.recipeUnlockReason(s,'pike') ? 'pike' : 'blade',
        armor: magical && !G.recipeUnlockReason(s,coat) ? coat : 'plate',
        charm: magical && !G.recipeUnlockReason(s,'wardstone') ? 'wardstone' : 'vitality',
        head:'cap',hands:'grips',feet:'boots',
      };
      for (const slot of q.slots) {
        const recipe = recipes[slot];
        assert.equal(G.recipeUnlockReason(s,recipe,q.tier),'', `${region}/${node}: ${recipe} available`);
        // An unrelated resistance affix contributes no damage or mitigation here.
        // The reference needs the item's normal stats, never a lucky affix roll.
        const unusedResistance = q.element === 'fire' ? 'shadow' : 'fire';
        const affix = G.AFFIXES.findIndex(a => a.stat === unusedResistance);
        assert.ok(affix >= 0 && G.AFFIXES[affix].stat !== q.element);
        const item = {id:`difficulty-${++s.guild.serial}`,recipe,tier:q.tier,rarity:q.rarity,upgrade:q.upgrade,affix};
        s.guild.inventory.push(item); h.equipment[slot] = item.id;
      }
    }
  }
  if (!baseline) for (const id of s.party) {
    const h = s.heroes.find(h => h.id === id);
    const tree = G.roleTree(h.role);
    const selectedBranch = branch || q.skillBranch;
    for (const n of tree.filter(n => n.branch !== 'root').sort((a,b) => (a.branch===selectedBranch?0:1)-(b.branch===selectedBranch?0:1)||a.depth-b.depth)) if (!G.learnSkillReason(s,id,n.id)) s = G.learnSkill(s,id,n.id);
    const skill = tree.find(n => n.branch === selectedBranch && n.type === 'active');
    if (skill && G.unlockedSkills(s.heroes.find(h => h.id === id)).some(x => x.id === skill.skillId)) s=G.setHeroSkill(s,id,skill.skillId);
  }
  for (const key of Object.keys(s.resources)) s.resources[key]=G.capacity(s,key);
  s.guild.rolls=1; s.guild.applicants=[]; s.log=[];
  assert.ok(G.decodeSave(JSON.stringify(s)),`${region}/${node}: valid save`);
  return s;
}

export function difficultyBattle(s0, region, node, seed, policy = 'auto', override) {
  let s=G.clone(s0); s.rng=seed;
  s.battle=G.createCombat(s,region,node===6?'boss':'guardian',node-1);
  if (override) Object.assign(s.battle, {enemyHp:override.hp,enemyMaxHp:override.hp,enemyAttack:override.attack,enemyDefense:override.armor*(node===6?.85:1)});
  const enemyMaxHp=s.battle.enemyMaxHp;
  let actions=0,lowestEnemyHp=enemyMaxHp;
  while(s.battle && actions++<300) {
    const before=s.battle;
    const actor=s.battle.units.find(u=>u.hp>0&&!s.battle.acted.includes(u.id));
    const command=policy==='auto'?G.autoCommand(s):G.commandFor(actor.id,'attack');
    assert.equal(G.commandReason(s,command),'');
    s=G.combat(s,command);
    if(s.battle) lowestEnemyHp=Math.min(lowestEnemyHp,s.battle.enemyHp);
    else if(s.lastBattle.won) lowestEnemyHp=0;
    else {
      // The shipping report preserves the final combat log. Reconstruct only
      // the final action's enemy damage, which happened after the last snapshot.
      const history=s.lastBattle.history;
      const overlap=history.findIndex((line,i)=>line===before.history[0]&&history.slice(i,i+3).every((entry,j)=>entry===before.history[j]));
      assert.ok(overlap>=0,'final battle report retains the prior log boundary');
      let finalHp=before.enemyHp;
      for(const line of history.slice(0,overlap)) {
        const hit=line.match(/造成 (\d+)(?: 伤害)?。$/);
        const restored=line.match(/敌人恢复 (\d+) 生命。$/);
        if(hit) finalHp-=Number(hit[1]);
        if(restored) finalHp+=Number(restored[1]);
      }
      lowestEnemyHp=Math.min(lowestEnemyHp,Math.max(0,finalHp));
    }
  }
  assert.equal(s.battle,null,'bounded combat');
  return {...s.lastBattle,enemyLowestRatio:lowestEnemyHp/enemyMaxHp};
}

export function difficultySample(s,region,node,count=32,override) {
  const runs=difficultySeeds(count).map(seed=>difficultyBattle(s,region,node,seed,'auto',override));
  return { wins:runs.filter(r=>r.won).length, rounds:runs.reduce((n,r)=>n+r.rounds,0)/count, survivors:runs.reduce((n,r)=>n+r.survivors,0)/count };
}
