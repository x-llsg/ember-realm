import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/realm.ts';
import { fixture, runBattle } from './combat-matrix.mjs';
import { GUARDIANS, BOSSES } from '../lib/guardian-candidates.ts';

// Combat-only fixtures: no claim about a legal campaign's acquisition time.
// All samples use the shipping engine, deterministic seeds and ordinary traits.
const seeds = (n) =>
  Array.from({ length: n }, (_, i) => Math.imul(i + 1, 2654435761) >>> 0);
function checkpoint(
  region,
  node,
  investment = 'bare',
  { quality = 3, level = 10, roles } = {},
) {
  const s = fixture(region, 1).state;
  s.guild.depths[region] = node - 1;
  s.guild.progress[region] = G.FRONTIER_REQUIREMENTS[node - 1];
  s.guild.inventory = [];
  s.guild.doctrine.smithing = 0;
  s.research = [];
  s.kit = 1;
  for (const [index, h] of s.heroes.entries()) {
    h.role = roles?.[index] || h.role;
    Object.assign(h, {
      quality,
      level,
      mastery: 0,
      xp: 0,
      aptitude: { hp: 100, attack: 100, defense: 100 },
      origin: '行商护卫',
      talent: 'diligent',
      talentVersion: 2,
      flaw: 'overcome',
      weapon: 0,
      armor: 0,
      equipment: {},
      learnedNodes: [],
      activeSkill: G.DEFAULT_SKILL[h.role],
    });
    delete h.secondarySkill;
    if (investment !== 'bare') {
      const recipes = [
        h.role === 'finn' ? 'bow' : region === 1 ? 'staff' : 'pike',
        region === 1 ? 'shadowcoat' : 'plate',
        region === 1 ? 'wardstone' : 'vitality',
      ];
      for (const recipe of recipes) {
        assert.equal(
          G.recipeUnlockReason(s, recipe),
          '',
          `${recipe} is available at this stage`,
        );
        const item = {
          id: `difficulty-${++s.guild.serial}`,
          recipe,
          tier: 2,
          rarity: 2,
          upgrade: 2,
          affix: 2,
        };
        s.guild.inventory.push(item);
        h.equipment[G.RECIPES.find((r) => r.id === recipe).slot] = item.id;
      }
    }
  }
  if (investment === 'prepared') {
    s.guild.preparation.element = region === 1 ? 'shadow' : 'physical';
    s.guild.preparation.stance = 'cautious';
    s.research.push(region === 1 ? 'wards' : 'steel');
    s.kit = 2;
  }
  assert.ok(
    G.decodeSave(JSON.stringify(s)),
    'fixture survives save validation',
  );
  return s;
}
function sample(
  s0,
  region,
  node,
  policy = 'auto',
  count = 32,
  kind = 'guardian',
) {
  const results = [];
  for (const seed of seeds(count)) {
    let s = G.clone(s0);
    s.rng = seed;
    s.battle = G.createCombat(s, region, kind, node - 1);
    let actions = 0;
    while (s.battle && actions++ < 260) {
      const actor = s.battle.units.find(
        (u) => u.hp > 0 && !s.battle.acted.includes(u.id),
      );
      const command =
        policy === 'auto' ? G.autoCommand(s) : G.commandFor(actor.id, 'attack');
      assert.equal(G.commandReason(s, command), '');
      s = G.combat(s, command);
    }
    assert.equal(s.battle, null, 'fight has a bounded conclusion');
    assert.ok(s.lastBattle);
    results.push(s.lastBattle);
  }
  return {
    wins: results.filter((x) => x.won).length,
    rounds: results.reduce((n, x) => n + x.rounds, 0) / count,
    casualties:
      results.reduce((n, x) => n + s0.party.length - x.survivors, 0) / count,
  };
}

test('encounters grow within each route, and never scale to the player', () => {
  const s = G.freshState(12345);
  for (let region = 0; region < 6; region++) {
    const route = [
      ...GUARDIANS.filter((e) => e.region === region),
      BOSSES[region],
    ];
    for (let i = 1; i < route.length; i++) {
      assert.ok(route[i].hp > route[i - 1].hp);
      assert.ok(route[i].attack > route[i - 1].attack);
    }
    const before = G.clone(G.enemyDefinition(s, region, 'guardian', 2));
    s.kit = 5;
    s.research = ['steel', 'wards', 'memory', 'godslayer'];
    assert.deepEqual(G.enemyDefinition(s, region, 'guardian', 2), before);
  }
});

test('first guardian stays approachable with two level-2 one-star heroes', () => {
  const s = fixture(0, 0).state;
  for (const h of s.heroes) {
    h.quality = 1;
    h.aptitude = { hp: 100, attack: 100, defense: 100 };
  }
  assert.ok(sample(s, 0, 1).wins >= 28);
});

for (const region of [1, 2]) {
  test(`route ${region + 1}: bare level-10 three-star teams cannot reliably auto-clear the midpoint`, () => {
    for (const roles of [
      undefined,
      ['luna', 'luna', 'luna', 'luna'],
      ['rhea', 'rhea', 'rhea', 'rhea'],
    ]) {
      const result = sample(
        checkpoint(region, 3, 'bare', { roles }),
        region,
        3,
        'auto',
        64,
      );
      assert.ok(
        result.wins <= 16,
        `unprepared midpoint wins ${result.wins}/64`,
      );
    }
    const early = sample(checkpoint(region, 2), region, 2);
    assert.ok(
      early.wins >= 24,
      'earlier foothold remains available before the equipment check',
    );
  });
  test(`route ${region + 1}: ordinary green gear works without high potential or rare talents`, () => {
    const bare = sample(checkpoint(region, 3), region, 3);
    const geared = sample(checkpoint(region, 3, 'equipped'), region, 3);
    const trainedTwoStar = sample(
      checkpoint(region, 3, 'equipped', { quality: 2, level: 12 }),
      region,
      3,
    );
    assert.ok(geared.wins >= 28 && geared.wins - bare.wins >= 20);
    assert.ok(
      trainedTwoStar.wins >= 28,
      'two-star growth plus equipment is a viable early route',
    );
  });
}

test('research and preparation matter after the midpoint; defensive skill use beats plain attacking', () => {
  const ordinary = sample(checkpoint(2, 4, 'equipped'), 2, 4, 'auto', 64);
  const prepared = sample(checkpoint(2, 4, 'prepared'), 2, 4, 'auto', 64);
  assert.ok(
    ordinary.wins <= 48,
    'equipment alone is not the entire progression route',
  );
  assert.ok(prepared.wins >= 56 && prepared.wins - ordinary.wins >= 24);
  const s = checkpoint(2, 3, 'equipped', { quality: 2, level: 12 });
  const tactical = sample(s, 2, 3, 'auto');
  const attacks = sample(s, 2, 3, 'attack');
  assert.ok(
    tactical.wins - attacks.wins >= 20,
    'existing automatic defensive decisions remain useful',
  );
});

test('stage-constrained three-star builds can still defeat all thirty guardians and six bosses', () => {
  for (const enemy of GUARDIANS) {
    const { region, node } = enemy;
    let s = fixture(region, node === 1 ? 0 : 1).state;
    s.guild.depths[region] = node - 1;
    s.guild.progress[region] = G.FRONTIER_REQUIREMENTS[node - 1];
    for (const h of s.heroes) {
      h.level = enemy.targetLevel;
      h.quality = 3;
      h.mastery = Math.min(h.mastery, Math.floor(enemy.targetLevel / 6));
      h.learnedNodes = [];
      h.activeSkill = G.DEFAULT_SKILL[h.role];
      delete h.secondarySkill;
    }
    for (const item of s.guild.inventory) {
      item.tier = enemy.targetTier;
      item.upgrade = enemy.targetUpgrade;
      item.rarity = 2;
    }
    for (const id of s.party) {
      const role = s.heroes.find((h) => h.id === id).role;
      const nodes = G.roleTree(role)
        .filter((n) => n.branch !== 'root')
        .sort(
          (a, b) =>
            (a.branch === 'a' ? 0 : 1) - (b.branch === 'a' ? 0 : 1) ||
            a.depth - b.depth,
        );
      for (const n of nodes)
        if (!G.learnSkillReason(s, id, n.id)) s = G.learnSkill(s, id, n.id);
    }
    assert.ok(
      sample(s, region, node, 'auto', 8).wins >= 6,
      `route ${region + 1}, node ${node}`,
    );
  }
  for (let region = 0; region < 6; region++) {
    const s = fixture(region, 2).state;
    let wins = 0;
    for (const seed of seeds(16)) {
      s.rng = seed;
      wins += Number(runBattle(s, region, 2, 'auto').won);
    }
    assert.ok(wins >= 12, `boss ${region + 1}: ${wins}/16`);
  }
});

