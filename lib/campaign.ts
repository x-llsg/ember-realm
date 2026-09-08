import * as E from './economy.ts';
import * as Civic from './civic.ts';
import type { State, BuildingId, Cost } from './realm.ts';
import {
  MATERIAL_IDS,
  MATERIAL_NAMES,
  MATERIAL_SOURCES,
  MATERIAL_CAPACITIES,
  WORK_IDS,
  WORK_RECIPES,
  TECHNOLOGIES,
  BUILDING_LIMITS,
  REGION_MATERIALS,
  CAMPAIGN_REGION_NAMES,
} from './campaign-data.ts';
import type {
  WorldState,
  MaterialId,
  MaterialCost,
  WorkId,
  Technology,
} from './campaign-data.ts';
export * from './campaign-data.ts';

type CampaignState = State & { world: WorldState };
const RESOURCE_NAMES: Record<string, string> = {
  wood: '木材',
  food: '口粮',
  stone: '石料',
  gold: '金币',
  iron: '铁锭',
  crystal: '魔晶',
};
const RECIPE_IDS = [
  'cap',
  'grips',
  'boots',
  'blade',
  'bow',
  'pike',
  'staff',
  'plate',
  'firecoat',
  'shadowcoat',
  'dawncoat',
  'vitality',
  'wardstone',
];
const world = (s: State): WorldState => (s as CampaignState).world;
const has = (s: State, id: string) => !!world(s)?.tech.includes(id);
const depth = (s: State, r: number) =>
  s.cleared.includes(r) ? 5 : Math.max(0, Math.min(5, s.guild.depths[r] || 0));
const techName = (id: string) =>
  TECHNOLOGIES.find((t) => t.id === id)?.name || id;
const fmt = (n: number) => Number(n.toFixed(2)).toString();
function note(s: State, text: string, kind = 'good') {
  s.log.unshift({ time: s.time, text, kind });
  s.log = s.log.slice(0, 100);
}
export function freshWorld(): WorldState {
  return {
    materials: {
      timber: 0,
      essence: 0,
      ore: 0,
      ember: 0,
      scale: 0,
      star: 0,
      boards: 0,
      steel: 0,
      runes: 0,
    },
    tech: [],
    work: { boards: false, steel: false, runes: false },
    workProgress: { boards: 0, steel: 0, runes: 0 },
  };
}
export function townRank(s: State): number {
  if (has(s, 'mythic')) return 5;
  if (has(s, 'dragoncraft') || has(s, 'infernalcraft')) return 4;
  if (has(s, 'citadel')) return 3;
  if (has(s, 'metallurgy') || has(s, 'runecraft')) return 2;
  return has(s, 'settlement') ? 1 : 0;
}
function limits(id: BuildingId): readonly number[] {
  if (id === 'hut' || id === 'warehouse' || id === 'tavern')
    return BUILDING_LIMITS[id];
  return BUILDING_LIMITS.production;
}
export function buildingLimit(s: State, id: BuildingId): number {
  return id === 'fire' ? 1 : limits(id)[townRank(s)];
}
/** Capacity is per material, independent of ordinary resource warehouses. */
export function materialCapacity(s: State, _id?: MaterialId): number {
  return Math.floor(MATERIAL_CAPACITIES[townRank(s)] * E.storageMultiplier(s));
}
export function materialCostText(cost: MaterialCost): string {
  return MATERIAL_IDS.filter((id) => (cost[id] || 0) > 0)
    .map((id) => `${fmt(cost[id]!)} ${MATERIAL_NAMES[id]}`)
    .join(' · ');
}
function validMaterialCost(cost: MaterialCost): boolean {
  return (
    !!cost &&
    typeof cost === 'object' &&
    !Array.isArray(cost) &&
    Object.entries(cost).every(
      ([id, n]) =>
        MATERIAL_IDS.includes(id as MaterialId) &&
        typeof n === 'number' &&
        Number.isFinite(n) &&
        n >= 0,
    )
  );
}
export function canAffordMaterials(s: State, cost: MaterialCost): boolean {
  return (
    validMaterialCost(cost) &&
    Object.entries(cost).every(
      ([id, n]) => (world(s)?.materials[id as MaterialId] || 0) >= n!,
    )
  );
}
/** Mutates only after checking the entire bill, so failure spends nothing. */
export function spendMaterials(s: State, cost: MaterialCost): boolean {
  if (!canAffordMaterials(s, cost)) return false;
  for (const [id, n] of Object.entries(cost))
    world(s).materials[id as MaterialId] -= n!;
  return true;
}
export function materialReason(s: State, cost: MaterialCost): string {
  if (!validMaterialCost(cost)) return '材料费用无效';
  const over = MATERIAL_IDS.filter(
    (id) => (cost[id] || 0) > materialCapacity(s, id),
  );
  if (over.length)
    return `材料容量不足：${over.map((id) => `${MATERIAL_NAMES[id]}需要 ${cost[id]} / 上限 ${materialCapacity(s, id)}`).join('；')}，先研究城镇进阶`;
  const missing = MATERIAL_IDS.filter(
    (id) => (world(s)?.materials[id] || 0) < (cost[id] || 0),
  );
  return missing.length
    ? missing
        .map(
          (id) =>
            `${MATERIAL_NAMES[id]} ${fmt(world(s)?.materials[id] || 0)}/${cost[id]}（${MATERIAL_SOURCES[id]}）`,
        )
        .join('；')
    : '';
}
function processedMaterial(s: State): 'steel' | 'runes' {
  // Prefer a route the player can currently afford, then their learned branch.
  if (has(s, 'metallurgy') && has(s, 'runecraft'))
    return world(s).materials.steel >= world(s).materials.runes
      ? 'steel'
      : 'runes';
  return has(s, 'metallurgy') ? 'steel' : 'runes';
}
function advancedMaterial(s: State): 'scale' | 'ember' {
  if (has(s, 'dragoncraft') && has(s, 'infernalcraft'))
    return world(s).materials.scale >= world(s).materials.ember
      ? 'scale'
      : 'ember';
  return has(s, 'dragoncraft') ? 'scale' : 'ember';
}
export function buildingMaterialCost(s: State, id: BuildingId): MaterialCost {
  if (id === 'fire') return {};
  const level = s.buildings[id] + 1;
  const stage = limits(id).findIndex((limit) => level <= limit);
  if (stage <= 0) return {};
  if (stage === 1) return { boards: Math.max(2, level) };
  const cost: MaterialCost = {
    boards: Math.min(24, level + stage * 2),
    [processedMaterial(s)]: stage * 2 - 2,
  };
  if (stage >= 4) cost[advancedMaterial(s)] = 3;
  if (stage >= 5) Object.assign(cost, { star: 2, scale: 4, ember: 4 });
  return cost;
}
export function regionReason(s: State, r: number): string {
  if (!Number.isInteger(r) || r < 0 || r > 5) return '未知地区';
  if (!s.buildings.tavern) return '先建造酒馆并招募冒险者';
  if (r === 0) return '';
  if (r === 1)
    return depth(s, 0) >= 1
      ? ''
      : '低语森林推进至深度 1，发现通往灰钟废墟的道路';
  if (r === 2)
    return depth(s, 0) >= 2 ? '' : '低语森林推进至深度 2，打通赤砂古道';
  if (r === 3)
    return s.cleared.includes(1) || s.cleared.includes(2)
      ? ''
      : '击败灰钟废墟或赤砂古道的任一首领，找到永夜王庭';
  if (r === 4)
    return depth(s, 2) >= 2 || depth(s, 1) >= 3
      ? ''
      : '赤砂古道推进至深度 2，或灰钟废墟推进至深度 3，找到登山路线';
  return s.cleared.includes(3) && s.cleared.includes(4)
    ? ''
    : '击败永夜王庭与龙脊雪山的两位首领，打开破碎天穹';
}
export const regionOpen = (s: State, r: number): boolean => !regionReason(s, r);
export function objectiveRegion(s: State): number {
  if (!has(s, 'settlement')) return 0;
  if (townRank(s) === 1) {
    const candidates = [1, 2].filter((r) => regionOpen(s, r));
    return candidates.sort((a, b) => depth(s, b) - depth(s, a))[0] ?? 0;
  }
  if (!s.cleared.includes(1) && !s.cleared.includes(2))
    return depth(s, 2) > depth(s, 1) ? 2 : 1;
  for (const r of [3, 4, 5])
    if (regionOpen(s, r) && !s.cleared.includes(r)) return r;
  return [0, 1, 2].find((r) => regionOpen(s, r) && !s.cleared.includes(r)) ?? 5;
}
export function gearTier(s: State): number {
  return [1, 1, 2, 3, 4, 6][townRank(s)];
}
export function recipeUnlockReason(s: State, id: string, tier = 1): string {
  if (!RECIPE_IDS.includes(id)) return '未知装备配方';
  if (!Number.isInteger(tier) || tier < 1 || tier > 6)
    return '装备阶级须为 T1 至 T6';
  if (tier > gearTier(s))
    return `当前最高可打造 T${gearTier(s)}；先研究城镇进阶`;
  if (['cap', 'grips', 'boots'].includes(id) && !s.buildings.forge)
    return '建造锻造坊后开放扩展行装';
  if (id === 'pike' && !has(s, 'metallurgy')) return '先研究金属工艺';
  if (['staff', 'shadowcoat'].includes(id) && !has(s, 'runecraft'))
    return '先研究符文工艺';
  if (id === 'firecoat' && depth(s, 4) < 1)
    return '先到龙脊雪山取得首处营地与脱落龙鳞';
  if (id === 'wardstone' && !has(s, 'runecraft')) return '先研究符文工艺';
  if (id === 'dawncoat' && townRank(s) < 4) return '先研究龙鳞工艺或魔焰工艺';
  return '';
}
export function recipeMaterialCost(
  s: State,
  id: string,
  tier = gearTier(s),
): MaterialCost {
  if (
    !RECIPE_IDS.includes(id) ||
    !Number.isInteger(tier) ||
    tier < 1 ||
    tier > 6
  )
    return {};
  const cost: MaterialCost = {};
  if (id === 'pike') cost.ore = 2;
  if (id === 'firecoat') cost.scale = 6;
  if (id === 'dawncoat') cost.ember = 6;
  if (['staff', 'shadowcoat', 'wardstone'].includes(id)) cost.essence = 2;
  if (tier >= 2) {
    cost.boards = tier * 2;
    cost[processedMaterial(s)] = [0, 0, 2, 4, 8, 12, 20][tier];
  }
  if (tier >= 4) cost[advancedMaterial(s)] = (tier - 2) * 6;
  if (tier >= 5) cost.star = tier === 5 ? 16 : 32;
  return cost;
}
export function projectMaterialCost(s: State, r: number): MaterialCost {
  const costs: MaterialCost[] = [
    { timber: 12, boards: 10 },
    { essence: 30, boards: 25, runes: 15 },
    { ore: 35, boards: 25, steel: 15 },
    { ember: 80, boards: 60, [processedMaterial(s)]: 40 },
    { scale: 100, boards: 80, [processedMaterial(s)]: 50 },
    { star: 160, scale: 80, ember: 80, runes: 120, steel: 120 },
  ];
  return costs[r] || {};
}
function prerequisites(s: State, t: Technology): string {
  const q = t.requires;
  const missing = q.allTech?.filter((id) => !has(s, id)) || [];
  if (missing.length) return `先研究${missing.map(techName).join('、')}`;
  if (q.anyTech?.length && !q.anyTech.some((id) => has(s, id)))
    return `先研究${q.anyTech.map(techName).join('或')}`;
  if (q.depth && depth(s, q.depth.region) < q.depth.value)
    return `${CAMPAIGN_REGION_NAMES[q.depth.region]}推进至深度 ${q.depth.value}`;
  if (q.bossAny?.length && !q.bossAny.some((r) => s.cleared.includes(r)))
    return `击败${q.bossAny.map((r) => CAMPAIGN_REGION_NAMES[r]).join('或')}的任一首领`;
  if (q.bossAll?.some((r) => !s.cleared.includes(r)))
    return `击败${q.bossAll
      .filter((r) => !s.cleared.includes(r))
      .map((r) => CAMPAIGN_REGION_NAMES[r])
      .join('与')}的首领`;
  return '';
}
function resourceReason(s: State, cost: Cost): string {
  const over = Object.entries(cost).filter(
    ([id, n]) => n! > E.baseCapacity(s, id as keyof Cost),
  );
  if (over.length)
    return `仓库容量不足：${over.map(([id]) => RESOURCE_NAMES[id]).join('、')}，先扩建仓库`;
  const missing = Object.entries(cost).filter(
    ([id, n]) => s.resources[id as keyof Cost] + 1e-8 < n!,
  );
  return missing.length
    ? missing
        .map(
          ([id, n]) =>
            `${RESOURCE_NAMES[id]} ${fmt(s.resources[id as keyof Cost])}/${n}`,
        )
        .join('；')
    : '';
}
export function technologyReason(s: State, id: string): string {
  const t = TECHNOLOGIES.find((item) => item.id === id);
  if (!t) return '未知进阶研究';
  if (has(s, id)) return '已经完成研究';

  return (
    prerequisites(s, t) ||
    resourceReason(s, t.cost) ||
    materialReason(s, t.materials)
  );
}
export function technologyPrerequisiteReason(s: State, id: string): string {
  const t = TECHNOLOGIES.find((t) => t.id === id);
  return !t ? '未知工艺' : prerequisites(s, t);
}
export function studyTechnology(s0: State, id: string): State {
  if (technologyReason(s0, id)) return s0;
  const t = TECHNOLOGIES.find((item) => item.id === id)!;
  const s = structuredClone(s0);
  for (const [key, amount] of Object.entries(t.cost))
    s.resources[key as keyof Cost] -= amount!;
  spendMaterials(s, t.materials);
  world(s).tech.push(id);
  note(s, `完成「${t.name}」。${t.desc}`, 'story');
  return s;
}
export function workReason(s: State, id: WorkId): string {
  const recipe = WORK_RECIPES.find((item) => item.id === id);
  if (!recipe) return '未知加工配方';
  if (!has(s, recipe.tech)) return `先研究${techName(recipe.tech)}`;
  if (
    world(s).materials[id] + E.processingOutput(s, id) >
    E.workshopTarget(s, id)
  )
    return `${MATERIAL_NAMES[id]}已满仓，加工暂停且不消耗原料`;
  const bill = E.processingBill(s, id);
  return (
    resourceReason(s, bill.cost) ||
    materialReason(s, bill.materials) ||
    E.reserveReason(s, bill.cost)
  );
}
export function workStations(s: State, id: WorkId): number {
  const building =
    id === 'boards'
      ? s.buildings.lumber
      : id === 'steel'
        ? s.buildings.forge
        : s.buildings.shrine;
  return Math.min(4, 1 + Math.floor(Math.max(0, building - 1) / 3));
}
export function workDuration(s: State, id: WorkId): number {
  const recipe = WORK_RECIPES.find((r) => r.id === id)!;
  const building =
    id === 'boards'
      ? s.buildings.lumber
      : id === 'steel'
        ? s.buildings.forge
        : s.buildings.shrine;
  const doctrine =
    id === 'runes' ? s.guild.doctrine.scholarship : s.guild.doctrine.smithing;
  return Math.max(
    2,
    Math.ceil(
      recipe.seconds /
        ((1 + Math.max(0, building - 1) * 0.15 + doctrine * 0.05) *
          workStations(s, id) *
          E.processingMultiplier(s, id) *
          Civic.renovationFactor(
            s,
            id === 'boards' ? 'lumber' : id === 'steel' ? 'forge' : 'shrine',
            0.02,
          ) *
          (Civic.buffActive(s, 'artisan') ? 1.25 : 1)),
    ),
  );
}
export function toggleWork(s0: State, id: WorkId, enabled?: boolean): State {
  const recipe = WORK_RECIPES.find((item) => item.id === id);
  if (
    !recipe ||
    !has(s0, recipe.tech) ||
    (enabled !== undefined && typeof enabled !== 'boolean')
  )
    return s0;
  const s = structuredClone(s0);
  world(s).work[id] = enabled ?? !world(s).work[id];
  const reason = workReason(s, id);
  note(
    s,
    `${recipe.name}${world(s).work[id] ? '已启用' : '已暂停'}${world(s).work[id] && reason ? `；${reason}，条件满足后自动继续` : ''}。`,
  );
  return s;
}
/** Mutates state. Call once per simulated second after ordinary production. */
export function worldTick(s: State, seconds = 1): void {
  if (!Number.isFinite(seconds) || seconds <= 0 || !world(s)) return;
  for (const recipe of WORK_RECIPES) {
    if (!world(s).work[recipe.id] || workReason(s, recipe.id)) continue;
    const total = world(s).workProgress[recipe.id] + seconds;
    const duration = workDuration(s, recipe.id),
      output = E.processingOutput(s, recipe.id),
      bill = E.processingBill(s, recipe.id);
    let batches = Math.min(
      Math.floor(total / duration),
      Math.floor(
        (E.workshopTarget(s, recipe.id) - world(s).materials[recipe.id]) /
          output,
      ),
    );
    for (const [id, n] of Object.entries(bill.cost))
      batches = Math.min(
        batches,
        Math.floor(
          (s.resources[id as keyof Cost] -
            E.baseCapacity(s, id as keyof Cost) * s.economy.reserve +
            1e-8) /
            n!,
        ),
      );
    for (const [id, n] of Object.entries(bill.materials))
      batches = Math.min(
        batches,
        Math.floor((world(s).materials[id as MaterialId] + 1e-8) / n!),
      );
    batches = Math.max(0, batches);
    if (batches > 0) {
      for (const [id, n] of Object.entries(bill.cost))
        s.resources[id as keyof Cost] = Math.max(
          0,
          s.resources[id as keyof Cost] - n! * batches,
        );
      for (const [id, n] of Object.entries(bill.materials))
        world(s).materials[id as MaterialId] = Math.max(
          0,
          world(s).materials[id as MaterialId] - n! * batches,
        );
      world(s).materials[recipe.id] += output * batches;
      s.economy.crafted[recipe.id] += output * batches;
    }
    world(s).workProgress[recipe.id] =
      batches < Math.floor(total / duration) ? 0 : total - batches * duration;
  }
}
/** Market handling and warehouse loading expand returning supply caravans. */
export function supplyLoad(s: State): number {
  return (
    (1 + Math.floor((s.buildings.market + s.buildings.warehouse) / 4)) *
    (s.research.includes('supply_chain') ? 1.5 : 1)
  );
}
export function expeditionMaterialAmount(
  s: State,
  r: number,
  route: string,
): number {
  return route === 'supply'
    ? Math.floor((4 + depth(s, r) * 2) * supplyLoad(s))
    : 2 + depth(s, r);
}
/** Every successful route yields its regional material; cleared supply routes remain useful. */
export function grantExpeditionMaterials(
  s: State,
  r: number,
  route: string,
  success: boolean,
): string {
  if (
    !success ||
    !Number.isInteger(r) ||
    r < 0 ||
    r > 5 ||
    !['supply', 'survey', 'frontier'].includes(route)
  )
    return '';
  const id = REGION_MATERIALS[r];
  const found = expeditionMaterialAmount(s, r, route);
  const kept = Math.min(
    found,
    materialCapacity(s, id) - world(s).materials[id],
  );
  world(s).materials[id] += kept;
  return `${MATERIAL_NAMES[id]} +${kept}${kept < found ? `（材料仓已满，${found - kept} 未能带回）` : ''}`;
}
export function expeditionMaterialPreview(
  s: State,
  r: number,
  route: string,
): string {
  const n = expeditionMaterialAmount(s, r, route);
  return s.explored[r] || s.guild.depths[r] || s.cleared.includes(r)
    ? `成功归来必得 ${n} ${MATERIAL_NAMES[REGION_MATERIALS[r]]}${route === 'supply' ? ` · 车队运量 ×${supplyLoad(s)}（集市、仓库${s.research.includes('supply_chain') ? '、驿站' : ''}）` : '，用于当地工艺与装备'}`
    : '沿途可能带回未知样品；首次归来后由工匠辨认用途';
}
function exactKeys(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}
/** Throw on malformed v5 data. Do not call migration to repair an invalid v5 save. */
export function validateWorld(s: State): void {
  const value: unknown = (s as CampaignState).world;
  const fail = (message: string): never => {
    throw new Error(`世界存档无效：${message}`);
  };
  if (!exactKeys(value, ['materials', 'tech', 'work', 'workProgress']))
    fail('字段不完整或含未知字段');
  const w = value as unknown as WorldState;
  if (!exactKeys(w.materials, MATERIAL_IDS)) fail('材料字段不完整或含未知材料');
  if (
    !Array.isArray(w.tech) ||
    w.tech.some(
      (id) => typeof id !== 'string' || !TECHNOLOGIES.some((t) => t.id === id),
    ) ||
    new Set(w.tech).size !== w.tech.length
  )
    fail('研究列表无效');
  if (
    !exactKeys(w.work, WORK_IDS) ||
    WORK_IDS.some((id) => typeof w.work[id] !== 'boolean')
  )
    fail('加工开关无效');
  if (!exactKeys(w.workProgress, WORK_IDS)) fail('加工进度字段无效');
  for (const id of MATERIAL_IDS)
    if (
      !Number.isFinite(w.materials[id]) ||
      w.materials[id] < 0 ||
      w.materials[id] > materialCapacity(s, id)
    )
      fail(`${MATERIAL_NAMES[id]}数量超出容量或不是非负数`);
  for (const recipe of WORK_RECIPES) {
    const n = w.workProgress[recipe.id];
    if (!Number.isFinite(n) || n < 0 || n > recipe.seconds * 1.5)
      fail(`${recipe.name}进度无效`);
    if (!w.tech.includes(recipe.tech) && (w.work[recipe.id] || n !== 0))
      fail(`${recipe.name}尚未解锁`);
  }
  for (const t of TECHNOLOGIES)
    if (w.tech.includes(t.id) && prerequisites(s, t))
      fail(`${t.name}缺少进展条件`);
}
/** Mutates legacy state; earned milestones carry across without charging research again. */
export function migrateWorld(s: State): void {
  if ((s as CampaignState).world !== undefined) {
    validateWorld(s);
    return;
  }
  (s as CampaignState).world = freshWorld();
  // Order is topological; metallurgy and runecraft are independent siblings.
  for (const t of TECHNOLOGIES)
    if (!prerequisites(s, t)) world(s).tech.push(t.id);
  validateWorld(s);
}
