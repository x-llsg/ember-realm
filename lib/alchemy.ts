import * as G from './realm.ts';
import type { PotionId } from './guild-data.ts';
import type { MaterialCost } from './campaign-data.ts';

export const POTIONS: {
  id: PotionId;
  name: string;
  element: PotionId;
  tech: string;
  cost: G.Cost;
  materials: MaterialCost;
  effect: string;
}[] = [
  {
    id: 'shadow', name: '镇魂药剂', element: 'shadow', tech: 'settlement',
    cost: { food: 40, gold: 35 }, materials: { essence: 2 },
    effect: '一份供全队使用；本场暗影抗性 +20%。',
  },
  {
    id: 'fire', name: '辟火药剂', element: 'fire', tech: 'settlement',
    cost: { food: 40, gold: 35 }, materials: { ore: 2 },
    effect: '一份供全队使用；本场火焰抗性 +20%。',
  },
  {
    id: 'radiant', name: '逆律药剂', element: 'radiant', tech: 'runecraft',
    cost: { food: 60, gold: 60, crystal: 12 }, materials: { runes: 1 },
    effect: '一份供全队使用；本场神圣抗性 +20%。',
  },
];

export function freshPotions(): Record<PotionId, number> {
  return { shadow: 0, fire: 0, radiant: 0 };
}
export const potionCapacity = (s: G.State) => 8 + G.townRank(s) * 4;
export function potionCount(s: G.State, id: PotionId) {
  return s.guild.potions?.[id] ?? 0;
}
export function potionUnlockReason(s: G.State, id: PotionId) {
  const recipe = POTIONS.find((p) => p.id === id);
  if (!recipe) return '未知药剂配方';
  if (!s.world.tech.includes(recipe.tech))
    return `先研究${G.TECHNOLOGIES.find((t) => t.id === recipe.tech)!.name}`;
  return '';
}
export function craftPotionReason(s: G.State, id: PotionId) {
  const locked = potionUnlockReason(s, id);
  if (locked) return locked;
  const recipe = POTIONS.find((p) => p.id === id)!;
  if (potionCount(s, id) >= potionCapacity(s)) return `${recipe.name}库存已满`;
  if (!G.canPay(s, recipe.cost)) return `物资不足：${G.costText(recipe.cost)}`;
  return G.materialReason(s, recipe.materials);
}
export function craftPotion(s0: G.State, id: PotionId): G.State {
  if (craftPotionReason(s0, id)) return s0;
  const recipe = POTIONS.find((p) => p.id === id)!;
  const s = G.clone(s0);
  for (const [key, value] of Object.entries(recipe.cost))
    s.resources[key as G.Resource] -= value!;
  G.spendMaterials(s, recipe.materials);
  s.guild.potions[id]++;
  G.log(s, `调配了 1 份${recipe.name}，可供全队使用一场。`, 'good');
  return s;
}
export function hasPreparedPotion(s: G.State, element: G.Element) {
  return element !== 'physical' &&
    s.guild.preparation.element === element && potionCount(s, element) > 0;
}
export function preparedPotionReason(s: G.State) {
  const id = s.guild.preparation.element;
  if (id === 'physical' || potionCount(s, id) > 0) return '';
  const name = POTIONS.find((p) => p.id === id)?.name || '抗性药剂';
  return `${name}库存不足：先调配 1 份，或取消携带`;
}
export function consumePreparedPotion(s: G.State) {
  const id = s.guild.preparation.element;
  if (id !== 'physical' && potionCount(s, id) > 0) s.guild.potions[id]--;
}
export function validatePotions(s: G.State) {
  // Missing inventory is an older save, not an entitlement to free doses.
  if (!Object.hasOwn(s.guild, 'potions')) s.guild.potions = freshPotions();
  const stock = s.guild.potions;
  if (!stock || typeof stock !== 'object' || Array.isArray(stock) ||
      Object.keys(stock).length !== POTIONS.length ||
      !POTIONS.every((p) => Object.hasOwn(stock, p.id) &&
        Number.isInteger(stock[p.id]) && stock[p.id] >= 0 &&
        stock[p.id] <= potionCapacity(s)))
    throw Error('药剂库存无效');
}
