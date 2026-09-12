// Constructed high-chapter combat fixtures, not a claim of a full legal playthrough.
import assert from 'node:assert/strict';
import * as G from '../lib/realm.ts';
import * as T from '../lib/tactics.ts';
import * as R from '../lib/relic-combat.ts';
import { recommendedFixture } from './difficulty-fixtures.mjs';

export const clone = structuredClone;
export const hero = (s, i = 0) => s.heroes.find((h) => h.id === s.party[i]);
export const unit = (s, i = 0) => s.battle.units[i];
export function town(roles = ['rhea', 'luna', 'kael', 'orin']) {
  const s = recommendedFixture(5, 6, { roles });
  s.guild.depths = [5, 5, 5, 5, 5, 5];
  s.cleared = [0, 1, 2, 3, 4];
  s.survey = G.REGIONS.map((r) => r.thresholds[1]);
  s.nextEventAt = 1e8;
  s.jobs = Object.fromEntries(Object.keys(s.jobs).map((k) => [k, 0]));
  for (const h of s.heroes) {
    h.learnedNodes = [];
    h.activeSkill = G.DEFAULT_SKILL[h.role];
    delete h.secondarySkill;
  }
  for (const k of G.MATERIAL_IDS)
    s.world.materials[k] = G.materialCapacity(s, k);
  G.discoverSites(s, false);
  return s;
}
export function own(s, id, index = 0) {
  const siteId = id.replace('R', 'S');
  const p = s.worldExploration.sites[siteId];
  p.firstCompleted = true;
  p.routesCompleted = ['assault'];
  s.worldExploration.relics.owned[id] = {
    siteId,
    acquiredAt: s.time,
    repaired: true,
    operation: null,
  };
  s.worldExploration.relics.combat[id] = s.party[index];
  return s;
}
export function learn(s, index, skillId) {
  const id = hero(s, index).id;
  const tree = G.roleTree(hero(s, index).role);
  const node = tree.find((n) => n.skillId === skillId);
  assert.ok(node, skillId);
  function add(current, key) {
    const n = tree.find((x) => x.id === key);
    if (G.nodeKnown(hero(current, index), n)) return current;
    for (const required of n.requires) current = add(current, required);
    assert.equal(G.learnSkillReason(current, id, key), '', key);
    return G.learnSkill(current, id, key);
  }
  return G.setHeroSkill(add(s, node.id), id, skillId);
}
export function sync(s) {
  const b = s.battle;
  b.hp = b.units.reduce((sum, u) => sum + u.hp, 0);
  b.maxHp = b.units.reduce((sum, u) => sum + u.maxHp, 0);
  b.ward = Math.max(...b.units.map((u) => u.ward));
  b.burn = Math.max(...b.units.map((u) => u.burn));
  b.cooldowns = Object.fromEntries(
    b.units.map((u) => [u.id, Math.max(0, ...Object.values(u.cooldowns))]),
  );
}
export function arena(s = town(), intent = 'strike') {
  s = clone(s);
  s.battle = T.createCombat(s, 0, 'guardian', 0);
  Object.assign(s.battle, {
    enemyHp: 100000,
    enemyMaxHp: 100000,
    enemyAttack: 100,
    enemyDefense: 0,
    enemyDodge: 0,
    enemyCrit: 0,
    pattern: [intent],
    energy: 10,
    bonus: 1,
  });
  for (const u of s.battle.units)
    Object.assign(u, {
      hp: 1000,
      maxHp: 1000,
      attack: 100,
      defense: 0,
      crit: 0,
      dodge: 0,
      pierce: 0,
      resistance: 0,
      healing: 1,
      shieldPower: 1,
      cooldownReduction: 0,
      ranged: 0,
    });
  s.battle.target = s.party[0];
  sync(s);
  T.validateBattle(s);
  return s;
}
export function act(s, action, index = 0, target) {
  return command(s, T.commandFor(s.party[index], action, target));
}
export function relic(s, mode, skill, index = 0, target = '', aux = '') {
  return command(s, R.relicCommand(s.party[index], mode, skill, target, aux));
}
export function command(s, command) {
  assert.equal(T.tacticalReason(s, command), '', command);
  const before = clone(s),
    next = T.tacticalCombat(s, command);
  assert.notEqual(next, s);
  assert.deepEqual(s, before);
  if (next.battle) T.validateBattle(next);
  return next;
}
export function endRound(s) {
  const round = s.battle.round;
  while (s.battle?.round === round) {
    const i = s.battle.units.findIndex(
      (u) => u.hp > 0 && !s.battle.acted.includes(u.id),
    );
    s = act(s, 'guard', i);
  }
  return s;
}
