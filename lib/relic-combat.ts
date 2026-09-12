import type { Battle, Command, SkillDefinition } from './realm.ts';
import type { CombatUnit } from './tactics.ts';

export const COMBAT_RELIC_IDS = [
  'R02',
  'R04',
  'R06',
  'R08',
  'R10',
  'R12',
] as const;
export type CombatRelicId = (typeof COMBAT_RELIC_IDS)[number];
export interface CombatRelicState {
  id: CombatRelicId;
  debt: number;
  cooldown: number;
  usedRound: number;
  autoCharge: boolean;
  charge?: { skillId: string; round: number };
  sealed?: { skillId: string; remaining: number };
}
export type RelicMode =
  | 'charge'
  | 'split'
  | 'transfer'
  | 'borrow'
  | 'project'
  | 'tune';
export const RELIC_COMBAT_HELP: Record<
  CombatRelicId,
  { name: string; text: string }
> = {
  R02: {
    name: '回响沙漏',
    text: '蓄势放弃本轮行动且不回士气；下一轮使用选定技能时，直接伤害、治疗和护盾×1.80。其它行动会放弃积蓄，持续效果、引爆和套装附加不增强。',
  },
  R04: {
    name: '共鸣折页',
    text: '单体治疗可分给两人：主目标70%，副目标35%；额外1士气、冷却+1轮。附带净化等仍只作用于主目标。',
  },
  R06: {
    name: '守约绳结',
    text: '自用防护技可交给另一位伙伴，本人不再受益；附带嘲讽与闪避也交给对方，冷却+1轮。',
  },
  R08: {
    name: '逆誓筹',
    text: '费用不超过4士气的技能，缺1—2点时可借支，冷却+1轮。本人随后以攻击／防守回气先偿债；未还清不能技能或破势。',
  },
  R10: {
    name: '猎月钩',
    text: '近身伤害技能可改为投射，直接伤害和该技能持续伤害×0.75，冷却+1轮；不附送命中、穿甲或解除其它机制。',
  },
  R12: {
    name: '众声调律钟',
    text: '花本人行动及2士气，让未行动队友一项技能冷却-1；同时封存本人一项就绪技能2轮。遗物冷却3轮，不能赠予额外行动或缩减遗物冷却。',
  },
};
export function createCombatRelic(id: string): CombatRelicState | undefined {
  return COMBAT_RELIC_IDS.includes(id as CombatRelicId)
    ? {
        id: id as CombatRelicId,
        debt: 0,
        cooldown: 0,
        usedRound: 0,
        autoCharge: false,
      }
    : undefined;
}
export function decodeRelicAction(action: string) {
  const [prefix, mode, skillId, aux, ...extra] = action.split('~');
  if (prefix !== 'relic') return null;
  return {
    mode: mode as RelicMode,
    skillId: skillId || '',
    aux: aux || '',
    malformed: extra.length > 0,
  };
}
export function relicCommand(
  id: string,
  mode: RelicMode,
  skillId: string,
  target = '',
  aux = '',
): Command {
  return `unit:${id}:relic~${mode}~${skillId}${aux ? '~' + aux : ''}${target ? ':' + target : ''}`;
}
const owner: Record<RelicMode, CombatRelicId> = {
  charge: 'R02',
  split: 'R04',
  transfer: 'R06',
  borrow: 'R08',
  project: 'R10',
  tune: 'R12',
};
export function directSkill(skill: SkillDefinition) {
  return skill.damage > 0 || !!skill.healing || !!skill.shield;
}
export function canTransfer(skill: SkillDefinition) {
  return (
    skill.target === 'self' &&
    !skill.damage &&
    (!!skill.incomingMultiplier ||
      !!skill.shield ||
      !!skill.wardHits ||
      !!skill.preventBurn)
  );
}
export function relicActionReason(
  b: Battle,
  u: CombatUnit,
  action: string,
  target: string | undefined,
  skills: (id: string) => SkillDefinition[],
) {
  const decoded = decodeRelicAction(action);
  if (!decoded) return '';
  const { mode, skillId, aux, malformed } = decoded;
  if (malformed || !(mode in owner) || u.relic?.id !== owner[mode])
    return '未携带对应遗物';
  const skill = skills(u.id).find((s) => s.id === skillId);
  const patient = b.units.find((x) => x.id === target && x.hp > 0);
  if (mode === 'tune') {
    if (u.relic.cooldown) return `调律钟冷却 ${u.relic.cooldown} 回合`;
    if (!patient || patient.id === u.id || b.acted.includes(patient.id))
      return '选择尚未行动的另一位伙伴';
    if (patient.tunedRound === b.round) return '该伙伴本轮已接受调律';
    const borrowed = skills(patient.id).find((x) => x.id === skillId);
    const pledge = skills(u.id).find((x) => x.id === aux);
    if (
      !borrowed ||
      !patient.cooldowns[skillId] ||
      patient.relic?.sealed?.skillId === skillId
    )
      return '选择伙伴尚在冷却且未封存的技能';
    if (!pledge || pledge.cooldown < 2 || u.cooldowns[aux])
      return '抵押本人一项就绪、基础冷却至少2轮的技能';
    if (b.energy < 2) return '需要2点士气';
    return '';
  }
  if (!skill) return '未携带这项技能';
  if (mode === 'charge') {
    if (!directSkill(skill)) return '只能积蓄含直接伤害、治疗或护盾的技能';
    if (u.relic.charge) return '已有积蓄，不能叠加或延长';
    if (
      u.cooldowns[skillId] > 1 ||
      (u.cooldowns[skillId] > 0 && u.castThisRound === skillId)
    )
      return '该技能下一轮仍在冷却';
    return '';
  }
  if (mode === 'split') {
    if (!skill.healing || skill.target !== 'ally')
      return '只能分写单体友方治疗技能';
    const other = b.units.find((x) => x.id === aux && x.hp > 0);
    if (!patient || !other || patient.id === other.id)
      return '请选择两名不同的存活伙伴';
  }
  if (mode === 'transfer') {
    if (!canTransfer(skill)) return '只能交出自用、无伤害的防护技能';
    if (!patient || patient.id === u.id) return '选择另一名存活伙伴';
  }
  if (mode === 'borrow') {
    const missing = skill.energy - b.energy;
    if (u.relic.debt) return '先偿清本人的士气债务';
    if (skill.energy > 4 || missing < 1 || missing > 2)
      return '仅可在技能缺1—2点士气时借支，原费用最多4点';
  }
  if (
    mode === 'project' &&
    (!skill.damage || skill.projectile || skill.target !== 'enemy')
  )
    return '只能牵射近身伤害技能';
  return '';
}
export function effectiveSkillId(action: string) {
  return decodeRelicAction(action)?.skillId || action;
}
export function actionEnergy(
  skill: SkillDefinition | undefined,
  action: string,
) {
  const decoded = decodeRelicAction(action);
  if (decoded?.mode === 'charge') return 0;
  if (decoded?.mode === 'tune') return 2;
  return (
    (skill?.energy || (action === 'break' ? 2 : 0)) +
    (decoded?.mode === 'split' ? 1 : 0)
  );
}
export function addMorale(b: Battle, u: CombatUnit, amount: number) {
  const paid = Math.min(u.relic?.debt || 0, amount);
  if (u.relic) u.relic.debt -= paid;
  b.energy = Math.min(10, b.energy + amount - paid);
  return paid;
}
export function directMultiplier(
  b: Battle,
  u: CombatUnit,
  skillId: string,
  action: string,
) {
  if (decodeRelicAction(action)?.mode === 'project') return 0.75;
  return u.relic?.charge?.round === b.round - 1 &&
    u.relic.charge.skillId === skillId
    ? 1.8
    : 1;
}
export function afterRelicAction(b: Battle, u: CombatUnit, action: string) {
  if (u.relic?.charge && decodeRelicAction(action)?.mode !== 'charge')
    delete u.relic.charge;
}
export function advanceRelicRound(b: Battle, u: CombatUnit) {
  const r = u.relic;
  if (!r) return;
  if (r.usedRound !== b.round) r.cooldown = Math.max(0, r.cooldown - 1);
  if (r.sealed) {
    if (u.castThisRound !== r.sealed.skillId)
      r.sealed.remaining = Math.max(0, r.sealed.remaining - 1);
    if (!r.sealed.remaining) delete r.sealed;
  }
  if (r.charge && (u.hp <= 0 || r.charge.round < b.round)) delete r.charge;
}
export function validCombatRelics(b: Battle) {
  const ids: string[] = [];
  const n = (v: unknown, lo: number, hi: number) =>
    typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
  for (const u of b.units) {
    if (u.tunedRound !== undefined && !n(u.tunedRound, 0, b.round))
      return false;
    const r = u.relic;
    if (r === undefined) continue;
    if (
      !r ||
      !COMBAT_RELIC_IDS.includes(r.id) ||
      ids.includes(r.id) ||
      !n(r.debt, 0, 2) ||
      !n(r.cooldown, 0, 3) ||
      !n(r.usedRound, 0, b.round) ||
      typeof r.autoCharge !== 'boolean'
    )
      return false;
    ids.push(r.id);
    if (r.id !== 'R08' && r.debt) return false;
    if (r.id !== 'R12' && (r.cooldown || r.sealed)) return false;
    if (
      r.charge &&
      (r.id !== 'R02' ||
        !n(r.charge.round, Math.max(1, b.round - 1), b.round) ||
        !Object.hasOwn(u.cooldowns, r.charge.skillId))
    )
      return false;
    if (
      r.sealed &&
      (!n(r.sealed.remaining, 1, 2) ||
        !Object.hasOwn(u.cooldowns, r.sealed.skillId) ||
        u.cooldowns[r.sealed.skillId] !== r.sealed.remaining)
    )
      return false;
  }
  return ids.length <= 2;
}

export interface RelicOption {
  command: Command;
  label: string;
  detail: string;
  mode: RelicMode;
}
/** Pure, bounded menu; reasons are supplied by the one real command validator. */
export function relicOptions(
  b: Battle,
  u: CombatUnit,
  skills: (id: string) => SkillDefinition[],
): RelicOption[] {
  if (!u.relic) return [];
  const list: RelicOption[] = [];
  const living = b.units.filter((x) => x.hp > 0);
  const push = (
    mode: RelicMode,
    skillId: string,
    label: string,
    target = '',
    aux = '',
  ) =>
    list.push({
      mode,
      command: relicCommand(u.id, mode, skillId, target, aux),
      label,
      detail: RELIC_COMBAT_HELP[u.relic!.id].text,
    });
  if (u.relic.id === 'R12') {
    for (const friend of living.filter((x) => x.id !== u.id))
      for (const next of skills(friend.id).filter(
        (x) => friend.cooldowns[x.id] > 0,
      ))
        for (const pledge of skills(u.id).filter(
          (x) => x.cooldown >= 2 && !u.cooldowns[x.id],
        ))
          push(
            'tune',
            next.id,
            `调律 ${friend.name}·${next.name} / 封存${pledge.name}`,
            friend.id,
            pledge.id,
          );
    return list;
  }
  for (const skill of skills(u.id)) {
    if (u.relic.id === 'R02' && directSkill(skill))
      push('charge', skill.id, `积蓄 ${skill.name}`);
    if (u.relic.id === 'R04' && skill.target === 'ally' && skill.healing)
      for (const a of living)
        for (const c of living.filter((x) => x.id !== a.id))
          push(
            'split',
            skill.id,
            `${skill.name}：${a.name}70% / ${c.name}35%`,
            a.id,
            c.id,
          );
    if (u.relic.id === 'R06' && canTransfer(skill))
      for (const friend of living.filter((x) => x.id !== u.id))
        push('transfer', skill.id, `${skill.name} → ${friend.name}`, friend.id);
    if (u.relic.id === 'R08' && skill.energy <= 4) {
      if (skill.target === 'ally')
        for (const friend of living)
          push(
            'borrow',
            skill.id,
            `借支 ${skill.name} → ${friend.name}`,
            friend.id,
          );
      else push('borrow', skill.id, `借支 ${skill.name}`);
    }
    if (
      u.relic.id === 'R10' &&
      skill.damage &&
      !skill.projectile &&
      skill.target === 'enemy'
    )
      push('project', skill.id, `牵射 ${skill.name}`);
  }
  return list;
}
