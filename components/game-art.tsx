import type { CSSProperties } from 'react';
import { ItemArt } from './item-art';
import '../app/game-art.css';

const roles = [
  'rhea',
  'finn',
  'luna',
  'kael',
  'orin',
  'ash',
  'nyx',
  'sylva',
  'vera',
];
const regions = ['forest', 'ruins', 'desert', 'abyss', 'dragon', 'heaven'];
const siteEnemies = [
  'S01',
  'S02',
  'S03',
  'S04',
  'S05',
  'S06',
  'S07',
  'S08',
  'S09',
  'S10',
  'S11',
  'S12',
];
type ArtSize = 'sm' | 'md' | 'lg';
type HeroIdentity = {
  role?: string;
  id?: string;
  name?: string;
  quality?: number;
};
const safeIndex = (value: number, max: number) =>
  Math.max(0, Math.min(max, Math.trunc(Number.isFinite(value) ? value : 0)));

/** Class portraits deliberately share an archetype; recruit identities and game RNG remain untouched. */
export function HeroPortrait({
  hero,
  size = 'md',
  className = '',
}: {
  hero: HeroIdentity;
  size?: ArtSize;
  className?: string;
}) {
  const index = Math.max(0, roles.indexOf(hero.role ?? 'rhea'));
  return (
    <span
      aria-hidden="true"
      className={`game-portrait hero-portrait art-${size} ${className}`}
      data-quality={hero.quality ?? 1}
      style={{
        backgroundImage: 'var(--art-portraits)',
        backgroundSize: '300% 300%',
        backgroundPosition: `${(index % 3) * 50}% ${Math.floor(index / 3) * 50}%`,
      }}
    />
  );
}

export function EnemyPortrait({
  region,
  node = 5,
  size = 'md',
  className = '',
}: {
  region: number;
  node?: number;
  size?: ArtSize;
  className?: string;
}) {
  const index = safeIndex(node, 5);
  return (
    <span
      aria-hidden="true"
      className={`game-portrait enemy-portrait art-${size} ${className}`}
      style={{
        backgroundImage: `var(--art-enemies-${regions[safeIndex(region, 5)]})`,
        backgroundSize: '300% 200%',
        backgroundPosition: `${(index % 3) * 50}% ${Math.floor(index / 3) * 100}%`,
      }}
    />
  );
}

/** Twelve independent location enemies, ordered left to right across the 4-by-3 atlas. */
export function SiteEnemyPortrait({
  siteId,
  size = 'md',
  className = '',
}: {
  siteId: string;
  size?: ArtSize;
  className?: string;
}) {
  const index = Math.max(0, siteEnemies.indexOf(siteId));
  return (
    <span
      aria-hidden="true"
      className={`game-portrait enemy-portrait site-enemy-portrait art-${size} ${className}`}
      style={{
        backgroundImage: 'var(--art-enemies-sites)',
        backgroundSize: '400% 300%',
        backgroundPosition: `${(index % 4) * (100 / 3)}% ${Math.floor(index / 4) * 50}%`,
      }}
    />
  );
}

export function RegionScene({
  region,
  className = '',
}: {
  region: number;
  className?: string;
}) {
  const index = safeIndex(region, 5);
  return (
    <span
      aria-hidden="true"
      className={`region-scene ${className}`}
      style={
        {
          '--region-x': `${(index % 3) * 50}%`,
          '--region-y': `${Math.floor(index / 3) * 100}%`,
        } as CSSProperties
      }
    >
      <span />
    </span>
  );
}

export const GameIcon = ItemArt;
