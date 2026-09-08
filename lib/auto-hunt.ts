import * as G from './realm.ts';

export type HuntKind = 'guardian' | 'boss';
export interface HuntState {
  enabled: boolean;
  region: number;
  kind: HuntKind;
  node: number;
  wins: number;
  drops: number;
  reason: string;
}
export const freshHunt = (): HuntState => ({
  enabled: false, region: 0, kind: 'guardian', node: 0, wins: 0, drops: 0, reason: '',
});

function targetReason(s: G.State, region: number, kind: HuntKind, node: number) {
  if (!Number.isInteger(region) || region < 0 || region >= G.REGIONS.length ||
      !['guardian', 'boss'].includes(kind) || !Number.isInteger(node) || node < 0 || node > 4)
    return '请选择有效的刷怪目标';
  if (!G.regionOpen(s, region)) return '尚未发现通往这里的道路';
  if (kind === 'boss' ? !s.cleared.includes(region) : !G.guardianRematch(s, region, node))
    return kind === 'boss' ? '击败这个首领后，才能连续挑战其残响' : '先亲自击败这个据点的守敌，才能连续刷取';
  return '';
}

/** Starting can queue through normal cooldown/recovery, but never through missing supplies. */
export function huntReason(s: G.State, region: number, kind: HuntKind, node = 0) {
  const target = targetReason(s, region, kind, node);
  if (target) return target;
  // These temporary views only suppress time gates; all normal party, potion,
  // capacity, progression and payment checks remain owned by battle preparation.
  const ready: G.State = {
    ...s, recoveryUntil: 0,
    guild: {
      ...s.guild,
      guardianHunts: { readyAt: [0, 0, 0, 0, 0, 0] },
      bossHunts: { wins: s.guild.bossHunts?.wins || [0, 0, 0, 0, 0, 0], readyAt: [0, 0, 0, 0, 0, 0] },
    },
  };
  return kind === 'boss' ? G.bossReason(ready, region) : G.guardianReason(ready, region, node);
}

export function huntBattleMatches(s: G.State, b = s.battle) {
  const h = s.hunt;
  return !!(h && b?.hunt && b.region === h.region && b.kind === h.kind &&
    (h.kind === 'boss' || b.node === h.node));
}

export function huntStatus(s: G.State): {
  enabled: boolean; target: string; phase: 'fighting' | 'waiting' | 'stopped';
  wait: number; reason: string; wins: number; drops: number;
} {
  const h = s.hunt || freshHunt();
  const ready = h.kind === 'boss' ? s.guild.bossHunts?.readyAt[h.region] : s.guild.guardianHunts?.readyAt[h.region];
  const wait = Math.max(0, Math.ceil(Math.max(ready || 0, s.recoveryUntil) - s.time));
  const fighting = huntBattleMatches(s);
  return {
    enabled: h.enabled,
    target: `${G.REGIONS[h.region].name} · ${G.enemyDefinition(s, h.region, h.kind, h.node).name}`,
    phase: h.enabled ? (fighting ? 'fighting' : 'waiting') : 'stopped',
    wait: h.enabled && !fighting ? wait : 0,
    reason: h.reason, wins: h.wins, drops: h.drops,
  };
}

/** Internal mutation helper: one halt produces one visible explanation. */
export function haltHunt(s: G.State, reason: string) {
  if (!s.hunt?.enabled) return;
  s.hunt.enabled = false;
  s.hunt.reason = reason;
  G.log(s, `连续刷怪已停止：${reason}。本轮 ${s.hunt.wins} 胜，装备 ${s.hunt.drops} 件。`);
}

export function startHunt(s0: G.State, region: number, kind: HuntKind, node = 0) {
  if (huntReason(s0, region, kind, node)) return s0;
  const s = G.clone(s0);
  s.hunt = { enabled: true, region, kind, node, wins: 0, drops: 0, reason: '' };
  s.order.enabled = false;
  s.order.reason = '已改为连续刷怪';
  G.log(s, `开始连续刷怪：${huntStatus(s).target}。每场照常消耗补给，等待重整后再次挑战。`);
  return s.paused ? s : huntTick(s);
}

export function stopHunt(s0: G.State) {
  if (!s0.hunt?.enabled) return s0;
  const s = G.clone(s0);
  haltHunt(s, s.battle ? '已手动停刷，当前战斗继续' : '已手动停刷');
  return s;
}

/** Called at whole game-second boundaries, before the normal combat action. */
export function huntTick(s: G.State) {
  const h = s.hunt;
  if (!h?.enabled) return s;
  if (s.battle) {
    if (!huntBattleMatches(s)) haltHunt(s, '队伍已进入其他战斗');
    return s;
  }
  const reason = huntReason(s, h.region, h.kind, h.node);
  if (reason) { haltHunt(s, reason); return s; }
  if (huntStatus(s).wait) return s;
  const next = G.beginBattle(s, h.region, h.kind, h.node, 'hunt');
  if (next.battle) {
    next.battle.hunt = true;
    next.battle.auto = true;
  } else haltHunt(s, '出战条件已变化，请检查队伍与补给');
  return next;
}

/** Track actual settlement; do not infer drops from odds or grant extra rewards. */
export function finishHuntBattle(s: G.State, b: G.Battle, won: boolean, retreat: boolean) {
  if (!huntBattleMatches(s, b)) return;
  const h = s.hunt!;
  if (won) {
    h.wins++;
    if (s.lastBattle?.loot?.outcome === 'stored') h.drops++;
    if (h.enabled) {
      const reason = huntReason(s, h.region, h.kind, h.node);
      if (reason) haltHunt(s, reason);
    }
  } else haltHunt(s, retreat ? '已主动撤退' : '本场战败，请调整队伍后重新开始');
}

export function validateHunt(s: G.State) {
  if (s.hunt === undefined) s.hunt = freshHunt();
  const h = s.hunt;
  const integer = (v: unknown, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max;
  if (!h || typeof h !== 'object' || Array.isArray(h) ||
      typeof h.enabled !== 'boolean' || !integer(h.region, 5) ||
      !['guardian', 'boss'].includes(h.kind) || !integer(h.node, 4) ||
      !integer(h.wins, 1e8) || !integer(h.drops, h.wins) ||
      typeof h.reason !== 'string' || h.reason.length > 300 ||
      (s.battle?.hunt !== undefined && typeof s.battle.hunt !== 'boolean') ||
      (s.battle?.hunt && (!huntBattleMatches(s) || targetReason(s, h.region, h.kind, h.node))) ||
      (h.enabled && (h.reason !== '' || s.expedition || s.order.enabled ||
        targetReason(s, h.region, h.kind, h.node) ||
        (s.battle && (!huntBattleMatches(s) || !s.battle.auto)))))
    throw Error('连续刷怪记录无效');
}
