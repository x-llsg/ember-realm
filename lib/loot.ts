import * as G from './realm.ts';

export const MAX_LOOT_HISTORY = 40;
export type LootSource = 'guardian' | 'boss' | 'expedition' | 'forge' | 'visitor';
export interface LootConversion {
  dust: number;
  rarity: number;
  material: number;
  lostDust?: number;
  lostMaterial?: number;
}
export interface LootReceipt {
  serial: number;
  time: number;
  source: LootSource;
  sourceName: string;
  item: G.Gear;
  outcome: 'stored' | 'converted';
  conversion?: LootConversion;
}
export function recordLoot(
  s: G.State,
  item: G.Gear,
  source: LootSource,
  sourceName: string,
  outcome: LootReceipt['outcome'] = 'stored',
  conversion?: LootConversion,
): LootReceipt {
  const receipt: LootReceipt = {
    serial: (s.guild.lootSerial || 0) + 1,
    time: s.time,
    source,
    sourceName,
    item: { ...item },
    outcome,
    ...(conversion ? { conversion: { ...conversion } } : {}),
  };
  s.guild.lootSerial = receipt.serial;
  s.guild.lootReadSerial ||= 0;
  s.guild.lootHistory = [receipt, ...(s.guild.lootHistory || [])].slice(0, MAX_LOOT_HISTORY);
  return receipt;
}
export const lootUnread = (s: G.State) => (s.guild.lootHistory || [])
  .filter((r) => r.serial > (s.guild.lootReadSerial || 0)).length;
export const latestBattleLoot = (s: G.State) => (s.guild.lootHistory || [])
  .find((r) => r.source === 'boss' || r.source === 'guardian');
export function readLoot(s0: G.State, through = s0.guild.lootSerial || 0) {
  if (!Number.isInteger(through) || through < 0 || through > (s0.guild.lootSerial || 0) ||
    through <= (s0.guild.lootReadSerial || 0)) return s0;
  const s = G.clone(s0);
  s.guild.lootReadSerial = through;
  return s;
}
export function lootOutcomeText(receipt: LootReceipt) {
  if (receipt.outcome === 'stored') return '已入库';
  const c = receipt.conversion!;
  return `库满转化：锻造尘 +${c.dust}、${G.SALVAGE_MATERIALS[c.rarity - 1].name} +${c.material}` +
    ((c.lostDust || c.lostMaterial) ? `；材料仓满，损失 ${c.lostDust || 0} 尘 / ${c.lostMaterial || 0} 残片` : '');
}
export function validLootReceipt(s: G.State, value: unknown): value is LootReceipt {
  const r = value as LootReceipt;
  const int = (x: unknown, min: number, max: number) => typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max;
  if (!r || typeof r !== 'object' || Array.isArray(r) ||
    !int(r.serial, 1, s.guild.lootSerial || 0) || !Number.isFinite(r.time) || r.time < 0 || r.time > s.time ||
    !['guardian', 'boss', 'expedition', 'forge', 'visitor'].includes(r.source) ||
    typeof r.sourceName !== 'string' || !r.sourceName.length || r.sourceName.length > 100 ||
    !['stored', 'converted'].includes(r.outcome)) return false;
  const i = r.item;
  if (!i || typeof i !== 'object' || Array.isArray(i) || typeof i.id !== 'string' || i.id.length > 60 ||
    !i.id.length || !G.RECIPES.some((recipe) => recipe.id === i.recipe) ||
    !int(i.tier, 1, 6) || !int(i.rarity, 1, 6) || !int(i.affix, 0, G.AFFIXES.length - 1) || !int(i.upgrade, 0, 8) ||
    (i.setId !== undefined && !G.EQUIPMENT_SETS.some((set) => set.id === i.setId)) ||
    (i.locked !== undefined && typeof i.locked !== 'boolean')) return false;
  const c = r.conversion;
  if (r.outcome === 'stored') return c === undefined;
  return !!c && typeof c === 'object' && !Array.isArray(c) &&
    int(c.dust, 0, 9999) && int(c.material, 0, 9999) && int(c.rarity, 1, 6) && c.rarity === i.rarity &&
    (c.lostDust === undefined || int(c.lostDust, 0, 9999)) &&
    (c.lostMaterial === undefined || int(c.lostMaterial, 0, 9999)) &&
    c.dust + (c.lostDust || 0) === i.tier * i.rarity * 4 &&
    c.material + (c.lostMaterial || 0) === i.tier;
}
export function validateLoot(s: G.State) {
  const g = s.guild;
  if (g.lootHistory === undefined && g.lootSerial === undefined && g.lootReadSerial === undefined) {
    g.lootHistory = []; g.lootSerial = 0; g.lootReadSerial = 0;
  }
  if (!Array.isArray(g.lootHistory) || g.lootHistory.length > MAX_LOOT_HISTORY ||
    !Number.isInteger(g.lootSerial) || g.lootSerial! < 0 || g.lootSerial! > 1e8 ||
    !Number.isInteger(g.lootReadSerial) || g.lootReadSerial! < 0 || g.lootReadSerial! > g.lootSerial! ||
    g.lootHistory.some((r, index, list) => !validLootReceipt(s, r) || (index > 0 && r.serial >= list[index - 1].serial)))
    throw Error('装备收获记录无效');
}
