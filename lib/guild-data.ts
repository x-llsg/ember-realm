import type { Cost, HeroId } from './realm-data.ts';

import { TALENTS } from './talent-data.ts';
export { TALENTS } from './talent-data.ts';
export const FLAWS = [
  { id: 'frail', name: '体弱', text: '生命 -8%' },
  { id: 'hesitant', name: '迟疑', text: '攻击 -6%' },
  { id: 'reckless', name: '冒进', text: '防御 -2' },
  { id: 'green', name: '缺乏历练', text: '获得经验 -10%' },
] as const;
export type TalentId = (typeof TALENTS)[number]['id'];
export type FlawId = (typeof FLAWS)[number]['id'] | 'overcome';
export type GearSlot = 'weapon' | 'armor' | 'charm' | 'head' | 'hands' | 'feet';
export type Element = 'physical' | 'shadow' | 'fire' | 'radiant';
export type PotionId = Exclude<Element, 'physical'>;
export const ELEMENT_NAMES: Record<Element, string> = {
  physical: '物理',
  shadow: '暗影',
  fire: '火焰',
  radiant: '神圣',
};
export interface Character {
  role: HeroId;
  name: string;
  origin: string;
  quality: number;
  aptitude: { hp: number; attack: number; defense: number };
  talent: TalentId;
  flaw: FlawId;
  mastery: number;
  talentVersion?: 2;
  secondarySkill?: import('./skill-data.ts').SkillId;
  activeSkill?: import('./skill-data.ts').SkillId;
  learnedNodes?: string[];
  legacySkill?: import('./skill-data.ts').SkillId;
  equipment: Partial<Record<GearSlot, string>>;
}
export interface Gear {
  id: string;
  recipe: string;
  tier: number;
  rarity: number;
  affix: number;
  upgrade: number;
  setId?: string;
}
export const AFFIXES = [
  {
    name: '锋锐',
    text: '额外基础攻击 +8（随装备阶级与强化成长）',
    stat: 'attack',
    value: 0.08,
  },
  {
    name: '坚韧',
    text: '额外基础生命 +20（随装备阶级与强化成长）',
    stat: 'hp',
    value: 0.1,
  },
  { name: '守御', text: '防御 +3', stat: 'defense', value: 3 },
  { name: '穿透', text: '穿甲 +12%', stat: 'pierce', value: 0.12 },
  { name: '辟火', text: '火抗 +15%', stat: 'fire', value: 0.15 },
  { name: '镇魂', text: '暗抗 +15%', stat: 'shadow', value: 0.15 },
  { name: '逆律', text: '神圣抗性 +15%', stat: 'radiant', value: 0.15 },
  { name: '会心', text: '暴击率 +8%', stat: 'crit', value: 0.08 },
  { name: '轻灵', text: '闪避率 +6%', stat: 'dodge', value: 0.06 },
  { name: '致命', text: '暴击伤害 +20%', stat: 'critDamage', value: 0.2 },
] as const;
export const RECIPES: {
  id: string;
  name: string;
  slot: GearSlot;
  chapter: number;
  cost: Cost;
  attack: number;
  hp: number;
  defense: number;
  pierce: number;
  ranged: number;
  fire: number;
  shadow: number;
  radiant: number;
  text: string;
}[] = [
  {
    id: 'blade',
    name: '均衡长剑',
    slot: 'weapon',
    chapter: 0,
    cost: { wood: 25, stone: 15, gold: 15 },
    attack: 12,
    hp: 0,
    defense: 2,
    pierce: 0,
    ranged: 0,
    fire: 0,
    shadow: 0,
    radiant: 0,
    text: '稳定输出，兼顾格挡',
  },
  {
    id: 'bow',
    name: '猎手长弓',
    slot: 'weapon',
    chapter: 0,
    cost: { wood: 35, food: 15, gold: 20 },
    attack: 10,
    hp: 0,
    defense: 0,
    pierce: 0.08,
    ranged: 1,
    fire: 0,
    shadow: 0,
    radiant: 0,
    text: '普通攻击也可应对飞行，附带少量穿甲',
  },
  {
    id: 'pike',
    name: '破甲战矛',
    slot: 'weapon',
    chapter: 1,
    cost: { wood: 20, iron: 25, gold: 35 },
    attack: 10,
    hp: 0,
    defense: 0,
    pierce: 0.45,
    ranged: 0,
    fire: 0,
    shadow: 0,
    radiant: 0,
    text: '削弱敌方护甲，适合督军和古龙',
  },
  {
    id: 'staff',
    name: '裂法之杖',
    slot: 'weapon',
    chapter: 1,
    cost: { wood: 20, iron: 15, crystal: 8, gold: 40 },
    attack: 15,
    hp: 0,
    defense: 0,
    pierce: 0.2,
    ranged: 0.6,
    fire: 0,
    shadow: 0,
    radiant: 0,
    text: '提高法术输出，部分无视护甲与飞行',
  },
  {
    id: 'plate',
    name: '卫城板甲',
    slot: 'armor',
    chapter: 0,
    cost: { wood: 20, stone: 25, gold: 20 },
    attack: 0,
    hp: 35,
    defense: 7,
    pierce: 0,
    ranged: 0,
    fire: 0,
    shadow: 0,
    radiant: 0,
    text: '物理防护高，缺少元素抵抗',
  },
  {
    id: 'firecoat',
    name: '隔焰猎装',
    slot: 'armor',
    chapter: 2,
    cost: { iron: 20, crystal: 12, gold: 40 },
    attack: 0,
    hp: 28,
    defense: 2,
    pierce: 0,
    ranged: 0,
    fire: 0.45,
    shadow: 0,
    radiant: 0,
    text: '火焰伤害 -45%，可抑制龙息灼烧',
  },
  {
    id: 'shadowcoat',
    name: '守夜法衣',
    slot: 'armor',
    chapter: 1,
    cost: { iron: 15, crystal: 8, gold: 35 },
    attack: 0,
    hp: 28,
    defense: 2,
    pierce: 0,
    ranged: 0,
    fire: 0,
    shadow: 0.45,
    radiant: 0,
    text: '暗影伤害 -45%，应对亡灵与魔王',
  },
  {
    id: 'dawncoat',
    name: '逆律圣衣',
    slot: 'armor',
    chapter: 4,
    cost: { iron: 30, crystal: 22, gold: 60 },
    attack: 0,
    hp: 28,
    defense: 2,
    pierce: 0,
    ranged: 0,
    fire: 0,
    shadow: 0,
    radiant: 0.45,
    text: '神圣伤害 -45%，为终神决战准备',
  },
  {
    id: 'vitality',
    name: '生命护符',
    slot: 'charm',
    chapter: 0,
    cost: { stone: 25, food: 25, gold: 25 },
    attack: 0,
    hp: 50,
    defense: 0,
    pierce: 0,
    ranged: 0,
    fire: 0,
    shadow: 0,
    radiant: 0,
    text: '增加生命，让补给治疗受益',
  },
  {
    id: 'wardstone',
    name: '三相护石',
    slot: 'charm',
    chapter: 2,
    cost: { stone: 30, crystal: 15, gold: 45 },
    attack: 0,
    hp: 0,
    defense: 2,
    pierce: 0,
    ranged: 0,
    fire: 0.2,
    shadow: 0.2,
    radiant: 0.2,
    text: '全元素抗性 +20%，与护甲叠加至75%',
  },
];
export const QUALITY_NAMES = ['朴素', '精良', '稀有', '史诗', '传说', '神话'];
export const FRONTIERS = [
  ['林缘猎径', '断桥营地', '荆棘围场', '旧猎人塔', '狼穴外围'],
  ['墓园石阶', '失声教堂', '亡者回廊', '钟楼基座', '守墓密室'],
  ['沙海驿路', '废弃水井', '军械货站', '黑铁营垒', '督军粮道'],
  ['无名村庄', '永夜岗哨', '献名石阵', '王庭外环', '黑曜王座'],
  ['冻土营地', '雪崩隘口', '换鳞洞窟', '高空巢道', '龙心祭台'],
  ['升天阶梯', '破碎星桥', '天律书库', '命运织机', '神座之门'],
];
export const FRONTIER_REQUIREMENTS = [40, 75, 120, 180, 260];
export const FRONTIER_RESOURCES = [
  'wood',
  'stone',
  'iron',
  'gold',
  'crystal',
  'food',
] as const;
export const FRONTIER_REWARDS = [
  '开放地区驻地',
  '本地区资源生产 +15%',
  '获得一件稀有以上装备，开放首领道路（可提前挑战全盛首领）',
  '首领护甲永久降低15%',
  '补给材料基础运量增至14，集市与仓库可进一步增加运量',
];
export const ENEMIES: { element: Element; defense: number; tip: string }[] = [
  {
    element: 'physical',
    defense: 12,
    tip: '板甲与剑士保护前线；狼王扑杀时坚守。',
  },
  {
    element: 'shadow',
    defense: 24,
    tip: '守夜法衣抵抗钟鸣；法杖与破势处理结界。',
  },
  {
    element: 'physical',
    defense: 75,
    tip: '战矛与穿透词条削甲；打断军阵补给。',
  },
  {
    element: 'shadow',
    defense: 65,
    tip: '暗抗减少洪流伤害，保留士气打断末日咏唱。',
  },
  {
    element: 'fire',
    defense: 110,
    tip: '隔焰猎装与三相护石对抗龙息；弓能在飞行回合持续输出。',
  },
  {
    element: 'radiant',
    defense: 135,
    tip: '逆律圣衣保护队伍；敌情与驻地改善开场，打断法则重写。',
  },
];

// Additional slots are introduced with the forge and regional craft discoveries.
RECIPES.push(
  {
    id: 'cap',
    name: '旅人皮帽',
    slot: 'head',
    chapter: 0,
    cost: { food: 18, wood: 20, gold: 20 },
    hp: 18,
    attack: 0,
    defense: 2,
    pierce: 0,
    ranged: 0,
    fire: 0,
    shadow: 0,
    radiant: 0,
    text: '轻便头部防护。',
  },
  {
    id: 'grips',
    name: '猎手护腕',
    slot: 'hands',
    chapter: 0,
    cost: { wood: 25, stone: 10, gold: 20 },
    hp: 0,
    attack: 4,
    defense: 1,
    pierce: 0.04,
    ranged: 0,
    fire: 0,
    shadow: 0,
    radiant: 0,
    text: '手部支撑，少量攻击与穿甲。',
  },
  {
    id: 'boots',
    name: '远行长靴',
    slot: 'feet',
    chapter: 0,
    cost: { food: 25, wood: 15, gold: 20 },
    hp: 14,
    attack: 0,
    defense: 2,
    pierce: 0,
    ranged: 0,
    fire: 0,
    shadow: 0,
    radiant: 0,
    text: '足部防护，兼顾生命与防御。',
  },
);
