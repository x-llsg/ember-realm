import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/realm.ts';

// Constructed mechanism fixtures, not a legal campaign. No Site files are written.
const copy = structuredClone;
const reload = (s) => G.decodeSave(JSON.stringify(s));
function learn(s, id, nodeId) {
  const hero = () => s.heroes.find((h) => h.id === id);
  const node = G.roleTree(hero().role).find((n) => n.id === nodeId);
  for (const prerequisite of node.requires) {
    const parent = G.roleTree(hero().role).find((n) => n.id === prerequisite);
    if (!G.nodeKnown(hero(), parent)) s = learn(s, id, prerequisite);
  }
  if (!G.nodeKnown(hero(), node)) {
    assert.equal(G.learnSkillReason(s, id, nodeId), '');
    s = G.learnSkill(s, id, nodeId);
  }
  return s;
}
function arena(region, index) {
  let s = G.freshState(123456789);
  s.buildings.tavern = 1;
  s.buildings.fire = 1;
  s.guild.depths.fill(5);
  s.cleared = [1, 2, 3, 4];
  s.research = ['godslayer'];
  s.nextEventAt = 1e7;
  s.order.enabled = false;
  s.guild.rolls = 1;
  for (const role of ['rhea', 'kael', 'rhea', 'kael']) {
    const h = G.makeApplicant(s, role);
    Object.assign(h, {
      level: 40,
      xp: 0,
      quality: 3,
      aptitude: { hp: 100, attack: 100, defense: 100 },
      mastery: 0,
      talent: 'diligent',
      talentVersion: 2,
      flaw: 'overcome',
      activeSkill: G.DEFAULT_SKILL[role],
      learnedNodes: [],
      equipment: {},
    });
    if (role === 'rhea') {
      h.legacySkill = 'shield_breaker';
      h.activeSkill = 'shield_breaker';
    }
    s.heroes.push(h);
    s.party.push(h.id);
  }
  for (const id of s.party.filter(
    (id) => s.heroes.find((h) => h.id === id).role === 'kael',
  )) {
    const node = G.roleTree('kael').find(
      (n) => n.skillId === 'prism_interdict',
    );
    s = learn(s, id, node.id);
    s = G.setHeroSkill(s, id, 'prism_interdict');
  }
  for (const key of Object.keys(s.resources))
    s.resources[key] = Math.min(80, G.capacity(s, key));
  s.battle = G.createCombat(s, region, 'boss');
  const b = s.battle;
  Object.assign(b, {
    enemyMaxHp: 10000,
    enemyHp: 10000,
    enemyAttack: 100,
    enemyDefense: 0,
    enemyDodge: 0,
    enemyCrit: 0,
    energy: 10,
    bonus: 1,
    round: 10 + index,
    boss: {
      version: 1,
      phase: 1,
      phaseStartRound: 10,
      preparedRound: 10 + index,
    },
  });
  for (const u of b.units)
    Object.assign(u, {
      hp: 10000,
      maxHp: 10000,
      attack: 100,
      defense: 0,
      crit: 0,
      dodge: 0,
      pierce: 0,
      ranged: 0,
      resistance: 0,
      healing: 1,
      shieldPower: 1,
      cooldownReduction: 0,
    });
  b.hp = 40000;
  b.maxHp = 40000;
  b.enemyShield = Math.round(
    b.enemyMaxHp * (G.bossStep(b).barrierFraction || 0),
  );
  assert.deepEqual(reload(s), s);
  return s;
}
function act(s, index, action) {
  const before = copy(s),
    command = G.commandFor(s.party[index], action);
  assert.equal(G.commandReason(s, command), '', command);
  const next = G.combat(s, command);
  assert.notEqual(next, s);
  assert.deepEqual(s, before);
  assert.ok(next.battle);
  assert.deepEqual(reload(next), next);
  return next;
}

test('one successful boss counter grants only two attack exposures; repeated break and enemy-phase end never refill them', () => {
  for (const [region, index] of [
    [1, 0],
    [3, 2],
    [4, 0],
    [5, 2],
  ]) {
    let s = arena(region, index);
    const startRound = s.battle.round;
    assert.equal(G.bossResolution(s.battle).exposeHits, 0);
    s = act(s, 0, 'break');
    assert.equal(
      s.battle.marked,
      1,
      'first countering attack consumes the first exposure',
    );
    s = act(s, 1, 'attack');
    assert.equal(
      s.battle.marked,
      0,
      'second attack consumes the final exposure',
    );
    s = act(s, 2, 'break');
    assert.equal(
      s.battle.marked,
      0,
      `region ${region}: an already-countered intent grants nothing again`,
    );
    s = act(s, 3, 'attack');
    assert.equal(s.battle.round, startRound + 1);
    assert.equal(
      s.battle.marked,
      0,
      `region ${region}: enemy phase does not reissue the old channel reward`,
    );
  }
});

test('shatter and interrupt reward only their effective boss mechanics, including no-exposure armor and recovery counters', () => {
  // White-bone and divine barriers: interrupt alone is ineffective; shatter is effective.
  for (const region of [1, 5]) {
    let s = arena(region, region === 5 ? 1 : 0);
    s = act(s, 1, 'prism_interdict');
    assert.equal(s.battle.marked, 0);
    assert.equal(s.battle.shattered, false);
    assert.ok(s.battle.enemyShield > 0);
    s = act(s, 0, 'shield_breaker');
    assert.equal(s.battle.enemyShield, 0);
    assert.equal(s.battle.marked, 1);
    s = act(s, 2, 'shield_breaker');
    assert.equal(
      s.battle.marked,
      0,
      'a second shield breaker cannot refill an already broken barrier',
    );
  }
  // Demonic channel and dragon flight: shatter alone is ineffective; interrupt is effective.
  for (const [region, index] of [
    [3, 2],
    [4, 0],
  ]) {
    let s = arena(region, index);
    s = act(s, 0, 'shield_breaker');
    assert.equal(s.battle.marked, 0);
    assert.equal(G.bossResolution(s.battle).countered, false);
    s = act(s, 1, 'prism_interdict');
    assert.equal(s.battle.marked, 1);
    assert.equal(G.bossResolution(s.battle).countered, true);
    if (region === 4) assert.equal(G.bossResolution(s.battle).flying, false);
    s = act(s, 2, 'shield_breaker');
    assert.equal(
      s.battle.marked,
      0,
      'an unrelated follow-up shatter cannot reissue the interruption exposure',
    );
  }
  let iron = arena(2, 0);
  iron = act(iron, 1, 'prism_interdict');
  assert.equal(G.bossResolution(iron.battle).armorScale, 1.8);
  assert.equal(iron.battle.marked, 0);
  iron = act(iron, 0, 'shield_breaker');
  assert.equal(G.bossResolution(iron.battle).armorScale, 0.9);
  assert.equal(
    iron.battle.marked,
    0,
    'armor counter has no declared exposure reward',
  );
  let drain = arena(1, 2);
  drain = act(drain, 0, 'shield_breaker');
  assert.equal(G.bossResolution(drain.battle).healFraction, 0.06);
  assert.equal(drain.battle.marked, 0);
  drain = act(drain, 1, 'prism_interdict');
  assert.equal(G.bossResolution(drain.battle).healFraction, 0);
  assert.equal(
    drain.battle.marked,
    0,
    'stopping recovery has no declared exposure reward',
  );
  let wolf = arena(0, 1);
  const attackScale = G.bossResolution(wolf.battle).attackScale;
  wolf = act(wolf, 0, 'shield_breaker');
  wolf = act(wolf, 1, 'prism_interdict');
  assert.equal(wolf.battle.marked, 0);
  assert.equal(
    G.bossResolution(wolf.battle).attackScale,
    attackScale,
    'physical pounce cannot be countered by interruption',
  );
});
