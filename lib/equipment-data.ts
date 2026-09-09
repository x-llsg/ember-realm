import type { GearSlot } from './guild-data.ts';

export const GEAR_SLOTS = [
  'weapon',
  'armor',
  'charm',
  'head',
  'hands',
  'feet',
] as const;
export const SLOT_NAMES: Record<GearSlot, string> = {
  weapon: '武器',
  armor: '护甲',
  charm: '饰品',
  head: '头部',
  hands: '手部',
  feet: '足部',
};
export const GEAR_SLOT_OPTIONS = GEAR_SLOTS.map((value) => ({
  value,
  label: SLOT_NAMES[value],
}));
export const INVENTORY_CAP = 120;
export const RARITY_SCALE = [1, 1.15, 1.3, 1.45, 1.65, 1.85] as const;
export const BOSS_RED_CHANCE = 0.02;
export const REGION_DROP_TIERS = [1, 2, 2, 4, 4, 6] as const;
export const REGION_DROP_RANKS = [0, 1, 1, 2, 2, 3] as const;
export const GUARDIAN_DROP_CHANCES = [0.2, 0.35, 0.5, 0.7, 0.9] as const;
/** Green, blue, purple and gold weights; red remains exclusive to bosses. */
export const GUARDIAN_RARITY_WEIGHTS = [
  [70, 27, 3, 0],
  [58, 34, 8, 0],
  [42, 43, 14, 1],
  [28, 48, 21, 3],
  [15, 48, 31, 6],
] as const;
export const EXPEDITION_DROP_CHANCES = [
  0.12, 0.17, 0.23, 0.3, 0.38, 0.47,
] as const;
export type BuildModifiers = Partial<
  Record<
    | 'hp'
    | 'attack'
    | 'defense'
    | 'pierce'
    | 'crit'
    | 'dodge'
    | 'critDamage'
    | 'fire'
    | 'shadow'
    | 'radiant'
    | 'healing'
    | 'shield'
    | 'cooldown',
    number
  >
>;
export const EQUIPMENT_SETS: {
  id: string;
  name: string;
  region: number;
  two: BuildModifiers;
  four: BuildModifiers;
  text: string;
}[] = [
  {
    id: 'wildwatch',
    name: '林间守望',
    region: 0,
    two: { hp: 0.08 },
    four: { dodge: 0.08, healing: 0.15 },
    text: '2件：生命 +8%。4件：闪避 +8%、治疗 +15%；闪避或在防守/护佑中受击后，以45%攻击反击，每个敌方阶段最多1次。反击不暴击，不触发其它套装。',
  },
  {
    id: 'nightbell',
    name: '沉钟誓约',
    region: 1,
    two: { shadow: 0.15 },
    four: { shield: 0.25, cooldown: 0.1 },
    text: '2件：暗抗 +15%。4件：护盾 +25%、技能冷却缩短10%；本人直接治疗的溢出量50%转为目标的2轮护盾，单次上限为目标生命20%，与已有护盾取较高值。满血时也能为队友预备护盾。',
  },
  {
    id: 'ironvow',
    name: '铁壁军阵',
    region: 2,
    two: { defense: 0.15 },
    four: { hp: 0.15, shield: 0.2 },
    text: '2件：防御 +15%。4件：生命 +15%、护盾 +20%；在减伤或护盾保护中受击，将该次生命与护盾承伤之和的50%蓄为反击力量，上限为本人攻击80%；下次直接攻击释放，受护甲影响，未命中也消耗。',
  },
  {
    id: 'dragonscar',
    name: '龙痕猎装',
    region: 4,
    two: { fire: 0.15 },
    four: { pierce: 0.18, crit: 0.08 },
    text: '2件：火抗 +15%。4件：穿甲 +18%、暴击 +8%；破势、破盾或带额外穿甲的技能命中后留下2次猎痕。其他队友直接攻击额外穿甲15%，仍受75%上限约束；猎痕不叠加，持续至用完或战斗结束。',
  },
  {
    id: 'abysswalk',
    name: '深渊行者',
    region: 3,
    two: { attack: 0.08 },
    four: { critDamage: 0.3, cooldown: 0.1 },
    text: '2件：攻击 +8%。4件：暴伤 +30%、技能冷却缩短10%；伤害技能命中后附加2轮、每轮20%攻击的燃烧，同来源取较强值。破势可提前引爆本人燃烧，结算剩余伤害的80%，上限120%攻击；引爆不暴击，不再次点燃。',
  },
  {
    id: 'dawnbreak',
    name: '破晓逆律',
    region: 5,
    two: { radiant: 0.15 },
    four: { healing: 0.25, shield: 0.25, pierce: 0.12 },
    text: '2件：神圣抗性 +15%。4件：治疗/护盾 +25%、穿甲 +12%；清除灼烧/治疗封印，或成功反制结界与咏唱时，为全队提供本人生命4%与攻击45%的2轮护盾（每目标上限生命15%）；每人每轮最多1次。净化技能还能解除本轮治疗封禁。',
  },
];
