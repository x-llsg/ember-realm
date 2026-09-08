import {
  GUARDIANS as candidates,
  BOSSES,
  type EnemyCandidate,
} from './guardian-candidates.ts';
const patterns: Record<EnemyCandidate['pattern'], string[]> = {
  patrol: ['strike', 'strike', 'heavy'],
  pack: ['strike', 'heavy', 'strike'],
  ward: ['ward', 'strike', 'heavy'],
  bell: ['ward', 'strike', 'heavy', 'strike'],
  charge: ['strike', 'heavy', 'strike', 'heavy'],
  restore: ['strike', 'restore', 'heavy', 'strike'],
  curse: ['strike', 'seal', 'heavy', 'strike'],
  channel: ['strike', 'channel', 'strike', 'heavy'],
  claw: ['strike', 'strike', 'heavy'],
  flight: ['flight', 'strike', 'heavy', 'flight'],
  seal: ['seal', 'strike', 'heavy', 'strike'],
  law: ['seal', 'strike', 'channel', 'heavy'],
};
const adapt = (e: EnemyCandidate) => ({
  ...e,
  defense: e.armor,
  pattern: patterns[e.pattern],
  crit: e.node === 6 ? 0.08 : 0.04,
  aoeScale: e.heavyMultiplier,
});
export const GUARDIANS = Array.from({ length: 6 }, (_, region) =>
  candidates.filter((e) => e.region === region).map(adapt),
);
export const BOSS_COMBAT = BOSSES.map(adapt);
