import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/realm.ts';
import * as T from '../lib/tactics.ts';
import * as S from '../lib/site-combat.ts';
import * as E from '../lib/site-exploration.ts';
import { GUARDIANS } from '../lib/guardian-data.ts';
import { difficultySeeds, recommendedFixture } from './difficulty-fixtures.mjs';
import { carefulCommand } from './site-combat-matrix.mjs';
import {
  arena,
  town,
  own,
  unit,
  sync,
  act,
  endRound,
  clone,
} from './v03-combat-fixtures.mjs';

function siteArena(id, variant = 'A', round = 1) {
  const s = arena();
  const units = s.battle.units;
  s.battle = T.snapshotSiteCombat(s, id, variant, 12345);
  Object.assign(s.battle, {
    units,
    enemyHp: 100000,
    enemyMaxHp: 100000,
    enemyAttack: 100,
    enemyDefense: 0,
    enemyDodge: 0,
    enemyCrit: 0,
    round,
    energy: 10,
    bonus: 1,
  });
  s.battle.site.preparedRound = 0;
  S.prepareSiteRound(s.battle);
  sync(s);
  T.validateBattle(s);
  return s;
}
function start(id = 'S01') {
  let s = town();
  s.guild.preparation.element = 'physical';
  s.guild.preparation.remedy = false;
  assert.equal(E.siteStartReason(s, id), '');
  s = E.startSite(s, id);
  E.siteTick(s, s.worldExploration.activeRun.remaining);
  s = E.chooseSiteRoute(s, 'assault');
  E.siteTick(s, s.worldExploration.activeRun.remaining);
  assert.equal(s.battle.kind, 'site');
  assert.equal(s.worldExploration.activeRun.phase, 'battle');
  assert.ok(G.decodeSave(JSON.stringify(s)));
  return s;
}

test('all twelve enemies have fixed chapter/node baselines independent of player stats', () => {
  const hp = [1.1, 1.08, 1.1, 1.08, 1.08, 1.1, 1.08, 1.1, 1.1, 1.08, 1.08, 1.1];
  const attack = [1, 1.03, 1, 1.02, 1, 1, 1.02, 1, 1, 1, 1, 1];
  for (let i = 0; i < 12; i++) {
    const id = `S${String(i + 1).padStart(2, '0')}`,
      d = S.siteEnemyDefinition(id);
    const source = GUARDIANS[Math.floor(i / 2)][i % 2 ? 2 : 0];
    assert.equal(d.hp, Math.round(source.hp * hp[i]));
    assert.equal(d.attack, Math.round(source.attack * attack[i]));
    const weak = T.snapshotSiteCombat(
      recommendedFixture(d.region, d.node + 1, { bare: true }),
      id,
      'A',
      100,
    );
    const strong = T.snapshotSiteCombat(town(), id, 'A', 100);
    assert.equal(weak.enemyMaxHp, strong.enemyMaxHp);
    assert.equal(weak.enemyAttack, strong.enemyAttack);
    assert.equal(weak.enemyDefense, strong.enemyDefense);
  }
});

test('all 24 advertised situations produce their distinct bounded turn sequence', () => {
  const expected = [
    ['ward,strike,heavy', 'heavy,ward,strike,heavy'],
    ['strike,strike,strike', 'strike,heavy,strike'],
    ['ward,strike,restore', 'ward,strike,channel'],
    ['seal,strike,strike', 'restore,seal,strike,strike'],
    ['strike,heavy,strike', 'strike,heavy,strike'],
    ['flight,strike,heavy', 'flight,flight,strike,heavy,flight,strike'],
    ['ward,channel,strike', 'strike,ward,channel,strike'],
    ['seal,strike,strike', 'seal,channel,strike'],
    ['flight,strike,strike', 'flight,strike,heavy,strike'],
    ['restore,strike,channel,strike', 'ward,strike,channel,strike'],
    ['ward,strike,channel', 'ward,strike,channel'],
    ['seal,ward,channel,strike', 'heavy,seal,ward,channel,strike'],
  ];
  for (let i = 0; i < 12; i++)
    for (let v = 0; v < 2; v++) {
      const id = `S${String(i + 1).padStart(2, '0')}`,
        variant = v ? 'B' : 'A',
        pattern = expected[i][v].split(',');
      for (let r = 1; r <= pattern.length; r++) {
        const s = siteArena(id, variant, r);
        assert.equal(
          T.enemyIntent(s.battle).kind,
          pattern[r - 1],
          `${id}${variant} round ${r}`,
        );
        assert.ok(S.validSiteRuntime(s.battle));
      }
    }
  assert.equal(S.siteStepAt('S05', 'B', 2).step.burn, 2);
  assert.equal(S.siteStepAt('S11', 'B', 2).step.hits, 2);
});

test('departure and launch clone combat snapshot without paying twice or consuming global RNG', () => {
  const s = own(town(), 'R02', 2),
    before = clone(s);
  const snapshot = T.snapshotSiteCombat(s, 'S02', 'B', 1234);
  assert.deepEqual(s, before);
  assert.deepEqual(snapshot, T.snapshotSiteCombat(s, 'S02', 'B', 1234));
  const run = {
    combatSnapshot: snapshot,
    id: 7,
    siteId: 'S02',
    variant: 'B',
    automatic: true,
  };
  const b = T.createSiteBattle(s, run);
  assert.equal(b.site.runId, 7);
  assert.equal(b.auto, true);
  assert.deepEqual(s, before);
  assert.equal(snapshot.site.runId, 0);
  assert.equal(b.units[2].relic.id, 'R02');
  s.heroes[2].equipment = {};
  s.guild.preparation.stance = 'assault';
  s.guild.outposts[0] = 3;
  assert.deepEqual(T.createSiteBattle(s, run), b);
  b.units[2].hp = 1;
  assert.notEqual(snapshot.units[2].hp, 1);
});

test('a selected potion brewed after departure has frozen benefits but assault cannot start without real payment', () => {
  let s = town();
  s.guild.preparation.element = 'shadow';
  s.guild.potions.shadow = 0;
  const before = clone(s),
    dry = T.snapshotSiteCombat(s, 'S03', 'A', 123);
  const stocked = clone(s);
  stocked.guild.potions.shadow = 1;
  assert.deepEqual(dry, T.snapshotSiteCombat(stocked, 'S03', 'A', 123));
  assert.deepEqual(s, before);
  s = E.startSite(s, 'S03');
  assert.equal(s.guild.potions.shadow, 0);
  E.siteTick(s, s.worldExploration.activeRun.remaining);
  assert.equal(E.chooseSiteRoute(s, 'assault'), s);
  assert.match(E.siteRouteQuote(s, 'S03', 'assault').reason, /药剂/);
  assert.equal(G.craftPotionReason(s, 'shadow'), '');
  s = G.craftPotion(s, 'shadow');
  s = E.chooseSiteRoute(s, 'assault');
  assert.equal(s.guild.potions.shadow, 0);
  E.siteTick(s, s.worldExploration.activeRun.remaining);
  assert.deepEqual(
    s.battle.units.map((u) => u.resistance),
    dry.units.map((u) => u.resistance),
  );
  assert.ok(G.decodeSave(JSON.stringify(s)));
});

test('taking over a repeated site battle stops future runs while retaining the current encounter', () => {
  let s = own(town(), 'R02');
  s.guild.preparation.element = 'physical';
  s = E.setSiteRepeat(s, 'S02', {
    strategies: {
      A: { method: 'assault', rewardKind: 'basic' },
      B: { method: 'assault', rewardKind: 'basic' },
    },
    limit: 5,
    reserve: {},
    maxExtraCost: {},
    maxExtraMaterials: {},
  });
  assert.equal(s.worldExploration.activeRun.automatic, true);
  E.siteTick(s, s.worldExploration.activeRun.remaining);
  E.siteTick(s, s.worldExploration.activeRun.remaining);
  assert.equal(s.battle.auto, true);
  const runId = s.worldExploration.activeRun.id;
  s = T.setCombatAuto(s, false);
  assert.equal(s.worldExploration.repeatPlan.enabled, false);
  assert.equal(s.worldExploration.activeRun.id, runId);
  assert.equal(s.battle.auto, false);
  assert.equal(s.worldExploration.activeRun.phase, 'battle');
});

test('ward breaks once, channel counter exposure is consumed and cannot be refreshed by repeated breaks', () => {
  let s = siteArena('S01');
  assert.equal(s.battle.enemyShield, 10000);
  s = act(s, 'break');
  assert.equal(s.battle.enemyShield, 0);
  assert.equal(S.siteResolution(s.battle).armorScale, 0.8);
  S.prepareSiteRound(s.battle);
  assert.equal(s.battle.enemyShield, 0);
  s = siteArena('S07', 'A', 2);
  s = act(s, 'break');
  assert.equal(S.siteResolution(s.battle).attackScale, 1.8 * 0.3);
  assert.equal(s.battle.marked, 1);
  s = act(s, 'break', 1);
  assert.equal(s.battle.marked, 0);
  s = act(s, 'break', 2);
  assert.equal(s.battle.marked, 0);
  assert.equal(S.siteResolution(s.battle).burnRounds, 0);
});

test('seal lasts only its advertised round; healing returns next turn and restore is interruptible', () => {
  let s = siteArena('S04');
  unit(s).hp = 100;
  sync(s);
  assert.match(
    T.tacticalReason(s, T.commandFor(s.party[1], 'mortal_light', s.party[0])),
    /封/,
  );
  s = endRound(s);
  assert.equal(s.battle.sealed, 0);
  assert.equal(
    T.tacticalReason(s, T.commandFor(s.party[1], 'mortal_light', s.party[0])),
    '',
  );
  s = siteArena('S10');
  s.battle.enemyHp = 50000;
  const unbroken = endRound(clone(s));
  assert.equal(unbroken.battle.enemyHp, 60000);
  s = act(s, 'break');
  const damaged = s.battle.enemyHp;
  s = endRound(s);
  assert.equal(s.battle.enemyHp, damaged);
});

test('remembered prey and multi-hit highest-attack targeting remain deterministic and flight responds to interrupt', () => {
  let s = siteArena('S02');
  unit(s, 2).hp = 100;
  sync(s);
  s.battle.site.preparedRound = 0;
  S.prepareSiteRound(s.battle);
  assert.equal(s.battle.target, s.party[2]);
  s = endRound(s);
  assert.equal(s.battle.target, s.party[2]);
  s = siteArena('S11', 'B', 2);
  unit(s, 1).attack = 200;
  s.battle.site.preparedRound = 0;
  S.prepareSiteRound(s.battle);
  assert.equal(s.battle.target, s.party[1]);
  assert.equal(S.siteResolution(s.battle).hits, 2);
  const targetHp = unit(s, 1).hp;
  s = endRound(s);
  assert.ok(unit(s, 1).hp < targetHp);
  s = siteArena('S06');
  assert.equal(S.siteResolution(s.battle).flying, true);
  s = act(s, 'star_shatter', 2);
  assert.equal(S.siteResolution(s.battle).flying, false);
});

test('site victory preserves combat report, returns first, and never awards mainline depth or equipment', () => {
  let s = start();
  const before = {
    depths: [...s.guild.depths],
    cleared: [...s.cleared],
    inventory: clone(s.guild.inventory),
    xp: s.heroes.map((h) => h.xp),
  };
  s.battle.enemyHp = 1;
  s.battle.enemyShield = 0;
  s.battle.enemyDodge = 0;
  s = act(s, 'attack');
  assert.equal(s.battle, null);
  assert.equal(s.lastBattle.kind, 'site');
  assert.equal(s.lastBattle.won, true);
  assert.equal(s.worldExploration.activeRun.phase, 'returning');
  assert.equal(s.worldExploration.sites.S01.firstCompleted, false);
  assert.deepEqual(s.guild.depths, before.depths);
  assert.deepEqual(s.cleared, before.cleared);
  assert.deepEqual(s.guild.inventory, before.inventory);
  assert.deepEqual(
    s.heroes.map((h) => h.xp),
    before.xp,
  );
  assert.ok(G.decodeSave(JSON.stringify(s)));
  E.siteTick(s, s.worldExploration.activeRun.remaining);
  assert.equal(s.worldExploration.activeRun, null);
  assert.equal(s.worldExploration.relics.owned.R01.repaired, false);
  assert.equal(s.lastBattle.kind, 'site');
  assert.equal(s.lastBattle.loot, null);
  assert.ok(G.decodeSave(JSON.stringify(s)));
});

test('site retreat closes only its run and never grants first clear or rerolls through reload', () => {
  let s = start('S02');
  const run = clone(s.worldExploration.activeRun),
    resources = clone(s.resources);
  const reload = G.decodeSave(JSON.stringify(s));
  assert.deepEqual(reload.battle, s.battle);
  s = T.tacticalCombat(s, 'retreat');
  assert.equal(s.battle, null);
  assert.equal(s.worldExploration.activeRun, null);
  assert.equal(s.worldExploration.sites.S02.firstCompleted, false);
  assert.equal(s.worldExploration.relics.owned.R02, undefined);
  assert.equal(s.lastBattle.retreated, true);
  assert.equal(s.lastBattle.siteId, run.siteId);
  assert.deepEqual(s.resources, resources);
  assert.ok(G.decodeSave(JSON.stringify(s)));
});

test('twelve side enemies keep naked reference wins at zero and allow the legal reference to fight back', () => {
  const results = [],
    failed = [];
  for (let i = 0; i < 12; i++)
    for (const variant of ['A', 'B']) {
      const id = `S${String(i + 1).padStart(2, '0')}`,
        d = S.siteEnemyDefinition(id);
      let equipped = 0,
        naked = 0;
      for (const bare of [false, true])
        for (const seed of difficultySeeds(8)) {
          let s = recommendedFixture(d.region, d.node + 1, { bare });
          s.battle = T.snapshotSiteCombat(s, id, variant, seed);
          let actions = 0;
          while (s.battle && actions++ < 400) {
            const c = T.autoCommand(s);
            assert.equal(T.tacticalReason(s, c), '');
            s = T.tacticalCombat(s, c, true);
          }
          assert.ok(actions < 400, `${id}${variant} cannot loop forever`);
          if (s.lastBattle.won) {
            if (bare) naked++;
            else equipped++;
          }
        }
      results.push(`${id}${variant}: equipped ${equipped}/8, naked ${naked}/8`);
      if (naked) failed.push(`${id}${variant} naked won ${naked}/8`);
      if (!equipped) {
        let manual = 0;
        for (const seed of difficultySeeds(8)) {
          let s = recommendedFixture(d.region, d.node + 1);
          s.battle = T.snapshotSiteCombat(s, id, variant, seed);
          let actions = 0;
          while (s.battle && actions++ < 400)
            s = T.tacticalCombat(s, carefulCommand(s), true);
          if (s.lastBattle.won) manual++;
        }
        if (!manual)
          failed.push(
            `${id}${variant} legal reference cannot win even with defensive decisions`,
          );
      }
    }
  console.log(results.join('\n'));
  assert.deepEqual(failed, []);
});
