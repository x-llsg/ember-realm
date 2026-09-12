'use client';
import '@/app/world-exploration.css';
import * as G from '@/lib/realm';
import { MaterialName, ResourceName, InfoHint } from './info-hint';
import { duration, short } from './realm-panels';

/** Small local line drawings, deliberately separate from equipment rarity. */
export function RelicSigil({
  id,
  large = false,
}: {
  id: string;
  large?: boolean;
}) {
  const paths = [
    'M8 9h16v14H8zM12 5v4m8-4v4M12 23v4m8-4v4M4 13h4m-4 6h4m16-6h4m-4 6h4M13 13h6v6h-6z',
    'M9 5h14M9 27h14M11 5v5l10 12v5M21 5v5L11 22v5M12 11h8M12 23h8',
    'M16 5a11 11 0 1 0 0 22 11 11 0 0 0 0-22M16 9v7l5 3M8 8l3 3m10 10 3 3M24 8l-3 3',
    'M5 7h8l3 3 3-3h8v18h-8l-3 3-3-3H5zM16 10v18M8 12h4m-4 5h4m8-5h4m-4 5h4',
    'M9 5v22M23 5v22M9 8h14M9 15h14M9 23h14M4 27l9-9m6 0 9 9',
    'M7 11c0-9 18-9 18 0 0 6-18 5-18 12 0 7 18 7 18 0 0-6-18-6-18-12M11 9l10 14',
    'M7 14h18v12H7zM11 14V9m5 5V5m5 9V8M11 22h10',
    'M7 9l9-5 9 5v14l-9 5-9-5zM11 13h10m-10 6h10M16 9v14',
    'M6 10h20v17H6zM10 10V5h12v5M6 16h20M12 21h8',
    'M8 6l13 13c6 6 10-5 3-5M8 6l-3 7 7-3M17 16l-6 11',
    'M16 3l4 9 9 4-9 4-4 9-4-9-9-4 9-4zM16 10v12m-6-6h12',
    'M7 23h18l-4-6V12c0-7-10-7-10 0v5zM13 27h6M16 3v3M4 12l3 2m18 0 3-2',
  ];
  const index = Math.max(0, Math.min(11, Number(id.slice(1)) - 1));
  return (
    <span className={`world-sigil${large ? ' large' : ''}`} aria-hidden="true">
      <svg
        viewBox="0 0 32 32"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={paths[index]} />
      </svg>
    </span>
  );
}

export function WorldBill({
  s,
  cost = {},
  materials = {},
  potions = {},
  empty = '无需额外物资',
  reward = false,
}: {
  s: G.State;
  cost?: G.Cost;
  materials?: G.MaterialCost;
  potions?: Partial<Record<G.PotionId, number>>;
  empty?: string;
  reward?: boolean;
}) {
  const count = [...Object.values(cost), ...Object.values(materials), ...Object.values(potions)].filter(n => n! > 0).length;
  return (
    <div className="world-bill">
      {!count && <span className="desk-muted">{empty}</span>}
      {Object.entries(cost)
        .filter(([, n]) => n! > 0)
        .map(([id, amount]) => (
          <span
            key={id}
            className={
              !reward && s.resources[id as G.Resource] < amount! ? 'short' : ''
            }
          >
            <ResourceName s={s} id={id as G.Resource} /> <b>{short(amount!)}</b>
          </span>
        ))}
      {Object.entries(materials)
        .filter(([, n]) => n! > 0)
        .map(([id, amount]) => (
          <span
            key={id}
            className={
              !reward && s.world.materials[id as G.MaterialId] < amount!
                ? 'short'
                : ''
            }
          >
            <MaterialName s={s} id={id as G.MaterialId} />{' '}
            <b>{short(amount!)}</b>
          </span>
        ))}
      {Object.entries(potions)
        .filter(([, n]) => n! > 0)
        .map(([id, amount]) => (
          <span key={id}>
            <InfoHint
              title={G.POTIONS.find((p) => p.id === id)?.name || '药剂'}
              body="药剂来自实际调配库存；确认使用后支付，预览不消耗。"
            >
              {G.POTIONS.find((p) => p.id === id)?.name || '药剂'}
            </InfoHint>{' '}
            <b>{amount}</b>
          </span>
        ))}
    </div>
  );
}

export function WorldTime({
  seconds,
  total,
  label,
}: {
  seconds: number;
  total: number;
  label: string;
}) {
  return (
    <div className="world-time">
      <div>
        <span>{label}</span>
        <strong>{duration(Math.max(0, seconds))}</strong>
      </div>
      <progress
        aria-label={label}
        value={Math.max(0, total - seconds)}
        max={Math.max(1, total)}
      />
    </div>
  );
}
