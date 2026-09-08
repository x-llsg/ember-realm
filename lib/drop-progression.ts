import type { State } from './realm.ts';
import {
  REGION_DROP_TIERS,
  REGION_DROP_RANKS,
  GUARDIAN_DROP_CHANCES,
  GUARDIAN_RARITY_WEIGHTS,
  EXPEDITION_DROP_CHANCES,
  BOSS_RED_CHANCE,
} from './equipment-data.ts';

export type DropKind = 'expedition' | 'guardian' | 'boss';
export type DropWeights = [number, number, number, number, number, number];
export interface DropProfile {
  kind: DropKind;
  region: number;
  node: number;
  tier: number;
  chance: number;
  /** Conditional probabilities after equipment drops, in white through red order. */
  rarityWeights: DropWeights;
  guaranteed: boolean;
  cleared: boolean;
  tierAfterClear: number;
  unlockedTier: number;
}

/** Any branch boss can open its equipment stage; the forest is not mandatory. */
export function unlockedDropTier(s: State, winningRegion?: number) {
  const clears = winningRegion === undefined ? s.cleared : [...s.cleared, winningRegion];
  return Math.min(6, Math.max(1, ...clears.map((region) => REGION_DROP_TIERS[region] + 1)));
}

/** Only the defeated region advances its loot; old equipment is never rewritten. */
export function regionDropTier(s: State, region: number, victory = false) {
  if (!Number.isInteger(region) || region < 0 || region >= REGION_DROP_TIERS.length)
    throw new RangeError('未知掉落地区');
  return Math.min(unlockedDropTier(s, victory ? region : undefined), REGION_DROP_TIERS[region] + Number(victory || s.cleared.includes(region)));
}

/** Shared by actual rolls and player-facing previews; no RNG or state mutation. */
export function dropProfile(
  s: State,
  region: number,
  kind: DropKind,
  node = 0,
  firstClear = false,
): DropProfile {
  const tierAfterClear = regionDropTier(s, region, true);
  const rank = REGION_DROP_RANKS[region];
  const depth = Math.max(0, Math.min(kind === 'expedition' ? 5 : 4, Math.floor(Number.isFinite(node) ? node : 0)));
  const guaranteed = kind === 'boss' || (firstClear && (kind === 'expedition' || depth === 2));
  let chance: number;
  let weights: DropWeights;
  if (kind === 'boss') {
    chance = 1;
    weights = [0, 0, 52 - rank * 5, 34 + rank * 2, 12 + rank * 2, BOSS_RED_CHANCE * 100 + rank];
  } else if (kind === 'guardian') {
    chance = guaranteed ? 1 : GUARDIAN_DROP_CHANCES[depth] + rank * 0.02;
    const local = GUARDIAN_RARITY_WEIGHTS[depth];
    weights = [0, local[0] - rank * 5, local[1] + rank, local[2] + rank * 3, local[3] + rank, 0];
  } else {
    chance = guaranteed ? 1 : EXPEDITION_DROP_CHANCES[depth] + rank * 0.02;
    const quality = depth + rank;
    weights = [60 - quality * 5, 28 + quality, 10 + quality * 3, 2 + quality * 0.75, quality * 0.25, 0];
  }
  if (guaranteed && kind !== 'boss') {
    weights[2] += weights[0] + weights[1];
    weights[0] = weights[1] = 0;
  }
  return {
    kind,
    region,
    node: depth,
    tier: kind === 'boss' ? tierAfterClear : regionDropTier(s, region),
    chance: Math.min(1, chance),
    rarityWeights: weights.map((weight) => weight / 100) as DropWeights,
    guaranteed,
    cleared: s.cleared.includes(region),
    tierAfterClear,
    unlockedTier: unlockedDropTier(s, kind === 'boss' ? region : undefined),
  };
}

/** Descending order keeps rare outcomes on the same low random-number boundary. */
export function rollDropRarity(profile: DropProfile, value: number) {
  let cumulative = 0;
  for (let rarity = 6; rarity >= 1; rarity--) {
    cumulative += profile.rarityWeights[rarity - 1];
    if (value < cumulative) return rarity;
  }
  return 1;
}

const percent = (value: number) => `${Number((value * 100).toFixed(2))}%`;
export function dropSummary(profile: DropProfile) {
  return `T${profile.tier} · ${profile.guaranteed ? '必掉装备' : `掉装 ${percent(profile.chance)}`}${profile.kind === 'expedition' ? ' · 散件' : ' · 地区套装'}`;
}
export function dropHelp(profile: DropProfile) {
  const names = ['白·朴素', '绿·精良', '蓝·稀有', '紫·史诗', '金·传说', '红·神话'];
  const distribution = profile.rarityWeights
    .map((weight, index) => weight > 0 ? `${names[index]} ${percent(weight)}` : '')
    .filter(Boolean).join('、');
  const promotion = profile.kind === 'boss'
    ? '本次胜利奖励已按通关后的装备阶级计算。'
    : profile.cleared
      ? '本区已通关，之后新掉落使用通关后的装备阶级。'
      : `击败本区首领后，本区新掉落提升至 T${profile.tierAfterClear}，首胜战利品立即生效。`;
  return {
    title: profile.kind === 'boss' ? '首领战利品' : profile.kind === 'guardian' ? `第 ${profile.node + 1} 处守敌掉落` : '远征装备收获',
    body: `每次${profile.kind === 'expedition' ? '成功归来' : '胜利'}掉装概率 ${percent(profile.chance)}；获得 T${profile.tier} ${profile.kind === 'expedition' ? '散件' : '本区套装'}。${profile.kind === 'expedition' ? '失败或主动撤回没有装备掉落。' : ''}\n成功掉装后的品质概率：${distribution}。${profile.kind !== 'boss' ? '\n红色神话装备仅由首领掉落。' : ''}${profile.guaranteed && profile.kind === 'guardian' ? '\n首次击败第三处守敌，必得蓝色及以上套装；重战不重复保底。' : ''}\n${promotion}\n未击败任何首领时，所有地区只掉 T1；任意分支首领都能解锁更高阶级。本区仍受自身阶级上限限制，不会随最后一张地图无限升阶。掉落不受城镇锻造研究限制，已有装备保持原阶级。`,
  };
}
