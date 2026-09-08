import * as G from './realm.ts';
import * as C from './campaign.ts';
import type { MaterialCost } from './campaign-data.ts';
import { originEffect } from './origins.ts';

/** Each tier is a paid training milestone, never a retroactive save restriction. */
export const MASTERY_STAGES = [
  { level: 8, name: '实战入门', requirement: '掌握金属或符文工艺，并夺取对应地区的首处据点', cost: { gold: 180, food: 100, iron: 20 } },
  { level: 16, name: '城塞研修', requirement: '掌握城塞营造，并击败灰钟废墟或赤砂古道的首领', cost: { gold: 900, food: 400, iron: 60, crystal: 30 } },
  { level: 22, name: '异域精修', requirement: '掌握魔焰或龙鳞工艺，并夺取对应地区的第二处据点', cost: { gold: 4000, food: 1800, iron: 180, crystal: 90 } },
  { level: 30, name: '天穹领悟', requirement: '掌握凡人的神话，击败魔王与古龙，并夺取破碎天穹的首处据点', cost: { gold: 12000, food: 5000, iron: 600, crystal: 300 } },
  { level: 36, name: '凡人极境', requirement: '掌握凡人的神话，击败魔王与古龙，并夺取破碎天穹的第四处据点', cost: { gold: 30000, food: 12000, iron: 1200, crystal: 700 } },
] as const;

const has = (s: G.State, id: string) => s.world.tech.includes(id);
const depth = (s: G.State, region: number) => s.guild.depths[region] || 0;
function stageOpen(s: G.State, stage: number): boolean {
  if (stage === 1)
    return (has(s, 'metallurgy') && depth(s, 2) >= 1) ||
      (has(s, 'runecraft') && depth(s, 1) >= 1);
  if (stage === 2)
    return has(s, 'citadel') && [1, 2].some((r) => s.cleared.includes(r));
  if (stage === 3)
    return (has(s, 'infernalcraft') && depth(s, 3) >= 2) ||
      (has(s, 'dragoncraft') && depth(s, 4) >= 2);
  return has(s, 'mythic') && [3, 4].every((r) => s.cleared.includes(r)) &&
    depth(s, 5) >= (stage === 4 ? 1 : 4);
}

/** Town progression ceiling; a particular hero must also meet the listed level. */
export function masteryLimit(s: G.State): number {
  if (s.buildings.tavern < 2) return 0;
  for (let stage = 1; stage <= MASTERY_STAGES.length; stage++)
    if (!stageOpen(s, stage)) return stage - 1;
  return MASTERY_STAGES.length;
}

export function masteryCost(h: G.Hero): G.Cost {
  const stage = MASTERY_STAGES[h.mastery];
  if (!stage) return {};
  return Object.fromEntries(Object.entries(stage.cost)
    .map(([id, amount]) => [id, Math.ceil(amount * originEffect(h).mastery)]));
}

/** Stable branch selection keeps the displayed bill identical to the payment. */
export function masteryMaterials(s: G.State, h: G.Hero): MaterialCost {
  if (h.mastery < 0 || h.mastery >= MASTERY_STAGES.length) return {};
  const metal = has(s, 'metallurgy');
  const processed = metal ? 'steel' : 'runes';
  const regional = metal ? 'ore' : 'essence';
  const advanced = has(s, 'dragoncraft') ? 'scale' : 'ember';
  const bills: MaterialCost[] = [
    { boards: 6, [processed]: 2 },
    { boards: 16, [processed]: 8, [regional]: 8 },
    { boards: 30, [processed]: 18, [advanced]: 8 },
    { boards: 60, [processed]: 36, [advanced]: 20, star: 4 },
    { boards: 100, [processed]: 70, scale: 30, ember: 30, star: 12 },
  ];
  return Object.fromEntries(Object.entries(bills[h.mastery])
    .map(([id, amount]) => [id, Math.ceil(amount! * originEffect(h).mastery)]));
}

export function masteryUnlockReason(s: G.State, h: G.Hero): string {
  if (!s.heroes.some((entry) => entry.id === h.id)) return '该角色尚未加入公会';
  if (h.mastery >= MASTERY_STAGES.length) return '已完成全部五阶专精';
  if (G.heroAway(s, h.id)) return G.heroAwayReason(s, h.id);
  if (s.buildings.tavern < 2) return '酒馆达到 2 级后可进行专精培养';
  const stage = MASTERY_STAGES[h.mastery];
  if (!stage || !Number.isInteger(h.mastery)) return '专精阶级无效';
  if (h.level < stage.level) return `第 ${h.mastery + 1} 阶专精需要角色达到 ${stage.level} 级`;
  if (masteryLimit(s) < h.mastery + 1) return stage.requirement;
  return '';
}

export function masteryReason(s: G.State, h: G.Hero): string {
  const unlock = masteryUnlockReason(s, h);
  if (unlock) return unlock;
  const cost = masteryCost(h);
  const missing = Object.entries(cost).filter(([id, amount]) =>
    s.resources[id as G.Resource] < amount!);
  return G.capacityReason(s, cost) ||
    (missing.length ? `还缺 ${missing.map(([id, amount]) =>
      `${G.RESOURCE_NAMES[id as G.Resource]} ${Math.ceil(amount! - s.resources[id as G.Resource])}`).join('、')}` : '') ||
    C.materialReason(s, masteryMaterials(s, h));
}
