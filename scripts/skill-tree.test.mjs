import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/realm.ts';

// Constructed unit fixtures, not legal campaign completions. We exercise the
// real public learning, save, dispatch and personal-combat APIs, without a mirror engine.
const copy = structuredClone;
const reload = s => G.decodeSave(JSON.stringify(s));
const roles = G.TREE_ROLES;
const hero = (s, id = s.heroes[0].id) => s.heroes.find(h => h.id === id);
const unit = (s, id = s.party[0]) => s.battle.units.find(u => u.id === id);
const close = (a, b, label = '') => assert.ok(Math.abs(a - b) < 1e-8, `${label}: ${a} != ${b}`);
function town(roster = ['rhea'], level = 30) {
  const s = G.freshState(1);
  s.rng = 987654321; s.event = 0; s.order.enabled = false;
  s.heroes = roster.map(role => {
    const h = G.makeApplicant(s, role);
    Object.assign(h, { level, quality: 3, aptitude: { hp: 100, attack: 100, defense: 100 },
      mastery: 0, talent: 'diligent', flaw: 'overcome', activeSkill: G.DEFAULT_SKILL[role], learnedNodes: [] });
    return h;
  });
  s.party = s.heroes.slice(0, 4).map(h => h.id);
  return s;
}
function learn(s, nodeId, id = s.heroes[0].id) {
  assert.equal(G.learnSkillReason(s, id, nodeId), '', nodeId);
  const before = copy(s), next = G.learnSkill(s, id, nodeId);
  assert.notEqual(next, s); assert.deepEqual(s, before, 'learning must not mutate input');
  return next;
}
function arena(s) {
  s = copy(s);
  s.battle = G.createCombat(s, 0, 'boss');
  delete s.battle.boss;
  Object.assign(s.battle, { enemyHp: 1e7, enemyMaxHp: 1e7, enemyDefense: 0, enemyDodge: 0,
    enemyCrit: 0, enemyAttack: 1, energy: 10, supplies: 8, pattern: ['strike'], bonus: 1 });
  for (const u of s.battle.units) u.hp = Math.floor(u.maxHp * .25);
  s.battle.hp = s.battle.units.reduce((sum,u) => sum + u.hp, 0);
  return s;
}
function act(s, action, id = s.party[0]) {
  const command = G.commandFor(id, action), before = copy(s);
  assert.equal(G.commandReason(s, command), '', `${id}:${action}`);
  const next = G.combat(s, command);
  assert.notEqual(next, s); assert.deepEqual(s, before); assert.ok(next.battle);
  assert.equal(next.rng, s.rng, 'combat uses private RNG');
  return next;
}
const expected = {
  rhea: [{ attack: .1, crit: .05 }, { hp: .12, defense: .15 }],
  finn: [{ dodge: .08, defense: .1 }, { crit: .1, critDamage: .25 }],
  luna: [{ healing: .2, cooldown: .25 }, { shield: .25, hp: .08 }],
  kael: [{ defense: .15, dodge: .05 }, { attack: .12, critDamage: .2 }],
  orin: [{ attack: .08, defense: .12 }, { shield: .3, hp: .1 }],
  ash: [{ hp: .1, dodge: .05 }, { attack: .12, crit: .08 }],
  nyx: [{ attack: .1, crit: .08 }, { dodge: .1, crit: .05 }],
  sylva: [{ attack: .12, crit: .05 }, { healing: .15, shield: .15 }],
  vera: [{ healing: .2, hp: .1 }, { attack: .1, critDamage: .25 }],
};

test('nine complete trees: 45 unique nodes, 63 actives, 54 passives and all twelve legacy IDs', () => {
  assert.equal(roles.length, 9); assert.equal(G.SKILL_TREE_NODES.length, 117); assert.equal(G.SKILLS.length, 63);
  assert.equal(new Set(G.SKILL_TREE_NODES.map(n => n.id)).size, 117);
  assert.equal(new Set(G.SKILLS.map(n => n.id)).size, 63);
  assert.equal(G.SKILL_TREE_NODES.filter(n => n.type === 'passive').length, 54);
  for (const id of ['home_oath','shield_breaker','hunter_mark','covering_shot','mortal_light','steadfast_prayer',
    'star_shatter','star_ward','unfallen_shield','battle_standard','sky_arrow','scale_cleanse']) assert.ok(G.SKILLS.some(s => s.id === id));
});

test('level point boundaries are 5/10/15/20/25/30 with no rarity bonus or stored balance', () => {
  const s = town();
  for (const [level, points] of [[1,0],[4,0],[5,1],[9,1],[10,2],[14,2],[15,3],[19,3],[20,4],[25,5],[30,6],[35,7],[40,8]]) {
    hero(s).level = level;
    for (const quality of [1,3,5]) {
      hero(s).quality = quality;
      assert.equal(G.totalSkillPoints(hero(s)), points); assert.equal(G.skillPoints(hero(s)), points);
    }
  }
});

for (const role of roles) {
  test(`${role.id}: root available at level 1; first branch level 5; two learned branches share one loadout slot`, () => {
    let s = town([role.id], 1); const id = hero(s).id;
    assert.deepEqual(G.unlockedSkills(hero(s)).map(x => x.id), [role.root]);
    assert.deepEqual(G.combatSkills(s,id).map(x => x.id), [role.root]);
    assert.equal(G.setHeroSkill(s,id,role.a), s);
    assert.ok(G.learnSkillReason(s,id,`${role.id}.a1`));
    hero(s).level = 5; s = learn(s,`${role.id}.a1`);
    assert.equal(hero(s).activeSkill, role.a); assert.equal(G.skillPoints(hero(s)), 0);
    assert.deepEqual(G.combatSkills(s,id).map(x => x.id), [role.root,role.a]);
    assert.equal(G.setHeroSkill(s,id,role.b), s);
    hero(s).level = 10; s = learn(s,`${role.id}.b1`);
    assert.equal(hero(s).activeSkill, role.b);
    assert.deepEqual(G.combatSkills(s,id).map(x => x.id), [role.root,role.b]);
    s = G.setHeroSkill(s,id,role.a);
    assert.deepEqual(G.combatSkills(s,id).map(x => x.id), [role.root,role.a]);
    assert.equal(G.unlockedSkills(hero(s)).length, 3); assert.doesNotThrow(() => G.validateHeroTree(hero(s)));
  });

  for (const [index, branch] of ['a','b'].entries()) test(`${role.id}.${branch}2: level 15 passive modifies real individual/unit stats exactly once`, () => {
    let s = town([role.id], 15); s = learn(s,`${role.id}.${branch}1`);
    const base = G.individualStats(s,hero(s)), beforeUnit = unit(arena(s));
    s = learn(s,`${role.id}.${branch}2`);
    const modifiers = expected[role.id][index], bonuses = G.skillBonuses(hero(s)), after = G.individualStats(s,hero(s));
    assert.equal(G.skillPoints(hero(s)),0);
    for (const [key,value] of Object.entries(bonuses)) close(value,modifiers[key] || 0,key);
    for (const key of ['hp','attack','defense']) close(after[key],base[key]*(1+(modifiers[key]||0)),key);
    for (const key of ['crit','dodge','critDamage']) close(after[key],base[key]+(modifiers[key]||0),key);
    const u = unit(arena(s));
    close(u.healing,1+(modifiers.healing||0)); close(u.shieldPower,1+(modifiers.shield||0));
    close(u.cooldownReduction,modifiers.cooldown||0);
    assert.ok(Object.entries(modifiers).some(([k]) => ['healing','shield','cooldown'].includes(k) || after[k] > base[k]));
    assert.ok(u.maxHp >= beforeUnit.maxHp && u.attack >= beforeUnit.attack && u.defense >= beforeUnit.defense);
    const snapshot = copy(s); const loaded = reload(s);
    assert.deepEqual(G.skillBonuses(hero(loaded)), bonuses); assert.deepEqual(G.individualStats(loaded,hero(loaded)), after);
    assert.deepEqual(s,snapshot);
  });

  test(`${role.id}: all root/A/B execute as personal actions and root/branch have independent cooldowns`, () => {
    let townState = town([role.id,'rhea'], 30);
    townState = learn(townState,`${role.id}.a1`); townState = learn(townState,`${role.id}.b1`);
    for (const branchSkill of [role.a,role.b]) {
      const s = arena(G.setHeroSkill(townState,hero(townState).id,branchSkill)), id = hero(s).id;
      const rootCast = act(s,role.root), u = unit(rootCast);
      assert.equal(rootCast.battle.round,1, 'enemy waits until every living hero acts');
      assert.equal(u.cooldowns[role.root],G.SKILLS.find(x=>x.id===role.root).cooldown);
      assert.equal(u.cooldowns[branchSkill],0);
      assert.deepEqual(rootCast.battle.acted,[id]);
      assert.ok(G.commandReason(rootCast,G.commandFor(id,branchSkill)).includes('已行动'));
      const secondRound = act(rootCast,'guard',s.party[1]);
      assert.equal(secondRound.battle.round,2);
      assert.ok(G.commandReason(secondRound,G.commandFor(id,role.root)).includes('冷却'));
      const branchCast = act(secondRound,branchSkill);
      assert.equal(unit(branchCast).cooldowns[branchSkill],G.SKILLS.find(x=>x.id===branchSkill).cooldown);
      assert.equal(unit(branchCast).cooldowns[role.root],u.cooldowns[role.root]);
    }
  });
}

test('invalid learning is atomic: other class, missing parent, too early, duplicate and insufficient points', () => {
  let s = town(['rhea'], 5); const id = hero(s).id;
  const reject = (state, nodeId, target=id) => {
    const before = copy(state); assert.ok(G.learnSkillReason(state,target,nodeId));
    assert.equal(G.learnSkill(state,target,nodeId),state); assert.deepEqual(state,before);
  };
  for (const key of ['unknown','finn.a1','rhea.a2','rhea.root']) reject(s,key);
  reject(s,'rhea.a1','missing');
  s = learn(s,'rhea.a1'); reject(s,'rhea.a1'); reject(s,'rhea.b1');
  hero(s).level=14; reject(s,'rhea.a2');
  hero(s).level=15; s=learn(s,'rhea.b1'); reject(s,'rhea.a2');
});

test('free reset refunds all six points, clears only tree investment and never rerolls identity/gear/resources', () => {
  let s=town(['rhea']); const id=hero(s).id;
  for(const key of ['a1','a2','b1','b2'])s=learn(s,`rhea.${key}`);
  assert.equal(G.spentSkillPoints(hero(s)),6); assert.equal(G.skillPoints(hero(s)),0);
  const before=copy(s),next=G.resetSkills(s,id);
  assert.deepEqual(s,before); assert.notEqual(next,s); assert.equal(G.skillPoints(hero(next)),6);
  assert.deepEqual(hero(next).learnedNodes,[]);assert.equal(hero(next).activeSkill,'home_oath');
  const originalHero={...hero(s),learnedNodes:[],activeSkill:'home_oath'};
  assert.deepEqual(hero(next),originalHero); assert.deepEqual(next.resources,s.resources);
  assert.deepEqual(next.guild,s.guild); assert.equal(next.rng,s.rng); assert.equal(G.resetSkills(next,id),next);
});

test('duplicate roles learn and reset independently; battle locks participants but leaves bench editable', () => {
  let s=town(['rhea','rhea','rhea']); const [first,second,bench]=s.heroes.map(h=>h.id);
  s=learn(s,'rhea.a1',first);s=learn(s,'rhea.b1',second);s=learn(s,'rhea.a1',bench);
  s.party=[first,second];s=arena(s);
  for(const id of [first,second]){
    assert.match(G.learnSkillReason(s,id,'rhea.b2'),/出征/);
    assert.equal(G.learnSkill(s,id,'rhea.a2'),s);assert.equal(G.resetSkills(s,id),s);
    assert.equal(G.setHeroSkill(s,id,G.DEFAULT_SKILL.rhea),s);
  }
  let edited=learn(s,'rhea.b1',bench);edited=G.resetSkills(edited,bench);
  assert.deepEqual(hero(edited,first),hero(s,first));assert.deepEqual(hero(edited,second),hero(s,second));
  assert.deepEqual(edited.battle,s.battle);assert.deepEqual(hero(edited,bench).learnedNodes,[]);
});

test('same-role and per-skill cooldowns remain independent through one full round', () => {
  let s=town(['kael','kael']);
  for(const h of s.heroes)s=learn(s,'kael.a1',h.id);
  s=arena(s);const [a,b]=s.party;
  let next=act(s,'star_shatter',a);
  assert.equal(unit(next,a).cooldowns.star_shatter,G.SKILLS.find(sk=>sk.id==='star_shatter').cooldown);assert.equal(unit(next,b).cooldowns.star_shatter,0);
  next=act(next,'star_ward',b);
  assert.equal(next.battle.round,2);assert.equal(unit(next,a).cooldowns.star_ward,0);
  assert.equal(unit(next,b).cooldowns.star_shatter,0);assert.equal(unit(next,b).cooldowns.star_ward,3);
});

test('level 15 prayer passive improves actual healing and reduces each skill cooldown by the ratio rule', () => {
  let base=town(['luna','rhea'],15);base=learn(base,'luna.a1');
  const improved=learn(base,'luna.a2');
  for(const skill of ['mortal_light','steadfast_prayer']){
    const a=arena(base),b=arena(improved),target=a.party[1];
    a.battle.healTarget=target;b.battle.healTarget=target;
    for(const s of [a,b]){unit(s,target).maxHp=100000;unit(s,target).hp=1;s.battle.hp=s.battle.units.reduce((sum,u)=>sum+u.hp,0);s.battle.maxHp=s.battle.units.reduce((sum,u)=>sum+u.maxHp,0);}
    const plain=act(a,skill),strong=act(b,skill),gain=unit(plain,target).hp-1,better=unit(strong,target).hp-1;
    assert.ok(better>gain);assert.ok(Math.abs(better-gain*1.2)<=1);
    assert.equal(unit(strong).cooldowns[skill],Math.max(1,Math.ceil(G.SKILLS.find(x=>x.id===skill).cooldown*.75)));
  }
});

test('level 15 shield passive increases real shield and shields never add beyond the stronger application', () => {
  let base=town(['orin','rhea'],15);base=learn(base,'orin.b1');
  const a=arena(base),b=arena(learn(base,'orin.b2'));
  const plain=act(a,'guardian_sanctuary'),strong=act(b,'guardian_sanctuary');
  assert.ok(unit(strong).shield>unit(plain).shield);
  for(const u of strong.battle.units)assert.ok(u.shield<=Math.round(u.maxHp*.6));
  const before=copy(b);for(const u of before.battle.units){u.shield=Math.round(u.maxHp*.59);u.shieldTurns=2;}
  const refreshed=act(before,'guardian_sanctuary');
  for(const u of refreshed.battle.units)assert.equal(u.shield,unit(before,u.id).shield);
});

test('all twelve v6 selected skills survive migration; free old choices grant no learned nodes or point credit', () => {
  for(const role of roles.slice(0,6))for(const selected of [role.root,role.a]){
    const s=town([role.id],15);s.version=6;hero(s).activeSkill=selected;delete hero(s).learnedNodes;
    delete s.lastMap;delete s.combatAuto;
    const before=copy(s),loaded=reload(s),h=hero(loaded);
    assert.deepEqual(s,before);assert.equal(loaded.version, 11);assert.equal(h.activeSkill,selected);
    assert.equal(h.legacySkill,selected===role.root?undefined:selected);
    assert.equal(G.spentSkillPoints(h),0);assert.equal(G.skillPoints(h),3);
    assert.ok(!h.learnedNodes?.length);assert.doesNotThrow(()=>G.validateHeroTree(h));
    assert.deepEqual(G.combatSkills(loaded,h.id).map(x=>x.id),selected===role.root?[role.root]:[role.root,selected]);
    assert.deepEqual(hero(reload(loaded)),h);
  }
});

test('legacy exemption is usable, does not satisfy passive prerequisite and survives free reset', () => {
  let s=town(['luna'],15);s.version=6;hero(s).activeSkill='steadfast_prayer';delete hero(s).learnedNodes;
  s=reload(s);const id=hero(s).id;
  assert.match(G.learnSkillReason(s,id,'luna.a2'),/前置/);
  s=learn(s,'luna.b1');assert.equal(hero(s).activeSkill,'sanctuary');
  s=G.resetSkills(s,id);assert.equal(hero(s).activeSkill,'steadfast_prayer');
  assert.equal(hero(s).legacySkill,'steadfast_prayer');assert.equal(G.skillPoints(hero(s)),3);
  s=learn(s,'luna.a1');s=learn(s,'luna.a2');assert.equal(G.skillPoints(hero(s)),0);
});

test('modern saves reject unlearned branch, other-role legacy, duplicate roots and invalid prerequisite/point graphs', () => {
  const cases=[
    h=>{h.activeSkill='shield_breaker';},
    h=>{h.legacySkill='star_ward';},
    h=>{h.legacySkill='challengers_oath';},
    h=>{h.learnedNodes=['rhea.root'];},
    h=>{h.learnedNodes=['rhea.a1','rhea.a1'];},
    h=>{h.learnedNodes=['rhea.a2'];},
    h=>{h.learnedNodes=['finn.a1'];},
    h=>{h.level=5;h.learnedNodes=['rhea.a1','rhea.b1'];},
    h=>{h.level=10;h.learnedNodes=['rhea.a1','rhea.a2'];},
  ];
  for(const mutate of cases){const s=town();mutate(hero(s));assert.throws(()=>G.validateHeroTree(hero(s)));assert.throws(()=>reload(s));}
});

test('full nine-class tree saves reload twice without accumulating passive bonuses', () => {
  let s=town(roles.map(role=>role.id));
  for(const h of s.heroes)for(const key of ['a1','a2','b1','b2'])s=learn(s,`${h.role}.${key}`,h.id);
  const once=reload(s),twice=reload(once);
  assert.deepEqual(twice.heroes,once.heroes);
  for(const h of s.heroes){assert.equal(G.skillPoints(h),0);assert.deepEqual(G.individualStats(s,h),G.individualStats(twice,hero(twice,h.id)));}
});

test('public expedition locks learning/reset/loadout only for dispatched members, then recall releases them', () => {
  let s=town(['finn','rhea']);const [away,bench]=s.heroes.map(h=>h.id);
  s=learn(s,'finn.a1',away);s=learn(s,'rhea.a1',bench);s.party=[away];
  s.buildings.tavern=1;s.resources.food=G.capacity(s,'food');
  assert.equal(G.dispatchReason(s,0,'survey',0),'');s=G.expedition(s,0,'survey');assert.ok(s.expedition);
  assert.equal(G.learnSkill(s,away,'finn.b1'),s);assert.equal(G.resetSkills(s,away),s);assert.equal(G.setHeroSkill(s,away,'hunter_mark'),s);
  const edited=learn(s,'rhea.b1',bench);assert.deepEqual(edited.expedition,s.expedition);
  s=G.recallExpedition(edited);assert.equal(s.expedition,null);
  s=learn(s,'finn.b1',away);assert.equal(hero(s,away).activeSkill,'piercing_volley');
});

test('party healing remains available when selected ally is full but another ally is injured', () => {
  let s=town(['vera','rhea']);s=learn(s,'vera.a1');s=arena(s);
  const [caster,injured]=s.party;unit(s,caster).hp=unit(s,caster).maxHp;
  s.battle.healTarget=caster;s.battle.hp=s.battle.units.reduce((sum,u)=>sum+u.hp,0);
  assert.equal(G.commandReason(s,G.commandFor(caster,'mending_mist')),'');
  const next=act(s,'mending_mist');assert.ok(unit(next,injured).hp>unit(s,injured).hp);
  assert.equal(unit(next,caster).hp,unit(s,caster).maxHp);
});

test('auto healing evaluates its intended injured target despite a stale full-HP manual selection', () => {
  let s=town(['luna','rhea']);s=learn(s,'luna.a1');s=arena(s);
  const [caster,injured]=s.party;unit(s,caster).hp=unit(s,caster).maxHp;
  unit(s,injured).hp=1;s.battle.healTarget=caster;s.battle.hp=s.battle.units.reduce((sum,u)=>sum+u.hp,0);
  const before=copy(s),command=G.autoCommand(s);assert.deepEqual(s,before);
  assert.equal(G.commandReason(s,command),'');
  const next=G.combat(s,command);assert.ok(unit(next,injured).hp>unit(s,injured).hp,command);
});
