import type { Cost } from './realm-data.ts';
import type { MaterialCost, WorkId } from './campaign-data.ts';
import type { PotionId } from './guild-data.ts';

export type FacilityModeId = 'A' | 'B';
export interface EconomyQuote {
  cost: Cost;
  materials: MaterialCost;
  seconds: number;
  reason: string;
  outputCost?: Cost;
  outputMaterials?: MaterialCost;
  outputPotions?: Partial<Record<PotionId, number>>;
}
export interface RepairOperation {
  kind: 'facilityRepair' | 'relicRepair' | 'change';
  targetId: string;
  quote: EconomyQuote;
  totalSeconds: number;
  remainingSeconds: number;
  paid: true;
  nextMode?: FacilityModeId;
}
export interface SiteFacilityState {
  repaired: boolean;
  operation: RepairOperation | null;
  mode: FacilityModeId | null;
  enabled: boolean;
  progress: number;
  batchQuote: EconomyQuote | null;
  repairQuote: EconomyQuote | null;
  completed: number;
}
export interface OwnedRelic {
  siteId: string;
  acquiredAt: number;
  repaired: boolean;
  operation: RepairOperation | null;
}
export type TownRelicOptions =
  | { mode: 'hand' | 'lend'; target: WorkId; source?: WorkId }
  | { target: WorkId }
  | { routes: [number, number]; counts: [number, number] }
  | { source: WorkId; target: string }
  | { target: string }
  | {
      target: WorkId;
      recipes: [string, string];
      counts: [number, number];
      skipBlocked: boolean;
    };
// Flat serializable configuration also makes imported-save validation explicit.
export interface TownRelicConfig {
  id: string;
  mode?: 'hand' | 'lend';
  target?: string;
  source?: WorkId;
  routes?: [number, number];
  counts?: [number, number];
  recipes?: [string, string];
  skipBlocked?: boolean;
}
export interface ProcessingBatch {
  variant: string;
  cost: Cost;
  materials: MaterialCost;
  seconds: number;
  output: number;
  remaining: number;
  wholeOutput: number;
  split: boolean;
}
export interface RelicRuntime {
  handSeconds: number;
  routeIndex: 0 | 1;
  routeSeconds: number;
  sequenceIndex: 0 | 1;
  sequenceBatches: number;
  processing: Partial<Record<WorkId, ProcessingBatch>>;
  arrivals: Partial<Record<WorkId, number>>;
}
export interface WorldEconomyState {
  facilities: Record<string, SiteFacilityState>;
  relics: {
    owned: Record<string, OwnedRelic>;
    town: TownRelicConfig[];
    combat: Record<string, string>;
    runtime: RelicRuntime;
  };
  facilityCursor: number;
  facilityPriority: string[];
}
