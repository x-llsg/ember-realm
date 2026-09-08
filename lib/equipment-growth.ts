/** Flat equipment investment is strongest during the early potential-growth gap.
 * All ranks remain strictly stronger; resistance and penetration are never scaled. */
export const EQUIPMENT_BASE_SCALE = [4.5, 4.5, 3.2, 2.6, 2, 1.8] as const;
export const EQUIPMENT_DEFENSE_SCALE = 2;
export function gearTierScale(tier: number): number {
  const index = Math.max(0, Math.min(5, Math.trunc(tier) - 1));
  return 1.75 ** index * EQUIPMENT_BASE_SCALE[index];
}
