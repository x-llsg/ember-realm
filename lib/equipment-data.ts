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
    text: '2件：生命 +8%。4件：再获得闪避 +8%、治疗效果 +15%。适合游击与续航。',
  },
  {
    id: 'nightbell',
    name: '沉钟誓约',
    region: 1,
    two: { shadow: 0.15 },
    four: { shield: 0.25, cooldown: 0.1 },
    text: '2件：暗抗 +15%。4件：再获得护盾效果 +25%、技能冷却缩短10%。适合破咒与护佑。',
  },
  {
    id: 'ironvow',
    name: '铁壁军阵',
    region: 2,
    two: { defense: 0.15 },
    four: { hp: 0.15, shield: 0.2 },
    text: '2件：防御 +15%。4件：再获得生命 +15%、护盾效果 +20%。适合承受点名与群攻。',
  },
  {
    id: 'dragonscar',
    name: '龙痕猎装',
    region: 4,
    two: { fire: 0.15 },
    four: { pierce: 0.18, crit: 0.08 },
    text: '2件：火抗 +15%。4件：再获得穿甲 +18%、暴击 +8%。适合破鳞与狙击。',
  },
  {
    id: 'abysswalk',
    name: '深渊行者',
    region: 3,
    two: { attack: 0.08 },
    four: { critDamage: 0.3, cooldown: 0.1 },
    text: '2件：攻击 +8%。4件：再获得暴伤 +30%、技能冷却缩短10%。适合爆发与持续施法。',
  },
  {
    id: 'dawnbreak',
    name: '破晓逆律',
    region: 5,
    two: { radiant: 0.15 },
    four: { healing: 0.25, shield: 0.25, pierce: 0.12 },
    text: '2件：神圣抗性 +15%。4件：再获得治疗/护盾效果 +25%、穿甲 +12%。适合长期决战。',
  },
];
