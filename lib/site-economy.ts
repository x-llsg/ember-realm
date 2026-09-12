import type { State } from './realm.ts';
import type { Resource } from './realm-data.ts';
import { RESOURCE_NAMES } from './realm-data.ts';
import {
  MATERIAL_IDS,
  MATERIAL_NAMES,
  REGION_MATERIALS,
  WORK_IDS,
  type MaterialId,
} from './campaign-data.ts';
import type { PotionId } from './guild-data.ts';
import * as C from './campaign.ts';
import * as E from './economy.ts';
import * as D from './discovery.ts';
import { potionCapacity, potionUnlockReason } from './alchemy.ts';
import { SITE_ECONOMY_IDS, RELIC_IDS } from './relic-data.ts';
import { townRelicReason, combatRelicReason } from './relics.ts';
import type {
  EconomyQuote,
  FacilityModeId,
  SiteFacilityState,
  WorldEconomyState,
  RepairOperation,
} from './site-economy-types.ts';
export type {
  EconomyQuote,
  FacilityModeId,
  WorldEconomyState,
} from './site-economy-types.ts';

export interface FacilityMode extends EconomyQuote {
  id: string;
  siteId: string;
  mode: FacilityModeId;
  name: string;
  tech: string[];
}
export const FACILITY_MODES: FacilityMode[] = [
  {
    id: 'S01A',
    siteId: 'S01',
    mode: 'A',
    name: '采材养护',
    cost: { food: 24, gold: 14, stone: 8 },
    materials: {},
    outputCost: { wood: 20 },
    outputMaterials: { timber: 4 },
    seconds: 120,
    tech: [],
    outputPotions: {},
  },
  {
    id: 'S01B',
    siteId: 'S01',
    mode: 'B',
    name: '木料整备',
    cost: { wood: 60, food: 16, gold: 12 },
    materials: { timber: 1 },
    outputCost: {},
    outputMaterials: { boards: 1 },
    seconds: 90,
    tech: ['settlement'],
    outputPotions: {},
  },
  {
    id: 'S02A',
    siteId: 'S02',
    mode: 'A',
    name: '营地供餐',
    cost: { wood: 20, gold: 28 },
    materials: { timber: 1 },
    outputCost: { food: 60 },
    outputMaterials: {},
    seconds: 120,
    tech: [],
    outputPotions: {},
  },
  {
    id: 'S02B',
    siteId: 'S02',
    mode: 'B',
    name: '废垒清理',
    cost: { food: 24, gold: 28 },
    materials: { timber: 1 },
    outputCost: { stone: 50, wood: 10 },
    outputMaterials: {},
    seconds: 120,
    tech: [],
    outputPotions: {},
  },
  {
    id: 'S03A',
    siteId: 'S03',
    mode: 'A',
    name: '月露采集',
    cost: { food: 36, gold: 30, stone: 20 },
    materials: {},
    outputCost: {},
    outputMaterials: { essence: 6 },
    seconds: 135,
    tech: [],
    outputPotions: {},
  },
  {
    id: 'S03B',
    siteId: 'S03',
    mode: 'B',
    name: '镇魂制备',
    cost: { food: 40, gold: 40 },
    materials: { essence: 2, boards: 1 },
    outputCost: {},
    outputMaterials: {},
    seconds: 180,
    tech: ['settlement'],
    outputPotions: { shadow: 2 },
  },
  {
    id: 'S04A',
    siteId: 'S04',
    mode: 'A',
    name: '残页萃取',
    cost: { food: 30, gold: 20, stone: 16 },
    materials: { boards: 1 },
    outputCost: {},
    outputMaterials: { essence: 5 },
    seconds: 150,
    tech: ['settlement'],
    outputPotions: {},
  },
  {
    id: 'S04B',
    siteId: 'S04',
    mode: 'B',
    name: '符墨整备',
    cost: { crystal: 8, food: 32, gold: 80 },
    materials: { essence: 2, boards: 1 },
    outputCost: {},
    outputMaterials: { runes: 2 },
    seconds: 180,
    tech: ['runecraft'],
    outputPotions: {},
  },
  {
    id: 'S05A',
    siteId: 'S05',
    mode: 'A',
    name: '矿脉筛选',
    cost: { food: 70, gold: 48, wood: 30 },
    materials: { boards: 1 },
    outputCost: {},
    outputMaterials: { ore: 12 },
    seconds: 150,
    tech: ['settlement'],
    outputPotions: {},
  },
  {
    id: 'S05B',
    siteId: 'S05',
    mode: 'B',
    name: '精钢压锭',
    cost: { iron: 20, wood: 50, food: 45, gold: 30 },
    materials: { ore: 3 },
    outputCost: {},
    outputMaterials: { steel: 2 },
    seconds: 180,
    tech: ['metallurgy'],
    outputPotions: {},
  },
  {
    id: 'S06A',
    siteId: 'S06',
    mode: 'A',
    name: '旧井淘洗',
    cost: { food: 60, gold: 45, stone: 40 },
    materials: {},
    outputCost: { iron: 20 },
    outputMaterials: { ore: 8 },
    seconds: 150,
    tech: [],
    outputPotions: {},
  },
  {
    id: 'S06B',
    siteId: 'S06',
    mode: 'B',
    name: '驿站供餐',
    cost: { wood: 35, gold: 55 },
    materials: { boards: 1, ore: 1 },
    outputCost: { food: 120 },
    outputMaterials: {},
    seconds: 150,
    tech: ['settlement'],
    outputPotions: {},
  },
  {
    id: 'S07A',
    siteId: 'S07',
    mode: 'A',
    name: '炉渣回收',
    cost: { food: 105, gold: 75, stone: 40 },
    materials: { steel: 1 },
    outputCost: { iron: 20 },
    outputMaterials: { ember: 18 },
    seconds: 150,
    tech: ['metallurgy'],
    outputPotions: {},
  },
  {
    id: 'S07B',
    siteId: 'S07',
    mode: 'B',
    name: '辟火制备',
    cost: { food: 70, gold: 70 },
    materials: { ember: 1, ore: 2, boards: 2 },
    outputCost: {},
    outputMaterials: {},
    seconds: 180,
    tech: ['settlement'],
    outputPotions: { fire: 3 },
  },
  {
    id: 'S08A',
    siteId: 'S08',
    mode: 'A',
    name: '余烬采集',
    cost: { food: 96, gold: 65, wood: 40 },
    materials: { boards: 2 },
    outputCost: {},
    outputMaterials: { ember: 16 },
    seconds: 150,
    tech: ['settlement'],
    outputPotions: {},
  },
  {
    id: 'S08B',
    siteId: 'S08',
    mode: 'B',
    name: '庇护修缮',
    cost: { gold: 100 },
    materials: { boards: 1, steel: 1, ember: 2 },
    outputCost: { stone: 120, food: 100 },
    outputMaterials: {},
    seconds: 180,
    tech: ['settlement', 'metallurgy'],
    outputPotions: {},
  },
  {
    id: 'S09A',
    siteId: 'S09',
    mode: 'A',
    name: '冰层取样',
    cost: { food: 245, gold: 130, wood: 60 },
    materials: { steel: 2 },
    outputCost: {},
    outputMaterials: { scale: 36 },
    seconds: 165,
    tech: ['metallurgy'],
    outputPotions: {},
  },
  {
    id: 'S09B',
    siteId: 'S09',
    mode: 'B',
    name: '猎装整备',
    cost: { food: 90, gold: 110 },
    materials: { scale: 4, boards: 2, steel: 1 },
    outputCost: {},
    outputMaterials: { boards: 5, steel: 2 },
    seconds: 180,
    tech: ['settlement', 'metallurgy', 'dragoncraft'],
    outputPotions: {},
  },
  {
    id: 'S10A',
    siteId: 'S10',
    mode: 'A',
    name: '龙迹采集',
    cost: { food: 220, gold: 105, stone: 75 },
    materials: { runes: 1 },
    outputCost: {},
    outputMaterials: { scale: 30 },
    seconds: 180,
    tech: ['runecraft'],
    outputPotions: {},
  },
  {
    id: 'S10B',
    siteId: 'S10',
    mode: 'B',
    name: '温泉净晶',
    cost: { wood: 80, food: 80, gold: 160 },
    materials: { scale: 3, steel: 1 },
    outputCost: { crystal: 75 },
    outputMaterials: {},
    seconds: 180,
    tech: ['metallurgy'],
    outputPotions: {},
  },
  {
    id: 'S11A',
    siteId: 'S11',
    mode: 'A',
    name: '陨屑收集',
    cost: { food: 360, gold: 240, stone: 100 },
    materials: { runes: 2 },
    outputCost: {},
    outputMaterials: { star: 54 },
    seconds: 180,
    tech: ['runecraft'],
    outputPotions: {},
  },
  {
    id: 'S11B',
    siteId: 'S11',
    mode: 'B',
    name: '逆律制备',
    cost: { food: 140, gold: 150, crystal: 20 },
    materials: { star: 2, runes: 1 },
    outputCost: {},
    outputMaterials: {},
    seconds: 180,
    tech: ['runecraft'],
    outputPotions: { radiant: 3 },
  },
  {
    id: 'S12A',
    siteId: 'S12',
    mode: 'A',
    name: '圣所清理',
    cost: { food: 330, gold: 200, wood: 80 },
    materials: { boards: 3, steel: 2 },
    outputCost: {},
    outputMaterials: { star: 48 },
    seconds: 180,
    tech: ['settlement', 'metallurgy'],
    outputPotions: {},
  },
  {
    id: 'S12B',
    siteId: 'S12',
    mode: 'B',
    name: '终阶整备',
    cost: { food: 120, gold: 180, crystal: 16 },
    materials: { star: 5, boards: 2, steel: 1 },
    outputCost: {},
    outputMaterials: { steel: 3, runes: 3 },
    seconds: 180,
    tech: ['metallurgy', 'runecraft', 'mythic'],
    outputPotions: {},
  },
].map((r) => ({ ...r, mode: r.mode as FacilityModeId, reason: '' }));
const eps = 1e-8;
export const siteNumber = (id: string) =>
  /^S(0[1-9]|1[0-2])$/.test(id) ? Number(id.slice(1)) : 0;
export const relicNumber = (id: string) =>
  /^R(0[1-9]|1[0-2])$/.test(id) ? Number(id.slice(1)) : 0;
export function freshFacility(): SiteFacilityState {
  return {
    repaired: false,
    operation: null,
    mode: null,
    enabled: false,
    progress: 0,
    batchQuote: null,
    repairQuote: null,
    completed: 0,
  };
}
export function freshWorldEconomy(): WorldEconomyState {
  return {
    facilities: Object.fromEntries(
      SITE_ECONOMY_IDS.map((id) => [id, freshFacility()]),
    ),
    relics: {
      owned: {},
      town: [],
      combat: {},
      runtime: {
        handSeconds: 0,
        routeIndex: 0,
        routeSeconds: 0,
        sequenceIndex: 0,
        sequenceBatches: 0,
        processing: {},
        arrivals: {},
      },
    },
    facilityCursor: 0,
    facilityPriority: [...SITE_ECONOMY_IDS],
  };
}
export const facilityWorkers = (s: State) =>
  Object.values(s.worldExploration?.facilities || {}).filter((f) => f.enabled)
    .length;
export const relicWorkers = (s: State) =>
  s.worldExploration?.relics.town.some((r) => r.id === 'R01') ? 1 : 0;
export const facilityLines = facilityWorkers;
const noQuote = (reason: string): EconomyQuote => ({
  cost: {},
  materials: {},
  seconds: 0,
  reason,
});
export function quoteInputsReason(
  s: State,
  q: Pick<EconomyQuote, 'cost' | 'materials'>,
  reserve = false,
): string {
  for (const [key, n] of Object.entries(q.cost)) {
    const k = key as Resource;
    if (s.resources[k] + eps < n!)
      return '还缺' + RESOURCE_NAMES[k] + ' ' + Math.ceil(n! - s.resources[k]);
    if (
      reserve &&
      s.resources[k] - n! + eps < E.baseCapacity(s, k) * s.economy.reserve
    )
      return RESOURCE_NAMES[k] + '已到保留线';
  }
  for (const [key, n] of Object.entries(q.materials)) {
    const k = key as MaterialId;
    if (s.world.materials[k] + eps < n!)
      return (
        '还缺' + MATERIAL_NAMES[k] + ' ' + Math.ceil(n! - s.world.materials[k])
      );
    if (
      reserve &&
      s.world.materials[k] - n! + eps <
        C.materialCapacity(s, k) * s.economy.reserve
    )
      return MATERIAL_NAMES[k] + '已到保留线';
  }
  return '';
}
export function payEconomyQuote(
  s: State,
  q: Pick<EconomyQuote, 'cost' | 'materials'>,
): void {
  for (const [k, n] of Object.entries(q.cost))
    s.resources[k as Resource] = Math.max(0, s.resources[k as Resource] - n!);
  for (const [k, n] of Object.entries(q.materials))
    s.world.materials[k as MaterialId] = Math.max(
      0,
      s.world.materials[k as MaterialId] - n!,
    );
}
const quoteCopy = (q: EconomyQuote) => ({ ...structuredClone(q), reason: '' });
export function repairBaseQuote(
  id: string,
  kind: 'facilityRepair' | 'relicRepair',
): EconomyQuote {
  const num = kind === 'facilityRepair' ? siteNumber(id) : relicNumber(id);
  if (!num) return noQuote('未知修复目标');
  const c = Math.ceil(num / 2) - 1,
    mult = num % 2 ? 1 : 1.25,
    raw = REGION_MATERIALS[c];
  const rows =
    kind === 'facilityRepair'
      ? [
          [90, 60, 45, 3, 0, 0, 0],
          [160, 110, 90, 5, 4, 0, 0],
          [260, 180, 150, 8, 6, 2, 0],
          [420, 300, 240, 12, 10, 4, 2],
          [680, 480, 380, 18, 14, 6, 4],
          [1080, 760, 600, 24, 20, 10, 6],
        ]
      : [
          [40, 20, 45, 2, 0, 0, 0],
          [70, 35, 90, 4, 2, 0, 0],
          [110, 60, 150, 6, 0, 2, 0],
          [180, 100, 240, 10, 0, 2, 2],
          [280, 160, 380, 14, 0, 4, 3],
          [450, 260, 600, 20, 0, 6, 6],
        ];
  const [wood, stone, gold, rawN, boards, steel, runes] = rows[c].map((n) =>
    Math.ceil(n * mult),
  );
  return {
    cost: { wood, stone, gold },
    materials: {
      [raw]: rawN,
      ...(boards ? { boards } : {}),
      ...(steel ? { steel } : {}),
      ...(runes ? { runes } : {}),
    },
    seconds: Math.ceil(
      (kind === 'facilityRepair' ? 60 + c * 30 : 30 + c * 15) * mult,
    ),
    reason: '',
  };
}
function knownBill(s: State, q: EconomyQuote): string {
  for (const k of Object.keys({ ...q.cost, ...q.outputCost }))
    if (!D.resourceDiscovered(s, k as Resource))
      return '尚未发现' + RESOURCE_NAMES[k as Resource];
  for (const k of Object.keys({ ...q.materials, ...q.outputMaterials }))
    if (!D.materialDiscovered(s, k as MaterialId))
      return '先取得' + MATERIAL_NAMES[k as MaterialId] + '的真实样品';
  return '';
}
export function facilityRepairQuote(s: State, id: string): EconomyQuote {
  const q = repairBaseQuote(id, 'facilityRepair'),
    f = s.worldExploration.facilities[id];
  q.reason =
    q.reason ||
    (!s.worldExploration.sites[id]?.firstCompleted
      ? '先完成这一地点'
      : !f
        ? '未知设施'
        : f.repaired
          ? '已经修复'
          : f.operation
            ? '修复正在进行'
            : knownBill(s, q) || quoteInputsReason(s, q));
  return q;
}
export function startEconomyOperation(
  s: State,
  id: string,
  kind: RepairOperation['kind'],
  q: EconomyQuote,
  nextMode?: FacilityModeId,
): RepairOperation {
  payEconomyQuote(s, q);
  return {
    kind,
    targetId: id,
    quote: quoteCopy(q),
    totalSeconds: q.seconds,
    remainingSeconds: q.seconds,
    paid: true,
    ...(nextMode ? { nextMode } : {}),
  };
}
export function repairFacility(s0: State, id: string): State {
  const q = facilityRepairQuote(s0, id);
  if (q.reason) return s0;
  const s = structuredClone(s0),
    f = s.worldExploration.facilities[id];
  f.operation = startEconomyOperation(s, id, 'facilityRepair', q);
  f.repairQuote = quoteCopy(q);
  return s;
}
export function facilityModeQuote(
  s: State,
  id: string,
  mode: FacilityModeId,
): EconomyQuote {
  const def = FACILITY_MODES.find((r) => r.siteId === id && r.mode === mode);
  if (!def) return noQuote('未知设施用途');
  const q: EconomyQuote = quoteCopy(def);
  if (
    s.worldExploration.relics.town.some(
      (r) => r.id === 'R09' && r.target === id,
    )
  ) {
    const k = Math.floor((q.cost.food || 0) * 0.25);
    q.cost.food = (q.cost.food || 0) - k;
    q.cost.wood = (q.cost.wood || 0) + 2 * k;
    q.seconds *= 1.1;
  }
  const f = s.worldExploration.facilities[id];
  q.reason = !f?.repaired
    ? '先修复这一设施'
    : f.operation
      ? '正在修复或改设'
      : def.tech.some((t) => !s.world.tech.includes(t))
        ? '先掌握所需工艺'
        : knownBill(s, q);
  for (const p of Object.keys(q.outputPotions || {}))
    q.reason ||= potionUnlockReason(s, p as PotionId);
  q.reason ||= quoteInputsReason(s, q, true);
  for (const [k, n] of Object.entries(q.outputCost || {}))
    if (
      s.resources[k as Resource] - (q.cost[k as Resource] || 0) + n! >
      E.baseCapacity(s, k as Resource) + eps
    )
      q.reason ||= RESOURCE_NAMES[k as Resource] + '空间不足';
  for (const [k, n] of Object.entries(q.outputMaterials || {}))
    if (
      s.world.materials[k as MaterialId] -
        (q.materials[k as MaterialId] || 0) +
        n! >
      C.materialCapacity(s, k as MaterialId) + eps
    )
      q.reason ||= MATERIAL_NAMES[k as MaterialId] + '空间不足';
  for (const [k, n] of Object.entries(q.outputPotions || {}))
    if (s.guild.potions[k as PotionId] + n! > potionCapacity(s))
      q.reason ||= '药剂空间不足';
  return q;
}
export function facilityChangeQuote(
  s: State,
  id: string,
  mode: FacilityModeId,
): EconomyQuote {
  const f = s.worldExploration.facilities[id],
    def = FACILITY_MODES.find((r) => r.siteId === id && r.mode === mode);
  if (!f || !def) return noQuote('未知设施用途');
  const base = f.repairQuote || repairBaseQuote(id, 'facilityRepair');
  const q: EconomyQuote = {
    cost: f.mode
      ? Object.fromEntries(
          Object.entries(base.cost)
            .filter(([k]) => ['wood', 'stone', 'gold'].includes(k))
            .map(([k, n]) => [k, Math.ceil(n! * 0.1)]),
        )
      : {},
    materials: {},
    seconds: f.mode ? 15 : 0,
    reason: '',
  };
  q.reason = !f.repaired
    ? '先修复这一设施'
    : f.operation
      ? '正在修复或改设'
      : f.mode === mode
        ? '当前已经采用此用途'
        : def.tech.some((t) => !s.world.tech.includes(t))
          ? '先掌握所需工艺'
          : knownBill(s, def) || quoteInputsReason(s, q);
  return q;
}
export function setFacilityMode(
  s0: State,
  id: string,
  mode: FacilityModeId,
): State {
  const q = facilityChangeQuote(s0, id, mode);
  if (q.reason) return s0;
  const s = structuredClone(s0),
    f = s.worldExploration.facilities[id];
  f.progress = 0;
  f.batchQuote = null;
  f.enabled = false;
  // A refit removes links whose actual input no longer exists; it never leaves
  // an impossible configuration that later makes an otherwise legal save fail.
  const def = FACILITY_MODES.find((r) => r.siteId === id && r.mode === mode)!;
  s.worldExploration.relics.town = s.worldExploration.relics.town.filter(
    (r) =>
      !(
        r.target === id &&
        ((r.id === 'R07' && (!r.source || !def.materials[r.source])) ||
          (r.id === 'R09' && Math.floor((def.cost.food || 0) * 0.25) < 1))
      ),
  );
  if (f.mode) f.operation = startEconomyOperation(s, id, 'change', q, mode);
  else f.mode = mode;
  return s;
}
export function facilityEnableReason(s: State, id: string): string {
  if (!siteNumber(id) || !Object.hasOwn(s.worldExploration.facilities, id))
    return '未知设施';
  const f = s.worldExploration.facilities[id];
  return !f?.repaired
    ? '先修复这一设施'
    : f.operation
      ? '正在修复或改设'
      : !f.mode
        ? '先选择用途'
        : !f.enabled && E.freeEconomyWorkers(s) < 1
          ? '没有空闲居民'
          : !f.enabled && E.transportLines(s) >= E.transportSlots(s)
            ? '供给线路已满'
            : '';
}
export function toggleFacility(
  s0: State,
  id: string,
  enabled?: boolean,
): State {
  if (!siteNumber(id) || !Object.hasOwn(s0.worldExploration.facilities, id))
    return s0;
  const f0 = s0.worldExploration.facilities[id];
  if (!f0 || (enabled !== undefined && typeof enabled !== 'boolean')) return s0;
  const on = enabled ?? !f0.enabled;
  if (on === f0.enabled || (on && facilityEnableReason(s0, id))) return s0;
  const s = structuredClone(s0);
  s.worldExploration.facilities[id].enabled = on;
  return s;
}
export function clearFacilityProgress(s: State, id: string): void {
  if (!siteNumber(id) || !Object.hasOwn(s.worldExploration.facilities, id))
    return;
  const f = s.worldExploration.facilities[id];
  if (f) {
    f.progress = 0;
    f.batchQuote = null;
  }
}
export function siteEconomyTick(s: State, dt = 1): void {
  if (!s.worldExploration || s.paused || !Number.isFinite(dt) || dt <= 0)
    return;
  for (let elapsed = 0; elapsed < dt; elapsed += 1) {
    const step = Math.min(1, dt - elapsed),
      w = s.worldExploration;
    for (const f of Object.values(w.facilities)) {
      if (!f.operation) continue;
      f.operation.remainingSeconds = Math.max(
        0,
        f.operation.remainingSeconds - step,
      );
      if (f.operation.remainingSeconds <= eps) {
        if (f.operation.kind === 'facilityRepair') f.repaired = true;
        else f.mode = f.operation.nextMode!;
        f.operation = null;
        f.enabled = false;
      }
    }
    for (const r of Object.values(w.relics.owned)) {
      if (!r.operation) continue;
      r.operation.remainingSeconds = Math.max(
        0,
        r.operation.remainingSeconds - step,
      );
      if (r.operation.remainingSeconds <= eps) {
        r.repaired = true;
        r.operation = null;
      }
    }
    for (const id of [...w.facilityPriority].reverse()) {
      if (
        E.freeEconomyWorkers(s) >= 0 &&
        E.transportLines(s) <= E.transportSlots(s)
      )
        break;
      w.facilities[id].enabled = false;
    }
    const queue = SITE_ECONOMY_IDS.map(
      (_, i) => SITE_ECONOMY_IDS[(w.facilityCursor + i) % 12],
    );
    const link = w.relics.town.find((r) => r.id === 'R07');
    if (
      link?.source &&
      link.target &&
      (w.relics.runtime.arrivals[link.source] || 0) > 0
    ) {
      const at = queue.indexOf(link.target);
      if (at >= 0) {
        queue.splice(at, 1);
        queue.unshift(link.target);
      }
    }
    for (const id of queue) {
      const f = w.facilities[id];
      if (!f.enabled || !f.mode || f.operation) continue;
      const q = facilityModeQuote(s, id, f.mode);
      if (q.reason) continue;
      f.batchQuote ||= quoteCopy(q);
      f.progress = Math.min(q.seconds, f.progress + step);
      if (f.progress + eps < q.seconds) continue;
      payEconomyQuote(s, f.batchQuote);
      for (const [k, n] of Object.entries(f.batchQuote.outputCost || {}))
        s.resources[k as Resource] += n!;
      for (const [k, n] of Object.entries(f.batchQuote.outputMaterials || {}))
        s.world.materials[k as MaterialId] += n!;
      for (const [k, n] of Object.entries(f.batchQuote.outputPotions || {}))
        s.guild.potions[k as PotionId] += n!;
      f.progress = 0;
      f.batchQuote = null;
      f.completed++;
      w.facilityCursor = (SITE_ECONOMY_IDS.indexOf(id) + 1) % 12;
    }
    w.relics.runtime.arrivals = {};
  }
}
export function awardSiteRelic(s: State, siteId: string): void {
  const n = siteNumber(siteId);
  if (!n || !s.worldExploration.sites[siteId]?.firstCompleted) return;
  const id = RELIC_IDS[n - 1];
  s.worldExploration.relics.owned[id] ||= {
    siteId,
    acquiredAt: s.time,
    repaired: false,
    operation: null,
  };
}
const finite = (v: unknown, max = 1e12) =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;
const obj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const exactKeys = (v: unknown, keys: readonly string[]) =>
  obj(v) &&
  Object.keys(v).length === keys.length &&
  keys.every((k) => Object.hasOwn(v, k));
const sameAmounts = (a: unknown, b: unknown) =>
  obj(a) &&
  obj(b) &&
  Object.keys(a).length === Object.keys(b).length &&
  Object.entries(a).every(([k, n]) => n === b[k]);
function sameBill(a: EconomyQuote, b: EconomyQuote): boolean {
  return (
    a.seconds === b.seconds &&
    sameAmounts(a.cost, b.cost) &&
    sameAmounts(a.materials, b.materials) &&
    sameAmounts(a.outputCost || {}, b.outputCost || {}) &&
    sameAmounts(a.outputMaterials || {}, b.outputMaterials || {}) &&
    sameAmounts(a.outputPotions || {}, b.outputPotions || {})
  );
}
function validQuote(q: unknown): q is EconomyQuote {
  if (
    !obj(q) ||
    !obj(q.cost) ||
    !obj(q.materials) ||
    !finite(q.seconds, 10000) ||
    typeof q.reason !== 'string'
  )
    return false;
  if (
    Object.entries(q.cost).some(
      ([k, n]) => !Object.hasOwn(RESOURCE_NAMES, k) || !finite(n),
    )
  )
    return false;
  if (
    Object.entries(q.materials).some(
      ([k, n]) => !MATERIAL_IDS.includes(k as MaterialId) || !finite(n),
    )
  )
    return false;
  for (const [field, keys] of [
    ['outputCost', Object.keys(RESOURCE_NAMES)],
    ['outputMaterials', MATERIAL_IDS],
    ['outputPotions', ['shadow', 'fire', 'radiant']],
  ] as const)
    if (
      q[field] !== undefined &&
      (!obj(q[field]) ||
        Object.entries(q[field]).some(
          ([k, n]) => !(keys as readonly string[]).includes(k) || !finite(n),
        ))
    )
      return false;
  return true;
}
function validOperation(
  op: unknown,
  id: string,
  kind: string,
  changeQuote?: EconomyQuote,
): boolean {
  if (
    !obj(op) ||
    op.targetId !== id ||
    op.paid !== true ||
    !validQuote(op.quote) ||
    !finite(op.totalSeconds, 10000) ||
    !finite(op.remainingSeconds, op.totalSeconds as number) ||
    op.remainingSeconds === 0
  )
    return false;
  if (op.kind !== kind && !(kind === 'facilityRepair' && op.kind === 'change'))
    return false;
  const expected =
    op.kind === 'change'
      ? changeQuote
      : repairBaseQuote(id, kind as 'facilityRepair' | 'relicRepair');
  return (
    !!expected &&
    op.totalSeconds === expected.seconds &&
    sameBill(op.quote, expected) &&
    (op.kind !== 'change' || ['A', 'B'].includes(op.nextMode as string))
  );
}
export function validateWorldEconomy(s: State): boolean {
  try {
    const w = s.worldExploration;
    if (
      !w ||
      !obj(w.facilities) ||
      Object.keys(w.facilities).length !== 12 ||
      !SITE_ECONOMY_IDS.every((id) => obj(w.facilities[id])) ||
      !Number.isInteger(w.facilityCursor) ||
      w.facilityCursor < 0 ||
      w.facilityCursor >= 12 ||
      !Array.isArray(w.facilityPriority) ||
      w.facilityPriority.length !== 12 ||
      new Set(w.facilityPriority).size !== 12 ||
      w.facilityPriority.some((id) => !SITE_ECONOMY_IDS.includes(id))
    )
      return false;
    if (
      !obj(w.relics) ||
      !exactKeys(w.relics, ['owned', 'town', 'combat', 'runtime']) ||
      !obj(w.relics.owned) ||
      !Array.isArray(w.relics.town) ||
      !obj(w.relics.combat) ||
      !obj(w.relics.runtime)
    )
      return false;
    for (const [id, f] of Object.entries(w.facilities)) {
      if (
        !exactKeys(f, [
          'repaired',
          'operation',
          'mode',
          'enabled',
          'progress',
          'batchQuote',
          'repairQuote',
          'completed',
        ])
      )
        return false;
      if (!Object.hasOwn(f, 'operation') || (f.repaired && !f.repairQuote))
        return false;
      if (
        typeof f.repaired !== 'boolean' ||
        typeof f.enabled !== 'boolean' ||
        ![null, 'A', 'B'].includes(f.mode) ||
        !finite(f.progress, 1000) ||
        !Number.isInteger(f.completed) ||
        f.completed < 0 ||
        (f.batchQuote !== null && !validQuote(f.batchQuote)) ||
        (f.repairQuote !== null && !validQuote(f.repairQuote))
      )
        return false;
      if (
        ((f.repaired || f.operation) && !w.sites[id]?.firstCompleted) ||
        (f.mode !== null && !f.repaired) ||
        (f.completed > 0 && !f.repaired) ||
        (f.repairQuote !== null && !f.repaired && !f.operation) ||
        (f.enabled && (!f.repaired || !f.mode || f.operation)) ||
        (f.progress > 0 && (!f.mode || !f.batchQuote)) ||
        (f.batchQuote && f.progress > f.batchQuote.seconds + eps)
      )
        return false;
      const repair = repairBaseQuote(id, 'facilityRepair');
      if (f.repairQuote && !sameBill(f.repairQuote, repair)) return false;
      const change = {
        cost: Object.fromEntries(
          Object.entries(repair.cost).map(([k, n]) => [k, Math.ceil(n! * 0.1)]),
        ),
        materials: {},
        seconds: 15,
        reason: '',
      };
      if (
        f.operation &&
        !validOperation(f.operation, id, 'facilityRepair', change)
      )
        return false;
      if (
        (f.operation?.kind === 'facilityRepair' && f.repaired) ||
        (f.operation?.kind === 'change' &&
          (!f.repaired || !f.mode || f.operation.nextMode === f.mode))
      )
        return false;
      if (f.mode) {
        const d = FACILITY_MODES.find(
          (r) => r.siteId === id && r.mode === f.mode,
        )!;
        if (d.tech.some((t) => !s.world.tech.includes(t))) return false;
        if (
          f.batchQuote &&
          !sameBill(f.batchQuote, facilityModeQuote(s, id, f.mode))
        )
          return false;
      }
    }
    for (const [id, r] of Object.entries(w.relics.owned)) {
      if (
        !RELIC_IDS.includes(id) ||
        !obj(r) ||
        !exactKeys(r, ['siteId', 'acquiredAt', 'repaired', 'operation']) ||
        !Object.hasOwn(r, 'operation') ||
        r.siteId !== SITE_ECONOMY_IDS[relicNumber(id) - 1] ||
        !w.sites[r.siteId]?.firstCompleted ||
        !finite(r.acquiredAt, s.time) ||
        typeof r.repaired !== 'boolean' ||
        (r.operation &&
          (r.repaired || !validOperation(r.operation, id, 'relicRepair')))
      )
        return false;
    }
    const town = w.relics.town;
    if (new Set(town.map((r) => r.id)).size !== town.length) return false;
    for (const cfg of town) {
      const copy = structuredClone(s);
      copy.worldExploration.relics.town =
        copy.worldExploration.relics.town.filter((r) => r.id !== cfg.id);
      if (townRelicReason(copy, cfg.id, cfg, true)) return false;
    }
    if (
      new Set(Object.values(w.relics.combat)).size !==
      Object.keys(w.relics.combat).length
    )
      return false;
    for (const [id, h] of Object.entries(w.relics.combat)) {
      const copy = structuredClone(s);
      delete copy.worldExploration.relics.combat[id];
      if (combatRelicReason(copy, id, h, true)) return false;
    }
    const rt = w.relics.runtime;
    if (
      !exactKeys(rt, [
        'handSeconds',
        'routeIndex',
        'routeSeconds',
        'sequenceIndex',
        'sequenceBatches',
        'processing',
        'arrivals',
      ]) ||
      !finite(rt.handSeconds, 60) ||
      ![0, 1].includes(rt.routeIndex) ||
      !finite(rt.routeSeconds, 5) ||
      ![0, 1].includes(rt.sequenceIndex) ||
      !Number.isInteger(rt.sequenceBatches) ||
      rt.sequenceBatches < 0 ||
      rt.sequenceBatches > 5 ||
      !obj(rt.processing) ||
      !obj(rt.arrivals)
    )
      return false;
    if (
      Object.entries(rt.arrivals).some(
        ([id, n]) =>
          !WORK_IDS.includes(id as (typeof WORK_IDS)[number]) || !finite(n),
      )
    )
      return false;
    if (rt.handSeconds > 0 && !w.relics.owned.R01?.repaired) return false;
    if (
      (rt.routeSeconds > 0 || rt.routeIndex > 0) &&
      !w.relics.owned.R05?.repaired
    )
      return false;
    if (
      (rt.sequenceBatches > 0 || rt.sequenceIndex > 0) &&
      !w.relics.owned.R11?.repaired
    )
      return false;
    if (
      Object.keys(rt.processing).length &&
      !['R01', 'R03', 'R11'].some((id) => w.relics.owned[id]?.repaired)
    )
      return false;
    for (const [key, b] of Object.entries(rt.processing)) {
      if (
        !WORK_IDS.includes(key as (typeof WORK_IDS)[number]) ||
        !obj(b) ||
        !exactKeys(b, [
          'variant',
          'cost',
          'materials',
          'seconds',
          'output',
          'remaining',
          'wholeOutput',
          'split',
        ]) ||
        !validQuote({ ...b, reason: '' }) ||
        !finite(b.output, 100) ||
        !finite(b.remaining, 100) ||
        !finite(b.wholeOutput, 100) ||
        b.output < 1 ||
        b.remaining < 1 ||
        b.remaining > b.wholeOutput ||
        !Number.isInteger(b.output) ||
        !Number.isInteger(b.remaining) ||
        !Number.isInteger(b.wholeOutput) ||
        b.output !== b.wholeOutput ||
        b.seconds <= 0 ||
        typeof b.split !== 'boolean' ||
        typeof b.variant !== 'string'
      )
        return false;
      if (
        E.processingVariantReason(
          s,
          key as (typeof WORK_IDS)[number],
          b.variant,
        ) ||
        (s.economy.variants?.[key as (typeof WORK_IDS)[number]] ||
          'original') !== b.variant
      )
        return false;
    }
    return (
      E.freeEconomyWorkers(s) >= 0 && E.transportLines(s) <= E.transportSlots(s)
    );
  } catch {
    return false;
  }
}
