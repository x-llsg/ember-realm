import type { Battle, Cost, State } from './realm.ts';
import type { MaterialCost } from './campaign-data.ts';
import type { WorldEconomyState } from './site-economy-types.ts';

export type SiteVariant = 'A' | 'B';
export type SiteMethod = 'assault' | 'clever';
export type SiteRewardKind = 'basic' | 'material';
export type SiteBillKind = 'construction' | 'supply' | 'sample';
export interface SiteBundle {
  cost: Cost;
  materials: MaterialCost;
}
export interface SiteQuote extends SiteBundle {
  seconds: number;
  reason: string;
}
export interface SitePreview {
  variant: SiteVariant;
  seed: number;
  serial: number;
}
export interface SiteReceipt {
  id: number;
  runId: number;
  siteId: string;
  time: number;
  variant: SiteVariant;
  method: SiteMethod;
  rewardKind: SiteRewardKind;
  original: SiteBundle;
  kept: SiteBundle;
  remaining: SiteBundle;
  abandoned: SiteBundle;
  first: boolean;
  won: boolean;
  retreated: boolean;
  read: boolean;
}
export interface SiteProgress {
  discovered: boolean;
  firstCompleted: boolean;
  routesCompleted: SiteMethod[];
  preview: SitePreview;
  readyAt: number;
  lastResult: SiteReceipt | null;
  pendingReceipt: SiteReceipt | null;
}
/** Immutable payment limits captured when an automatic trip actually starts. */
export interface SiteRepeatLimits {
  reserve: Cost;
  maxExtraCost: Cost;
  maxExtraMaterials: MaterialCost;
}
export interface SiteRun {
  id: number;
  siteId: string;
  variant: SiteVariant;
  previewSerial: number;
  previewSeed: number;
  phase: 'outbound' | 'awaitingChoice' | 'resolving' | 'battle' | 'returning';
  remaining: number;
  total: number;
  startedAt: number;
  method: SiteMethod | null;
  rewardKind: SiteRewardKind;
  rewards: SiteBundle;
  travelPaid: SiteBundle;
  extraQuote: SiteQuote;
  paidExtra: SiteBundle;
  helped: boolean;
  billKind: SiteBillKind;
  partyIds: string[];
  combatSnapshot: Battle;
  preparation: State['guild']['preparation'];
  paidPreparation: boolean;
  // automatic is current control; autoMethod/limits retain the original trip
  // snapshot even after a failed automatic payment or a manual takeover.
  automatic: boolean;
  autoMethod: SiteMethod | null;
  waitingReason: string;
  repeatLimits: SiteRepeatLimits | null;
}
export interface SiteStrategy {
  method: SiteMethod;
  rewardKind: SiteRewardKind;
}
export interface SiteRepeatOptions extends SiteRepeatLimits {
  strategies: Record<SiteVariant, SiteStrategy | null>;
  limit: number;
}
export interface SiteRepeatPlan extends SiteRepeatOptions {
  enabled: boolean;
  siteId: string;
  completed: number;
  reason: string;
  preparation: State['guild']['preparation'];
  /** Existing trip excluded from this new plan's count; 0 when set while idle. */
  startsAfterRunId: number;
}
export interface WorldExplorationState extends WorldEconomyState {
  sites: Record<string, SiteProgress>;
  activeRun: SiteRun | null;
  repeatPlan: SiteRepeatPlan | null;
  runSerial: number;
  receiptSerial: number;
  ui: { lastSites: Record<string, string | null> };
}
