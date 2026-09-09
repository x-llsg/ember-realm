// Constructed, validator-accepted combat fixtures. These are not legal-playthrough claims.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/realm.ts';
import { recommendedFixture } from './difficulty-fixtures.mjs';

const copy = structuredClone;
const reload = (s) => G.decodeSave(JSON.stringify(s));
const hero = (s, index = 0) => s.heroes.find((h) => h.id === s.party[index]);
const unit = (s, index = 0) => s.battle.units[index];
function town(roles = ['rhea', 'luna', 'kael', 'vera']) {
  const s = recommendedFixture(5, 6, { roles });
  s.guild.depths = [5, 5, 5, 5, 5, 5];
  s.cleared = [0, 1, 2, 3, 4];
  s.survey = G.REGIONS.map((region) => region.thresholds[1]);
  s.nextEventAt = 1e8;
  s.jobs = Object.fromEntries(Object.keys(s.jobs).map((key) => [key, 0]));
  for (const h of s.heroes) {
    h.learnedNodes = [];
    h.activeSkill = G.DEFAULT_SKILL[h.role];
    delete h.secondarySkill;
  }
  for (const key of G.MATERIAL_IDS)
    s.world.materials[key] = G.materialCapacity(s, key);
  return s;
}
function dress(s, setId, index = 0, count = 4) {
  const h = hero(s, index);
  const ids = Object.values(h.equipment);
  for (const item of s.guild.inventory.filter((g) => ids.includes(g.id))) {
    item.rarity = 3;
    delete item.setId;
  }
  for (const id of ids.slice(0, count))
    s.guild.inventory.find((g) => g.id === id).setId = setId;
  return s;
}
function learn(s, index, skillId) {
  const id = hero(s, index).id;
  const node = G.roleTree(hero(s, index).role).find(
    (n) => n.skillId === skillId,
  );
  assert.ok(node);
  function add(current, key) {
    const n = G.roleTree(hero(current, index).role).find((x) => x.id === key);
    if (G.nodeKnown(hero(current, index), n)) return current;
    for (const required of n.requires) current = add(current, required);
    assert.equal(G.learnSkillReason(current, id, key), '');
    return G.learnSkill(current, id, key);
  }
  s = add(s, node.id);
  return G.setHeroSkill(s, id, skillId);
}
function sync(s) {
  const b = s.battle;
  b.hp = b.units.reduce((sum, u) => sum + u.hp, 0);
  b.maxHp = b.units.reduce((sum, u) => sum + u.maxHp, 0);
  b.ward = Math.max(...b.units.map((u) => u.ward));
  b.burn = Math.max(...b.units.map((u) => u.burn));
  b.cooldowns = Object.fromEntries(
    b.units.map((u) => [u.id, Math.max(0, ...Object.values(u.cooldowns))]),
  );
}
function arena(s = town(), region = 0, intent = 'strike') {
  s = copy(s);
  s.battle = G.createCombat(s, region, 'guardian', 0);
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
      ranged: 1,
    });
  s.battle.target = s.party[0];
  sync(s);
  assert.deepEqual(reload(s).battle, s.battle);
  return s;
}
function act(s, action, index = 0, target) {
  const command = G.commandFor(s.party[index], action, target);
  assert.equal(G.commandReason(s, command), '', command);
  const before = copy(s);
  const next = G.combat(s, command);
  assert.notEqual(next, s);
  assert.deepEqual(s, before);
  return next;
}
function endRound(s) {
  const round = s.battle.round;
  while (s.battle?.round === round) {
    const index = s.battle.units.findIndex(
      (u) => u.hp > 0 && !s.battle.acted.includes(u.id),
    );
    s = act(s, 'guard', index);
  }
  return s;
}

test('all six blue four-piece sets freeze their behavior; three pieces never activate it', () => {
  for (const set of G.EQUIPMENT_SETS) {
    const s = town();
    dress(s, set.id);
    const fought = G.createCombat(s, set.region, 'guardian', 0);
    assert.equal(fought.units[0].setEffect.id, set.id);
    for (const item of s.guild.inventory) delete item.setId;
    assert.equal(
      fought.units[0].setEffect.id,
      set.id,
      'not recomputed from town equipment',
    );
    dress(s, set.id, 0, 3);
    assert.equal(
      G.createCombat(s, set.region, 'guardian', 0).units[0].setEffect,
      undefined,
    );
  }
});
test('forest: choosing guard produces one bounded riposte, while unprotected damage produces none', () => {
  let s = arena(dress(town(), 'wildwatch'));
  const noGuard = act(copy(s), 'attack');
  const unprotected = endRound(noGuard);
  assert.equal(unprotected.battle.enemyHp, 99900);
  s = endRound(s);
  assert.equal(s.battle.enemyHp, 99955);
  assert.ok(s.battle.history.some((line) => line.includes('林间还击造成 45')));
  assert.equal(unit(s).setEffect.triggered, true);
  assert.deepEqual(reload(s).battle, s.battle);
});
test('forest: a real dodge causes a riposte without consuming an action or creating recursive effects', () => {
  let s = arena(dress(town(), 'wildwatch'));
  unit(s).dodge = 0.4;
  s.battle.rng = 1;
  // Guard all members; the enemy RNG alone supplies the first dodge roll.
  s = endRound(s);
  assert.equal(unit(s).hp, 1000);
  assert.equal(s.battle.enemyHp, 99955);
  assert.equal(
    s.battle.history.filter((line) => line.includes('林间还击')).length,
    1,
  );
});
test('bell: direct excess healing becomes a shield at full health and meaningfully absorbs the next hit', () => {
  let s = arena(dress(town(), 'nightbell', 1), 1);
  const target = s.party[0];
  assert.equal(
    G.commandReason(s, G.commandFor(s.party[1], 'heal', target)),
    '',
  );
  const supplies = s.battle.supplies;
  s = act(s, 'heal', 1, target);
  assert.equal(
    unit(s).shield,
    200,
    'target max-hp 20% cap, even with large supply healing',
  );
  assert.equal(s.battle.supplies, supplies - 1);
  const shield = unit(s).shield;
  s = act(s, 'attack');
  s = endRound(s);
  assert.equal(unit(s).hp, 1000);
  assert.ok(unit(s).shield < shield);
  assert.equal(
    G.commandReason(s, G.commandFor(s.party[1], 'heal', target)).includes(
      '冷却',
    ),
    true,
  );
});
test('bell: automatic combat uses a healer to prepare shields before a visible heavy attack', () => {
  const s = arena(dress(town(), 'nightbell', 1), 1, 'heavy');
  const command = G.autoCommand(s);
  assert.ok(command.includes(s.party[1]));
  const next = G.combat(s, command);
  assert.ok(next.battle.units.some((u) => u.shield > 0));
});
test('iron: protected damage stores finite power and the next direct attack releases it exactly once', () => {
  let s = arena(dress(town(), 'ironvow'), 2);
  s = endRound(s);
  const stored = unit(s).setEffect.stored;
  assert.ok(stored > 0 && stored <= 80);
  const hp = s.battle.enemyHp;
  s = act(s, 'attack');
  assert.equal(hp - s.battle.enemyHp, 100 + stored);
  assert.equal(unit(s).setEffect.stored, 0);
  const exposed = arena(dress(town(), 'ironvow'), 2);
  const after = endRound(act(exposed, 'attack'));
  assert.equal(
    unit(after).setEffect.stored,
    0,
    'being hurt without protection grants no power',
  );
});
test('abyss: damage skills ignite; break consumes the snapshot DOT and cannot reignite or duplicate it', () => {
  let s = arena(dress(town(), 'abysswalk'), 3);
  s = act(s, 'home_oath');
  const fire = s.battle.dots.find(
    (e) => e.source === s.party[0] && e.kind === 'fire',
  );
  assert.deepEqual(fire, {
    source: s.party[0],
    kind: 'fire',
    damage: 20,
    turns: 2,
  });
  s = endRound(s);
  const before = s.battle.enemyHp;
  s = act(s, 'break');
  assert.equal(before - s.battle.enemyHp, 85 + 16);
  assert.equal(s.battle.dots.filter((e) => e.source === s.party[0]).length, 0);
  assert.ok(s.battle.history.some((line) => line.includes('引爆本人燃烧')));
});
test('skill-tree: the mage can turn another profession fire into a bounded immediate burst without rare gear', () => {
  let s = town(['ash', 'luna', 'kael', 'vera']);
  s = learn(s, 0, 'cinder_lance');
  s = learn(s, 2, 'meteor');
  s = arena(s, 3);
  s = act(s, 'cinder_lance');
  assert.equal(s.battle.dots[0].damage, 35);
  const hp = s.battle.enemyHp;
  s = act(s, 'meteor', 2);
  // Forced zero crit plus meteor 10% roll may crit, but the separate detonation is exactly 56.
  assert.ok(hp - s.battle.enemyHp >= 296);
  assert.ok(
    s.battle.history.some((line) => line.includes('引爆队伍燃烧造成 56')),
  );
  assert.equal(s.battle.dots.length, 0);
  assert.ok(!s.battle.units.some((u) => u.setEffect));
});
test('automatic damage selection detonates substantial existing fire using a carried branch skill', () => {
  let s = learn(town(), 2, 'meteor');
  s = arena(s, 3);
  s.battle.dots = [{ source: s.party[0], kind: 'fire', damage: 50, turns: 3 }];
  assert.equal(G.autoCommand(s), G.commandFor(s.party[2], 'meteor'));
  s = G.combat(s, G.autoCommand(s));
  assert.equal(s.battle.dots.length, 0);
  assert.ok(
    s.battle.history.some((line) => line.includes('引爆队伍燃烧造成 120')),
  );
});
test('dragon: two allies consume armor-opening tokens; the owner cannot consume its own mark and marks never stack', () => {
  let s = arena(dress(town(), 'dragonscar'), 4);
  s.battle.enemyDefense = 100;
  s = act(s, 'break');
  assert.equal(unit(s).setEffect.weakness, 2);
  let hp = s.battle.enemyHp;
  s = act(s, 'attack', 1);
  assert.equal(hp - s.battle.enemyHp, 54);
  assert.equal(unit(s).setEffect.weakness, 1);
  hp = s.battle.enemyHp;
  s = act(s, 'attack', 2);
  assert.equal(hp - s.battle.enemyHp, 54);
  assert.equal(unit(s).setEffect.weakness, 0);
  hp = s.battle.enemyHp;
  s = act(s, 'attack', 3);
  assert.equal(hp - s.battle.enemyHp, 50);
});
test('sky: equipped cleansing skill lifts a real seal, enables healing, and prevents its same-round reapplication', () => {
  let s = town(['ash', 'luna', 'kael', 'vera']);
  s = learn(s, 0, 'scale_cleanse');
  dress(s, 'dawnbreak');
  s = arena(s, 5, 'seal');
  unit(s, 1).hp = 300;
  sync(s);
  assert.match(
    G.commandReason(s, G.commandFor(s.party[1], 'heal', s.party[1])),
    /封禁/,
  );
  assert.equal(G.autoCommand(s), G.commandFor(s.party[0], 'scale_cleanse'));
  s = act(s, 'scale_cleanse');
  assert.equal(unit(s).setEffect.sealWardRound, 1);
  assert.ok(s.battle.units.every((u) => u.shield >= 85));
  s = act(s, 'heal', 1, s.party[1]);
  assert.ok(unit(s, 1).hp > 300);
  s = endRound(s);
  assert.equal(s.battle.sealed, 0);
  assert.equal(
    s.battle.history.filter((line) => line.includes('破晓逆律')).length,
    1,
  );
  assert.match(
    G.commandReason(s, G.commandFor(s.party[1], 'heal', s.party[1])),
    /封禁|冷却/,
  );
});
test('sky: breaking the current ward is a second equipment route to party shields', () => {
  let s = arena(dress(town(), 'dawnbreak'), 5, 'ward');
  s = act(s, 'break');
  assert.ok(s.battle.units.every((u) => u.shield === 85));
  assert.equal(unit(s).setEffect.triggered, true);
});
test('all six set encounters save and continue identically; legacy units with no new snapshots remain valid', () => {
  for (const set of G.EQUIPMENT_SETS) {
    let s = arena(dress(town(), set.id), set.region);
    s.battle.auto = true;
    s = G.advance(s, 3);
    const loaded = reload(s);
    assert.deepEqual(G.advance(s, 45), G.advance(loaded, 45));
    let partitioned = reload(s);
    for (let i = 0; i < 9; i++) partitioned = reload(G.advance(partitioned, 5));
    assert.deepEqual(G.advance(s, 45), partitioned);
  }
  const old = arena();
  for (const u of old.battle.units) {
    delete u.setEffect;
    delete u.projectChoices;
  }
  assert.deepEqual(reload(old).battle, old.battle);
  assert.ok(endRound(reload(old)).battle.round > old.battle.round);
});
test('malformed behavior counters, cross-set charges and mismatched project snapshots are rejected', () => {
  const s = arena(dress(town(), 'ironvow'));
  for (const mutate of [
    (b) => {
      b.units[0].setEffect.stored = 81;
    },
    (b) => {
      b.units[0].setEffect.round = 999;
    },
    (b) => {
      b.units[0].setEffect.weakness = 1;
    },
    (b) => {
      b.units[0].setEffect.sealWardRound = 1;
    },
    (b) => {
      b.units[0].setEffect.triggered = 'yes';
    },
    (b) => {
      b.units[0].projectChoices = ['array:shields'];
    },
  ]) {
    const invalid = copy(s);
    mutate(invalid.battle);
    assert.throws(() => reload(invalid));
  }
});
test('project effects are frozen on departure; chant cuts heavy damage and shields counter only once', () => {
  let s = town();
  s.projects.array = 'chant';
  s = arena(s, 3, 'heavy');
  const damage = G.incomingDamage(s, unit(s, 1));
  s = act(s, 'break');
  assert.equal(
    G.incomingDamage(s, unit(s, 1)),
    Math.max(1, Math.round(damage * 0.35)),
  );
  s.projects.array = 'shields';
  s = endRound(s);
  assert.ok(!s.battle.history.some((line) => line.includes('坚守护盾阵反击')));
  let shields = town();
  shields.projects.array = 'shields';
  shields = arena(shields, 3);
  shields = endRound(shields);
  assert.equal(
    shields.battle.history.filter((line) => line.includes('坚守护盾阵反击'))
      .length,
    1,
  );
  assert.equal(shields.battle.enemyHp, 99960);
});
test('dragon blood cleanses only after actually guarding heavy; the cut project increases break damage 10%', () => {
  let s = town();
  s.projects.dragon = 'blood';
  s = arena(s, 4, 'heavy');
  unit(s).burn = 2;
  unit(s).hp = 800;
  sync(s);
  s = endRound(s);
  assert.equal(unit(s).burn, 0);
  assert.ok(unit(s).hp > 800);
  let cut = town();
  cut.projects.key = 'cut';
  cut = arena(cut, 5);
  const hp = cut.battle.enemyHp;
  cut = act(cut, 'break');
  assert.equal(hp - cut.battle.enemyHp, 94);
});
test('six deterministic set patterns charge exact regional materials and same-quality salvage without random rerolls', () => {
  for (const set of G.EQUIPMENT_SETS) {
    const s = town(),
      item = s.guild.inventory[0];
    item.rarity = 3;
    s.guild.salvage[3] = 100;
    const q = G.setReforgePreview(s, item.id, set.id),
      before = copy(s);
    assert.equal(q.reason, '');
    const next = G.reforgeGearSet(s, item.id, set.id);
    assert.deepEqual(s, before);
    assert.equal(next.rng, s.rng);
    assert.equal(next.guild.rng, s.guild.rng);
    assert.deepEqual(next.guild.inventory[0], { ...item, setId: set.id });
    assert.equal(s.resources.gold - next.resources.gold, q.cost.gold);
    assert.equal(s.guild.salvage[3] - next.guild.salvage[3], item.tier * 2);
    for (const [key, amount] of Object.entries(q.materials))
      assert.equal(s.world.materials[key] - next.world.materials[key], amount);
    assert.ok(reload(next));
    assert.equal(G.reforgeGearSet(next, item.id, set.id), next);
  }
});
test('deterministic patterns cannot bypass undiscovered regions, substitute low-quality salvage or alter away gear', () => {
  const s = town(),
    item = s.guild.inventory[0];
  item.rarity = 3;
  s.guild.salvage[1] = 9999;
  s.guild.salvage[3] = 0;
  assert.match(
    G.setReforgePreview(s, item.id, 'wildwatch').reason,
    /稀有残片不足/,
  );
  s.guild.salvage[3] = 100;
  s.guild.depths[0] = 0;
  assert.match(
    G.setReforgePreview(s, item.id, 'wildwatch').reason,
    /第一处守敌/,
  );
  assert.equal(G.reforgeGearSet(s, item.id, 'wildwatch'), s);
  s.guild.depths[0] = 5;
  s.battle = G.createCombat(s, 0, 'guardian', 0);
  assert.match(G.setReforgePreview(s, item.id, 'wildwatch').reason, /出征/);
  assert.equal(G.reforgeGearSet(s, item.id, 'wrong'), s);
});
test('two-hit boss attacks trigger forest and project counters once each, never once per damage event', () => {
  let s = town();
  s.projects.array = 'shields';
  dress(s, 'wildwatch');
  s = arena(s);
  Object.assign(s.battle, {
    kind: 'boss',
    region: 0,
    round: 11,
    boss: { version: 1, phase: 2, phaseStartRound: 10, preparedRound: 11 },
    enemyHp: 40000,
  });
  assert.equal(G.bossResolution(s.battle).hits, 2);
  const hp = s.battle.enemyHp;
  s = endRound(s);
  assert.equal(
    s.battle.history.filter((line) => line.includes('林间还击')).length,
    1,
  );
  assert.equal(
    s.battle.history.filter((line) => line.includes('坚守护盾阵反击')).length,
    1,
  );
  assert.equal(hp - s.battle.enemyHp, 85);
  assert.equal(
    s.battle.history.filter((line) => line.includes('狂猎连扑 →')).length,
    2,
  );
});
test('a lethal enemy hit cannot resurrect its wearer through a set counter', () => {
  let s = arena(dress(town(), 'wildwatch'));
  unit(s).hp = 1;
  sync(s);
  s = endRound(s);
  assert.equal(unit(s).hp, 0);
  assert.equal(s.battle.enemyHp, 100000);
  assert.ok(!s.battle.history.some((line) => line.includes('林间还击')));
});
test('a defeated foe cannot attack again after a legitimate first-hit counter', () => {
  let s = arena(dress(town(), 'wildwatch'));
  s.battle.enemyHp = 1;
  s = endRound(s);
  assert.equal(s.battle, null);
  assert.equal(s.lastBattle.won, true);
  assert.equal(
    s.lastBattle.history.filter((line) => line.includes('定向攻击 →')).length,
    1,
  );
});
