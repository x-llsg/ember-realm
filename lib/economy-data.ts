import type { Cost, Resource, BuildingId } from './realm-data.ts';
import type { MaterialCost, WorkId } from './campaign-data.ts';

export const DEVELOPMENT_IDS = [
  'forestry',
  'agriculture',
  'masonry',
  'commerce',
  'smelting',
  'attunement',
  'carpentry',
  'metalwork',
  'inscription',
  'logistics',
  'storage',
  'education',
] as const;
export type DevelopmentId = (typeof DEVELOPMENT_IDS)[number];
export type WorkMode = 'steady' | 'efficient' | 'rush';
export type Duty = 'transport' | 'workshop' | 'academy';
export interface EconomyState {
  development: Record<DevelopmentId, number>;
  routes: {
    level: number;
    crew: number;
    enabled: boolean;
    delivered: number;
  }[];
  modes: Record<WorkId, WorkMode>;
  targets: Record<WorkId, number>;
  reserve: number;
  duties: Partial<Record<Duty, string>>;
  production: Record<Resource, number>;
  crafted: Record<WorkId, number>;
  orders: number;
  orderProgress: number;
  orderActive: boolean;
  orderBatch?: 1 | 4 | 16 | 64;
  legacy: { industry: number; scholarship: number; exploration: number };
}
export interface Development {
  id: DevelopmentId;
  name: string;
  desc: string;
  building: BuildingId;
  resource?: Resource;
  work?: WorkId;
  cost: Cost;
  materials?: MaterialCost;
  prior?: DevelopmentId;
}
export const DEVELOPMENT_MAX = 12;
export const DEVELOPMENTS: Development[] = [
  {
    id: 'forestry',
    name: '林务改良',
    desc: '木材产量每级 ×1.14；第4、8、12级再各 ×1.20。由轮伐走向水力锯木。',
    building: 'lumber',
    resource: 'wood',
    cost: { wood: 65, stone: 25 },
  },
  {
    id: 'agriculture',
    name: '农事改良',
    desc: '口粮产量每级 ×1.14；第4、8、12级再各 ×1.20。种植、灌溉与粮路共同供养工坊。',
    building: 'farm',
    resource: 'food',
    cost: { wood: 45, food: 55 },
  },
  {
    id: 'masonry',
    name: '石工改良',
    desc: '石料产量每级 ×1.14；第4、8、12级再各 ×1.20。更快扩建，也能持续供给冶炼。',
    building: 'quarry',
    resource: 'stone',
    cost: { wood: 55, stone: 65 },
  },
  {
    id: 'commerce',
    name: '商事改良',
    desc: '金币产量每级 ×1.14；第4、8、12级再各 ×1.20。2、6、10级开放4、16、64份批量订单。',
    building: 'market',
    resource: 'gold',
    cost: { wood: 80, gold: 70 },
  },
  {
    id: 'smelting',
    name: '炉务改良',
    desc: '铁锭产量每级 ×1.14；第4、8、12级再各 ×1.20。更大的炉火也会消耗更多木石。',
    building: 'forge',
    resource: 'iron',
    cost: { stone: 240, iron: 30, gold: 120 },
  },
  {
    id: 'attunement',
    name: '灵脉调谐',
    desc: '魔晶产量每级 ×1.14；第4、8、12级再各 ×1.20。增加魔晶产能，同时增加金币需求。',
    building: 'shrine',
    resource: 'crystal',
    cost: { gold: 220, crystal: 20, wood: 160 },
  },
  {
    id: 'carpentry',
    name: '木工传习',
    desc: '木板加工速度每级 ×1.16；第4、8、12级每批产出增加1件。原料每批照常支付。',
    building: 'lumber',
    work: 'boards',
    cost: { wood: 200, food: 100, stone: 80 },
  },
  {
    id: 'metalwork',
    name: '精炼工艺',
    desc: '精钢加工速度每级 ×1.16；第4、8、12级每批产出增加1件。提升成材率，减少每件矿耗。',
    building: 'forge',
    work: 'steel',
    cost: { iron: 45, wood: 320, gold: 220 },
  },
  {
    id: 'inscription',
    name: '铭文工艺',
    desc: '符文加工速度每级 ×1.16；第4、8、12级每批产出增加1件。提升刻印成材率。',
    building: 'shrine',
    work: 'runes',
    cost: { crystal: 25, gold: 360, food: 160 },
  },
  {
    id: 'logistics',
    name: '运输调度',
    desc: '后勤运量每级 ×1.18；第4、8、12级各增加1条并行运输线。主队远征不占用运输线。',
    building: 'market',
    cost: { wood: 150, food: 80, gold: 100 },
  },
  {
    id: 'storage',
    name: '分仓与货栈',
    desc: '基础与材料容量每级增加25%基础倍率；第2级开放库存目标与原料保留线。扩容不产生资源。',
    building: 'warehouse',
    cost: { wood: 140, stone: 100, gold: 45 },
  },
  {
    id: 'education',
    name: '公会教范',
    desc: '留守教学与远征经验每级增加10%基础倍率；第4、8、12级各提高2级培养上限，最高40级。',
    building: 'tavern',
    cost: { gold: 140, food: 100 },
  },
];
export const ROUTE_STAGES = [
  '尚未修路',
  '清理旧路',
  '装卸营地',
  '常驻驿站',
  '地区商道',
] as const;
export const DUTIES: { id: Duty; name: string; desc: string }[] = [
  {
    id: 'transport',
    name: '护送领队',
    desc: '留守旅人改善后勤运量。游侠、猎人、刺客与猎户、护卫更擅长护送。',
  },
  {
    id: 'workshop',
    name: '工坊顾问',
    desc: '留守旅人加快加工。法师、炼金师与学徒、佣兵更擅长工艺。',
  },
  {
    id: 'academy',
    name: '驻城教官',
    desc: '持续消耗口粮与金币，令所有留守伙伴积累经验。剑士、骑士、修女与佣兵、隐修者更擅长教学。',
  },
];
export const ORDER_RECIPES = [
  {
    name: '营地修缮',
    cost: { wood: 40, stone: 20, food: 10 } as Cost,
    seconds: 40,
  },
  {
    name: '居民货单',
    cost: { wood: 65, food: 55, stone: 35 } as Cost,
    seconds: 60,
  },
  {
    name: '城镇采买',
    cost: { wood: 120, food: 80, stone: 90, iron: 8 } as Cost,
    seconds: 90,
  },
];
