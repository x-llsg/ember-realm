import type { Battle } from './realm.ts';
import type { CombatUnit } from './tactics.ts';
import { EQUIPMENT_SETS } from './equipment-data.ts';
import {
  absorbBossBarrier,
  bossPlayerDamageScale,
  bossResolution,
} from './boss-mechanics.ts';

/** Frozen at departure. Missing fields mean a pre-V0.2 battle and grant no new effects. */
export interface SetEffect {
  id: string;
  round: number;
  triggered: boolean;
  stored: number;
  weakness: number;
  sealWardRound: number;
}
export const createSetEffect = (id: string): SetEffect => ({
  id,
  round: 0,
  triggered: false,
  stored: 0,
  weakness: 0,
  sealWardRound: 0,
});
export const hasSet = (u: CombatUnit, id: string) => u.setEffect?.id === id;
function note(b: Battle, message: string) {
  b.history.unshift(`第 ${b.round} 回合 · ${message}`);
  b.history = b.history.slice(0, 35);
}
function once(b: Battle, u: CombatUnit) {
  const effect = u.setEffect!;
  if (effect.round !== b.round) {
    effect.round = b.round;
    effect.triggered = false;
  }
  if (effect.triggered) return false;
  effect.triggered = true;
  return true;
}
export function setShield(
  b: Battle,
  target: CombatUnit,
  amount: number,
  rounds = 2,
) {
  const previous = target.shield;
  target.shield = Math.max(
    target.shield,
    Math.min(Math.round(target.maxHp * 0.6), Math.round(amount)),
  );
  if (target.shield > previous) {
    target.shieldTurns = Math.max(target.shieldTurns, rounds);
    note(b, `${target.name}获得 ${target.shield - previous} 护盾。`);
  }
}
export function overflowShield(
  b: Battle,
  source: CombatUnit | undefined,
  target: CombatUnit,
  excess: number,
) {
  if (source && hasSet(source, 'nightbell') && excess > 0)
    setShield(b, target, Math.min(target.maxHp * 0.2, excess * 0.5));
}
export function canPrepareOverflow(source: CombatUnit, target: CombatUnit) {
  return (
    hasSet(source, 'nightbell') &&
    target.shield < Math.round(target.maxHp * 0.2)
  );
}
/** Additional damage respects armor, flying/ward mechanics and barriers; never recursively procs. */
export function responseDamage(
  b: Battle,
  u: CombatUnit,
  amount: number,
  label: string,
) {
  const kind = b.pattern[(b.round - 1) % b.pattern.length];
  let scale =
    100 /
    (100 +
      b.enemyDefense *
        (b.boss ? bossResolution(b).armorScale : 1) *
        (1 - u.pierce));
  scale *= b.bonus;
  scale *= b.boss
    ? bossPlayerDamageScale(b, false, u.ranged)
    : kind === 'flight'
      ? 0.25 + 0.75 * u.ranged
      : kind === 'ward' && !b.shattered
        ? 0.4
        : 1;
  const hit = absorbBossBarrier(
    b.enemyShield,
    Math.max(1, Math.round(amount * scale)),
  );
  b.enemyShield = hit.remaining;
  b.enemyHp = Math.max(0, b.enemyHp - hit.hpDamage);
  note(
    b,
    `${u.name} · ${label}造成 ${hit.hpDamage} 伤害${hit.absorbed ? `，结界吸收 ${hit.absorbed}` : ''}。`,
  );
}
export function afterSetHit(
  b: Battle,
  u: CombatUnit,
  dodged: boolean,
  protectedHit: boolean,
  damage: number,
) {
  if (u.hp <= 0) return;
  if (hasSet(u, 'wildwatch') && (dodged || protectedHit) && once(b, u))
    responseDamage(b, u, u.attack * 0.45, '林间还击');
  if (hasSet(u, 'ironvow') && protectedHit && !dodged && damage > 0) {
    u.setEffect!.stored = Math.min(
      Math.round(u.attack * 0.8),
      u.setEffect!.stored + Math.round(damage * 0.5),
    );
    note(b, `${u.name} · 铁壁蓄力 ${u.setEffect!.stored}。`);
  }
}
export function takeStoredPower(u: CombatUnit) {
  if (!hasSet(u, 'ironvow')) return 0;
  const amount = u.setEffect!.stored;
  u.setEffect!.stored = 0;
  return amount;
}
export function consumeWeakness(b: Battle, u: CombatUnit) {
  const source = b.units.find(
    (x) =>
      x.id !== u.id && hasSet(x, 'dragonscar') && x.setEffect!.weakness > 0,
  );
  if (!source) return 0;
  source.setEffect!.weakness--;
  note(b, `${u.name}利用${source.name}留下的猎痕，额外穿甲15%。`);
  return 0.15;
}
export function leaveWeakness(b: Battle, u: CombatUnit) {
  if (!hasSet(u, 'dragonscar')) return;
  for (const friend of b.units)
    if (friend.setEffect) friend.setEffect.weakness = 0;
  u.setEffect!.weakness = 2;
  note(b, `${u.name}留下2次猎痕，供其他队友穿甲。`);
}
export function igniteSet(b: Battle, u: CombatUnit) {
  if (!hasSet(u, 'abysswalk')) return;
  b.dots ||= [];
  const existing = b.dots.find((e) => e.source === u.id && e.kind === 'fire');
  const damage = Math.round(u.attack * 0.2);
  if (existing) {
    existing.damage = Math.max(existing.damage, damage);
    existing.turns = Math.max(existing.turns, 2);
  } else b.dots.push({ source: u.id, kind: 'fire', damage, turns: 2 });
  note(b, `${u.name}的深渊余火延续燃烧。`);
}
export function firePotential(b: Battle, u: CombatUnit, shared = false) {
  return (b.dots || [])
    .filter((e) => e.kind === 'fire' && (shared || e.source === u.id))
    .reduce((total, e) => total + e.damage * e.turns, 0);
}
export function detonateFire(b: Battle, u: CombatUnit, shared = false) {
  const amount = Math.min(u.attack * 1.2, firePotential(b, u, shared) * 0.8);
  if (!amount) return;
  b.dots = (b.dots || []).filter(
    (e) => e.kind !== 'fire' || (!shared && e.source !== u.id),
  );
  // DOT damage is already snapshotted and ignores armor; detonation keeps that contract.
  const hit = absorbBossBarrier(b.enemyShield, Math.round(amount));
  b.enemyShield = hit.remaining;
  b.enemyHp = Math.max(0, b.enemyHp - hit.hpDamage);
  note(
    b,
    `${u.name}引爆${shared ? '队伍' : '本人'}燃烧造成 ${hit.hpDamage} 伤害，消耗全部对应余火。`,
  );
}
export function dawnResponse(b: Battle, u: CombatUnit, cleansedSeal: boolean) {
  if (!hasSet(u, 'dawnbreak')) return;
  if (cleansedSeal) {
    b.sealed = 0;
    u.setEffect!.sealWardRound = b.round;
  }
  if (!once(b, u)) return;
  note(
    b,
    `${u.name} · 破晓逆律${cleansedSeal ? '解除治疗封印，并' : ''}守护全队。`,
  );
  for (const friend of b.units.filter((x) => x.hp > 0))
    setShield(
      b,
      friend,
      Math.min(friend.maxHp * 0.15, u.maxHp * 0.04 + u.attack * 0.45),
    );
}
export const sealPurified = (b: Battle) =>
  b.units.some(
    (u) => hasSet(u, 'dawnbreak') && u.setEffect!.sealWardRound === b.round,
  );
export function setEffectHelp(u: CombatUnit) {
  if (!u.setEffect) return '';
  const set = EQUIPMENT_SETS.find((x) => x.id === u.setEffect!.id)!;
  return `${set.name} · 四件已激活\n${set.text}${u.setEffect.stored ? `\n已蓄力 ${u.setEffect.stored}。` : ''}${u.setEffect.weakness ? `\n猎痕剩余 ${u.setEffect.weakness} 次。` : ''}`;
}
export function validSetEffect(value: unknown, round: number, attack: number) {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const x = value as SetEffect;
  const int = (n: number, max: number) =>
    Number.isInteger(n) && n >= 0 && n <= max;
  return (
    Object.keys(x).length === 6 &&
    EQUIPMENT_SETS.some((s) => s.id === x.id) &&
    int(x.round, round) &&
    typeof x.triggered === 'boolean' &&
    int(x.stored, Math.round(attack * 0.8)) &&
    int(x.weakness, 2) &&
    int(x.sealWardRound, round) &&
    (x.id === 'ironvow' || x.stored === 0) &&
    (x.id === 'dragonscar' || x.weakness === 0) &&
    (x.id === 'dawnbreak' || x.sealWardRound === 0)
  );
}
