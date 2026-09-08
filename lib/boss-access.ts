import type { State } from './realm.ts';

export const BOSS_ACCESS_DEPTH = 3;
export const BOSS_ARMOR_BREAK_DEPTH = 4;
export const BOSS_WEAKENED_ARMOR_SCALE = 0.85;

/** Captured outposts, never the boss-clear flag, determine the approach. */
export function bossArmorScale(s: State, region: number) {
  return s.guild.depths[region] >= BOSS_ARMOR_BREAK_DEPTH
    ? BOSS_WEAKENED_ARMOR_SCALE
    : 1;
}

export function bossApproach(s: State, region: number) {
  const depth = s.guild.depths[region] || 0;
  const accessible = depth >= BOSS_ACCESS_DEPTH;
  const weakened = depth >= BOSS_ARMOR_BREAK_DEPTH;
  return {
    depth,
    required: BOSS_ACCESS_DEPTH,
    accessible,
    weakened,
    armorScale: bossArmorScale(s, region),
    label: weakened ? '护甲已削弱' : '全盛首领',
    detail: !accessible
      ? `占领第 ${BOSS_ACCESS_DEPTH} 处据点后，可挑战全盛首领；也可继续夺取据点再战。`
      : !weakened
        ? '可以立即挑战全盛首领；继续夺取第 4 处据点，可使首领护甲降低 15%。'
        : depth < 5
          ? '第 4 处据点使首领护甲降低 15%；再夺取第 5 处据点，补给材料基础运量增至 14。'
          : '五处据点均已占领：首领护甲降低 15%，补给材料基础运量为 14。',
  };
}
