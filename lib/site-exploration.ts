import * as G from './realm.ts';
import { SITES, siteDefinition } from './sites-data.ts';
import { freshWorldEconomy, validateWorldEconomy } from './site-economy.ts';
import {
  siteBillKind,
  siteExtraQuote,
  siteHelped,
  sitePayReason,
  siteReward,
  siteTravelQuote,
  SITE_REVISIT_SECONDS,
} from './site-costs.ts';
import type {
  SiteBundle,
  SiteMethod,
  SiteQuote,
  SiteReceipt,
  SiteRepeatLimits,
  SiteRepeatOptions,
  SiteRewardKind,
  SiteRun,
  WorldExplorationState,
} from './world-types.ts';
export * from './world-types.ts';
export * from './sites-data.ts';
export * from './site-costs.ts';

const empty = (): SiteBundle => ({ cost: {}, materials: {} });
const copy = <T>(value: T): T => structuredClone(value);
const roll = (seed: number) => {
  let x = seed >>> 0 || 1;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0 || 1;
};
const numberOf = (id: string) => Number(id.slice(1));
export function freshWorldExploration(): WorldExplorationState {
  return {
    ...freshWorldEconomy(),
    sites: {},
    activeRun: null,
    repeatPlan: null,
    runSerial: 0,
    receiptSerial: 0,
    ui: { lastSites: {} },
  };
}
export function discoverSites(s: G.State, announce = true): void {
  const w = s.worldExploration;
  for (const d of SITES)
    if (
      !w.sites[d.id] &&
      G.regionOpen(s, d.region) &&
      s.guild.depths[d.region] >= d.depth
    ) {
      const seed = roll((s.rng ^ Math.imul(numberOf(d.id), 2654435761)) >>> 0);
      w.sites[d.id] = {
        discovered: true,
        firstCompleted: false,
        routesCompleted: [],
        preview: { variant: seed % 2 ? 'A' : 'B', seed, serial: 1 },
        readyAt: 0,
        lastResult: null,
        pendingReceipt: null,
      };
      if (announce)
        G.log(
          s,
          `发现支线：${d.name}。${d.depth === 1 ? '林路与街巷旁' : '更深处'}还有值得探寻的去处，可在远征地图查看。`,
          'story',
        );
    }
}
export function migrateWorldExploration(s: G.State): void {
  s.worldExploration = freshWorldExploration();
  discoverSites(s, false);
}
export function siteStageSeconds(total: number) {
  const outbound = Math.floor(total * 0.4),
    resolving = Math.floor(total * 0.2);
  return { outbound, resolving, returning: total - outbound - resolving };
}
export function siteStartReason(s: G.State, id: string): string {
  const d = siteDefinition(id),
    p = s.worldExploration.sites[id];
  if (!d || !p?.discovered) return '先在本地区实际夺取对应据点，发现这处地点';
  if (s.worldExploration.activeRun) return '小队正在支线出行，可先立即撤回';
  if (s.expedition || s.battle) return '小队正在执行其他任务，可先立即撤回';
  if (!s.party.length) return '先编入至少一位旅人';
  if (p.pendingReceipt) return '先处理上次待领取的物资';
  if (p.readyAt > s.time)
    return `地点重整中：${Math.ceil(p.readyAt - s.time)} 秒`;
  if (s.recoveryUntil > s.time)
    return `队伍休整中：${Math.ceil(s.recoveryUntil - s.time)} 秒`;
  return siteTravelQuote(s, id).reason;
}
function preparationQuote(
  s: G.State,
  preparation = s.guild.preparation,
): SiteQuote {
  const cost = preparation.remedy ? { food: 30, gold: 25 } : {};
  const potion = preparation.element;
  const reason =
    sitePayReason(s, { cost, materials: {} }) ||
    (potion !== 'physical' && G.potionCount(s, potion) < 1
      ? `${G.ELEMENT_NAMES[potion]}抗性药剂不足：先调配或取消携带`
      : '');
  return { cost, materials: {}, seconds: 0, reason };
}
export function siteRouteQuote(
  s: G.State,
  id: string,
  method: SiteMethod,
): SiteQuote {
  const d = siteDefinition(id),
    p = s.worldExploration.sites[id],
    run = s.worldExploration.activeRun;
  if (!d || !p)
    return { cost: {}, materials: {}, seconds: 0, reason: '尚未发现这个地点' };
  if (method === 'assault')
    return preparationQuote(
      s,
      run?.siteId === id ? run.preparation : s.guild.preparation,
    );
  if (method !== 'clever')
    return {
      cost: {},
      materials: {},
      seconds: 0,
      reason: '请选择有效处理方式',
    };
  if (run?.siteId === id)
    return {
      ...copy(run.extraQuote),
      reason: sitePayReason(s, run.extraQuote),
    };
  return siteExtraQuote(
    s,
    id,
    siteBillKind(s, id, p.preview.variant),
    siteHelped(s, id),
  );
}
export function siteView(s: G.State, id: string) {
  const definition = siteDefinition(id),
    progress = s.worldExploration.sites[id];
  return {
    definition,
    progress,
    variant:
      definition && progress
        ? definition.variants[progress.preview.variant]
        : undefined,
    routes: {
      assault: siteRouteQuote(s, id, 'assault'),
      clever: siteRouteQuote(s, id, 'clever'),
    },
    travel: siteTravelQuote(s, id),
    reward: siteReward(s, id, 'basic'),
    run:
      s.worldExploration.activeRun?.siteId === id
        ? s.worldExploration.activeRun
        : null,
    reason: siteStartReason(s, id),
  };
}
function pay(s: G.State, b: SiteBundle) {
  for (const [k, n] of Object.entries(b.cost))
    s.resources[k as G.Resource] -= n!;
  G.spendMaterials(s, b.materials);
}
export function haltSiteRepeat(s: G.State, reason: string): void {
  const p = s.worldExploration.repeatPlan;
  if (!p?.enabled) return;
  p.enabled = false;
  p.reason = reason;
  G.log(s, `支线重复已停止：${reason}。已完成 ${p.completed} 趟。`);
}
function beginRun(
  s: G.State,
  id: string,
  kind: SiteRewardKind,
  automatic: boolean,
): void {
  const w = s.worldExploration,
    p = w.sites[id],
    q = siteTravelQuote(s, id),
    d = siteDefinition(id)!;
  const helped = siteHelped(s, id),
    billKind = siteBillKind(s, id, p.preview.variant),
    extraQuote = siteExtraQuote(s, id, billKind, helped);
  const preparation = copy(
    automatic ? w.repeatPlan!.preparation : s.guild.preparation,
  );
  const snapshotState = { ...s, guild: { ...s.guild, preparation } };
  const combatSnapshot = G.snapshotSiteCombat(
    snapshotState,
    id,
    p.preview.variant,
    roll(p.preview.seed ^ 0x41a7),
  );
  const run: SiteRun = {
    id: ++w.runSerial,
    siteId: id,
    variant: p.preview.variant,
    previewSerial: p.preview.serial,
    previewSeed: p.preview.seed,
    phase: 'outbound',
    remaining: siteStageSeconds(q.seconds).outbound,
    total: q.seconds,
    startedAt: s.time,
    method: null,
    rewardKind: kind,
    rewards: siteReward(s, id, kind, p.preview.variant),
    travelPaid: { cost: copy(q.cost), materials: {} },
    extraQuote: { ...extraQuote, reason: '' },
    paidExtra: empty(),
    helped,
    billKind,
    partyIds: [...s.party],
    combatSnapshot,
    preparation,
    paidPreparation: false,
    automatic,
    autoMethod: automatic
      ? w.repeatPlan!.strategies[p.preview.variant]!.method
      : null,
    waitingReason: '',
    repeatLimits: automatic
      ? copy({
          reserve: w.repeatPlan!.reserve,
          maxExtraCost: w.repeatPlan!.maxExtraCost,
          maxExtraMaterials: w.repeatPlan!.maxExtraMaterials,
        })
      : null,
  };
  if (combatSnapshot.site) combatSnapshot.site.runId = run.id;
  pay(s, run.travelPaid);
  w.activeRun = run;
  s.order.enabled = false;
  s.order.reason = '已改为支线出行';
  G.haltHunt(s, '已改为支线出行');
  G.log(
    s,
    `前往${d.name}：${d.variants[run.variant].name}。基础费用 ${G.costText(q.cost)}；抵达后决定处理方式。`,
    'story',
  );
}
export function startSite(
  s0: G.State,
  id: string,
  kind: SiteRewardKind = 'basic',
): G.State {
  if (!['basic', 'material'].includes(kind) || siteStartReason(s0, id))
    return s0;
  const s = G.clone(s0);
  haltSiteRepeat(s, '已改为手动探索');
  beginRun(s, id, kind, false);
  return s;
}
function repeatPaymentReason(
  s: G.State,
  bill: SiteBundle,
  extra: boolean,
  limits: SiteRepeatLimits | null = s.worldExploration.repeatPlan,
): string {
  const p = limits;
  if (!p) return '';
  for (const [key, n] of Object.entries(bill.cost)) {
    const k = key as G.Resource;
    if (s.resources[k] - n! < (p.reserve[k] || 0))
      return `${G.RESOURCE_NAMES[k]}将低于保留量`;
    if (extra && p.maxExtraCost[k] !== undefined && n! > p.maxExtraCost[k]!)
      return `${G.RESOURCE_NAMES[k]}超过已设额外费用上限`;
  }
  if (extra)
    for (const [k, n] of Object.entries(bill.materials))
      if (
        p.maxExtraMaterials[k as G.MaterialId] !== undefined &&
        n! > p.maxExtraMaterials[k as G.MaterialId]!
      )
        return `${G.MATERIAL_NAMES[k as G.MaterialId]}超过额外费用上限`;
  return '';
}
function confirmRoute(
  s: G.State,
  method: SiteMethod,
  automatic: boolean,
): boolean {
  const run = s.worldExploration.activeRun;
  if (
    !run ||
    run.phase !== 'awaitingChoice' ||
    !['assault', 'clever'].includes(method)
  )
    return false;
  const q = siteRouteQuote(s, run.siteId, method),
    reason =
      q.reason ||
      (automatic ? repeatPaymentReason(s, q, true, run.repeatLimits) : '');
  if (reason) {
    run.waitingReason = reason;
    if (automatic) {
      run.automatic = false;
      haltSiteRepeat(s, reason);
    }
    return false;
  }
  pay(s, q);
  run.paidExtra = { cost: copy(q.cost), materials: copy(q.materials) };
  if (method === 'assault') {
    if (run.preparation.element !== 'physical')
      s.guild.potions[run.preparation.element]--;
    run.paidPreparation = true;
  }
  run.method = method;
  run.phase = 'resolving';
  run.remaining = siteStageSeconds(run.total).resolving;
  run.waitingReason = '';
  G.log(
    s,
    `${siteDefinition(run.siteId)!.name}：${method === 'clever' ? '已支付巧解费用，开始现场作业' : '已确认强攻，补给已付，开始接敌准备'}。`,
  );
  return true;
}
export function chooseSiteRoute(s0: G.State, method: SiteMethod): G.State {
  if (
    !s0.worldExploration.activeRun ||
    s0.worldExploration.activeRun.phase !== 'awaitingChoice'
  )
    return s0;
  const s = G.clone(s0);
  if (!confirmRoute(s, method, false)) return s0;
  // Manual choice is explicit consent for this one run, never for later repeats.
  haltSiteRepeat(s, '已接管现场决定');
  s.worldExploration.activeRun!.automatic = false;
  return s;
}
const amount = (b: SiteBundle) =>
  Object.values(b.cost).reduce((a, n) => a + (n || 0), 0) +
  Object.values(b.materials).reduce((a, n) => a + (n || 0), 0);
function takeReceipt(s: G.State, receipt: SiteReceipt): void {
  for (const [key, n] of Object.entries(receipt.remaining.cost)) {
    const k = key as G.Resource,
      take = Math.min(n!, Math.max(0, G.capacity(s, k) - s.resources[k]));
    s.resources[k] += take;
    receipt.kept.cost[k] = (receipt.kept.cost[k] || 0) + take;
    receipt.remaining.cost[k] = Math.max(0, n! - take);
  }
  for (const [key, n] of Object.entries(receipt.remaining.materials)) {
    const k = key as G.MaterialId,
      take = Math.min(
        n!,
        Math.max(0, G.materialCapacity(s, k) - s.world.materials[k]),
      );
    s.world.materials[k] += take;
    receipt.kept.materials[k] = (receipt.kept.materials[k] || 0) + take;
    receipt.remaining.materials[k] = Math.max(0, n! - take);
  }
}
function nextPreview(s: G.State, id: string): void {
  const p = s.worldExploration.sites[id],
    seed = roll(p.preview.seed);
  p.preview = {
    variant: seed % 2 ? 'A' : 'B',
    seed,
    serial: p.preview.serial + 1,
  };
}
function closeRun(s: G.State, won: boolean, retreated: boolean): void {
  const w = s.worldExploration,
    run = w.activeRun;
  if (!run) return;
  const p = w.sites[run.siteId],
    d = siteDefinition(run.siteId)!,
    first = won && !p.firstCompleted;
  const original = won ? copy(run.rewards) : empty();
  const receipt: SiteReceipt = {
    id: ++w.receiptSerial,
    runId: run.id,
    siteId: run.siteId,
    time: s.time,
    variant: run.variant,
    method: run.method || 'clever',
    rewardKind: run.rewardKind,
    original,
    kept: empty(),
    remaining: copy(original),
    abandoned: empty(),
    first,
    won,
    retreated,
    read: false,
  };
  if (won) {
    p.firstCompleted = true;
    if (!p.routesCompleted.includes(run.method!))
      p.routesCompleted.push(run.method!);
    if (first)
      w.relics.owned[d.relicId] = {
        siteId: d.id,
        acquiredAt: s.time,
        repaired: false,
        operation: null,
      };
    takeReceipt(s, receipt);
    p.pendingReceipt = amount(receipt.remaining) > 0 ? receipt : null;
    if (!p.pendingReceipt) nextPreview(s, run.siteId);
    G.log(
      s,
      `${d.name}归来${first ? '：新遗物已入藏，遗物与地点可分别修复' : ''}。${p.pendingReceipt ? '有超出仓容的物资待领取，可在地点收获中处理。' : '本趟物资已入库。'}`,
      'good',
    );
    if (w.repeatPlan?.enabled && w.repeatPlan.siteId === run.siteId) {
      if (run.automatic && w.repeatPlan.startsAfterRunId !== run.id)
        w.repeatPlan.completed++;
      if (p.pendingReceipt) haltSiteRepeat(s, '先处理上次待领取物资');
      else if (
        w.repeatPlan.limit > 0 &&
        w.repeatPlan.completed >= w.repeatPlan.limit
      )
        haltSiteRepeat(s, '已完成指定趟数');
    }
  } else {
    haltSiteRepeat(s, retreated ? '本趟已撤退' : '战败，请整备后重试');
    G.log(
      s,
      `${d.name}${retreated ? '已撤回' : '探索失败'}：已付补给不退，本趟未结算收获放弃。`,
      'bad',
    );
  }
  p.readyAt = s.time + SITE_REVISIT_SECONDS;
  p.lastResult = receipt;
  w.activeRun = null;
}
/** Called only by the real combat settlement, before it clears the Battle. */
export function finishSiteBattle(
  s: G.State,
  won: boolean,
  retreated: boolean,
): void {
  const run = s.worldExploration.activeRun;
  if (!run || run.phase !== 'battle') return;
  if (won) {
    run.phase = 'returning';
    run.remaining = siteStageSeconds(run.total).returning;
  } else {
    closeRun(s, false, retreated);
    s.recoveryUntil = Math.max(s.recoveryUntil, s.time + 30);
  }
}
export function recallSite(s0: G.State): G.State {
  if (!s0.worldExploration.activeRun) return s0;
  if (s0.battle?.kind === 'site') return G.tacticalCombat(s0, 'retreat');
  const s = G.clone(s0);
  closeRun(s, false, true);
  return s;
}
export function claimSite(s0: G.State, id: string): G.State {
  if (!s0.worldExploration.sites[id]?.pendingReceipt) return s0;
  const s = G.clone(s0),
    p = s.worldExploration.sites[id],
    r = p.pendingReceipt!;
  takeReceipt(s, r);
  p.lastResult = copy(r);
  if (amount(r.remaining) <= 1e-7) {
    p.pendingReceipt = null;
    nextPreview(s, id);
  }
  return s;
}
export function discardSite(s0: G.State, id: string): G.State {
  if (!s0.worldExploration.sites[id]?.pendingReceipt) return s0;
  const s = G.clone(s0),
    p = s.worldExploration.sites[id],
    r = p.pendingReceipt!;
  r.abandoned = copy(r.remaining);
  r.remaining = empty();
  p.lastResult = copy(r);
  p.pendingReceipt = null;
  nextPreview(s, id);
  G.log(
    s,
    `已明确放弃${siteDefinition(id)!.name}的剩余普通物资；遗物与地点进度保留。`,
  );
  return s;
}
export function readSiteReceipt(s0: G.State, id: string): G.State {
  if (!s0.worldExploration.sites[id]?.lastResult) return s0;
  const s = G.clone(s0),
    p = s.worldExploration.sites[id];
  p.lastResult!.read = true;
  if (p.pendingReceipt) p.pendingReceipt.read = true;
  return s;
}
export function rememberSite(
  s0: G.State,
  region: number,
  id: string | null,
): G.State {
  if (
    !Number.isInteger(region) ||
    region < 0 ||
    region > 5 ||
    (id !== null &&
      (!s0.worldExploration.sites[id] || siteDefinition(id)?.region !== region))
  )
    return s0;
  const s = G.clone(s0);
  s.lastMap = region;
  s.worldExploration.ui.lastSites[String(region)] = id;
  return s;
}
function validOptions(
  options: unknown,
  plan = false,
): options is SiteRepeatOptions {
  if (
    !exactKeys(options, [
      ...OPTION_KEYS,
      ...(plan
        ? [
            'enabled',
            'siteId',
            'completed',
            'reason',
            'preparation',
            'startsAfterRunId',
          ]
        : []),
    ]) ||
    !integer(options.limit, 10000) ||
    !validLimitAmounts(options) ||
    !exactKeys(options.strategies, ['A', 'B'])
  )
    return false;
  const strategies = options.strategies;
  return (['A', 'B'] as const).every((v) => {
    const strategy = strategies[v];
    return (
      strategy === null ||
      (exactKeys(strategy, ['method', 'rewardKind']) &&
        ['assault', 'clever'].includes(strategy.method as string) &&
        ['basic', 'material'].includes(strategy.rewardKind as string))
    );
  });
}
/** Checks before replacing any other waiting plan. Rest timers only delay a
 * valid funded plan; a failed quote must never cancel an existing activity. */
export function siteRepeatReason(
  s: G.State,
  id: string,
  options: SiteRepeatOptions,
): string {
  const p = s.worldExploration.sites[id],
    run = s.worldExploration.activeRun;
  if (!siteDefinition(id) || !p?.discovered) return '尚未发现这个地点';
  if (!validOptions(options)) return '重复配置无效';
  if (!(['A', 'B'] as const).some((v) => options.strategies[v]))
    return '至少配置一种已掌握的处理方式';
  if (
    (['A', 'B'] as const).some(
      (v) =>
        options.strategies[v] &&
        !p.routesCompleted.includes(options.strategies[v]!.method),
    )
  )
    return '先亲自完成所选处理方式';
  if (
    (run && run.siteId !== id) ||
    s.expedition ||
    (s.battle && s.battle.kind !== 'site')
  )
    return '小队正在执行其他任务';
  // Updating the next plan never reprices or redirects the active trip. Its
  // next preview and future stock are checked when that trip has returned.
  if (run) return '';
  if (s.battle) return '当前战斗还未结束';
  if (!s.party.length) return '先编入至少一位旅人';
  if (p.pendingReceipt) return '先处理上次待领取的物资';
  const strategy = options.strategies[p.preview.variant];
  if (!strategy) return '本次状况未配置已掌握的方式';
  const travel = siteTravelQuote(s, id),
    extra = siteRouteQuote(s, id, strategy.method);
  const total: SiteBundle = {
    cost: copy(travel.cost),
    materials: copy(extra.materials),
  };
  for (const [key, n] of Object.entries(extra.cost))
    total.cost[key as G.Resource] = (total.cost[key as G.Resource] || 0) + n!;
  return (
    travel.reason ||
    extra.reason ||
    sitePayReason(s, total) ||
    repeatPaymentReason(s, total, false, options) ||
    repeatPaymentReason(s, extra, true, options)
  );
}
export function setSiteRepeat(
  s0: G.State,
  id: string,
  options: SiteRepeatOptions | null,
): G.State {
  if (options === null) {
    const s = G.clone(s0);
    haltSiteRepeat(s, '已停止后续重复，当前一趟继续');
    return s;
  }
  if (siteRepeatReason(s0, id, options)) return s0;
  const s = G.clone(s0);
  s.worldExploration.repeatPlan = {
    ...copy(options),
    siteId: id,
    enabled: true,
    completed: 0,
    reason: '',
    preparation: copy(s.guild.preparation),
    startsAfterRunId: s.worldExploration.activeRun?.id || 0,
  };
  s.order.enabled = false;
  s.order.reason = '已改为支线重复';
  G.haltHunt(s, '已改为支线重复');
  tryRepeat(s);
  return s;
}
function tryRepeat(s: G.State): void {
  const w = s.worldExploration,
    p = w.repeatPlan;
  if (!p?.enabled || w.activeRun || s.expedition || s.battle) return;
  const location = w.sites[p.siteId],
    strategy = location && p.strategies[location.preview.variant];
  if (
    !location ||
    !strategy ||
    !location.routesCompleted.includes(strategy.method)
  ) {
    haltSiteRepeat(s, '本次状况未配置已掌握的方式');
    return;
  }
  if (location.pendingReceipt) {
    haltSiteRepeat(s, '先处理上次待领取物资');
    return;
  }
  if (location.readyAt > s.time || s.recoveryUntil > s.time) return;
  const travel = siteTravelQuote(s, p.siteId),
    snapshot = { ...s, guild: { ...s.guild, preparation: p.preparation } },
    extra = siteRouteQuote(snapshot, p.siteId, strategy.method);
  const total = { cost: { ...travel.cost }, materials: extra.materials };
  for (const [k, n] of Object.entries(extra.cost))
    total.cost[k as G.Resource] = (total.cost[k as G.Resource] || 0) + n!;
  const reason =
    siteStartReason(s, p.siteId) ||
    extra.reason ||
    repeatPaymentReason(s, total, false) ||
    repeatPaymentReason(s, extra, true);
  if (reason) {
    haltSiteRepeat(s, reason);
    return;
  }
  beginRun(s, p.siteId, strategy.rewardKind, true);
}
/** Called once per whole game second; no browser-owned timers. */
export function siteTick(s: G.State, dt = 1): void {
  if (s.paused || !Number.isFinite(dt) || dt <= 0) return;
  discoverSites(s);
  const run = s.worldExploration.activeRun;
  if (!run) {
    tryRepeat(s);
    return;
  }
  if (run.phase === 'battle') return;
  if (run.phase === 'awaitingChoice') {
    if (run.automatic && run.autoMethod) confirmRoute(s, run.autoMethod, true);
    return;
  }
  run.remaining = Math.max(0, run.remaining - dt);
  if (run.remaining > 0) return;
  if (run.phase === 'outbound') {
    run.phase = 'awaitingChoice';
    if (run.automatic && run.autoMethod) confirmRoute(s, run.autoMethod, true);
  } else if (run.phase === 'resolving') {
    if (run.method === 'assault') {
      run.phase = 'battle';
      s.battle = G.createSiteBattle(s, run);
    } else {
      run.phase = 'returning';
      run.remaining = siteStageSeconds(run.total).returning;
    }
  } else if (run.phase === 'returning') closeRun(s, true, false);
}

const num = (v: unknown, max = 1e8) =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;
const integer = (v: unknown, max = 1e8) => num(v, max) && Number.isInteger(v);
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const exactKeys = (
  v: unknown,
  keys: readonly string[],
): v is Record<string, unknown> =>
  record(v) &&
  Object.keys(v).length === keys.length &&
  keys.every((k) => Object.hasOwn(v, k));
const LIMIT_KEYS = ['reserve', 'maxExtraCost', 'maxExtraMaterials'] as const;
const OPTION_KEYS = ['strategies', 'limit', ...LIMIT_KEYS] as const;
const RUN_KEYS = [
  'id',
  'siteId',
  'variant',
  'previewSerial',
  'previewSeed',
  'phase',
  'remaining',
  'total',
  'startedAt',
  'method',
  'rewardKind',
  'rewards',
  'travelPaid',
  'extraQuote',
  'paidExtra',
  'helped',
  'billKind',
  'partyIds',
  'combatSnapshot',
  'preparation',
  'paidPreparation',
  'automatic',
  'autoMethod',
  'waitingReason',
  'repeatLimits',
] as const;
function validLimitAmounts(v: Record<string, unknown>): boolean {
  return (
    validCost(v.reserve, G.RESOURCE_NAMES) &&
    validCost(v.maxExtraCost, G.RESOURCE_NAMES) &&
    validCost(v.maxExtraMaterials, G.MATERIAL_NAMES)
  );
}
function validLimits(v: unknown): v is SiteRepeatLimits {
  return exactKeys(v, LIMIT_KEYS) && validLimitAmounts(v);
}
function validCost(v: unknown, names: Record<string, unknown>): boolean {
  return (
    record(v) &&
    Object.entries(v).every(([k, n]) => Object.hasOwn(names, k) && num(n))
  );
}
function validBundle(v: unknown): v is SiteBundle {
  return (
    record(v) &&
    validCost(v.cost, G.RESOURCE_NAMES) &&
    validCost(v.materials, G.MATERIAL_NAMES)
  );
}
function sameCost(
  a: Record<string, number | undefined>,
  b: Record<string, number | undefined>,
): boolean {
  return (
    Object.keys(a).length === Object.keys(b).length &&
    Object.entries(a).every(([k, n]) => n === b[k])
  );
}
function sameBundle(a: SiteBundle, b: SiteBundle): boolean {
  return sameCost(a.cost, b.cost) && sameCost(a.materials, b.materials);
}
function validReceipt(r: SiteReceipt, id: string, s: G.State): boolean {
  if (
    !exactKeys(r, [
      'id',
      'runId',
      'siteId',
      'time',
      'variant',
      'method',
      'rewardKind',
      'original',
      'kept',
      'remaining',
      'abandoned',
      'first',
      'won',
      'retreated',
      'read',
    ]) ||
    r.siteId !== id ||
    !integer(r.id) ||
    r.id < 1 ||
    r.id > s.worldExploration.receiptSerial ||
    !integer(r.runId) ||
    r.runId < 1 ||
    r.runId > s.worldExploration.runSerial ||
    !num(r.time, s.time) ||
    !['A', 'B'].includes(r.variant) ||
    !['assault', 'clever'].includes(r.method) ||
    !['basic', 'material'].includes(r.rewardKind) ||
    ![r.first, r.won, r.retreated, r.read].every(
      (v) => typeof v === 'boolean',
    ) ||
    ![r.original, r.kept, r.remaining, r.abandoned].every(validBundle)
  )
    return false;
  for (const key of ['cost', 'materials'] as const)
    for (const id of new Set([
      ...Object.keys(r.original[key]),
      ...Object.keys(r.kept[key]),
      ...Object.keys(r.remaining[key]),
      ...Object.keys(r.abandoned[key]),
    ])) {
      const a = r.original[key] as Record<string, number>,
        b = r.kept[key] as Record<string, number>,
        c = r.remaining[key] as Record<string, number>,
        d = r.abandoned[key] as Record<string, number>;
      if (
        Math.abs((a[id] || 0) - (b[id] || 0) - (c[id] || 0) - (d[id] || 0)) >
        1e-6
      )
        return false;
    }
  return (
    (!r.first || r.won) &&
    !(r.won && r.retreated) &&
    (r.won || amount(r.original) === 0)
  );
}
export function validateWorldExploration(s: G.State): void {
  const w = s.worldExploration;
  if (
    !exactKeys(w, [
      'facilities',
      'relics',
      'facilityCursor',
      'facilityPriority',
      'sites',
      'activeRun',
      'repeatPlan',
      'runSerial',
      'receiptSerial',
      'ui',
    ]) ||
    !record(w.sites) ||
    !integer(w.runSerial) ||
    !integer(w.receiptSerial) ||
    !exactKeys(w.ui, ['lastSites']) ||
    !record(w.ui.lastSites)
  )
    throw Error('支线记录不完整');
  const receiptIds = new Set<number>(),
    resultRunIds = new Set<number>();
  for (const [id, p] of Object.entries(w.sites)) {
    const d = siteDefinition(id);
    if (
      !d ||
      !exactKeys(p, [
        'discovered',
        'firstCompleted',
        'routesCompleted',
        'preview',
        'readyAt',
        'lastResult',
        'pendingReceipt',
      ]) ||
      p.discovered !== true ||
      typeof p.firstCompleted !== 'boolean' ||
      !G.regionOpen(s, d.region) ||
      s.guild.depths[d.region] < d.depth ||
      !Array.isArray(p.routesCompleted) ||
      new Set(p.routesCompleted).size !== p.routesCompleted.length ||
      p.routesCompleted.some((x) => !['assault', 'clever'].includes(x)) ||
      p.firstCompleted !== p.routesCompleted.length > 0 ||
      !exactKeys(p.preview, ['variant', 'seed', 'serial']) ||
      !['A', 'B'].includes(p.preview.variant) ||
      !integer(p.preview.seed, 4294967295) ||
      p.preview.seed === 0 ||
      !integer(p.preview.serial) ||
      p.preview.serial < 1 ||
      !num(p.readyAt)
    )
      throw Error('地点发现或路线记录无效');
    if (p.lastResult !== null && !validReceipt(p.lastResult, id, s))
      throw Error('地点收获记录无效');
    if (
      p.pendingReceipt !== null &&
      (!validReceipt(p.pendingReceipt, id, s) ||
        !p.pendingReceipt.won ||
        amount(p.pendingReceipt.remaining) <= 0 ||
        !p.firstCompleted ||
        p.lastResult?.id !== p.pendingReceipt.id)
    )
      throw Error('地点待领取记录无效');
    if (p.lastResult) {
      if (
        receiptIds.has(p.lastResult.id) ||
        resultRunIds.has(p.lastResult.runId)
      )
        throw Error('地点收获编号重复');
      receiptIds.add(p.lastResult.id);
      resultRunIds.add(p.lastResult.runId);
    }
    if (
      p.pendingReceipt &&
      p.lastResult &&
      Object.keys(p.pendingReceipt).some((key) => {
        const a = p.pendingReceipt![key as keyof SiteReceipt],
          b = p.lastResult![key as keyof SiteReceipt];
        return ['original', 'kept', 'remaining', 'abandoned'].includes(key)
          ? !sameBundle(a as SiteBundle, b as SiteBundle)
          : a !== b;
      })
    )
      throw Error('待领单与最近收获不一致');
    if (p.firstCompleted !== !!w.relics?.owned?.[d.relicId])
      throw Error('地点首通与遗物来源不一致');
  }
  for (const [region, id] of Object.entries(w.ui.lastSites))
    if (
      !/^[0-5]$/.test(region) ||
      (id !== null &&
        (typeof id !== 'string' ||
          !w.sites[id] ||
          siteDefinition(id)?.region !== Number(region)))
    )
      throw Error('地点浏览记录无效');
  if (w.activeRun !== null) {
    const r = w.activeRun;
    if (!exactKeys(r, RUN_KEYS)) throw Error('进行中的支线记录不完整');
    const p = w.sites[r.siteId];
    if (
      !record(r) ||
      !p ||
      p.pendingReceipt ||
      s.expedition ||
      !integer(r.id) ||
      r.id < 1 ||
      r.id > w.runSerial ||
      ![
        'outbound',
        'awaitingChoice',
        'resolving',
        'battle',
        'returning',
      ].includes(r.phase) ||
      !num(r.remaining, r.total) ||
      !num(r.total, 180) ||
      r.total < 90 ||
      !num(r.startedAt, s.time) ||
      r.variant !== p.preview.variant ||
      r.previewSerial !== p.preview.serial ||
      r.previewSeed !== p.preview.seed ||
      !['basic', 'material'].includes(r.rewardKind) ||
      !Array.isArray(r.partyIds) ||
      !r.partyIds.length ||
      r.partyIds.length > 4 ||
      new Set(r.partyIds).size !== r.partyIds.length ||
      r.partyIds.some((id) => !s.heroes.some((h) => h.id === id)) ||
      JSON.stringify(r.partyIds) !== JSON.stringify(s.party) ||
      !['construction', 'supply', 'sample'].includes(r.billKind) ||
      ![r.helped, r.automatic, r.paidPreparation].every(
        (v) => typeof v === 'boolean',
      ) ||
      typeof r.waitingReason !== 'string' ||
      ![r.rewards, r.travelPaid, r.extraQuote, r.paidExtra].every(
        validBundle,
      ) ||
      !validPreparation(r.preparation)
    )
      throw Error('进行中的支线记录无效');
    if (
      (['outbound', 'awaitingChoice'].includes(r.phase)
        ? r.method !== null
        : !['assault', 'clever'].includes(r.method!)) ||
      r.paidPreparation !== (r.method === 'assault') ||
      (r.phase === 'battle' &&
        (!s.battle ||
          s.battle.kind !== 'site' ||
          s.battle.site?.runId !== r.id ||
          s.battle.site?.siteId !== r.siteId)) ||
      (r.phase !== 'battle' && s.battle)
    )
      throw Error('支线阶段或战斗来源无效');
    if (
      r.id !== w.runSerial ||
      resultRunIds.has(r.id) ||
      r.waitingReason.length > 300 ||
      r.total !== siteTravelQuote(s, r.siteId).seconds
    )
      throw Error('支线编号或计时无效');
    const phaseTime = siteStageSeconds(r.total);
    if (
      r.phase === 'awaitingChoice' || r.phase === 'battle'
        ? r.remaining !== 0
        : r.remaining <= 0 || r.remaining > phaseTime[r.phase]
    )
      throw Error('支线阶段时间无效');
    if (r.autoMethod !== null && !['assault', 'clever'].includes(r.autoMethod))
      throw Error('支线自动处理方式无效');
    if (
      (r.autoMethod === null) !== (r.repeatLimits === null) ||
      (r.repeatLimits !== null && !validLimits(r.repeatLimits)) ||
      (r.autoMethod !== null &&
        (!w.repeatPlan || !p.routesCompleted.includes(r.autoMethod))) ||
      (r.automatic &&
        (r.autoMethod === null ||
          (r.method !== null && r.method !== r.autoMethod)))
    )
      throw Error('支线自动付款快照无效');
    const declared = siteDefinition(r.siteId)!.variants[r.variant].bill;
    const fallback = ['S04', 'S08', 'S12'].includes(r.siteId)
      ? 'supply'
      : 'construction';
    if (
      r.billKind !== declared &&
      !(declared === 'sample' && r.billKind === fallback)
    )
      throw Error('支线额外费用档位无效');
    const extra = siteExtraQuote(s, r.siteId, r.billKind, r.helped);
    if (
      !sameBundle(r.travelPaid, siteTravelQuote(s, r.siteId)) ||
      !exactKeys(r.extraQuote, ['cost', 'materials', 'seconds', 'reason']) ||
      !sameBundle(r.extraQuote, extra) ||
      r.extraQuote.seconds !== phaseTime.resolving ||
      r.extraQuote.reason !== ''
    )
      throw Error('支线冻结报价无效');
    const paid =
      r.method === 'clever'
        ? r.extraQuote
        : r.method === 'assault'
          ? {
              cost: r.preparation.remedy ? { food: 30, gold: 25 } : {},
              materials: {},
            }
          : empty();
    if (!sameBundle(r.paidExtra, paid)) throw Error('支线已付账单与阶段不一致');
    if (
      r.combatSnapshot?.kind !== 'site' ||
      r.combatSnapshot.site?.siteId !== r.siteId ||
      r.combatSnapshot.site?.runId !== r.id ||
      r.combatSnapshot.site?.variant !== r.variant
    )
      throw Error('出发战斗快照缺失');
    G.validateBattle({ ...s, battle: r.combatSnapshot });
  } else if (s.battle?.kind === 'site') throw Error('地点战斗缺少对应出行');
  if (w.repeatPlan !== null) {
    const p = w.repeatPlan;
    if (!validOptions(p, true)) throw Error('支线重复计划字段无效');
    const location = w.sites[p.siteId];
    if (
      !location ||
      typeof p.enabled !== 'boolean' ||
      !integer(p.completed) ||
      typeof p.reason !== 'string' ||
      p.reason.length > 300 ||
      !validPreparation(p.preparation) ||
      !integer(p.startsAfterRunId, w.runSerial) ||
      p.completed > w.runSerial - p.startsAfterRunId ||
      (p.limit > 0 && p.completed > p.limit) ||
      !(['A', 'B'] as const).some((v) => p.strategies[v]) ||
      (['A', 'B'] as const).some(
        (v) =>
          p.strategies[v] &&
          !location.routesCompleted.includes(p.strategies[v]!.method),
      ) ||
      (p.enabled &&
        (p.reason !== '' ||
          (p.limit > 0 && p.completed >= p.limit) ||
          s.order.enabled ||
          s.hunt?.enabled ||
          s.expedition ||
          (s.battle && s.battle.kind !== 'site') ||
          (w.activeRun && w.activeRun.siteId !== p.siteId)))
    )
      throw Error('支线重复计划无效');
    if (
      p.startsAfterRunId > 0 &&
      !(
        w.activeRun?.id === p.startsAfterRunId &&
        w.activeRun.siteId === p.siteId
      ) &&
      (!location.lastResult || location.lastResult.runId < p.startsAfterRunId)
    )
      throw Error('支线后续计划起点无效');
  }
  if (!validateWorldEconomy(s)) throw Error('遗物与地点经营记录无效');
}
function validPreparation(p: G.State['guild']['preparation']) {
  return (
    exactKeys(p, ['stance', 'element', 'remedy']) &&
    ['balanced', 'cautious', 'assault'].includes(p.stance) &&
    ['physical', 'shadow', 'fire', 'radiant'].includes(p.element) &&
    typeof p.remedy === 'boolean'
  );
}
