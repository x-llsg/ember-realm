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
export interface ProcessingVariant {
  id: string;
  work: WorkId;
  name: string;
  text: string;
  region: number;
  tech: string;
  cost: Cost;
  materials: MaterialCost;
  seconds: number;
  output: number;
}
/** Each chapter changes an input dependency; these never manufacture regional samples. */
export const PROCESSING_VARIANTS: ProcessingVariant[] = [
  {
    id: 'joinery',
    work: 'boards',
    region: 0,
    tech: 'settlement',
    name: '拼接工艺',
    text: '森林锯坊教会木匠用石榫拼合普通木料。免用古木，改为消耗更多木材、石料和工时；古木充足时，原工艺更省本地物资。',
    cost: { wood: 160, stone: 45, food: 30 },
    materials: {},
    seconds: 80,
    output: 1,
  },
  {
    id: 'resonance',
    work: 'runes',
    region: 1,
    tech: 'runecraft',
    name: '晶砂刻印',
    text: '灰钟匠人用魔晶共鸣，在石板上重现灵砂纹路。免用灵砂，增加魔晶、金币、石料和加工时间；适合暂停遗迹搬运时备符文。',
    cost: { crystal: 20, stone: 100, gold: 140, food: 55 },
    materials: {},
    seconds: 165,
    output: 1,
  },
  {
    id: 'crucible',
    work: 'steel',
    region: 2,
    tech: 'metallurgy',
    name: '坩埚精炼',
    text: '赤砂炉师以石坩埚反复除杂，普通铁锭也能成钢。免用黑铁矿，增加铁锭、燃料与石料并延长加工；保留矿路则可节约城内炉料。',
    cost: { iron: 30, stone: 120, wood: 100, food: 45 },
    materials: {},
    seconds: 135,
    output: 1,
  },
  {
    id: 'infernal',
    work: 'boards',
    region: 3,
    tech: 'infernalcraft',
    name: '魔焰熟化',
    text: '王庭余烬在封闭窑中熟化木料，一批得到多件木板。免用古木，节约木材；会占用锻造高阶装备所需的深渊余烬与金币。',
    cost: { wood: 40, stone: 80, gold: 120, food: 35 },
    materials: { ember: 1 },
    seconds: 90,
    output: 3,
  },
  {
    id: 'dragon',
    work: 'steel',
    region: 4,
    tech: 'dragoncraft',
    name: '龙鳞淬钢',
    text: '雪山淬火槽用龙鳞维持高温，一批得到多件精钢。免用黑铁矿，节约铁锭与木材；龙鳞和金币同时也是装备备战的投入。',
    cost: { iron: 8, gold: 220, food: 60 },
    materials: { scale: 2 },
    seconds: 140,
    output: 3,
  },
  {
    id: 'stellar',
    work: 'runes',
    region: 5,
    tech: 'mythic',
    name: '星髓刻印',
    text: '天穹观测台把星髓纹路复制到符文中，一批得到多件成品。免用灵砂，节约魔晶；需要保留用于最终装备与世界修复的星髓。',
    cost: { crystal: 4, gold: 400, food: 80 },
    materials: { star: 2 },
    seconds: 180,
    output: 3,
  },
];
export interface EconomyState {
  development: Record<DevelopmentId, number>;
  routes: {
    level: number;
    crew: number;
    enabled: boolean;
    delivered: number;
  }[];
  modes: Record<WorkId, WorkMode>;
  /** Older saves omit this field and keep every original recipe. */
  variants?: Record<WorkId, string>;
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
