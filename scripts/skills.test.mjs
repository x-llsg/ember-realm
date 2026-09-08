import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/realm.ts';

// Constructed unit fixtures, not legal campaign completions. Explicit arena
// snapshots isolate public combat transitions, never mirror the combat engine.
const copy = structuredClone;
const reload = s => G.decodeSave(JSON.stringify(s));
const unit = (s, id = s.party[0]) => s.battle.units.find(u => u.id === id);
const damage = (before, after) => before.battle.enemyHp - after.battle.enemyHp;
function syncFixture(s) {
  const b = s.battle;
  b.hp = b.units.reduce((v,u) => v + u.hp, 0);
  b.maxHp = b.units.reduce((v,u) => v + u.maxHp, 0);
  b.ward = Math.max(0,...b.units.map(u=>u.ward));
  b.burn = Math.max(0,...b.units.map(u=>u.burn));
  b.cooldowns = Object.fromEntries(b.units.map(u => [u.id, Math.max(0,...Object.values(u.cooldowns))]));
  return s;
}
function town(roster = ['rhea','finn','luna','kael'], region = 0) {
  const s = G.freshState(195893627);
  Object.assign(s.buildings, {fire:1, hut:1, tavern:1, warehouse:2});
  s.population = 6; s.assigned = true; s.nextEventAt = 100000;
  s.guild.depths.fill(5);
  s.cleared = [0,1,2,3,4].filter(r => r !== region);
  s.research = ['godslayer'];
  s.heroes = roster.map(role => {
    const h = G.makeApplicant(s,role);
    Object.assign(h, {level:15, quality:3, aptitude:{hp:100,attack:100,defense:100},
      mastery:0, talent:'diligent', flaw:'overcome', activeSkill:G.DEFAULT_SKILL[role], learnedNodes:[]});
    return h;
  });
  s.party = s.heroes.slice(0,4).map(h => h.id);
  for (const resource of Object.keys(G.RESOURCE_NAMES)) s.resources[resource] = G.capacity(s,resource);
  assert.equal(G.bossReason(s,region),'');
  assert.deepEqual(reload(s),s);
  return s;
}
function arena(roster = ['rhea','finn','luna','kael'], pattern = ['strike']) {
  const s = G.startBattle(town(roster),0), b = s.battle;
  delete b.boss; // Generic arena: isolate the legacy intent kind.
  Object.assign(b,{enemyHp:100000,enemyMaxHp:100000,enemyAttack:100,enemyDefense:0,
    enemyCrit:0,enemyDodge:0,pattern,energy:10,supplies:7,bonus:1,aoeScale:1,history:[]});
  s.cleared = []; s.projects = {}; s.guild.outposts.fill(0);
  s.guild.preparation = {stance:'balanced',element:'physical',remedy:false};
  for (const u of b.units) Object.assign(u,{hp:1000,maxHp:1000,attack:100,defense:0,crit:0,
    dodge:0,critDamage:1.5,pierce:0,ranged:0,resistance:0});
  syncFixture(s); assert.deepEqual(reload(s),s);
  return s;
}
function act(s,id,action = 'attack',target) {
  const command = G.commandFor(id,action,target), before = copy(s);
  assert.equal(G.commandReason(s,command),'',command);
  const next = G.combat(s,command);
  assert.notEqual(next,s); assert.deepEqual(s,before,'public action must preserve input');
  return next;
}
function finishRound(s, action = 'guard') {
  const round = s.battle.round;
  for (const id of s.party) if (s.battle?.round === round && unit(s,id).hp > 0 && !s.battle.acted.includes(id)) s = act(s,id,action);
  return s;
}
function learn(s, index, branch) {
  const h = s.heroes[index];
  assert.equal(G.learnSkillReason(s,h.id,`${h.role}.${branch}1`),'');
  return G.learnSkill(s,h.id,`${h.role}.${branch}1`);
}

test('one individual action per living hero; enemy waits for everyone; selection follows remaining actors', () => {
  const first = arena(), target = first.battle.target;
  let s = act(first,first.party[2]);
  assert.equal(damage(first,s),100); assert.equal(s.battle.hp,4000); assert.equal(s.battle.round,1);
  assert.deepEqual(s.battle.acted,[first.party[2]]); assert.equal(s.battle.selected,first.party[0]);
  assert.match(G.commandReason(s,G.commandFor(first.party[2],'attack')),/已行动/);
  assert.equal(G.combat(s,G.commandFor(first.party[2],'attack')),s);
  s = act(s,first.party[3]); s = act(s,first.party[1]);
  assert.equal(s.battle.hp,4000); assert.equal(s.battle.round,1);
  s = act(s,first.party[0]);
  assert.equal(s.battle.hp,3900); assert.equal(unit(s,target).hp,900);
  assert.equal(s.battle.round,2); assert.equal(s.battle.actionCount,4);
  assert.deepEqual(s.battle.acted,[]); assert.equal(s.battle.selected,first.party[0]);
});

test('the enemy preview target is fixed throughout a player phase and single attacks hit only that target', () => {
  let s = arena(['rhea','finn']); const [a,b] = s.party;
  s.battle.target = b;
  assert.match(G.intent(s.battle).hint,new RegExp(unit(s,b).name));
  s = act(s,a); assert.equal(s.battle.target,b); s = act(s,b);
  assert.equal(unit(s,a).hp,1000); assert.equal(unit(s,b).hp,900);
});

test('a dead unit cannot act, cannot be selected or healed, and is not required to finish the round', () => {
  let s = arena(['rhea','finn','luna']); const [dead,a,b] = s.party;
  unit(s,dead).hp = 0; s.battle.selected = a; s.battle.target = a; syncFixture(s);
  assert.match(G.commandReason(s,G.commandFor(dead,'attack')),/倒下/);
  assert.equal(G.selectCombatUnit(s,dead),s); assert.equal(G.selectHealTarget(s,dead),s);
  assert.match(G.commandReason(s,G.commandFor(b,'mortal_light',dead)),/目标不可用/);
  s = act(s,b); assert.equal(s.battle.round,1); s = act(s,a);
  assert.equal(s.battle.round,2); assert.equal(s.battle.actionCount,2); assert.equal(unit(s,dead).hp,0);
  assert.deepEqual(reload(s),s);
});

test('a fallen targeted hero is skipped on future turns while the survivor can continue alone', () => {
  let s = arena(['rhea','finn']); const [a,b] = s.party;
  s.battle.target = a; unit(s,a).hp = 90; syncFixture(s);
  s = act(s,a); s = act(s,b);
  assert.equal(unit(s,a).hp,0); assert.equal(s.battle.selected,b); assert.equal(s.battle.target,b);
  s = act(s,b); assert.equal(s.battle.round,3); assert.equal(unit(s,b).hp,900);
  assert.deepEqual(reload(s),s);
});

test('personal skill cooldown is retained after cast phase and decremented once per following complete round', () => {
  let s = arena(['kael','rhea']); const [a,b] = s.party;
  s = act(s,a,'star_shatter'); const cooldown = G.SKILLS.find(x=>x.id==='star_shatter').cooldown;
  assert.equal(unit(s,a).cooldowns.star_shatter,cooldown);
  s = act(s,b,'guard'); assert.equal(unit(s,a).cooldowns.star_shatter,cooldown);
  for (let remaining=cooldown;remaining>0;remaining--) {
    assert.match(G.commandReason(s,G.commandFor(a,'star_shatter')),/个人冷却/);
    s = act(s,b,'guard'); assert.equal(unit(s,a).cooldowns.star_shatter,remaining);
    s = act(s,a,'guard'); assert.equal(unit(s,a).cooldowns.star_shatter,remaining-1);
  }
  assert.equal(G.commandReason(s,G.commandFor(a,'star_shatter')),'');
});

test('taunt updates preview and redirects an attack without making another hero consume their action', () => {
  let s = learn(town(['rhea','finn']),0,'b'); s = G.startBattle(s,0);
  const [tank,other] = s.party;
  delete s.battle.boss; Object.assign(s.battle,{enemyHp:100000,enemyMaxHp:100000,enemyAttack:300,enemyCrit:0,enemyDodge:0,pattern:['strike'],target:other,energy:10});
  for(const u of s.battle.units) Object.assign(u,{hp:1000,maxHp:1000,defense:0,dodge:0}); syncFixture(s);
  s = act(s,tank,'challengers_oath');
  assert.equal(s.battle.taunt,tank); assert.match(G.intent(s.battle).hint,new RegExp(unit(s,tank).name));
  assert.equal(s.battle.acted.includes(other),false);
  const shield = unit(s,tank).shield; assert.ok(shield>0);
  s = act(s,other);
  assert.equal(unit(s,other).hp,1000); assert.equal(unit(s,tank).hp,1000-Math.max(0,300-shield));
  assert.equal(s.battle.taunt,''); assert.equal(s.battle.round,2);
});

test('guard applies only to its own hero; AoE attacks each independent HP and cannot crit or dodge', () => {
  let s = arena(['rhea','finn'],['heavy']); const [a,b] = s.party;
  s.battle.enemyCrit=.6; for(const u of s.battle.units) u.dodge=.4;
  s = act(s,a,'guard'); s = act(s,b);
  assert.equal(unit(s,a).hp,975); assert.equal(unit(s,b).hp,900);
  assert.doesNotMatch(s.battle.history.join('\n'),/闪避了|定向攻击.*暴击/);
  assert.equal(unit(s,a).guard,1);
});

test('player crit and enemy dodge use fixed draw counts and combat never consumes town RNG', () => {
  let critSeen=0,dodgeSeen=0;
  for(let seed=1;seed<=80;seed++) {
    const base=arena(['finn','rhea']); base.battle.rng=seed*73939; const id=base.party[0];
    const critical=copy(base); unit(critical,id).crit=.6;
    const evasive=copy(critical); evasive.battle.enemyDodge=.4;
    const a=act(base,id),b=act(critical,id),c=act(evasive,id);
    assert.equal(a.battle.rng,b.battle.rng); assert.equal(b.battle.rng,c.battle.rng);
    assert.equal(a.rng,base.rng); assert.equal(b.rng,base.rng); assert.equal(c.rng,base.rng);
    assert.ok([100,150].includes(damage(critical,b))); assert.ok([0,100,150].includes(damage(evasive,c)));
    if(damage(critical,b)===150)critSeen++; if(damage(evasive,c)===0)dodgeSeen++;
    assert.deepEqual(act(critical,id),b,'identical state and command must be reproducible');
  }
  assert.ok(critSeen>15); assert.ok(dodgeSeen>10);
});

test('enemy crit and hero dodge use fixed draw counts even when damage is dodged', () => {
  let critSeen=0,dodgeSeen=0;
  for(let seed=1;seed<=80;seed++) {
    const base=arena(['rhea']); base.battle.rng=seed*89717;
    const critical=copy(base); critical.battle.enemyCrit=.6;
    const evasive=copy(critical); unit(evasive).dodge=.4;
    const a=act(base,base.party[0]),b=act(critical,base.party[0]),c=act(evasive,base.party[0]);
    assert.equal(a.battle.rng,b.battle.rng); assert.equal(b.battle.rng,c.battle.rng);
    const loss=1000-unit(b).hp,evaded=1000-unit(c).hp;
    assert.ok([100,150].includes(loss)); assert.ok([0,100,150].includes(evaded));
    if(loss===150)critSeen++; if(evaded===0)dodgeSeen++;
  }
  assert.ok(critSeen>15); assert.ok(dodgeSeen>10);
});

test('saving in the middle of a round retains each HP, chosen target, acted list, CD and private RNG exactly', () => {
  let s=arena(['kael','finn','luna','rhea'],['strike','channel','heavy']);
  s=act(s,s.party[0],'star_shatter'); s=act(s,s.party[2],'guard');
  s=G.selectCombatUnit(s,s.party[1]); s=G.selectHealTarget(s,s.party[3]);
  const loaded=reload(s); assert.deepEqual(loaded,s);
  let a=s,b=loaded;
  for(let i=0;i<16;i++) {const command=G.autoCommand(a); a=G.combat(a,command); b=G.combat(b,command); assert.deepEqual(a,b);}
});

test('auto battle performs one same-rule action per game-second, stops immediately, and pause is respected', () => {
  const s=G.setCombatAuto(arena(['rhea','finn']),true);
  const next=G.advance(s,1),manual=G.combat(s,G.autoCommand(s));
  assert.deepEqual(next.battle,manual.battle); assert.equal(next.battle.actionCount,1);
  const stopped=G.setCombatAuto(next,false),after=G.advance(stopped,3);
  assert.deepEqual(after.battle,stopped.battle);
  const paused=G.setCombatAuto(after,true); paused.paused=true;
  assert.equal(G.advance(paused,100),paused);
});

test('one large offline auto tick equals incremental online ticks including intermediate save/load', () => {
  const base=G.setCombatAuto(arena(['rhea','finn','luna','kael'],['strike','channel','heavy']),true);
  const bulk=G.advance(base,40); let split=base;
  for(let i=0;i<40;i++) {split=G.advance(split,1);if(i%7===0)split=reload(split);}
  assert.deepEqual(split,bulk);
});

for(let region=0;region<6;region++) for(let node=0;node<5;node++) test(`region ${region} guardian ${node+1}: route reaches guardian; only a combat victory occupies it`, () => {
  const s=town(['rhea'],region); s.guild.depths[region]=node;
  const required=G.FRONTIER_REQUIREMENTS[node]; s.guild.progress[region]=required-1;
  assert.equal(G.guardianReady(s,region),false); assert.equal(G.beginBattle(s,region,'guardian'),s);
  s.guild.progress[region]=required;
  assert.equal(G.guardianReady(s,region),true); assert.equal(G.guardianReason(s,region),'');
  const fight=G.beginBattle(s,region,'guardian'); assert.ok(fight.battle);
  assert.equal(fight.guild.depths[region],node); assert.equal(fight.battle.kind,'guardian');
  assert.equal(fight.battle.node,node); assert.deepEqual(reload(fight),fight);
  assert.ok(fight.battle.enemyMaxHp>0); assert.ok(fight.battle.enemyAttack>0);
  // Force one-hit victory only after the public gate was tested above.
  fight.battle.enemyHp=1; fight.battle.enemyDodge=0; unit(fight).attack=100000;
  const won=act(fight,fight.party[0]);
  assert.equal(won.battle,null); assert.equal(won.guild.depths[region],node+1);
  assert.equal(won.guild.progress[region],0); assert.equal(won.lastBattle.won,true);
  assert.equal(won.lastBattle.kind,'guardian'); assert.equal(won.lastBattle.node,node);
  assert.equal(won.cleared.includes(region),false); assert.deepEqual(reload(won),won);
  assert.equal(G.combat(won,G.commandFor(won.party[0],'attack')),won);
});

test('guardian defeat and voluntary retreat preserve full route progress, equipment and materials', () => {
  for(const retreat of [true,false]) {
    const s=town(['rhea']);s.guild.depths[0]=0;s.guild.progress[0]=G.FRONTIER_REQUIREMENTS[0];
    let fight=G.beginBattle(s,0,'guardian');fight.order.enabled=true;
    const stock=copy(fight.resources),materials=copy(fight.world.materials),gear=copy(fight.guild.inventory);
    if(retreat)fight=G.combat(fight,'retreat');
    else {fight.battle.enemyAttack=1e7;fight.battle.enemyHp=1e7;fight.battle.enemyMaxHp=1e7;fight.battle.pattern=['heavy'];fight=act(fight,fight.party[0]);}
    assert.equal(fight.battle,null);assert.equal(fight.guild.depths[0],0);assert.equal(fight.guild.progress[0],G.FRONTIER_REQUIREMENTS[0]);
    assert.deepEqual(fight.resources,stock);assert.deepEqual(fight.world.materials,materials);assert.deepEqual(fight.guild.inventory,gear);
    assert.equal(fight.order.enabled,false);assert.equal(fight.recoveryUntil,fight.time+30);
    assert.equal(fight.lastBattle.won,false);assert.equal(fight.lastBattle.retreated,retreat);assert.deepEqual(reload(fight),fight);
  }
});

test('all bosses admit zero intelligence without project, clue, population, equipment or combat-power gates', () => {
  for(let region=0;region<6;region++) {
    const s=town(['rhea'],region);s.guild.intel.fill(0);s.survey.fill(0);s.projects={};s.kit=0;s.population=0;
    s.heroes[0].level=1;s.heroes[0].quality=1;s.heroes[0].aptitude={hp:80,attack:80,defense:80};
    assert.equal(G.bossReason(s,region),'',`boss ${region}`);
    const next=G.startBattle(s,region);assert.ok(next.battle);assert.equal(next.battle.kind,'boss');
    assert.equal(next.battle.bonus,1,'no hidden intel bonus at zero intel');
  }
});

test('shield skills do not interrupt, and cleanse skills do not break enemy wards merely by role', () => {
  const cases=[['kael','a','star_ward'],['ash','a','scale_cleanse']];
  for(const [role,branch,skill] of cases)for(const phase of ['channel','restore','ward']) {
    let s=learn(town([role,'rhea']),0,branch);s=G.startBattle(s,0);
    delete s.battle.boss; Object.assign(s.battle,{pattern:[phase],enemyHp:10000,enemyMaxHp:100000,energy:10,enemyAttack:1,enemyDodge:0,history:[]});
    const next=act(s,s.party[0],skill);
    assert.equal(next.battle.interrupted,false,`${skill} must not interrupt ${phase}`);
    assert.equal(next.battle.shattered,false,`${skill} must not break ${phase}`);
    const done=finishRound(next);
    if(phase==='restore')assert.ok(done.battle.history.some(x=>x.includes('敌人恢复')));
    if(phase==='channel')assert.ok(!done.battle.history.some(x=>x.includes('咏唱被打断')));
  }
});

test('shield_breaker shatters a ward but does not interrupt a recovery action', () => {
  let s=learn(town(['rhea','finn']),0,'a');s=G.startBattle(s,0);
  delete s.battle.boss; Object.assign(s.battle,{pattern:['restore'],enemyHp:10000,enemyMaxHp:100000,energy:10,enemyAttack:1,enemyDodge:0,history:[]});
  s=act(s,s.party[0],'shield_breaker');assert.equal(s.battle.shattered,true);assert.equal(s.battle.interrupted,false);
  s=finishRound(s);assert.ok(s.battle.history.some(x=>x.includes('敌人恢复')));
});

test('automatic counter chooses the stronger available interrupter and does not use protection as an interrupt', () => {
  let s=arena(['kael','kael','rhea'],['channel']);
  const [weak,strong]=s.party;unit(s,weak).attack=10;unit(s,strong).attack=500;
  assert.equal(G.autoCommand(s),G.commandFor(strong,'star_shatter'));
  s=act(s,strong,'star_shatter');assert.equal(s.battle.interrupted,true);
  assert.equal(unit(s,weak).cooldowns.star_shatter,0);
  assert.ok(unit(s,strong).cooldowns.star_shatter>0);
});

test('v6 shared-health combat migrates HP percentages, enemy percentage, supplies, morale and personal cooldowns', () => {
  const original=town(['kael','rhea']); original.version=6;
  original.heroes[0].activeSkill='star_ward'; delete original.heroes[0].learnedNodes;
  delete original.lastMap; delete original.combatAuto; delete original.lastBattle;
  const stats=G.partyStats(original),ids=original.party;
  original.battle={region:0,hp:Math.floor(stats.hp*.41),maxHp:stats.hp,enemyHp:Math.floor(G.REGIONS[0].hp*.67),
    attack:stats.attack,defense:stats.defense,round:5,energy:3,supplies:2,healCooldown:1,
    cooldowns:{[ids[0]]:3,[ids[1]]:1},...G.battleModifiers(original,0),ward:1,marked:2,burn:1,enemyShield:0,sealed:1,history:['旧战斗记录']};
  const before=copy(original),migrated=reload(original);
  assert.deepEqual(original,before); assert.equal(migrated.version, 10); assert.equal(migrated.rng,original.rng);
  const b=migrated.battle;assert.equal(b.system,2);assert.equal(b.kind,'boss');assert.equal(b.round,5);
  assert.equal(b.auto,false);assert.equal(migrated.combatAuto,false);assert.equal(b.energy,3);assert.equal(b.supplies,2);
  assert.equal(b.healCooldown,1);assert.equal(b.marked,2);assert.equal(b.sealed,1);
  for(const u of b.units){assert.equal(u.hp,Math.max(1,Math.round(u.maxHp*original.battle.hp/original.battle.maxHp)));
    assert.equal(u.ward,1);assert.equal(u.burn,1);for(const cd of Object.values(u.cooldowns))assert.equal(cd,original.battle.cooldowns[u.id]);}
  assert.equal(b.enemyHp,Math.round(b.enemyMaxHp*original.battle.enemyHp/G.REGIONS[0].hp));
  assert.equal(migrated.heroes[0].legacySkill,'star_ward');assert.ok(b.history.includes('旧战斗记录'));
  assert.deepEqual(reload(migrated),migrated);
});

test('malformed personal-action state, blood bars, RNG and report data are rejected on reload', () => {
  const variants=[
    s=>{s.battle.units[0].hp=-1;},s=>{s.battle.units[0].hp=1001;},
    s=>{s.battle.units[0].cooldowns.star_shatter=0;},s=>{s.battle.units[0].crit=.61;},
    s=>{s.battle.acted=[s.party[0],s.party[0]];},s=>{s.battle.selected='missing';},
    s=>{s.battle.rng=0;},s=>{s.battle.target='missing';},s=>{s.battle.pattern=[];},
    s=>{s.battle.enemyElement='ice';},s=>{delete s.battle.healTarget;},
    s=>{s.lastBattle={region:0,kind:'boss',node:5,enemy:'fake',won:true,retreated:true,rounds:1,history:[],survivors:1,time:0};},
  ];
  for(const mutate of variants){const s=arena(['rhea','finn']);mutate(s);assert.throws(()=>reload(s));}
});

test('repeat frontier stops at a guardian without auto permission and never occupies it on road completion alone', () => {
  let s=town();s.guild.depths[0]=0;s.guild.progress[0]=G.FRONTIER_REQUIREMENTS[0];
  s=G.setOrder(s,{enabled:true,region:0,route:'frontier',reserve:0});
  assert.equal(s.expedition,null);assert.equal(s.battle,null);assert.equal(s.order.enabled,true);
  const after=G.advance(s,3);
  assert.equal(after.expedition,null);assert.equal(after.battle,null);assert.equal(after.guild.depths[0],0);
  assert.match(after.order.reason,/守敌/);assert.equal(after.guild.progress[0],G.FRONTIER_REQUIREMENTS[0]);
});

test('enabled auto guardian starts, wins through real stats, then resumes the next road instead of attacking a boss', () => {
  let s=town();s.guild.depths[0]=0;s.guild.progress[0]=G.FRONTIER_REQUIREMENTS[0];
  s=G.rememberMap(s,4);assert.equal(s.lastMap,4);
  s=G.setOrder(s,{enabled:true,region:0,route:'frontier',reserve:0});s=G.setCombatAuto(s,true);
  s=G.advance(s,1);assert.ok(s.battle||s.lastBattle?.won);
  assert.equal(s.lastMap,4,'background guardian must preserve the last map the player viewed');
  if(s.battle){assert.equal(s.battle.kind,'guardian');assert.equal(s.battle.actionCount,1);}
  for(let i=0;i<200&&s.guild.depths[0]===0;i++)s=G.advance(s,1);
  assert.equal(s.guild.depths[0],1);assert.equal(s.lastBattle.won,true);assert.equal(s.lastBattle.kind,'guardian');
  assert.ok(s.expedition);assert.equal(s.expedition.route,'frontier');assert.equal(s.expedition.depth,1);
  assert.equal(s.lastMap,4,'automatic road resumption must also preserve map selection');
  assert.equal(s.battle,null);assert.deepEqual(reload(s),s);
});

test('auto frontier cannot start a boss after the fifth guardian', () => {
  let s=town();s.guild.depths[0]=5;s.guild.progress[0]=0;
  s=G.setOrder(s,{enabled:true,region:0,route:'frontier',reserve:0});s=G.setCombatAuto(s,true);
  s=G.advance(s,3);assert.equal(s.battle,null);assert.equal(s.expedition,null);
  assert.match(s.order.reason,/五处据点/);assert.equal(G.bossReason(s,0),'');
});

test('guardian auto loss stops the order and never pays another preparation automatically after recovery', () => {
  let s=town(['rhea']);s.guild.depths[0]=0;s.guild.progress[0]=G.FRONTIER_REQUIREMENTS[0];
  s=G.setOrder(s,{enabled:true,region:0,route:'frontier',reserve:0});s=G.setCombatAuto(s,true);
  s=G.beginBattle(s,0,'guardian');s.battle.enemyAttack=1e7;s.battle.enemyHp=1e7;s.battle.enemyMaxHp=1e7;s.battle.pattern=['heavy'];
  s=G.advance(s,1);assert.equal(s.battle,null);assert.equal(s.lastBattle.won,false);assert.equal(s.order.enabled,false);
  const food=s.resources.food,after=G.advance(s,60);
  assert.equal(after.battle,null);assert.equal(after.expedition,null);assert.equal(after.order.enabled,false);
  assert.equal(after.resources.food,food);assert.equal(after.guild.progress[0],G.FRONTIER_REQUIREMENTS[0]);
});

test('victory battle report survives later world ticks and contains independently counted survivors and rounds', () => {
  let s=arena(['rhea','finn']);unit(s,s.party[1]).hp=0;s.battle.target=s.party[0];syncFixture(s);
  s.battle.enemyHp=1;s=act(s,s.party[0]);assert.equal(s.battle,null);
  assert.equal(s.lastBattle.won,true);assert.equal(s.lastBattle.survivors,1);assert.equal(s.lastBattle.rounds,1);
  const report=copy(s.lastBattle);s=G.advance(s,10);assert.deepEqual(s.lastBattle,report);assert.deepEqual(reload(s),s);
});

test('auto does not spend a self cleanse merely because another hero is burning', () => {
  let s=learn(town(['ash','finn']),0,'a');s=G.startBattle(s,0);
  const [ash,burning]=s.party;
  delete s.battle.boss; Object.assign(s.battle,{enemyHp:100000,enemyMaxHp:100000,enemyAttack:1,enemyDodge:0,pattern:['strike'],energy:10,target:burning});
  unit(s,burning).hp=Math.floor(unit(s,burning).maxHp*.8);unit(s,burning).burn=2;syncFixture(s);
  assert.notEqual(G.autoCommand(s),G.commandFor(ash,'scale_cleanse'));
});

test('auto ally cleanse targets the burning hero despite a stale healthy manual target', () => {
  let s=learn(town(['luna','finn']),0,'b');s=G.startBattle(s,0);
  const [luna,burning]=s.party;
  delete s.battle.boss; Object.assign(s.battle,{enemyHp:100000,enemyMaxHp:100000,enemyAttack:1,enemyDodge:0,pattern:['strike'],energy:10,target:burning,healTarget:luna});
  unit(s,burning).hp=Math.floor(unit(s,burning).maxHp*.8);unit(s,burning).burn=2;syncFixture(s);
  const command=G.autoCommand(s);assert.equal(G.commandReason(s,command),'');
  const next=G.combat(s,command);assert.equal(unit(next,burning).burn,0,`auto command ${command} must cleanse its intended patient`);
});
