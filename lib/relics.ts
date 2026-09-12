import type { State } from './realm.ts';
import { WORK_IDS, type WorkId } from './campaign-data.ts';
import * as E from './economy.ts';
import { RELICS } from './relic-data.ts';
import {
  FACILITY_MODES,
  repairBaseQuote,
  quoteInputsReason,
  startEconomyOperation,
  clearFacilityProgress,
} from './site-economy.ts';
import * as D from './discovery.ts';
import type { MaterialId } from './campaign-data.ts';
import type { EconomyQuote, TownRelicConfig } from './site-economy-types.ts';
export type {
  TownRelicConfig,
  TownRelicOptions,
} from './site-economy-types.ts';
export { RELICS } from './relic-data.ts';

const hasKind = (s: State, kind: 'town' | 'combat') =>
  RELICS.some(
    (r) => r.kind === kind && s.worldExploration.relics.owned[r.id]?.repaired,
  );
export const townRelicSlots = (s: State) =>
  hasKind(s, 'town') ? (new Set(s.cleared).size >= 2 ? 2 : 1) : 0;
export const combatRelicSlots = (s: State) =>
  hasKind(s, 'combat') ? (new Set(s.cleared).size >= 3 ? 2 : 1) : 0;
export function relicRepairQuote(s: State, id: string): EconomyQuote {
  const q = repairBaseQuote(id, 'relicRepair'),
    owned = s.worldExploration.relics.owned[id];
  q.reason =
    q.reason ||
    (!owned
      ? '先完成对应支线取得遗物'
      : owned.repaired
        ? '已经修复'
        : owned.operation
          ? '修复正在进行'
          : Object.keys(q.materials).some(
                (k) => !D.materialDiscovered(s, k as MaterialId),
              )
            ? '先发现修复所需材料'
            : quoteInputsReason(s, q));
  return q;
}
export function repairRelic(s0: State, id: string): State {
  const q = relicRepairQuote(s0, id);
  if (q.reason) return s0;
  const s = structuredClone(s0);
  s.worldExploration.relics.owned[id].operation = startEconomyOperation(
    s,
    id,
    'relicRepair',
    q,
  );
  return s;
}
const work = (s: State, id: unknown): id is WorkId =>
  typeof id === 'string' &&
  WORK_IDS.includes(id as WorkId) &&
  !E.processingVariantReason(s, id as WorkId, 'original');
const counts = (v: unknown): boolean =>
  Array.isArray(v) &&
  v.length === 2 &&
  v.every((n) => Number.isInteger(n) && n >= 1 && n <= 5);
export function townRelicReason(
  s: State,
  id: string,
  options: Omit<TownRelicConfig, 'id'> | null,
  allowDormant = false,
): string {
  const def = RELICS.find((r) => r.id === id),
    town = s.worldExploration.relics.town;
  if (!def || def.kind !== 'town') return '未知经营遗物';
  if (options === null) return '';
  if (!s.worldExploration.relics.owned[id]?.repaired) return '先修复这件遗物';
  if (!town.some((r) => r.id === id) && town.length >= townRelicSlots(s))
    return '经营遗物部署槽已满';
  if (typeof options !== 'object' || Array.isArray(options))
    return '遗物配置无效';
  const allowed: Record<string, string[]> = {
    R01: ['mode', 'target', 'source'],
    R03: ['target'],
    R05: ['routes', 'counts'],
    R07: ['source', 'target'],
    R09: ['target'],
    R11: ['target', 'recipes', 'counts', 'skipBlocked'],
  };
  if (Object.keys(options).some((k) => k !== 'id' && !allowed[id].includes(k)))
    return '遗物配置含未知字段';
  if (id === 'R01') {
    if (
      !['hand', 'lend'].includes(options.mode || '') ||
      !work(s, options.target) ||
      !s.buildings[
        options.target === 'boards'
          ? 'lumber'
          : options.target === 'steel'
            ? 'forge'
            : 'shrine'
      ]
    )
      return '先选择有真实工位的已开放加工线';
    if (!town.some((r) => r.id === 'R01') && E.freeEconomyWorkers(s) < 1)
      return '机关台需要1名空闲居民';
    if (
      options.mode === 'lend' &&
      (!work(s, options.source) ||
        options.source === options.target ||
        !s.buildings[
          options.source === 'boards'
            ? 'lumber'
            : options.source === 'steel'
              ? 'forge'
              : 'shrine'
        ])
    )
      return '借工需要另一条有真实工位的已开放加工线';
  }
  if (
    id === 'R03' &&
    (!work(s, options.target) || E.processingOutput(s, options.target) < 2)
  )
    return '该加工线每批至少产出2件才可分批';
  if (id === 'R05') {
    if (
      !Array.isArray(options.routes) ||
      options.routes.length !== 2 ||
      options.routes[0] === options.routes[1] ||
      !options.routes.every(
        (r) =>
          Number.isInteger(r) &&
          r >= 0 &&
          r < 6 &&
          s.economy.routes[r].level &&
          s.economy.routes[r].crew &&
          s.economy.routes[r].enabled,
      ) ||
      !counts(options.counts)
    )
      return '选择两条已启用且有人供应的商路及1—5秒轮转';
  }
  if (id === 'R07') {
    const f = s.worldExploration.facilities[options.target || ''],
      mode = FACILITY_MODES.find(
        (r) => r.siteId === options.target && r.mode === f?.mode,
      );
    if (
      !work(s, options.source) ||
      !f?.repaired ||
      (f.operation && !allowDormant) ||
      !mode?.materials[options.source]
    )
      return '目标设施当前用途需要消耗这条线的成品，且已完成修复或改设';
  }
  if (id === 'R09') {
    const f = s.worldExploration.facilities[options.target || ''],
      mode = FACILITY_MODES.find(
        (r) => r.siteId === options.target && r.mode === f?.mode,
      );
    if (
      !f?.repaired ||
      (f.operation && !allowDormant) ||
      !mode ||
      Math.floor((mode.cost.food || 0) * 0.25) < 1
    )
      return '选择已完成修复或改设、每批至少消耗4口粮的设施';
  }
  if (id === 'R11') {
    if (
      !work(s, options.target) ||
      !Array.isArray(options.recipes) ||
      options.recipes.length !== 2 ||
      options.recipes[0] === options.recipes[1] ||
      options.recipes.some(
        (v) =>
          typeof v !== 'string' ||
          E.processingVariantReason(s, options.target as WorkId, v),
      ) ||
      !counts(options.counts) ||
      typeof options.skipBlocked !== 'boolean'
    )
      return '选择两种已开放配方和各1—5个完整批次';
  }
  const all = [...town.filter((r) => r.id !== id), { ...options, id }],
    lend = all.find((r) => r.id === 'R01' && r.mode === 'lend');
  if (
    lend &&
    all.some(
      (r) =>
        r.id !== 'R01' &&
        (r.target === lend.source ||
          (r.id === 'R07' && r.source === lend.source)),
    )
  )
    return '借出加工线不能同时作为其它遗物目标';
  return '';
}
export function configureTownRelic(
  s0: State,
  id: string,
  options: Omit<TownRelicConfig, 'id'> | null,
): State {
  if (townRelicReason(s0, id, options)) return s0;
  const prior = s0.worldExploration.relics.town.find((r) => r.id === id),
    next = options ? { ...options, id } : null;
  if (JSON.stringify(prior || null) === JSON.stringify(next)) return s0;
  const s = structuredClone(s0);
  if (id === 'R09') {
    if (prior?.target) clearFacilityProgress(s, prior.target);
    if (next?.target) clearFacilityProgress(s, next.target);
  }
  s.worldExploration.relics.town = s.worldExploration.relics.town.filter(
    (r) => r.id !== id,
  );
  if (next) s.worldExploration.relics.town.push(next);
  return s;
}
function locked(s: State, heroId: string): boolean {
  return (
    !!(s.expedition || s.battle || s.worldExploration.activeRun) &&
    s.party.includes(heroId)
  );
}
export function combatRelicReason(
  s: State,
  id: string,
  heroId: string | null,
  ignoreLocks = false,
): string {
  if (!RELICS.some((r) => r.id === id && r.kind === 'combat'))
    return '未知出征遗物';
  const current = s.worldExploration.relics.combat[id];
  if (
    !ignoreLocks &&
    ((current && locked(s, current)) || (heroId && locked(s, heroId)))
  )
    return '实际出征成员归来后才能调整遗物';
  if (heroId === null) return '';
  if (!s.worldExploration.relics.owned[id]?.repaired) return '先修复这件遗物';
  if (!s.heroes.some((h) => h.id === heroId)) return '未知旅人';
  if (
    Object.entries(s.worldExploration.relics.combat).some(
      ([r, h]) => r !== id && h === heroId,
    )
  )
    return '每位旅人只能携带一件出征遗物';
  if (
    !current &&
    Object.keys(s.worldExploration.relics.combat).length >= combatRelicSlots(s)
  )
    return '出征遗物部署槽已满';
  return '';
}
export function assignCombatRelic(
  s0: State,
  id: string,
  heroId: string | null,
): State {
  if (combatRelicReason(s0, id, heroId)) return s0;
  const s = structuredClone(s0);
  if (heroId) s.worldExploration.relics.combat[id] = heroId;
  else delete s.worldExploration.relics.combat[id];
  return s;
}
export function combatRelicLoadout(s: State): Record<string, string> {
  const result: Record<string, string> = {};
  if (!s.worldExploration) return result;
  for (const [id, h] of Object.entries(s.worldExploration.relics.combat)) {
    if (Object.keys(result).length >= combatRelicSlots(s)) break;
    if (
      RELICS.some((r) => r.id === id && r.kind === 'combat') &&
      s.worldExploration.relics.owned[id]?.repaired &&
      s.party.includes(h) &&
      s.heroes.some((hero) => hero.id === h) &&
      !result[h]
    )
      result[h] = id;
  }
  return result;
}
