'use client';

import '@/app/expedition-art.css';
import { EnemyPortrait, HeroPortrait, RegionScene } from './game-art';
import { useState } from 'react';
import * as G from '@/lib/realm';
import { InfoHint } from './info-hint';
import type { Act } from './realm-panels';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from './ui/dialog';

/** The engine owns personal actions, complete rounds and automatic stepping. */
export function BattleDesk({ s, act }: { s: G.State; act: Act }) {
  const [showHistory, setShowHistory] = useState(false);
  if (!s.battle) return null;
  const b = s.battle;
  const selected = b.units.find((u) => u.id === b.selected) || b.units[0];
  const intent = G.enemyIntent(b);
  const currentArmor =
    b.enemyDefense * (b.boss ? G.bossResolution(b).armorScale : 1);
  const target = b.units.find((u) => u.id === (b.taunt || b.target));
  const living = b.units.filter((u) => u.hp > 0);
  const roleName = (role: string) =>
    G.HEROES.find((h) => h.id === role)?.role || '旅人';
  const number = (n: number) =>
    Math.max(0, Math.round(n)).toLocaleString('zh-CN');
  const pct = (n: number, max: number) =>
    Math.min(100, Math.max(0, (n / Math.max(1, max)) * 100));
  const skills = selected ? G.combatSkills(s, selected.id) : [];
  // Manual input pauses automatic execution before issuing exactly one action.
  const execute = (command: G.Command) =>
    act((current) =>
      G.combat(
        command === 'retreat' ? current : G.setCombatAuto(current, false),
        command,
      ),
    );
  const commands = selected
    ? [
        {
          id: 'attack',
          label: '攻击',
          help: '由当前角色造成100%个人攻击倍率的伤害，恢复1士气，可暴击。护甲、穿甲、远程与敌方意图会影响实际伤害。',
        },
        {
          id: 'guard',
          label: '防守',
          help: '本人当轮承伤降低75%，恢复1士气；众盾成阵再多恢复1点，受击后以40%攻击反击，每敌方阶段1次。林间守望与铁壁军阵四件能进一步利用防守。',
        },
        {
          id: 'break',
          label: '破势',
          help: '消耗2士气，造成85%个人攻击倍率伤害；打断本轮咏唱或恢复，并拆除结界。深渊四件可引爆本人燃烧，龙痕四件为队友留下猎痕。',
        },
        {
          id: 'heal',
          label: '补给',
          help: '向所选援护目标使用携行补给；自动目标为生命比例最低的存活伙伴。本人穿戴沉钟四件时，溢出治疗可变为护盾，因此也可在满血时提前准备。',
        },
      ]
    : [];
  const history = (
    <ol className="battle-history-list" aria-label="逐步战报">
      {b.history.map((line, index) => (
        <li key={`${index}:${line}`}>{line}</li>
      ))}
    </ol>
  );

  return (
    <section className="battle-desk" aria-label="战斗">
      <header className="battle-heading">
        <div>
          <span className="battle-location">{G.REGIONS[b.region].name}</span>
          <strong>
            {b.kind === 'guardian' ? `第 ${b.node + 1} 据点守卫` : '首领决战'}
          </strong>
        </div>
        <span>
          第 <strong>{b.round}</strong> 回合
        </span>
      </header>

      <div className="battle-content">
        <div className="battle-stage">
          <section
            className={`battle-enemy${b.boss ? ' battle-enemy-boss' : ''}`}
            aria-label="敌方生命"
          >
            <RegionScene region={b.region} className="battle-region-scene" />
            <span className="battle-enemy-portrait" aria-hidden="true">
              <EnemyPortrait
                region={b.region}
                node={b.kind === 'guardian' ? b.node : 5}
                size={b.boss ? 'lg' : 'md'}
              />
            </span>
            <div className="battle-enemy-detail">
              {b.boss && (
                <div className="boss-phase-line">
                  <InfoHint
                    title={G.bossDefinition(b.region).name}
                    body={G.bossDefinition(b.region).lesson}
                  >
                    <strong>
                      阶段 {b.boss.phase} ·{' '}
                      {G.bossDefinition(b.region).phaseNames[b.boss.phase - 1]}
                    </strong>
                  </InfoHint>
                  <span>
                    {b.boss.phase === 1 ? '半血后于下回合变招' : '终阶段'}
                  </span>
                </div>
              )}
              <div className="battle-enemy-line">
                <InfoHint
                  title={b.enemyName}
                  body={`${G.ELEMENT_NAMES[b.enemyElement]}伤害 · 基础攻击 ${number(b.enemyAttack)} · 本轮护甲 ${currentArmor.toFixed(1)}\n单体暴击 ${Math.round(b.enemyCrit * 100)}% · 闪避 ${Math.round(b.enemyDodge * 100)}%。群体重击不暴击、不能闪避；31回合起逐步狂怒。`}
                >
                  <strong>{b.enemyName}</strong>
                </InfoHint>
                <span>
                  {number(b.enemyHp)} / {number(b.enemyMaxHp)}
                </span>
              </div>
              <progress
                className="battle-hp-track enemy"
                aria-label={`${b.enemyName}生命`}
                max={b.enemyMaxHp}
                value={Math.max(0, b.enemyHp)}
              />
              <div
                className={`battle-intent${intent.heavy ? ' dangerous' : ''}`}
              >
                <InfoHint title={`敌方意图：${intent.name}`} body={intent.hint}>
                  <strong>{intent.name}</strong>
                </InfoHint>
                <span>
                  {intent.heavy
                    ? '攻击全体'
                    : target
                      ? `盯住 ${target.name}`
                      : '敌方准备行动'}
                </span>
              </div>
              {b.enemyShield > 0 && (
                <div className="boss-barrier">
                  <span>结界 {number(b.enemyShield)} · 破盾可拆除</span>
                  <progress
                    aria-label="首领结界"
                    max={b.enemyMaxHp * 0.08}
                    value={b.enemyShield}
                  />
                </div>
              )}
              {!!b.dots?.length && (
                <small className="boss-dots">
                  {b.dots
                    .map(
                      (e) =>
                        `${b.units.find((u) => u.id === e.source)?.name} · ${e.kind === 'fire' ? '燃烧' : '毒伤'} ${e.damage}×${e.turns}轮`,
                    )
                    .join(' / ')}
                </small>
              )}
            </div>
          </section>

          <div className="battle-units" aria-label="参战伙伴，选择行动者">
            {b.units.map((unit) => {
              const hero = s.heroes.find((h) => h.id === unit.id);
              const unitSkills = G.combatSkills(s, unit.id);
              const acted = b.acted.includes(unit.id);
              const down = unit.hp <= 0;
              const statuses = [
                unit.shield > 0 ? `护盾 ${number(unit.shield)}` : '',
                unit.ward > 0 ? '护佑' : '',
                unit.burn > 0 ? '灼烧' : '',
                unit.regenTurns > 0 ? '持续恢复' : '',
                unit.guard < 1 ? '防守中' : '',
                unit.setEffect?.stored
                  ? `蓄力 ${number(unit.setEffect.stored)}`
                  : '',
                unit.setEffect?.weakness
                  ? `猎痕 ${unit.setEffect.weakness}`
                  : '',
              ]
                .filter(Boolean)
                .join(' · ');
              const status = down
                ? '倒下'
                : acted
                  ? '已行动'
                  : unit.id === b.selected
                    ? '行动者'
                    : '待行动';
              return (
                <button
                  type="button"
                  key={unit.id}
                  className={`battle-unit${unit.id === b.selected ? ' selected' : ''}${acted ? ' acted' : ''}${down ? ' down' : ''}${!intent.heavy && unit.id === target?.id ? ' targeted' : ''}`}
                  aria-pressed={unit.id === b.selected}
                  aria-disabled={down || acted}
                  aria-label={`${unit.name}，${roleName(unit.role)}，生命 ${number(unit.hp)} / ${number(unit.maxHp)}，${status}${statuses ? '，' + statuses : ''}`}
                  onClick={() => {
                    if (!down && !acted)
                      act((current) =>
                        G.selectCombatUnit(
                          G.setCombatAuto(current, false),
                          unit.id,
                        ),
                      );
                  }}
                >
                  <span className="battle-unit-identity">
                    <span className="battle-hero-portrait" aria-hidden="true">
                      <HeroPortrait
                        hero={
                          hero || {
                            id: unit.id,
                            name: unit.name,
                            role: unit.role,
                            quality: 1,
                          }
                        }
                        size="sm"
                      />
                    </span>
                    <span className="battle-unit-name">
                      <InfoHint
                        withinControl
                        title={`${unit.name} · ${roleName(unit.role)}`}
                        body={`${status}。${statuses || '没有额外状态'}。\n攻击 ${number(unit.attack)} · 防御 ${number(unit.defense)} · 暴击 ${Math.round(unit.crit * 100)}% · 闪避 ${Math.round(unit.dodge * 100)}%\n${G.setEffectHelp(unit)}`}
                      >
                        <strong className={'potential-' + (hero?.quality || 1)}>
                          {unit.name}
                        </strong>
                      </InfoHint>
                      <small>{status}</small>
                    </span>
                  </span>
                  <span className="battle-unit-health">
                    {number(unit.hp)} <small>/ {number(unit.maxHp)}</small>
                  </span>
                  <span className="battle-hp-track" aria-hidden="true">
                    <span style={{ width: `${pct(unit.hp, unit.maxHp)}%` }} />
                  </span>
                  <span className="battle-unit-cooldowns">
                    {unitSkills.map((skill) => (
                      <InfoHint
                        withinControl
                        key={skill.id}
                        title={`${unit.name} · ${skill.name}`}
                        body={`${skill.description}\n${unit.cooldowns[skill.id] > 0 ? `还需 ${unit.cooldowns[skill.id]} 回合冷却。` : '冷却已就绪；行动还需满足士气、回合与补给条件。'}`}
                      >
                        <span
                          className={
                            unit.cooldowns[skill.id] > 0 ? 'cooling' : ''
                          }
                        >
                          <span className="battle-cd-name">{skill.name}</span>
                          <b>
                            {unit.cooldowns[skill.id] > 0
                              ? unit.cooldowns[skill.id]
                              : '✓'}
                          </b>
                        </span>
                      </InfoHint>
                    ))}
                  </span>
                  <InfoHint
                    withinControl
                    className="battle-unit-status"
                    title={`${unit.name} · 当前状态`}
                    body={`${roleName(unit.role)}\n${statuses || '没有额外状态'}\n攻击 ${number(unit.attack)} · 防御 ${number(unit.defense)} · 暴击 ${Math.round(unit.crit * 100)}% · 闪避 ${Math.round(unit.dodge * 100)}%`}
                  >
                    {unit.burn > 0
                      ? '灼烧'
                      : unit.shield > 0
                        ? `盾 ${number(unit.shield)}`
                        : unit.guard < 1
                          ? '防守中'
                          : unit.ward > 0
                            ? '护佑'
                            : unit.regenTurns > 0
                              ? '持续恢复'
                              : roleName(unit.role)}
                  </InfoHint>
                </button>
              );
            })}
          </div>

          <div className="battle-command-heading">
            <strong>{selected?.name || '等待行动'}</strong>
            <span>
              士气 <b>{b.energy}/10</b>
            </span>
            <span>
              补给 <b>{b.supplies}</b>
            </span>
            <label className="battle-heal-target">
              <span>援护目标</span>
              <select
                value={
                  living.some((unit) => unit.id === b.healTarget)
                    ? b.healTarget
                    : ''
                }
                onChange={(event) =>
                  act((current) =>
                    G.selectHealTarget(current, event.target.value),
                  )
                }
              >
                <option value="">自动 · 最低血比例</option>
                {living.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name} · {number(unit.hp)}/{number(unit.maxHp)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="battle-actions" aria-label="当前角色行动">
            {commands.map((action) => {
              const command = G.commandFor(selected!.id, action.id);
              const reason = G.commandReason(s, command);
              return (
                <div className="battle-action-cell" key={action.id}>
                  <InfoHint title={action.label} body={action.help}>
                    <span>{action.label}</span>
                  </InfoHint>
                  <button
                    type="button"
                    disabled={!!reason}
                    onClick={() => execute(command)}
                    aria-label={`${selected!.name}：${action.label}${reason ? '，' + reason : ''}`}
                  >
                    {reason || '执行'}
                  </button>
                </div>
              );
            })}
            {skills.map((skill) => {
              const command = G.commandFor(selected!.id, skill.id);
              const reason = G.commandReason(s, command);
              return (
                <div className="battle-action-cell skill" key={skill.id}>
                  <InfoHint
                    title={skill.name}
                    body={`${skill.description}\n消耗 ${skill.energy} 士气，基础冷却 ${skill.cooldown} 回合；个人剩余冷却显示在伙伴血条下。`}
                  >
                    <span>{skill.name}</span>
                  </InfoHint>
                  <button
                    type="button"
                    disabled={!!reason}
                    onClick={() => execute(command)}
                    aria-label={`${selected!.name}：${skill.name}${reason ? '，' + reason : ''}`}
                  >
                    {reason || `${skill.energy} 士气 · 施放`}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="battle-action-note">
            {b.auto
              ? s.paused
                ? '游戏已暂停 · 底栏继续后自动出招'
                : s.hunt?.enabled
                  ? '连续刷怪中 · 手动出招会结束连刷'
                  : '自动中 · 手动出招会暂停自动'
              : '选择伙伴与查看说明不会推进回合'}
          </p>
        </div>

        <aside className="battle-history">
          <div className="battle-history-heading">
            <strong>逐步战报</strong>
            <span>每次行动可追溯</span>
          </div>
          {history}
        </aside>
      </div>

      <footer className="battle-controls">
        <button
          type="button"
          className={`battle-auto${b.auto ? ' enabled' : ''}`}
          aria-pressed={b.auto}
          onClick={() =>
            act((current) => G.setCombatAuto(current, !current.battle?.auto))
          }
        >
          {b.auto ? (s.hunt?.enabled ? '手动接管' : '暂停自动') : '开启自动'}
        </button>
        <button
          type="button"
          onClick={() =>
            act((current) => {
              const paused = G.setCombatAuto(current, false);
              return G.combat(paused, G.recommendedCommand(paused));
            })
          }
        >
          建议一步
        </button>
        <button
          type="button"
          className="battle-history-trigger"
          onClick={() => setShowHistory(true)}
        >
          战报
        </button>
        <button
          type="button"
          className="battle-retreat"
          onClick={() => execute('retreat')}
        >
          撤退
        </button>
      </footer>

      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="v21-ui life-dialog battle-history-dialog">
          <DialogTitle>{b.enemyName} · 战报</DialogTitle>
          <DialogDescription>
            查看战报不会执行手动行动。自动开启时战斗仍会继续，可先暂停自动。
          </DialogDescription>
          {history}
        </DialogContent>
      </Dialog>
    </section>
  );
}
