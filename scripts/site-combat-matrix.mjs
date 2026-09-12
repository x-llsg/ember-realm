import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as T from '../lib/tactics.ts';
import * as S from '../lib/site-combat.ts';
import { difficultySeeds, recommendedFixture } from './difficulty-fixtures.mjs';

/** Manual reference policy uses only this round's public target and damage forecast. */
export function carefulCommand(s) {
  const base = T.autoCommand(s),
    b = s.battle,
    w = T.enemyIntent(b);
  if (!w.heavy) return base;
  const [, id, action] = base.split(':'),
    u = b.units.find((x) => x.id === id);
  const skill = T.combatSkills(s, id).find((x) => x.id === action);
  // Do not have an exposed support spend its only action protecting somebody else.
  const target = base.split(':')[3] || b.healTarget;
  const protectsSelf =
    skill &&
    (skill.target === 'party' ||
      skill.target === 'self' ||
      (skill.target === 'ally' && target === id)) &&
    (skill.wardHits || skill.shield || skill.incomingMultiplier);
  const projected =
    T.incomingDamage(s, u) * (S.siteResolution(b)?.hits || 1) - u.shield;
  if (
    action !== 'guard' &&
    !protectsSelf &&
    projected > u.hp * 0.45 &&
    !T.tacticalReason(s, T.commandFor(id, 'guard'))
  )
    return T.commandFor(id, 'guard');
  return base;
}
export function runSiteMatrix(count = 100) {
  const rows = [],
    failures = [];
  for (let i = 0; i < 12; i++)
    for (const variant of ['A', 'B']) {
      const id = `S${String(i + 1).padStart(2, '0')}`,
        d = S.siteEnemyDefinition(id);
      const row = {
        id,
        variant,
        region: d.region,
        referenceNode: d.node + 1,
        samples: count,
      };
      const fixtures = {
        naked: recommendedFixture(d.region, d.node + 1, { bare: true }),
        auto: recommendedFixture(d.region, d.node + 1),
        manual: recommendedFixture(d.region, d.node + 1),
        ignore: recommendedFixture(d.region, d.node + 1),
        developed: recommendedFixture(5, 6),
      };
      for (const [mode, fixture] of Object.entries(fixtures)) {
        let wins = 0,
          rounds = 0;
        for (const seed of difficultySeeds(count)) {
          let s = structuredClone(fixture);
          s.battle = T.snapshotSiteCombat(s, id, variant, seed);
          let actions = 0;
          while (s.battle && actions++ < 400) {
            const c =
              mode === 'manual'
                ? carefulCommand(s)
                : mode === 'ignore'
                  ? T.commandFor(s.battle.selected, 'attack')
                  : T.autoCommand(s);
            assert.equal(T.tacticalReason(s, c), '');
            s = T.tacticalCombat(s, c, true);
          }
          assert.ok(actions < 400, `${id}${variant} cannot loop forever`);
          wins += Number(s.lastBattle.won);
          rounds += s.lastBattle.rounds;
          if (
            !s.lastBattle.won &&
            mode !== 'naked' &&
            failures.filter(
              (x) => x.id === id && x.variant === variant && x.mode === mode,
            ).length < 2
          )
            failures.push({ id, variant, mode, seed, report: s.lastBattle });
        }
        row[mode] = { wins, meanRounds: Number((rounds / count).toFixed(2)) };
      }
      assert.equal(row.naked.wins, 0, `${id}${variant} naked reference won`);
      rows.push(row);
      console.log(
        `${id}${variant}: naked ${row.naked.wins}, auto ${row.auto.wins}, careful ${row.manual.wins}, ignore ${row.ignore.wins}, overlevel ${row.developed.wins} / ${count}`,
      );
    }
  return {
    kind: 'constructed-fixtures-not-playthrough',
    samplesPerSituation: count,
    modes: {
      naked: '参考阶段裸装自动',
      auto: '参考合法配装自动',
      manual: '相同配装，按当前预告保护行动者',
      ignore: '参考配装仅普攻，忽略反制与防守',
      developed: '第六章首领合法推荐练度自动，用于显著超练度对照，未加新遗物',
    },
    rows,
    failures,
  };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const report = runSiteMatrix(Number(process.env.SITE_MATRIX_SAMPLES) || 100);
  fs.mkdirSync('.test-results', { recursive: true });
  fs.writeFileSync(
    '.test-results/v03-site-difficulty.json',
    JSON.stringify(report, null, 2),
  );
}
