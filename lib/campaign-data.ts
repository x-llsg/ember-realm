import type { Cost } from './realm.ts';

export const MATERIAL_IDS = [
  'timber',
  'essence',
  'ore',
  'ember',
  'scale',
  'star',
  'boards',
  'steel',
  'runes',
] as const;
export type MaterialId = (typeof MATERIAL_IDS)[number];
export type MaterialCost = Partial<Record<MaterialId, number>>;
export const WORK_IDS = ['boards', 'steel', 'runes'] as const;
export type WorkId = (typeof WORK_IDS)[number];
export interface WorldState {
  materials: Record<MaterialId, number>;
  tech: string[];
  work: Record<WorkId, boolean>;
  workProgress: Record<WorkId, number>;
}
export const MATERIAL_NAMES: Record<MaterialId, string> = {
  timber: '古木',
  essence: '灵砂',
  ore: '黑铁矿',
  ember: '深渊余烬',
  scale: '龙鳞',
  star: '星髓',
  boards: '精制木板',
  steel: '精钢',
  runes: '符文',
};
export const TOWN_RANK_NAMES: string[] = [
  '营地',
  '村落',
  '市镇',
  '城塞',
  '王城',
  '自由城',
];
export const MATERIAL_CAPACITIES = [80, 160, 320, 640, 1280, 2560] as const;
export const BUILDING_LIMITS = {
  production: [2, 3, 5, 7, 9, 12],
  hut: [2, 4, 6, 9, 12, 16],
  warehouse: [2, 4, 6, 8, 10, 12],
  tavern: [1, 2, 2, 3, 3, 3],
} as const;
export const CAMPAIGN_REGION_NAMES = [
  '低语森林',
  '灰钟废墟',
  '赤砂古道',
  '永夜王庭',
  '龙脊雪山',
  '破碎天穹',
] as const;
export const REGION_MATERIALS: readonly MaterialId[] = [
  'timber',
  'essence',
  'ore',
  'ember',
  'scale',
  'star',
];
export const MATERIAL_SOURCES: Record<MaterialId, string> = {
  timber: '低语森林远征，或夺下第一据点后安排地区后勤',
  essence: '灰钟废墟远征，或夺下第一据点后安排地区后勤',
  ore: '赤砂古道远征，或夺下第一据点后安排地区后勤',
  ember: '永夜王庭远征，或夺下第一据点后安排地区后勤',
  scale: '龙脊雪山远征，或夺下第一据点后安排地区后勤',
  star: '破碎天穹远征，或夺下第一据点后安排地区后勤',
  boards: '定居工艺 · 木板加工',
  steel: '金属工艺 · 精钢加工',
  runes: '符文工艺 · 符文加工',
};
export interface TechnologyRequirements {
  allTech?: string[];
  anyTech?: string[];
  depth?: { region: number; value: number };
  bossAny?: number[];
  bossAll?: number[];
}
export interface Technology {
  id: string;
  name: string;
  desc: string;
  rank: number;
  cost: Cost;
  materials: MaterialCost;
  requires: TechnologyRequirements;
}
export const TECHNOLOGIES: Technology[] = [
  {
    id: 'settlement',
    name: '定居工艺',
    rank: 1,
    desc: '营地成为村落；开放木板加工、锻造坊与学馆，建筑和训练上限提高。',
    cost: { wood: 180, stone: 100, gold: 80 },
    materials: { timber: 6 },
    requires: { depth: { region: 0, value: 1 } },
  },
  {
    id: 'metallurgy',
    name: '金属工艺',
    rank: 2,
    desc: '开放精钢加工、破甲战矛与 T2 装备；村落发展为市镇。可与符文工艺分别研究。',
    cost: { wood: 800, stone: 600, iron: 30, gold: 450 },
    materials: { boards: 12, ore: 10 },
    requires: { allTech: ['settlement'], depth: { region: 2, value: 1 } },
  },
  {
    id: 'runecraft',
    name: '符文工艺',
    rank: 2,
    desc: '开放符文加工、裂法之杖、守夜法衣与 T2 装备；村落发展为市镇。可与金属工艺分别研究。',
    cost: { wood: 700, stone: 500, crystal: 20, gold: 500 },
    materials: { boards: 12, essence: 10 },
    requires: { allTech: ['settlement'], depth: { region: 1, value: 1 } },
  },
  {
    id: 'citadel',
    name: '城塞营造',
    rank: 3,
    desc: '市镇发展为城塞，开放 T3 装备和更大的建筑、材料及训练容量。',
    cost: { wood: 6000, stone: 4500, gold: 3000, iron: 160, crystal: 80 },
    materials: { boards: 60, timber: 40 },
    requires: {
      allTech: ['settlement'],
      anyTech: ['metallurgy', 'runecraft'],
      bossAny: [1, 2],
    },
  },
  {
    id: 'dragoncraft',
    name: '龙鳞工艺',
    rank: 4,
    desc: '古龙鳞成为 T4 装备的锻造材料；城塞发展为王城，并开放逆律圣衣。',
    cost: { wood: 18000, stone: 14000, gold: 10000, iron: 600, crystal: 350 },
    materials: { boards: 100, scale: 80 },
    requires: { allTech: ['citadel'], depth: { region: 4, value: 2 } },
  },
  {
    id: 'infernalcraft',
    name: '魔焰工艺',
    rank: 4,
    desc: '魔焰余烬成为 T4 装备的锻造材料；城塞发展为王城，并开放逆律圣衣。',
    cost: { wood: 18000, stone: 14000, gold: 10000, iron: 500, crystal: 450 },
    materials: { boards: 100, ember: 80 },
    requires: { allTech: ['citadel'], depth: { region: 3, value: 2 } },
  },
  {
    id: 'mythic',
    name: '凡人的神话',
    rank: 5,
    desc: '王城成为自由城，开放 T5、T6 装备。天穹远征带回的星屑用于最终打造。',
    cost: { wood: 80000, stone: 65000, gold: 50000, iron: 2500, crystal: 1400 },
    materials: { boards: 240, scale: 160, ember: 160 },
    requires: {
      allTech: ['citadel'],
      anyTech: ['dragoncraft', 'infernalcraft'],
      bossAll: [3, 4],
    },
  },
];
export interface WorkRecipe {
  id: WorkId;
  name: string;
  text: string;
  seconds: number;
  cost: Cost;
  materials: MaterialCost;
  output: number;
  tech: string;
}
export const WORK_RECIPES: WorkRecipe[] = [
  {
    id: 'boards',
    name: '木板加工',
    text: '古木提供结构，木材与口粮支持木工。扩建伐木场、研究工匠传承加快加工。',
    seconds: 45,
    cost: { wood: 80, food: 20 },
    materials: { timber: 1 },
    output: 1,
    tech: 'settlement',
  },
  {
    id: 'steel',
    name: '精钢加工',
    text: '黑铁矿与铁锭精炼成钢。扩建锻造坊、研究工匠传承加快加工。',
    seconds: 90,
    cost: { iron: 12, wood: 40, food: 30 },
    materials: { ore: 2 },
    output: 1,
    tech: 'metallurgy',
  },
  {
    id: 'runes',
    name: '符文加工',
    text: '将遗迹灵砂刻成符文。扩建学馆、研究野外学术加快加工。',
    seconds: 120,
    cost: { crystal: 8, gold: 80, food: 40 },
    materials: { essence: 2 },
    output: 1,
    tech: 'runecraft',
  },
];
