import type { BuildModifiers } from './equipment-data.ts';

export type TalentDefinition = {
  id: string;
  name: string;
  rarity: number;
  text: string;
  stats: BuildModifiers;
  xp?: number;
  training?: number;
};
/** Potential and talent rarity are independent rolls. Multipliers never compound per party member. */
export const TALENTS: readonly TalentDefinition[] = [
  {
    id: 'hunter',
    name: '猎兽直觉',
    rarity: 2,
    text: '攻击 +8%；森林与龙巢伤害 +12%；自身治疗效果 -15%。',
    stats: { attack: 0.08, healing: -0.15 },
  },
  {
    id: 'breaker',
    name: '洞察裂隙',
    rarity: 3,
    text: '穿甲 +25%；防御 -12%。',
    stats: { pierce: 0.25, defense: -0.12 },
  },
  {
    id: 'warden',
    name: '元素亲和',
    rarity: 3,
    text: '三种元素抗性 +20%；攻击 -8%。',
    stats: { fire: 0.2, shadow: 0.2, radiant: 0.2, attack: -0.08 },
  },
  {
    id: 'healer',
    name: '草药师',
    rarity: 1,
    text: '全队补给治疗 +5%（同名不叠加）；自身攻击 -5%。',
    stats: { attack: -0.05 },
  },
  {
    id: 'scholar',
    name: '博闻',
    rarity: 1,
    text: '小队每次调查额外 3 敌情（同名不叠加）；自身防御 -5%。',
    stats: { defense: -0.05 },
  },
  {
    id: 'scout',
    name: '寻路人',
    rarity: 2,
    text: '小队远征耗时 -10%（同名不叠加）；自身生命 -8%。',
    stats: { hp: -0.08 },
  },
  {
    id: 'diligent',
    name: '勤勉',
    rarity: 1,
    text: '经验 +30%，训练金币 -15%；暴击率 -3%。',
    stats: { crit: -0.03 },
    xp: 1.3,
    training: 0.85,
  },
  {
    id: 'veteran',
    name: '临危不乱',
    rarity: 2,
    text: '开战士气 +1（同名不叠加）；闪避率 -3%。',
    stats: { dodge: -0.03 },
  },
  {
    id: 'bloodedge',
    name: '血刃誓约',
    rarity: 4,
    text: '攻击 +18%、暴击 +8%；生命 -15%、治疗效果 -20%。',
    stats: { attack: 0.18, crit: 0.08, hp: -0.15, healing: -0.2 },
  },
  {
    id: 'livingwall',
    name: '不动之壁',
    rarity: 4,
    text: '生命 +20%、护盾效果 +25%；攻击 -15%、闪避 -5%。',
    stats: { hp: 0.2, shield: 0.25, attack: -0.15, dodge: -0.05 },
  },
  {
    id: 'oracle',
    name: '逆流先知',
    rarity: 5,
    text: '技能冷却缩短20%、治疗与护盾效果 +25%；攻击 -20%、暴伤 -20%。',
    stats: {
      cooldown: 0.2,
      healing: 0.25,
      shield: 0.25,
      attack: -0.2,
      critDamage: -0.2,
    },
  },
  {
    id: 'glassstar',
    name: '陨星之心',
    rarity: 5,
    text: '暴击 +15%、暴伤 +40%、穿甲 +10%；生命 -20%、三种元素抗性 -10%。',
    stats: {
      crit: 0.15,
      critDamage: 0.4,
      pierce: 0.1,
      hp: -0.2,
      fire: -0.1,
      shadow: -0.1,
      radiant: -0.1,
    },
  },
  {
    id: 'mistborn',
    name: '雾生者',
    rarity: 3,
    text: '闪避 +12%；生命 -10%。群体重击无法闪避。',
    stats: { dodge: 0.12, hp: -0.1 },
  },
  {
    id: 'oathkeeper',
    name: '守誓者',
    rarity: 2,
    text: '治疗效果 +18%、护盾效果 +12%；攻击 -8%。',
    stats: { healing: 0.18, shield: 0.12, attack: -0.08 },
  },
  {
    id: 'warmblood',
    name: '炽血',
    rarity: 4,
    text: '攻击 +12%、火抗 +25%；暗抗 -15%。',
    stats: { attack: 0.12, fire: 0.25, shadow: -0.15 },
  },
];
export const TALENT_RARITY_WEIGHTS = [40, 30, 20, 8, 2] as const;
