import * as G from './realm.ts';
import type { Gear, GearSlot } from './guild-data.ts';

export type SalvageRarity = 1 | 2 | 3 | 4 | 5 | 6;
export type SalvageStock = Record<SalvageRarity, number>;
export const SALVAGE_CAP = 9999;
export const SALVAGE_MATERIALS: { rarity: SalvageRarity; name: string }[] = [
  { rarity: 1, name: '朴素残片' },
  { rarity: 2, name: '精良残片' },
  { rarity: 3, name: '稀有残片' },
  { rarity: 4, name: '史诗残片' },
  { rarity: 5, name: '传说残片' },
  { rarity: 6, name: '神话残片' },
];

export function freshSalvage(): SalvageStock {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
}
export function salvageCount(s: G.State, rarity: number) {
  return s.guild.salvage?.[rarity as SalvageRarity] ?? 0;
}
export function salvageYield(item: Gear) {
  return { dust: item.tier * item.rarity * 4,
    rarity: item.rarity as SalvageRarity, material: item.tier };
}
export function validateSalvage(s: G.State) {
  if (!Object.hasOwn(s.guild, 'salvage')) s.guild.salvage = freshSalvage();
  const stock = s.guild.salvage;
  if (!stock || typeof stock !== 'object' || Array.isArray(stock) ||
      Object.keys(stock).length !== SALVAGE_MATERIALS.length ||
      !SALVAGE_MATERIALS.every(({ rarity }) => Object.hasOwn(stock, rarity) &&
        Number.isInteger(stock[rarity]) && stock[rarity] >= 0 && stock[rarity] <= SALVAGE_CAP))
    throw Error('装备残片库存无效');
}

export function gearOwner(s: G.State, id: string) {
  return [...s.heroes, ...s.guild.applicants].find((h) => Object.values(h.equipment).includes(id));
}
export function toggleGearLock(s0: G.State, id: string, locked?: boolean) {
  const item = s0.guild.inventory.find((g) => g.id === id);
  if (!item || (locked !== undefined && typeof locked !== 'boolean')) return s0;
  const next = locked ?? !item.locked;
  if (!!item.locked === next) return s0;
  const s = G.clone(s0);
  const changed = s.guild.inventory.find((g) => g.id === id)!;
  if (next) changed.locked = true;
  else delete changed.locked;
  return s;
}

export interface DismantleOptions {
  includeSets?: boolean;
  includeEnhanced?: boolean;
  allowOverflow?: boolean;
}
export function dismantleReason(s: G.State, id: string, options: DismantleOptions = {}) {
  const item = s.guild.inventory.find((g) => g.id === id);
  if (!item) return '装备已不在仓库';
  if (G.gearAway(s, id)) return '该装备随角色出征，归来并卸下后才能分解';
  if (gearOwner(s, id)) return '已装备，先卸下后才能分解';
  if (item.locked) return '已收藏，先取消收藏后才能分解';
  if (item.setId && options.includeSets !== true) return '套装保护：未包含套装装备';
  if (item.upgrade > 0 && options.includeEnhanced !== true) return '强化保护：未包含强化装备';
  return '';
}
export function dismantleQuote(s: G.State, ids: readonly string[], options: DismantleOptions = {}) {
  const items: Gear[] = [], skipped: { id: string; reason: string }[] = [];
  const salvage = freshSalvage(), lostSalvage = freshSalvage();
  let totalDust = 0;
  for (const id of new Set(ids)) {
    const reason = dismantleReason(s, id, options);
    if (reason) { skipped.push({ id, reason }); continue; }
    const item = s.guild.inventory.find((g) => g.id === id)!;
    const gain = salvageYield(item);
    items.push(item);
    totalDust += gain.dust;
    salvage[gain.rarity] += gain.material;
  }
  const dust = Math.min(totalDust, SALVAGE_CAP - s.guild.dust), lostDust = totalDust - dust;
  for (const { rarity } of SALVAGE_MATERIALS) {
    const incoming = salvage[rarity];
    salvage[rarity] = Math.min(incoming, SALVAGE_CAP - salvageCount(s, rarity));
    lostSalvage[rarity] = incoming - salvage[rarity];
  }
  const full = SALVAGE_MATERIALS.find(({ rarity }) => lostSalvage[rarity] > 0);
  const reason = !items.length ? '没有可分解的装备'
    : options.allowOverflow === true ? ''
    : lostDust > 0 ? '锻造尘容量不足，整批分解不会执行'
    : full ? `${full.name}容量不足，整批分解不会执行` : '';
  return { ids: items.map((g) => g.id), items, skipped, count: items.length, dust, salvage, lostDust, lostSalvage, reason };
}
export function bulkDismantleGear(s0: G.State, ids: readonly string[], options: DismantleOptions = {}) {
  const quote = dismantleQuote(s0, ids, options);
  if (quote.reason) return s0;
  const s = G.clone(s0), selected = new Set(quote.ids);
  s.guild.inventory = s.guild.inventory.filter((g) => !selected.has(g.id));
  s.guild.dust += quote.dust;
  s.guild.salvage ??= freshSalvage();
  for (const { rarity } of SALVAGE_MATERIALS) s.guild.salvage[rarity] += quote.salvage[rarity];
  const gains = SALVAGE_MATERIALS.filter(({ rarity }) => quote.salvage[rarity] > 0)
    .map(({ rarity, name }) => `${name} +${quote.salvage[rarity]}`).join('、');
  const losses = [
    ...(quote.lostDust ? [`锻造尘 ${quote.lostDust}`] : []),
    ...SALVAGE_MATERIALS.filter(({ rarity }) => quote.lostSalvage[rarity] > 0)
      .map(({ rarity, name }) => `${name} ${quote.lostSalvage[rarity]}`),
  ].join('、');
  G.log(s, `分解 ${quote.count} 件装备：锻造尘 +${quote.dust}${gains ? `，${gains}` : ''}${losses ? `；已按确认丢弃超量材料：${losses}` : ''}。`, 'good');
  return s;
}

export function reforgeQuote(s: G.State, id: string, affix: number) {
  const item = s.guild.inventory.find((g) => g.id === id);
  const rarity = (item?.rarity ?? 1) as SalvageRarity;
  const materialName = SALVAGE_MATERIALS.find((m) => m.rarity === rarity)!.name;
  const dust = item ? 40 * item.tier * item.rarity : 0;
  const material = item ? 2 * item.tier : 0;
  const reason = !item ? '装备已不在仓库'
    : !Number.isInteger(affix) || !G.AFFIXES[affix] ? '请选择有效的装备词条'
    : G.gearAway(s, id) ? '该装备随角色出征，归来后可重铸'
    : item.affix === affix ? '已经是该词条'
    : salvageCount(s, rarity) < material ? `${materialName}不足：需要 ${material}，现有 ${salvageCount(s, rarity)}`
    : s.guild.dust < dust ? `锻造尘不足：需要 ${dust}，现有 ${s.guild.dust}` : '';
  return { dust, rarity, material, materialName, reason };
}
export const reforgeReason = (s: G.State, id: string, affix: number) => reforgeQuote(s, id, affix).reason;

export type GearSort = 'recent' | 'rarity' | 'tier' | 'name';
export interface GearFilter {
  rarities?: readonly number[];
  slot?: GearSlot | 'all';
  set?: string;
  equipped?: 'all' | 'equipped' | 'unequipped';
  locked?: 'all' | 'locked' | 'unlocked';
  search?: string;
  sort?: GearSort;
}
export function filterGear(s: G.State, filters: GearFilter = {}) {
  const equipped = new Set([...s.heroes, ...s.guild.applicants].flatMap((h) => Object.values(h.equipment)));
  const position = new Map(s.guild.inventory.map((g, i) => [g.id, i]));
  const search = filters.search?.trim().toLocaleLowerCase('zh-CN') ?? '';
  return s.guild.inventory.filter((item) => {
    const recipe = G.RECIPES.find((r) => r.id === item.recipe)!;
    return (!filters.rarities?.length || filters.rarities.includes(item.rarity)) &&
      (!filters.slot || filters.slot === 'all' || recipe.slot === filters.slot) &&
      (!filters.set || filters.set === 'all' || (filters.set === 'none' ? !item.setId : item.setId === filters.set)) &&
      (!filters.equipped || filters.equipped === 'all' || equipped.has(item.id) === (filters.equipped === 'equipped')) &&
      (!filters.locked || filters.locked === 'all' || !!item.locked === (filters.locked === 'locked')) &&
      (!search || G.gearName(item).toLocaleLowerCase('zh-CN').includes(search));
  }).sort((a, b) => {
    const recent = position.get(b.id)! - position.get(a.id)!;
    if (filters.sort === 'rarity') return b.rarity - a.rarity || b.tier - a.tier || b.upgrade - a.upgrade || recent;
    if (filters.sort === 'tier') return b.tier - a.tier || b.rarity - a.rarity || b.upgrade - a.upgrade || recent;
    if (filters.sort === 'name') return G.gearName(a).localeCompare(G.gearName(b), 'zh-CN') || recent;
    return recent;
  });
}
