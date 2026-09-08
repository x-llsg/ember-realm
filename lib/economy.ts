import type { State, Hero } from './realm.ts';
import { production, talentExperience } from './realm.ts';
import * as Civic from './civic.ts';
import type { Cost, Resource } from './realm-data.ts';
import { RESOURCE_NAMES } from './realm-data.ts';
import {
  REGION_MATERIALS,
  WORK_IDS,
  WORK_RECIPES,
  type WorkId,
  type MaterialCost,
} from './campaign-data.ts';
import { originEffect } from './origins.ts';
import * as C from './campaign.ts';
import {
  DEVELOPMENT_IDS,
  DEVELOPMENTS,
  DEVELOPMENT_MAX,
  ORDER_RECIPES,
  type DevelopmentId,
  type EconomyState,
  type WorkMode,
  type Duty,
} from './economy-data.ts';
export * from './economy-data.ts';

export function freshEconomy(): EconomyState {
  return {
    development: Object.fromEntries(
      DEVELOPMENT_IDS.map((id) => [id, 0]),
    ) as EconomyState['development'],
    routes: Array.from({ length: 6 }, () => ({
      level: 0,
      crew: 0,
      enabled: false,
      delivered: 0,
    })),
    modes: { boards: 'steady', steel: 'steady', runes: 'steady' },
    targets: { boards: 1, steel: 1, runes: 1 },
    reserve: 0,
    duties: {},
    production: { wood: 0, food: 0, stone: 0, gold: 0, iron: 0, crystal: 0 },
    crafted: { boards: 0, steel: 0, runes: 0 },
    orders: 0,
    orderProgress: 0,
    orderActive: false,
    orderBatch: 1,
    legacy: { industry: 0, scholarship: 0, exploration: 0 },
  };
}
const economy = (s: State) => s.economy || freshEconomy();
export const developmentLevel = (s: State, id: DevelopmentId) =>
  economy(s).development[id];
const say = (s: State, text: string) => {
  s.log.unshift({ time: s.time, text, kind: 'good' });
  s.log = s.log.slice(0, 100);
};
function missing(s: State, cost: Cost): string {
  const absent = Object.entries(cost).filter(
    ([k, n]) => s.resources[k as Resource] + 1e-8 < n!,
  );
  return absent.length
    ? `还缺 ${absent.map(([k, n]) => `${RESOURCE_NAMES[k as Resource]} ${Math.ceil(n! - s.resources[k as Resource])}`).join('、')}`
    : '';
}
function pay(s: State, cost: Cost) {
  for (const [k, n] of Object.entries(cost))
    s.resources[k as Resource] = Math.max(0, s.resources[k as Resource] - n!);
}
export function developmentDiscovered(s: State, id: DevelopmentId): boolean {
  const d = DEVELOPMENTS.find((d) => d.id === id);
  if (!d) return false;
  if (developmentLevel(s, id) > 0) return true;
  if (!s.buildings[d.building]) return false;
  if (d.work)
    return s.world.tech.includes(
      WORK_RECIPES.find((r) => r.id === d.work)!.tech,
    );
  if (id === 'logistics')
    return s.explored.some((n) => n > 0) || s.guild.depths.some((n) => n > 0);
  if (id === 'storage')
    return (
      developmentLevel(s, 'masonry') >= 1 || s.research.includes('baskets')
    );
  if (id === 'education') return s.heroes.length > 0;
  if (id === 'forestry') return !!s.buildings.farm;
  if (id === 'agriculture')
    return developmentLevel(s, 'forestry') >= 1 || s.research.includes('tools');
  return true;
}
export function developmentCost(s: State, id: DevelopmentId): Cost {
  const d = DEVELOPMENTS.find((d) => d.id === id)!;
  const level = developmentLevel(s, id);
  // Geometric investment grows faster than its marginal output; early upgrades
  // compete with buildings, late upgrades become optional long-term projects.
  const factor = 2.15 ** level * (1 + Math.floor(level / 4) * 0.45);
  return Object.fromEntries(
    Object.entries(d.cost).map(([k, n]) => [k, Math.ceil(n! * factor)]),
  );
}
export function developmentReason(s: State, id: DevelopmentId): string {
  if (!DEVELOPMENTS.some((d) => d.id === id)) return '未知改良';
  if (!developmentDiscovered(s, id)) return '先发现相应产线与手艺';
  if (developmentLevel(s, id) >= DEVELOPMENT_MAX) return '本项工艺已精通';
  return missing(s, developmentCost(s, id));
}
export function improveDevelopment(s0: State, id: DevelopmentId): State {
  if (developmentReason(s0, id)) return s0;
  const s = structuredClone(s0);
  pay(s, developmentCost(s, id));
  s.economy.development[id]++;
  say(
    s,
    `${DEVELOPMENTS.find((d) => d.id === id)!.name}提升至 ${developmentLevel(s, id)} 级。${developmentLevel(s, id) % 4 === 0 ? '完成一轮工艺突破。' : ''}`,
  );
  return s;
}
export function developmentPreview(s: State, id: DevelopmentId): string {
  const d = DEVELOPMENTS.find((d) => d.id === id)!,
    level = developmentLevel(s, id);
  const next = structuredClone(s);
  next.economy.development[id] = Math.min(DEVELOPMENT_MAX, level + 1);
  const milestone = 4 - (level % 4);
  if (d.resource)
    return `产线倍率 ×${productionMultiplier(s, d.resource).toFixed(2)} → ×${productionMultiplier(next, d.resource).toFixed(2)}；按当前分工，最大产能 ${production(s)[d.resource].toFixed(2)} → ${production(next)[d.resource].toFixed(2)}/秒（未扣用料与满仓）。再投入 ${milestone} 级迎来工艺突破。改良只提高已建造且已分工的产线。`;
  if (d.work)
    return `每批 ${processingOutput(s, d.work)} → ${processingOutput(next, d.work)} 件，加工速度 ×${processingMultiplier(s, d.work).toFixed(2)} → ×${processingMultiplier(next, d.work).toFixed(2)}。2级开放精作与赶工。`;
  if (id === 'logistics')
    return `每位搬运工的运量再提高18%；同时运输 ${transportSlots(s)} → ${transportSlots(next)} 条线。补给、人数、已建道路共同决定实际产出。`;
  if (id === 'storage')
    return `仓容倍率 ×${storageMultiplier(s).toFixed(2)} → ×${storageMultiplier(next).toFixed(2)}；2级开放各产线库存目标和原料保留。`;
  return `经验倍率 ×${educationMultiplier(s).toFixed(2)} → ×${educationMultiplier(next).toFixed(2)}；额外培养上限 +${educationLevels(s)} → +${educationLevels(next)}。留守伙伴可任职教学，前线通过实战成长。`;
}
export type GrowthChoice = {
  key: string;
  domain: string;
  name: string;
  status: string;
  destination: {
    view: 'research' | 'town' | 'heroes';
    tab?: string;
    research?: string;
    hero?: string;
  };
};
export function growthChoices(s: State): GrowthChoice[] {
  const choices: GrowthChoice[] = [];
  const rates = production(s),
    demand: Cost = {};
  for (const w of WORK_RECIPES) {
    if (
      !s.world.work[w.id] ||
      s.world.materials[w.id] >= workshopTarget(s, w.id)
    )
      continue;
    for (const [k, amount] of Object.entries(processingBill(s, w.id).cost)) {
      const resource = k as Resource;
      demand[resource] =
        (demand[resource] || 0) + amount! / C.workDuration(s, w.id);
    }
  }
  const shipping = transportPlan(s);
  demand.food = (demand.food || 0) + shipping.food;
  demand.gold = (demand.gold || 0) + shipping.gold;
  if (s.economy.orderActive) {
    const order = civicOrder(s);
    for (const [k, amount] of Object.entries(order.cost)) {
      const resource = k as Resource;
      demand[resource] = (demand[resource] || 0) + amount! / order.seconds;
    }
  }
  const useful = (d: (typeof DEVELOPMENTS)[number]) => {
    if (d.resource)
      return (
        (s.jobs[d.resource] > 0 &&
          (s.resources[d.resource] < baseCapacity(s, d.resource) * 0.4 ||
            rates[d.resource] < (demand[d.resource] || 0) * 1.25)) ||
        (d.id === 'commerce' && s.economy.orderActive && !orderReason(s))
      );
    if (d.work)
      return (
        s.world.work[d.work] &&
        s.world.materials[d.work] < workshopTarget(s, d.work) &&
        !C.workReason(s, d.work)
      );
    if (d.id === 'logistics')
      return s.economy.routes.some(
        (r, i) =>
          r.enabled &&
          r.crew &&
          s.world.materials[REGION_MATERIALS[i]] <
            C.materialCapacity(s, REGION_MATERIALS[i]) * 0.5,
      );
    if (d.id === 'education')
      return (
        s.heroes.some(
          (h) =>
            h.level <
            Math.min(
              40,
              [6, 10, 16, 24, 32, 40][C.townRank(s)] + educationLevels(s),
            ),
        ) || educationLevels(s) < 6
      );
    return Object.entries(s.resources).some(
      ([k, n]) => n >= baseCapacity(s, k as Resource) * 0.85,
    );
  };
  const improvements = DEVELOPMENTS.filter(
    (d) =>
      developmentDiscovered(s, d.id) &&
      developmentLevel(s, d.id) < DEVELOPMENT_MAX &&
      useful(d),
  );
  const score = (d: (typeof DEVELOPMENTS)[number]) => {
    const cost = developmentCost(s, d.id);
    return (
      Math.max(
        ...Object.entries(cost).map(
          ([k, n]) => n! / Math.max(1, s.resources[k as Resource]),
        ),
      ) +
      developmentLevel(s, d.id) * 0.02
    );
  };
  const d = improvements.sort((a, b) => score(a) - score(b))[0];
  if (d)
    choices.push({
      key: 'development',
      domain: '产线改良',
      name: `${d.name} ${developmentLevel(s, d.id)} → ${developmentLevel(s, d.id) + 1}`,
      status: developmentReason(s, d.id) || '可以投入',
      destination: { view: 'research', research: d.id },
    });
  const region = economy(s).routes.findIndex(
    (route, r) =>
      regionalDepth(s, r) > 0 &&
      (!route.level || !route.crew) &&
      s.world.materials[REGION_MATERIALS[r]] <
        C.materialCapacity(s, REGION_MATERIALS[r]) * 0.5,
  );
  if (region >= 0)
    choices.push({
      key: 'supply',
      domain: '地区后勤',
      name: `接通${C.CAMPAIGN_REGION_NAMES[region]}`,
      status: economy(s).routes[region].level
        ? '安排搬运工，建立持续供应'
        : routeUpgradeReason(s, region) || '可以修路',
      destination: { view: 'town', tab: 'workshop' },
    });
  else {
    const blocked = WORK_RECIPES.find(
      (w) =>
        s.world.tech.includes(w.tech) &&
        s.world.materials[w.id] < workshopTarget(s, w.id) &&
        (!s.world.work[w.id] || C.workReason(s, w.id)),
    );
    if (blocked)
      choices.push({
        key: 'work',
        domain: '材料加工',
        name: blocked.name,
        status: s.world.work[blocked.id]
          ? C.workReason(s, blocked.id) || '持续加工'
          : '可以安排加工',
        destination: { view: 'town', tab: 'workshop' },
      });
    else if (s.buildings.market)
      choices.push({
        key: 'orders',
        domain: '居民订单',
        name: civicOrder(s).name,
        status: economy(s).orderActive
          ? orderReason(s) || '交付中，自动继续'
          : '可用城镇物资换金币',
        destination: { view: 'town', tab: 'workshop' },
      });
  }
  return choices;
}
export function productionMultiplier(s: State, resource: Resource): number {
  const d = DEVELOPMENTS.find((d) => d.resource === resource)!;
  const level = developmentLevel(s, d.id);
  return (
    1.14 ** level *
    1.2 ** Math.floor(level / 4) *
    (1 + economy(s).legacy.industry * 0.1)
  );
}
export const storageMultiplier = (s: State) =>
  1 + developmentLevel(s, 'storage') * 0.25;
export const educationMultiplier = (s: State) =>
  1 +
  developmentLevel(s, 'education') * 0.1 +
  economy(s).legacy.scholarship * 0.12;
export const educationLevels = (s: State) =>
  Math.floor(developmentLevel(s, 'education') / 4) * 2;
export const transportWorkers = (s: State) =>
  economy(s).routes.reduce((n, r) => n + r.crew, 0);
export const freeEconomyWorkers = (s: State) =>
  s.population -
  Object.values(s.jobs).reduce((a, b) => a + b, 0) -
  transportWorkers(s);
export const transportSlots = (s: State) =>
  2 + Math.floor(developmentLevel(s, 'logistics') / 4);
export const transportLines = (s: State) =>
  economy(s).routes.filter((r) => r.enabled && r.crew > 0).length;
export const regionalDepth = (s: State, r: number) =>
  s.guild.depths[r] || 0;
export const routeDiscovered = (s: State, r: number) =>
  Number.isInteger(r) &&
  r >= 0 &&
  r < 6 &&
  (s.explored[r] > 0 || regionalDepth(s, r) > 0);
export function routeCost(
  s: State,
  r: number,
): { cost: Cost; materials: MaterialCost } {
  const level = economy(s).routes[r].level,
    scale = [1, 2.5, 3, 7, 9, 15][r] * 4 ** level;
  return {
    cost: {
      wood: Math.ceil(55 * scale),
      stone: Math.ceil(25 * scale),
      gold: Math.ceil(20 * scale),
    },
    materials: level
      ? {
          boards: level * 4 + r * 2,
          ...(level >= 2 ? { [REGION_MATERIALS[r]]: 8 * level } : {}),
        }
      : {},
  };
}
export function routeUpgradeReason(s: State, r: number): string {
  if (!routeDiscovered(s, r)) return '先探索这一地区';
  const route = economy(s).routes[r];
  if (route.level >= 4) return '商道已完全建成';
  if (regionalDepth(s, r) < 1) return '守住第一据点后才能修建运输线';
  if (route.level >= 2 && regionalDepth(s, r) < 3)
    return '深入第三据点，寻找修建驿站的位置';
  const bill = routeCost(s, r);
  return missing(s, bill.cost) || C.materialReason(s, bill.materials);
}
export function upgradeRoute(s0: State, r: number): State {
  if (routeUpgradeReason(s0, r)) return s0;
  const s = structuredClone(s0),
    bill = routeCost(s, r);
  pay(s, bill.cost);
  C.spendMaterials(s, bill.materials);
  s.economy.routes[r].level++;
  say(
    s,
    `${C.CAMPAIGN_REGION_NAMES[r]}运输设施升至 ${s.economy.routes[r].level} 级。安排搬运工即可持续供应。`,
  );
  return s;
}
export function routeAssignmentReason(
  s: State,
  r: number,
  delta: number,
): string {
  if (!Number.isInteger(r) || r < 0 || r > 5 || ![1, -1].includes(delta))
    return '无效分工';
  const route = economy(s).routes[r];
  if (!route.level) return '先清理旧路';
  if (delta < 0) return route.crew > 0 ? '' : '没有搬运工';
  if (route.crew >= 3) return '每条线最多3位搬运工';
  if (freeEconomyWorkers(s) < 1) return '没有空闲住民，可从生产岗位调配';
  if (!route.enabled && transportLines(s) >= transportSlots(s))
    return '运输线已满；暂停另一条线或改良运输调度';
  return '';
}
export function assignRoute(s0: State, r: number, delta: number): State {
  if (routeAssignmentReason(s0, r, delta)) return s0;
  const s = structuredClone(s0);
  s.economy.routes[r].crew += delta;
  if (delta > 0) s.economy.routes[r].enabled = true;
  if (!s.economy.routes[r].crew) s.economy.routes[r].enabled = false;
  return s;
}
export function toggleRoute(s0: State, r: number): State {
  if (!Number.isInteger(r) || r < 0 || r > 5) return s0;
  const route = economy(s0).routes[r];
  if (!route.level || !route.crew) return s0;
  if (!route.enabled && transportLines(s0) >= transportSlots(s0)) return s0;
  const s = structuredClone(s0);
  s.economy.routes[r].enabled = !route.enabled;
  return s;
}
export function dutyHero(s: State, duty: Duty): Hero | undefined {
  const id = economy(s).duties[duty];
  return s.heroes.find((h) => h.id === id && !s.party.includes(id!));
}
export function dutyMultiplier(s: State, duty: Duty): number {
  const h = dutyHero(s, duty);
  if (!h) return 1;
  const roles = {
    transport: ['finn', 'ash', 'nyx'],
    workshop: ['kael', 'vera'],
    academy: ['rhea', 'orin', 'luna'],
  }[duty];
  const origins = {
    transport: ['山地猎户', '行商护卫'],
    workshop: ['学徒出身', '旧王国佣兵'],
    academy: ['旧王国佣兵', '隐修者'],
  }[duty];
  return (
    1 +
    0.06 * h.quality +
    0.008 * h.level +
    (roles.includes(h.role) ? 0.15 : 0) +
    (origins.includes(h.origin) ? 0.1 : 0)
  );
}
export function assignDuty(s0: State, duty: Duty, id: string): State {
  if (
    !['transport', 'workshop', 'academy'].includes(duty) ||
    !s0.buildings.tavern
  )
    return s0;
  if (
    id &&
    (!s0.heroes.some((h) => h.id === id) ||
      s0.party.includes(id) ||
      Object.entries(economy(s0).duties).some(
        ([k, v]) => k !== duty && v === id,
      ))
  )
    return s0;
  const s = structuredClone(s0);
  if (id) s.economy.duties[duty] = id;
  else delete s.economy.duties[duty];
  return s;
}
export function routeYield(s: State, r: number): number {
  const route = economy(s).routes[r];
  if (!route.level || !route.crew || !route.enabled) return 0;
  return (
    0.014 *
    route.crew *
    (1 + regionalDepth(s, r) * 0.35) *
    1.7 ** (route.level - 1) *
    1.18 ** developmentLevel(s, 'logistics') *
    dutyMultiplier(s, 'transport') *
    (1 + economy(s).legacy.exploration * 0.12)
  );
}
export function routeUpkeep(s: State, r: number): Cost {
  const yieldPerSecond = routeYield(s, r);
  return {
    food: yieldPerSecond * (3 + r),
    gold: yieldPerSecond * (1 + r * 0.5),
  };
}
// Compute fair simultaneous shares; array order never gives one region priority.
export function transportPlan(s: State): {
  yields: number[];
  food: number;
  gold: number;
} {
  const yields = economy(s).routes.map((_, r) =>
    Math.min(
      routeYield(s, r),
      Math.max(
        0,
        C.materialCapacity(s, REGION_MATERIALS[r]) -
          s.world.materials[REGION_MATERIALS[r]],
      ),
    ),
  );
  const food = yields.reduce((n, y, r) => n + y * (3 + r), 0),
    gold = yields.reduce((n, y, r) => n + y * (1 + r * 0.5), 0);
  const reserve = economy(s).reserve,
    foodAvailable = Math.max(
      0,
      s.resources.food - baseCapacity(s, 'food') * reserve,
    ),
    goldAvailable = Math.max(
      0,
      s.resources.gold - baseCapacity(s, 'gold') * reserve,
    );
  const share = Math.max(
    0,
    Math.min(
      1,
      food ? foodAvailable / food : 1,
      gold ? goldAvailable / gold : 1,
    ),
  );
  return {
    yields: yields.map((y) => y * share),
    food: food * share,
    gold: gold * share,
  };
}
export function baseCapacity(s: State, k: Resource): number {
  const b = {
    wood: 120,
    food: 100,
    stone: 100,
    gold: 100,
    iron: 60,
    crystal: 40,
  };
  return Math.floor(
    b[k] *
      2 ** s.buildings.warehouse *
      (s.research.includes('baskets') ? 1.5 : 1) *
      (k === 'food' && s.research.includes('preservation') ? 1.5 : 1) *
      storageMultiplier(s) *
      Civic.renovationFactor(s, 'warehouse', 0.04),
  );
}
export function processingLevel(s: State, id: WorkId): number {
  return developmentLevel(
    s,
    { boards: 'carpentry', steel: 'metalwork', runes: 'inscription' }[
      id
    ] as DevelopmentId,
  );
}
export function processingMultiplier(s: State, id: WorkId): number {
  return (
    1.16 ** processingLevel(s, id) *
    dutyMultiplier(s, 'workshop') *
    (economy(s).modes[id] === 'rush'
      ? 1.5
      : economy(s).modes[id] === 'efficient'
        ? 2 / 3
        : 1)
  );
}
export function processingOutput(s: State, id: WorkId): number {
  return 1 + Math.floor(processingLevel(s, id) / 4);
}
export function processingBill(
  s: State,
  id: WorkId,
): { cost: Cost; materials: MaterialCost } {
  const recipe = WORK_RECIPES.find((r) => r.id === id)!;
  const mode = economy(s).modes[id],
    factor = mode === 'efficient' ? 0.75 : mode === 'rush' ? 1.5 : 1;
  return {
    cost: Object.fromEntries(
      Object.entries(recipe.cost).map(([k, n]) => [k, Math.ceil(n! * factor)]),
    ),
    materials: Object.fromEntries(
      Object.entries(recipe.materials).map(([k, n]) => [k, n! * factor]),
    ),
  };
}
export function setWorkMode(s0: State, id: WorkId, mode: WorkMode): State {
  if (
    !WORK_IDS.includes(id) ||
    !['steady', 'efficient', 'rush'].includes(mode) ||
    !workModesUnlocked(s0, id)
  )
    return s0;
  const s = structuredClone(s0);
  s.economy.modes[id] = mode;
  return s;
}
export function setWorkTarget(s0: State, id: WorkId, target: number): State {
  if (
    !stockControlsUnlocked(s0) ||
    !WORK_IDS.includes(id) ||
    ![0.25, 0.5, 0.75, 1].includes(target)
  )
    return s0;
  const s = structuredClone(s0);
  s.economy.targets[id] = target;
  return s;
}
export function setResourceReserve(s0: State, reserve: number): State {
  if (!stockControlsUnlocked(s0) || ![0, 0.1, 0.25, 0.5].includes(reserve))
    return s0;
  const s = structuredClone(s0);
  s.economy.reserve = reserve;
  return s;
}
export function workshopTarget(s: State, id: WorkId): number {
  return Math.floor(C.materialCapacity(s, id) * economy(s).targets[id]);
}
export function reserveReason(s: State, cost: Cost): string {
  const reserve = economy(s).reserve;
  if (!reserve) return '';
  const blocked = Object.entries(cost).find(
    ([k, n]) =>
      s.resources[k as Resource] - n! <
      baseCapacity(s, k as Resource) * reserve,
  );
  return blocked
    ? `${RESOURCE_NAMES[blocked[0] as Resource]}已到保留线 ${Math.round(reserve * 100)}%，可调整保留比例`
    : '';
}
export const workModesUnlocked = (s: State, id: WorkId) =>
  processingLevel(s, id) >= 2 || economy(s).legacy.industry > 0;
export const stockControlsUnlocked = (s: State) =>
  developmentLevel(s, 'storage') >= 2 || economy(s).legacy.industry > 0;
export const orderBatches = (s: State) =>
  ([1, 4, 16, 64] as const).filter(
    (_, i) => i === 0 || developmentLevel(s, 'commerce') >= i * 4 - 2,
  );
export function setOrderBatch(s0: State, batch: number): State {
  if (
    !s0.buildings.market ||
    !orderBatches(s0).includes(batch as 1 | 4 | 16 | 64)
  )
    return s0;
  const s = structuredClone(s0);
  s.economy.orderBatch = batch as 1 | 4 | 16 | 64;
  s.economy.orderProgress = 0;
  return s;
}
export function civicOrder(s: State) {
  const rank = Math.min(2, C.townRank(s)),
    recipe = ORDER_RECIPES[rank];
  const completed = economy(s).orders,
    scale =
      (1 + Math.min(8, Math.floor(completed / 5)) * 0.25) *
      (economy(s).orderBatch || 1);
  const cost = Object.fromEntries(
    Object.entries(recipe.cost).map(([k, n]) => [k, Math.ceil(n! * scale)]),
  );
  const gold = Math.ceil(
    [35, 65, 120][rank] * scale * (1 + developmentLevel(s, 'commerce') * 0.04),
  );
  return {
    ...recipe,
    cost,
    gold,
    seconds: Math.ceil(
      recipe.seconds / (1 + developmentLevel(s, 'commerce') * 0.04),
    ),
  };
}
export function orderReason(s: State): string {
  if (!s.buildings.market) return '先建造集市';
  const order = civicOrder(s);
  if (s.resources.gold + order.gold > baseCapacity(s, 'gold'))
    return '金币空间不足，订单暂存';
  return missing(s, order.cost) || reserveReason(s, order.cost);
}
export function toggleCivicOrder(s0: State): State {
  if (!s0.buildings.market) return s0;
  const s = structuredClone(s0);
  s.economy.orderActive = !s.economy.orderActive;
  return s;
}
export function economyTick(s: State): void {
  const e = s.economy;
  for (const [duty, id] of Object.entries(e.duties))
    if (!s.heroes.some((h) => h.id === id)) delete e.duties[duty as Duty];
  const plan = transportPlan(s);
  s.resources.food = Math.max(0, s.resources.food - plan.food);
  s.resources.gold = Math.max(0, s.resources.gold - plan.gold);
  plan.yields.forEach((n, r) => {
    s.world.materials[REGION_MATERIALS[r]] += n;
    e.routes[r].delivered += n;
  });
  if (e.orderActive && !orderReason(s)) {
    e.orderProgress++;
    const order = civicOrder(s);
    if (e.orderProgress >= order.seconds) {
      pay(s, order.cost);
      s.resources.gold += order.gold;
      e.orders++;
      e.orderProgress = 0;
    }
  }
  const teacher = dutyHero(s, 'academy');
  if (teacher && s.time % 10 === 0) {
    const cap = Math.min(
      40,
      [6, 10, 16, 24, 32, 40][C.townRank(s)] + educationLevels(s),
    );
    const pupils = s.heroes.filter(
      (h) => !s.party.includes(h.id) && h.level < cap,
    );
    const cost = { food: pupils.length * 2, gold: pupils.length };
    if (!missing(s, cost) && !reserveReason(s, cost)) {
      pay(s, cost);
      for (const h of pupils) {
        if (h.level >= cap) continue;
        h.xp +=
          (4 + teacher.level * 0.5) *
          educationMultiplier(s) *
          dutyMultiplier(s, 'academy') *
          talentExperience(h) *
          originEffect(h).experience *
          Civic.civicExperience(s) *
          Civic.LEARNING_FACTORS[h.quality - 1];
        while (h.level < cap && h.xp >= 60 + h.level * h.level * 10) {
          h.xp -= 60 + h.level * h.level * 10;
          h.level++;
        }
        if (h.level >= cap) h.xp = Math.min(h.xp, 60 + h.level * h.level * 10);
      }
    }
  }
}
export function migrateEconomy(s: State): void {
  s.economy = freshEconomy();
  // Existing roads and paid projects become infrastructure; no free production:
  // every route still needs workers and food/gold assigned by the player.
  s.economy.routes.forEach((route, r) => {
    if (regionalDepth(s, r) > 0)
      route.level = Math.min(2, s.guild.outposts[r] || 1);
  });
}
export function validateEconomy(s: State): void {
  const e = s.economy;
  const fail = () => {
    throw Error('经营与后勤记录无效');
  };
  const n = (v: unknown, max = 1e12) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;
  const i = (v: unknown, max: number) => n(v, max) && Number.isInteger(v);
  const exact = (v: unknown, keys: readonly string[]) =>
    !!v &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    Object.keys(v).length === keys.length &&
    keys.every((k) => Object.hasOwn(v, k));
  const keys = [
    'development',
    'routes',
    'modes',
    'targets',
    'reserve',
    'duties',
    'production',
    'crafted',
    'orders',
    'orderProgress',
    'orderActive',
    'legacy',
  ];
  if (
    !exact(
      e,
      Object.hasOwn(e || {}, 'orderBatch') ? [...keys, 'orderBatch'] : keys,
    )
  )
    return fail();
  if (e.orderBatch !== undefined && !orderBatches(s).includes(e.orderBatch))
    return fail();
  if (
    !exact(e.development, DEVELOPMENT_IDS) ||
    !Object.values(e.development).every((v) => i(v, DEVELOPMENT_MAX))
  )
    return fail();
  if (
    !Array.isArray(e.routes) ||
    e.routes.length !== 6 ||
    e.routes.some(
      (r, index) =>
        !exact(r, ['level', 'crew', 'enabled', 'delivered']) ||
        !i(r.level, 4) ||
        !i(r.crew, 3) ||
        typeof r.enabled !== 'boolean' ||
        !n(r.delivered) ||
        (!r.level && (r.crew || r.enabled)) ||
        (r.level > 0 && regionalDepth(s, index) < 1),
    )
  )
    return fail();
  if (transportLines(s) > transportSlots(s) || freeEconomyWorkers(s) < 0)
    return fail();
  if (
    !exact(e.modes, WORK_IDS) ||
    !Object.values(e.modes).every((v) =>
      ['steady', 'efficient', 'rush'].includes(v),
    ) ||
    !exact(e.targets, WORK_IDS) ||
    !Object.values(e.targets).every((v) => [0.25, 0.5, 0.75, 1].includes(v)) ||
    ![0, 0.1, 0.25, 0.5].includes(e.reserve)
  )
    return fail();
  if (
    !e.duties ||
    typeof e.duties !== 'object' ||
    Array.isArray(e.duties) ||
    Object.entries(e.duties).some(
      ([d, id]) =>
        !['transport', 'workshop', 'academy'].includes(d) ||
        typeof id !== 'string' ||
        !s.heroes.some((h) => h.id === id),
    ) ||
    new Set(Object.values(e.duties)).size !== Object.keys(e.duties).length
  )
    return fail();
  if (
    !exact(e.production, Object.keys(RESOURCE_NAMES)) ||
    !Object.values(e.production).every((v) => n(v)) ||
    !exact(e.crafted, WORK_IDS) ||
    !Object.values(e.crafted).every((v) => n(v)) ||
    !i(e.orders, 1e8) ||
    !n(e.orderProgress, 120) ||
    typeof e.orderActive !== 'boolean'
  )
    return fail();
  if (
    !exact(e.legacy, ['industry', 'scholarship', 'exploration']) ||
    !Object.values(e.legacy).every((v) => i(v, 10))
  )
    return fail();
}
