// Constructed unit fixtures only. Not a legal campaign; all action logic is the actual Site engine.
// Run: node --experimental-strip-types --test scripts/build-combat.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/realm.ts';

const copy = structuredClone;
const reload = (s) => G.decodeSave(JSON.stringify(s));
const h = (s, id = s.party[0]) => s.heroes.find((x) => x.id === id);
const u = (s, id = s.party[0]) => s.battle.units.find((x) => x.id === id);
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
function town(roster = ['rhea', 'finn', 'luna', 'kael'], level = 40) {
  const s = G.freshState(123456789);
  s.buildings.tavern = 1;
  s.buildings.fire = 1;
  s.guild.depths = [5, 5, 5, 5, 5, 5];
  s.cleared = [1, 2, 3, 4];
  s.research = ['godslayer'];
  s.nextEventAt = 1e7;
  s.order.enabled = false;
  s.guild.rolls = 1;
  for (const role of roster) {
    const hero = G.makeApplicant(s, role);
    Object.assign(hero, {
      level,
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
    s.heroes.push(hero);
    s.party.push(hero.id);
  }
  for (const key of Object.keys(s.resources))
    s.resources[key] = Math.min(80, G.capacity(s, key));
  assert.deepEqual(reload(s), s);
  return s;
}
function learn(s, id, nodeId) {
  const node = G.roleTree(h(s, id).role).find((x) => x.id === nodeId);
  assert.ok(node, nodeId);
  for (const key of node.requires)
    if (
      !G.nodeKnown(
        h(s, id),
        G.roleTree(h(s, id).role).find((x) => x.id === key),
      )
    )
      s = learn(s, id, key);
  assert.equal(G.learnSkillReason(s, id, nodeId), '', nodeId);
  return G.learnSkill(s, id, nodeId);
}
function skill(s, id, skillId) {
  const node = G.roleTree(h(s, id).role).find((x) => x.skillId === skillId);
  assert.ok(node);
  if (node.branch !== 'root' && !G.nodeKnown(h(s, id), node))
    s = learn(s, id, node.id);
  return G.setHeroSkill(s, id, skillId);
}
function syncFixture(b) {
  b.hp = b.units.reduce((n, x) => n + x.hp, 0);
  b.maxHp = b.units.reduce((n, x) => n + x.maxHp, 0);
  b.cooldowns = Object.fromEntries(
    b.units.map((x) => [x.id, Math.max(0, ...Object.values(x.cooldowns))]),
  );
  b.ward = Math.max(...b.units.map((x) => x.ward));
  b.burn = Math.max(...b.units.map((x) => x.burn));
}
function arena(s = town(), r = 0) {
  s = copy(s);
  s.battle = G.createCombat(s, r, 'boss');
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
  });
  for (const unit of b.units)
    Object.assign(unit, {
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
  b.enemyShield = Math.round(
    b.enemyMaxHp * (G.bossStep(b).barrierFraction || 0),
  );
  syncFixture(b);
  assert.deepEqual(reload(s).battle, b);
  return s;
}
function step(s, phase, index) {
  s = copy(s);
  const b = s.battle;
  b.round = 10 + index;
  b.boss = { version: 1, phase, phaseStartRound: 10, preparedRound: b.round };
  b.enemyShield = Math.round(
    b.enemyMaxHp * (G.bossStep(b).barrierFraction || 0),
  );
  return s;
}
function act(s, action, id = s.party[0], target) {
  const cmd = G.commandFor(id, action, target),
    before = copy(s);
  assert.equal(G.commandReason(s, cmd), '', cmd);
  const next = G.combat(s, cmd);
  assert.notEqual(next, s);
  assert.deepEqual(s, before);
  return next;
}
function rest(s) {
  const round = s.battle.round;
  while (s.battle && s.battle.round === round) {
    const next = s.battle.units.find(
      (x) => x.hp > 0 && !s.battle.acted.includes(x.id),
    );
    s = act(s, 'guard', next.id);
  }
  assert.ok(s.battle);
  return s;
}

test('six bosses: threshold crossings never replace an already displayed intent; phase two begins at next round and never reverts', () => {
  for (let r = 0; r < 6; r++) {
    let s = arena(town(), r);
    s.battle.enemyHp = 5001;
    const intent = G.enemyIntent(s.battle),
      snapshot = copy(s.battle);
    for (let i = 0; i < 5; i++) {
      assert.deepEqual(G.enemyIntent(s.battle), intent);
      assert.equal(G.bossStep(s.battle).id, G.bossStep(snapshot).id);
    }
    assert.deepEqual(s.battle, snapshot, 'read-only preview');
    s.battle.enemyShield = 0;
    s = act(s, 'attack');
    assert.ok(s.battle.enemyHp <= 5000);
    assert.equal(s.battle.boss.phase, 1);
    assert.deepEqual(G.enemyIntent(s.battle), intent);
    const prepared = G.prepareBossRound(s.battle);
    assert.equal(prepared.entered, false);
    assert.equal(prepared.runtime.phase, 1);
    s = rest(s);
    assert.equal(s.battle.boss.phase, 2);
    assert.equal(s.battle.boss.phaseStartRound, s.battle.round);
    assert.equal(G.bossStep(s.battle).id, G.bossDefinition(r).phases[1][0].id);
    s.battle.enemyHp = 9999;
    s = rest(s);
    assert.equal(s.battle.boss.phase, 2);
  }
});

test('enemy barriers absorb actual damage once; overflow hurts HP; breaking removes barrier before direct damage', () => {
  const s = arena(town(), 1);
  assert.equal(s.battle.enemyShield, 600);
  const next = act(s, 'attack');
  assert.equal(next.battle.enemyHp, 10000);
  assert.equal(next.battle.enemyShield, 500);
  const overflow = copy(s);
  overflow.battle.enemyShield = 50;
  const hit = act(overflow, 'attack');
  assert.equal(hit.battle.enemyHp, 9950);
  assert.equal(hit.battle.enemyShield, 0);
  const broken = act(s, 'break');
  assert.equal(broken.battle.enemyShield, 0);
  assert.equal(broken.battle.enemyHp, 9898);
  assert.equal(broken.battle.shattered, true);
  assert.equal(broken.battle.marked, 1);
  const read = copy(next);
  for (let i = 0; i < 8; i++) G.enemyIntent(read.battle);
  assert.deepEqual(read, next, 'preview cannot recharge a shield');
});

test('demon phase-two channel: interrupt cancels recovery and reduces attack; seal blocks healing for exactly shown rounds', () => {
  let base = step(arena(town(), 3), 2, 1);
  base.battle.enemyHp = 4000;
  const unbroken = rest(base);
  assert.equal(unbroken.battle.enemyHp, 4300);
  const disrupted = act(base, 'break');
  const hpAfterBreak = disrupted.battle.enemyHp;
  const broken = rest(disrupted);
  assert.equal(broken.battle.enemyHp, hpAfterBreak);
  assert.ok(broken.battle.hp > unbroken.battle.hp);
  let seal = step(arena(town(), 3), 1, 1);
  u(seal).hp = 5000;
  syncFixture(seal.battle);
  assert.match(
    G.commandReason(seal, G.commandFor(seal.party[0], 'heal')),
    /封禁/,
  );
  seal = rest(seal);
  assert.equal(G.bossStep(seal.battle).kind, 'channel');
  assert.equal(seal.battle.sealed, 1);
  assert.match(
    G.commandReason(seal, G.commandFor(seal.party[0], 'heal')),
    /封禁/,
  );
  seal = rest(seal);
  assert.equal(seal.battle.sealed, 0);
  assert.equal(G.commandReason(seal, G.commandFor(seal.party[0], 'heal')), '');
});

test('dragon: range removes airborne penalty; interrupt grounds before its own damage and halves incoming dive', () => {
  const base = arena(town(), 4),
    melee = act(base, 'attack');
  assert.equal(melee.battle.enemyHp, 9975);
  const ranged = copy(base);
  u(ranged).ranged = 1;
  assert.equal(act(ranged, 'attack').battle.enemyHp, 9900);
  const breakState = act(base, 'break');
  assert.equal(G.bossResolution(breakState.battle).flying, false);
  assert.equal(breakState.battle.enemyHp, 9898);
  close(
    G.incomingDamage(breakState, u(breakState)),
    Math.round(G.incomingDamage(base, u(base)) * 0.5),
  );
  let guarded = step(arena(town(), 4), 1, 1);
  for (const unit of guarded.battle.units) {
    unit.shield = 1000;
    unit.shieldTurns = 2;
  }
  guarded = rest(guarded);
  assert.ok(
    guarded.battle.units.every((x) => x.hp === 10000 && x.burn === 0),
    'fully absorbed flame must not burn',
  );
});

test('two heroes of the same role maintain independent DOT entries, ticks, cooldowns and serialized source IDs', () => {
  let s = town(['nyx', 'nyx', 'rhea', 'finn']);
  const [a, b] = s.party;
  s = skill(s, a, 'venom_edge');
  s = skill(s, b, 'venom_edge');
  s = arena(s);
  s = act(s, 'venom_edge', a);
  const first = copy(s.battle.dots[0]);
  s = act(s, 'venom_edge', b);
  assert.equal(s.battle.dots.length, 2);
  assert.equal(s.battle.dots[0].source, a);
  assert.equal(s.battle.dots[1].source, b);
  assert.deepEqual(s.battle.dots[0], first);
  const hp = s.battle.enemyHp;
  s = rest(s);
  assert.equal(s.battle.enemyHp, hp - 80);
  assert.ok(s.battle.dots.every((x) => x.turns === 1));
  assert.deepEqual(reload(s).battle, s.battle);
  const hp2 = s.battle.enemyHp;
  s = rest(s);
  assert.equal(s.battle.enemyHp, hp2 - 80);
  assert.deepEqual(s.battle.dots, []);
});

test('root plus two carried branch skills have independent personal cooldowns and level-20 slot boundary', () => {
  let s = town(['rhea', 'rhea', 'finn', 'kael'], 19);
  const id = s.party[0],
    other = s.party[1];
  s = learn(s, id, 'rhea.a1');
  s = learn(s, id, 'rhea.c1');
  s = G.setHeroSkill(s, id, 'shield_breaker');
  assert.equal(G.setSecondarySkill(s, id, 'wayfarer_riposte'), s);
  h(s, id).level = 20;
  s = G.setSecondarySkill(s, id, 'wayfarer_riposte');
  assert.equal(h(s, id).secondarySkill, 'wayfarer_riposte');
  s = arena(s);
  assert.deepEqual(
    Object.keys(u(s, id).cooldowns).sort(),
    ['home_oath', 'shield_breaker', 'wayfarer_riposte'].sort(),
  );
  s = act(s, 'home_oath', id);
  const rootCD = u(s, id).cooldowns.home_oath;
  assert.ok(rootCD > 0);
  assert.equal(u(s, id).cooldowns.shield_breaker, 0);
  assert.equal(u(s, other).cooldowns.home_oath, 0);
  s = rest(s);
  s = act(s, 'shield_breaker', id);
  assert.equal(u(s, id).cooldowns.home_oath, rootCD);
  assert.ok(u(s, id).cooldowns.shield_breaker > 0);
  assert.equal(u(s, id).cooldowns.wayfarer_riposte, 0);
  s = rest(s);
  s = act(s, 'wayfarer_riposte', id);
  assert.ok(u(s, id).cooldowns.wayfarer_riposte > 0);
  assert.ok(u(s, id).cooldowns.home_oath < rootCD);
  assert.deepEqual(reload(s).battle, s.battle);
});

test('self-targeted mixed attack/heal may be used at full health and cannot heal the selected ally', () => {
  for (const skillId of ['unbending_return', 'dawn_sentence', 'wild_claw']) {
    const def = G.SKILLS.find((x) => x.id === skillId);
    let s = town([def.role, 'finn']);
    const id = s.party[0],
      other = s.party[1];
    s = skill(s, id, skillId);
    s = arena(s);
    u(s, other).hp = 5000;
    syncFixture(s.battle);
    s.battle.healTarget = other;
    const next = act(s, skillId, id, other);
    assert.equal(u(next, id).hp, 10000);
    assert.equal(u(next, other).hp, 5000);
    assert.ok(next.battle.enemyHp < s.battle.enemyHp);
  }
});

test('automatic rescue cannot mistake a healthy caster self-heal for healing an injured teammate', () => {
  let s = town(['rhea', 'finn']);
  const [caster, patient] = s.party;
  s = skill(s, caster, 'unbending_return');
  s = arena(s);
  u(s, patient).hp = 4000;
  syncFixture(s.battle);
  const command = G.autoCommand(s),
    [, actor, action] = command.split(':'),
    selected = G.SKILLS.find((x) => x.id === action);
  assert.ok(
    !(selected?.healing && selected.target === 'self' && actor !== patient),
    `Auto tried ${action} on healthy ${actor} while ${patient} needs healing`,
  );
  const next = G.combat(s, command);
  assert.ok(
    u(next, patient).hp > 4000,
    'available rescue should restore the injured teammate',
  );
});

test('nine trees have 13 nodes and three complete branches; eight points cannot buy a ninth and reset conserves all points', () => {
  assert.equal(G.SKILL_TREE_NODES.length, 117);
  assert.equal(new Set(G.SKILL_TREE_NODES.map((x) => x.id)).size, 117);
  for (const role of G.TREE_ROLES) {
    const nodes = G.roleTree(role.id);
    assert.equal(nodes.length, 13);
    for (const branch of ['a', 'b', 'c']) {
      let s = town([role.id]);
      const id = s.party[0];
      assert.equal(G.totalSkillPoints(h(s)), 8);
      assert.equal(
        nodes
          .filter((x) => x.branch === branch)
          .reduce((n, x) => n + x.pointCost, 0),
        8,
      );
      s = learn(s, id, `${role.id}.${branch}4`);
      assert.equal(G.spentSkillPoints(h(s)), 8);
      assert.equal(G.skillPoints(h(s)), 0);
      const extra = nodes.find(
        (x) => x.depth === 1 && x.branch !== branch && x.branch !== 'root',
      );
      assert.equal(G.learnSkill(s, id, extra.id), s);
      G.validateHeroTree(h(s));
      const bad = copy(h(s));
      bad.learnedNodes.push(extra.id);
      assert.throws(() => G.validateHeroTree(bad));
      const resources = copy(s.resources);
      s = G.resetSkills(s, id);
      assert.equal(G.spentSkillPoints(h(s)), 0);
      assert.equal(G.skillPoints(h(s)), 8);
      assert.equal(h(s).secondarySkill, undefined);
      assert.deepEqual(s.resources, resources);
      assert.deepEqual(reload(s).heroes, s.heroes);
    }
    const lower = town([role.id], 35);
    assert.equal(G.totalSkillPoints(h(lower)), 7);
    assert.ok(G.learnSkillReason(lower, lower.party[0], `${role.id}.a4`));
  }
});

test('boss hunts grant exactly one item per win, charge each departure and never copy first-win resources/XP/ending', () => {
  let s = town();
  s.cleared = [];
  assert.equal(G.bossReason(s, 0), '');
  s = G.beginBattle(s, 0, 'boss');
  s.battle.enemyHp = 1;
  s.battle.enemyShield = 0;
  const before = copy(s);
  s = act(s, 'attack');
  assert.equal(s.battle, null);
  assert.deepEqual(s.cleared, [0]);
  assert.equal(s.guild.inventory.length, before.guild.inventory.length + 1);
  assert.equal(s.guild.bossHunts.wins[0], 1);
  assert.equal(s.guild.bossHunts.readyAt[0], s.time + 180);
  assert.equal(G.combat(s, 'attack'), s);
  assert.equal(G.beginBattle(s, 0, 'boss'), s);
  assert.deepEqual(reload(s), s);
  s.time = s.guild.bossHunts.readyAt[0];
  const resources = copy(s.resources),
    xp = s.heroes.map((x) => x.xp),
    oldEnding = s.ending,
    inv = s.guild.inventory.length,
    cost = G.battlePreparationCost(s);
  s = G.beginBattle(s, 0, 'boss');
  assert.ok(s.battle);
  for (const [k, v] of Object.entries(cost))
    assert.equal(s.resources[k], resources[k] - v);
  s.battle.enemyHp = 1;
  s.battle.enemyShield = 0;
  s = act(s, 'attack');
  assert.equal(s.guild.inventory.length, inv + 1);
  assert.equal(s.guild.bossHunts.wins[0], 2);
  assert.deepEqual(
    s.heroes.map((x) => x.xp),
    xp,
  );
  assert.deepEqual(s.cleared, [0]);
  assert.equal(s.ending, oldEnding);
  for (const k of Object.keys(resources))
    assert.equal(s.resources[k], resources[k] - (cost[k] || 0));
  assert.deepEqual(reload(s), s);
});

test('v9 in-flight combat keeps legacy cycle, stats, RNG and next actions exactly; v10 marked battle roundtrips exactly', () => {
  for (let r = 0; r < 6; r++) {
    let s = arena(town(), r);
    s = act(s, 'attack');
    delete s.battle.boss;
    delete s.battle.dots;
    s.version = 9;
    const oldBattle = copy(s.battle),
      loaded = reload(s);
    assert.equal(loaded.version, 11);
    assert.equal(loaded.battle.boss, undefined);
    assert.deepEqual(loaded.battle, oldBattle);
    let control = copy(loaded),
      resume = reload(loaded);
    for (let i = 0; i < 12; i++) {
      const actor = control.battle.units.find(
        (x) => x.hp > 0 && !control.battle.acted.includes(x.id),
      );
      const cmd = G.commandFor(actor.id, 'guard');
      control = G.combat(control, cmd);
      resume = G.combat(resume, cmd);
      assert.deepEqual(resume, control);
      assert.equal(resume.battle.boss, undefined);
    }
    const current = arena(town(), r);
    assert.ok(current.battle.boss);
    assert.deepEqual(reload(current), current);
  }
});

test('malformed runtime, duplicate DOT sources and invalid branch slot reject rather than repair or grant rewards', () => {
  const s = arena();
  for (const mutate of [
    (x) => (x.battle.boss.phase = 3),
    (x) => (x.battle.boss.preparedRound = 0),
    (x) =>
      (x.battle.dots = [
        { source: x.party[0], kind: 'poison', damage: 2, turns: 2 },
        { source: x.party[0], kind: 'poison', damage: 2, turns: 2 },
      ]),
    (x) => (x.heroes[0].secondarySkill = 'made_up_skill'),
  ]) {
    const bad = copy(s);
    mutate(bad);
    assert.throws(() => reload(bad));
  }
});

test('162 actual-stat encounters: four same-role heroes, all complete branches, root plus two actives, auto/save/reload never stalls or diverges', () => {
  const totals = { encounters: 0, wins: 0, actions: 0, rounds: 0, byRole: [] };
  for (const role of G.TREE_ROLES) {
    let wins = 0,
      actions = 0;
    for (const branch of ['a', 'b', 'c']) {
      let base = town([role.id, role.id, role.id, role.id]);
      for (const id of base.party) {
        base = learn(base, id, `${role.id}.${branch}4`);
        const nodes = G.roleTree(role.id),
          early = nodes.find((x) => x.id === `${role.id}.${branch}1`).skillId,
          deep = nodes.find((x) => x.id === `${role.id}.${branch}3`).skillId;
        base = G.setHeroSkill(base, id, deep);
        base = G.setSecondarySkill(base, id, early);
        assert.equal(G.spentSkillPoints(h(base, id)), 8);
        assert.equal(G.combatSkills(base, id).length, 3);
      }
      for (let r = 0; r < 6; r++) {
        let control = G.beginBattle(base, r, 'boss');
        assert.ok(
          control.battle,
          `${role.id}/${branch}/${r}: ${G.bossReason(base, r)}`,
        );
        let restored = reload(control),
          count = 0;
        while (control.battle && count < 250) {
          const command = G.autoCommand(control);
          assert.equal(
            G.commandReason(control, command),
            '',
            `${role.id}/${branch}/${r}: ${command}`,
          );
          assert.equal(G.autoCommand(restored), command);
          const next = G.combat(control, command);
          assert.notEqual(next, control, 'auto must spend an action');
          control = next;
          restored = reload(G.combat(restored, command));
          assert.deepEqual(
            restored,
            control,
            `${role.id}/${branch}/${r}, action ${count}`,
          );
          count++;
        }
        assert.equal(
          control.battle,
          null,
          `${role.id}/${branch}/${r} exceeded 250 actions`,
        );
        assert.ok(control.lastBattle);
        assert.ok(control.lastBattle.rounds <= 61);
        totals.encounters++;
        totals.wins += Number(control.lastBattle.won);
        totals.actions += count;
        totals.rounds += control.lastBattle.rounds;
        wins += Number(control.lastBattle.won);
        actions += count;
      }
    }
    totals.byRole.push({ role: role.id, encounters: 18, wins, actions });
  }
  assert.equal(totals.encounters, 162);
  console.log('SAME_ROLE_LOOP_RESULTS ' + JSON.stringify(totals));
});
