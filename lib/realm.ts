import * as D from './realm-data.ts';
import { BOSS_ACCESS_DEPTH } from './boss-access.ts';
import { preparedPotionReason } from './alchemy.ts';
export * from './boss-access.ts';
import { combatRecommendation } from './combat-recommendation.ts';
import { skillPoints, roleTree, learnSkillReason } from './skill-tree.ts';
import * as Guild from './guild.ts';
import * as Campaign from './campaign.ts';
import * as Discovery from './discovery.ts';
import * as Tactics from './tactics.ts';
import * as Economy from './economy.ts';
import * as Civic from './civic.ts';
export * from './civic.ts';
export * from './equipment-data.ts';
export * from './buildcraft.ts';
export * from './boss-mechanics.ts';
import type { EconomyState } from './economy-data.ts';
export * from './economy.ts';
export * from './tactics.ts';
export * from './skill-tree.ts';
export * from './discovery.ts';
import type { WorldState, MaterialCost } from './campaign-data.ts';
export * from './campaign-data.ts';
export * from './campaign.ts';
import type { Character, Gear, Element } from './guild-data.ts';
import { FRONTIER_RESOURCES, RECIPES } from './guild-data.ts';
export * from './guild-data.ts';
export * from './guild.ts';
export * from './alchemy.ts';
export * from './origins.ts';
import { originEffect } from './origins.ts';
import { decodeSave as decodeLegacy } from './game.ts';
import type { Resource, Job, BuildingId, Cost, View } from './realm-data.ts';
export * from './realm-data.ts';
export type Route = 'supply' | 'survey' | 'frontier';
export type Command =
  | 'attack'
  | 'break'
  | 'guard'
  | 'heal'
  | 'retreat'
  | `hero:${string}`
  | `unit:${string}:${string}`;
export interface Hero extends Character {
  trainingInvestment?: { gold: number; food: number };
  id: string;
  level: number;
  xp: number;
  weapon: number;
  armor: number;
}
export interface Expedition {
  region: number;
  route: Route;
  start: number;
  end: number;
  power: number;
  outcome: number;
  chance: number;
  success: boolean;
  depth: number;
}
export interface ExpeditionReport {
  time: number;
  region: number;
  outcome: number;
  found: Cost;
  kept: Cost;
  lost: Cost;
  success: boolean;
  progress: number;
  equipment: string;
  materials?: string;
  route?: Route;
  chance?: number;
  intelGain?: number;
  clues?: number;
}
export interface Order {
  enabled: boolean;
  region: number;
  route: Route;
  reserve: number;
  autoBuy: boolean;
  reason: string;
}
export interface Battle {
  boss?: import('./boss-mechanics.ts').BossRuntime;
  dots?: {
    source: string;
    kind: 'poison' | 'fire';
    damage: number;
    turns: number;
  }[];
  system: 2;
  kind: 'boss' | 'guardian';
  node: number;
  units: Tactics.CombatUnit[];
  acted: string[];
  selected: string;
  target: string;
  healTarget: string;
  enemyName: string;
  enemyMaxHp: number;
  enemyAttack: number;
  enemyDefense: number;
  enemyCrit: number;
  enemyDodge: number;
  enemyElement: Element;
  pattern: string[];
  aoeScale: number;
  rng: number;
  actionCount: number;
  auto: boolean;
  interrupted: boolean;
  shattered: boolean;
  poison: number;
  poisonTurns: number;
  taunt: string;
  region: number;
  hp: number;
  maxHp: number;
  enemyHp: number;
  attack: number;
  defense: number;
  round: number;
  energy: number;
  supplies: number;
  healCooldown: number;
  cooldowns: Record<string, number>;
  resistance: number;
  pierce: number;
  ranged: number;
  bonus: number;
  ward: number;
  marked: number;
  burn: number;
  enemyShield: number;
  sealed: number;
  history: string[];
}
export interface State {
  version: 10;
  civic: Civic.CivicState;
  lastMap: number;
  combatAuto: boolean;
  lastBattle: Tactics.BattleReport | null;
  economy: EconomyState;
  world: WorldState;
  chronicle: string[];
  time: number;
  savedAt: number;
  speed: 1 | 3;
  paused: boolean;
  resources: Record<Resource, number>;
  buildings: Record<BuildingId, number>;
  population: number;
  jobs: Record<Job, number>;
  heroes: Hero[];
  party: string[];
  guild: {
    bossHunts?: { wins: number[]; readyAt: number[] };
    guardianHunts?: { readyAt: number[] };
    applicants: Hero[];
    refreshAt: number;
    rolls: number;
    fiveStarMisses: number;
    serial: number;
    inventory: Gear[];
    potions: Record<import('./guild-data.ts').PotionId, number>;
    crafts: number;
    dust: number;
    depths: number[];
    progress: number[];
    intel: number[];
    failures: number[];
    outposts: number[];
    doctrine: { logistics: number; smithing: number; scholarship: number };
    preparation: {
      stance: 'balanced' | 'cautious' | 'assault';
      element: Element;
      remedy: boolean;
    };
  };
  explored: number[];
  survey: number[];
  cleared: number[];
  projects: Record<string, string>;
  research: string[];
  event: number | null;
  eventDone: string[];
  flags: string[];
  pendingSettlers: number;
  assigned: boolean;
  kit: number;
  expedition: Expedition | null;
  order: Order;
  battle: Battle | null;
  recoveryUntil: number;
  gatherAt: number;
  gatherTimes: Record<Resource, number>;
  legacyStock: Record<Resource, number>;
  rng: number;
  nextEventAt: number;
  lastExpedition: ExpeditionReport | null;
  ending: boolean;
  rebuild: string[];
  peaceRuns: number[];
  legacy: number;
  journeys: number;
  log: { time: number; text: string; kind: string }[];
}
export const MAX_OFFLINE = 8 * 3600;
const ids = D.HEROES.map((h) => h.id);
const blankResources = (): Record<Resource, number> => ({
  wood: 0,
  food: 0,
  stone: 0,
  gold: 0,
  iron: 0,
  crystal: 0,
});
export const freshState = (
  now = Date.now(),
  legacy = 0,
  journeys = 0,
): State => ({
  version: 10,
  civic: Civic.freshCivic(),
  lastMap: 0,
  combatAuto: false,
  lastBattle: null,
  chronicle: [],
  world: Campaign.freshWorld(),
  economy: Economy.freshEconomy(),
  time: 0,
  savedAt: now,
  speed: 1,
  paused: false,
  resources: blankResources(),
  buildings: {
    fire: 0,
    warehouse: 0,
    hut: 0,
    lumber: 0,
    farm: 0,
    quarry: 0,
    market: 0,
    tavern: 0,
    forge: 0,
    shrine: 0,
  },
  population: 0,
  jobs: blankResources(),
  heroes: [],
  party: [],
  guild: Guild.freshGuild(),
  explored: [0, 0, 0, 0, 0, 0],
  survey: [0, 0, 0, 0, 0, 0],
  cleared: [],
  projects: {},
  research: [],
  event: null,
  eventDone: [],
  flags: [],
  pendingSettlers: 0,
  assigned: false,
  kit: 0,
  expedition: null,
  order: {
    enabled: false,
    region: 0,
    route: 'survey',
    reserve: 20,
    autoBuy: false,
    reason: '',
  },
  battle: null,
  recoveryUntil: 0,
  gatherAt: -12,
  gatherTimes: {
    wood: -12,
    food: -12,
    stone: -12,
    gold: -12,
    iron: -12,
    crystal: -12,
  },
  legacyStock: blankResources(),
  rng: Math.floor(now) >>> 0 || 123456789,
  nextEventAt: 30,
  lastExpedition: null,
  ending: false,
  rebuild: [],
  peaceRuns: [0, 0, 0, 0, 0, 0],
  legacy,
  journeys,
  log: [
    {
      time: 0,
      text: journeys
        ? '带着上一段旅程留下的手艺，你再一次在异乡醒来。'
        : '你在一堵断墙下醒来。没有系统替你解释世界，只有湿冷的风。先拾起枯枝，让火燃起来。',
      kind: 'story',
    },
  ],
});
export const clone = (s: State): State => structuredClone(s);
export const day = (s: State) => Math.floor(s.time / 300) + 1;
export const populationCap = (s: State) => 3 + s.buildings.hut * 3;
export const idleWorkers = (s: State) => Economy.freeEconomyWorkers(s);
export const levelCap = (s: State) =>
  Math.min(
    40,
    [6, 10, 16, 24, 32, 40][Campaign.townRank(s)] + Economy.educationLevels(s),
  );
export const canPay = (s: State, c: Cost) =>
  Object.entries(c).every(([k, v]) => s.resources[k as Resource] + 1e-8 >= v!);
export const costText = (c: Cost) =>
  Object.entries(c)
    .map(([k, v]) => `${v} ${D.RESOURCE_NAMES[k as Resource]}`)
    .join(' · ');
export const capacity = Economy.baseCapacity;
export function capacityReason(s: State, cost: Cost) {
  const over = Object.entries(cost).filter(
    ([k, v]) => v! > capacity(s, k as Resource),
  );
  return over.length
    ? `容量不足：${over.map(([k, v]) => `${D.RESOURCE_NAMES[k as Resource]}需要 ${v} / 上限 ${capacity(s, k as Resource)}`).join('；')}，先扩建仓库`
    : '';
}
export function claimLegacyStock(s0: State) {
  const s = clone(s0);
  let total = 0;
  for (const k of Object.keys(s.resources) as Resource[]) {
    const amount = Math.min(s.legacyStock[k], capacity(s, k) - s.resources[k]);
    s.resources[k] += amount;
    s.legacyStock[k] -= amount;
    total += amount;
  }
  if (!total) return s0;
  log(s, '已将封存的旧库存取入仓库。新产出仍受容量限制。');
  return s;
}
function pay(s: State, c: Cost) {
  for (const [k, v] of Object.entries(c))
    s.resources[k as Resource] = Math.max(0, s.resources[k as Resource] - v!);
}
export function grant(s: State, c: Cost) {
  for (const [k, v] of Object.entries(c))
    s.resources[k as Resource] = Math.min(
      capacity(s, k as Resource),
      s.resources[k as Resource] + v!,
    );
}
function random(s: State) {
  let x = s.rng;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  s.rng = x >>> 0;
  return s.rng / 4294967296;
}
export function outcomeChances(s: State) {
  return D.EXPEDITION_OUTCOMES.map(
    (o, i) =>
      o.chance +
      (s.research.includes('scouting')
        ? i === 1
          ? 10
          : i === 2
            ? -10
            : 0
        : 0),
  );
}
function rollOutcome(s: State) {
  let roll = random(s) * 100;
  const chances = outcomeChances(s);
  for (let i = 0; i < chances.length; i++) {
    roll -= chances[i];
    if (roll < 0) return i;
  }
  return 0;
}
export function log(s: State, text: string, kind = 'normal') {
  s.log.unshift({ time: s.time, text, kind });
  s.log = s.log.slice(0, 100);
}
export const chosen = (s: State, project: string, choice: string) =>
  s.projects[project] === choice;
export const resourceVisible = Discovery.resourceDiscovered;
export const buildingVisible = Discovery.buildingDiscovered;
export function buildingReason(s: State, id: BuildingId) {
  const b = D.BUILDINGS.find((b) => b.id === id)!;
  if (!Discovery.buildingDiscovered(s, id))
    return '先完成当前引导，找到这座建筑的用途';
  if (s.buildings[id] >= b.max) return '已完成全部建设';
  if (s.buildings[id] >= Campaign.buildingLimit(s, id))
    return '本阶段建设已完成；研究城镇进阶以扩建';
  if (b.need && !s.buildings[b.need])
    return `先建造${D.BUILDINGS.find((x) => x.id === b.need)!.name}`;
  if (b.chapter && Campaign.townRank(s) < 1)
    return '探索森林第一据点，研究定居法令';
  if (id === 'tavern' && (!s.assigned || s.population < 6))
    return '先安置 6 位住民，并亲自安排一次分工';
  return '';
}
export function buildingCost(s: State, id: BuildingId): Cost {
  const b = D.BUILDINGS.find((b) => b.id === id)!;
  return Object.fromEntries(
    Object.entries(b.cost).map(([k, v]) => [
      k,
      Math.ceil(
        v! *
          (id === 'warehouse' || id === 'hut' ? 1.65 : 1.62) **
            s.buildings[id] *
          (1 +
            s.buildings[id] * (id === 'warehouse' || id === 'hut' ? 0 : 0.28)),
      ),
    ]),
  );
}
export function production(s: State): Record<Resource, number> {
  const base = 1 + Math.min(0.5, s.legacy * 0.05);
  const rates = {
    wood:
      (s.buildings.lumber ? s.jobs.wood : 0) *
      0.65 *
      (1 + s.buildings.lumber * 0.5) *
      base *
      (chosen(s, 'watch', 'forest') ? 1.25 : 1),
    food:
      (s.buildings.farm ? s.jobs.food : 0) *
      0.65 *
      (1 + s.buildings.farm * 0.5) *
      base *
      (chosen(s, 'watch', 'river') ? 1.25 : 1),
    stone: s.buildings.quarry
      ? s.jobs.stone * 0.5 * (1 + s.buildings.quarry * 0.4) * base
      : 0,
    gold: s.buildings.market
      ? s.jobs.gold *
        0.22 *
        (1 + s.buildings.market * 0.35) *
        base *
        (chosen(s, 'station', 'traders') ? 1.2 : 1)
      : 0,
    iron:
      (s.buildings.forge
        ? s.jobs.iron *
          0.12 *
          (1 + s.buildings.forge * 0.25) *
          (chosen(s, 'station', 'miners') ? 1.35 : 1)
        : 0) + (chosen(s, 'station', 'miners') ? 0.1 : 0),
    crystal: s.buildings.shrine
      ? s.jobs.crystal * 0.07 * (1 + s.buildings.shrine * 0.2)
      : 0,
  };
  for (const r of D.RESEARCH)
    if (s.research.includes(r.id))
      for (const [k, m] of Object.entries(r.production || {}))
        rates[k as Resource] *= m!;
  FRONTIER_RESOURCES.forEach((resource, region) => {
    if (s.guild.depths[region] >= 2) rates[resource] *= 1.15;
  });
  for (const k of Object.keys(rates) as Resource[])
    rates[k] *=
      Economy.productionMultiplier(s, k) *
      Civic.renovationFactor(
        s,
        (
          {
            wood: 'lumber',
            food: 'farm',
            stone: 'quarry',
            gold: 'market',
            iron: 'forge',
            crystal: 'shrine',
          } as const
        )[k],
      ) *
      Civic.renovationFactor(s, 'hut', 0.01) *
      (['wood', 'food', 'stone'].includes(k) && Civic.buffActive(s, 'hands')
        ? 1.25
        : 1);
  return rates;
}
/** The same one-second flow drives the live ledger and simulation. Full workshops consume no inputs. */
function productionStep(s: State): Record<Resource, number> {
  const p = production(s),
    next = { ...s.resources };
  for (const k of ['wood', 'food', 'stone', 'gold'] as Resource[])
    next[k] = Math.min(capacity(s, k), next[k] + p[k]);
  const extra = chosen(s, 'station', 'miners') ? 0.1 : 0;
  const iron = s.buildings.forge ? s.jobs.iron : 0,
    ironOutput = p.iron - extra;
  const ironInput = ironOutput / 0.12;
  if (iron && ironOutput > 0) {
    const ratio = Math.max(
      0,
      Math.min(
        1,
        next.wood / (ironInput * 0.3),
        next.stone / (ironInput * 0.6),
        (capacity(s, 'iron') - next.iron) / ironOutput,
      ),
    );
    next.wood -= ironInput * 0.3 * ratio;
    next.stone -= ironInput * 0.6 * ratio;
    next.iron += ironOutput * ratio;
  }
  next.iron = Math.min(capacity(s, 'iron'), next.iron + extra);
  const crystal = s.buildings.shrine ? s.jobs.crystal : 0;
  if (crystal && p.crystal > 0) {
    const ratio = Math.max(
      0,
      Math.min(
        1,
        next.gold / ((p.crystal / 0.07) * 0.25),
        (capacity(s, 'crystal') - next.crystal) / p.crystal,
      ),
    );
    next.gold -= (p.crystal / 0.07) * 0.25 * ratio;
    next.crystal += p.crystal * ratio;
  }
  return next;
}
export function netProduction(s: State): Record<Resource, number> {
  const sim = clone(s);
  sim.time = Math.floor(s.time) + 1;
  sim.resources = productionStep(sim);
  Economy.economyTick(sim);
  Campaign.worldTick(sim);
  const next = sim.resources;
  return Object.fromEntries(
    Object.keys(next).map((k) => [
      k,
      next[k as Resource] - s.resources[k as Resource],
    ]),
  ) as Record<Resource, number>;
}
export function productionFormula(s: State, k: Resource) {
  const unavailable = jobReason(s, k);
  if (unavailable) return `${unavailable}；此岗位当前没有持续产出。`;
  const p = production(s);
  const base = {
    wood: 0.65,
    food: 0.65,
    stone: 0.5,
    gold: 0.22,
    iron: 0.12,
    crystal: 0.07,
  }[k];
  const building = {
    wood: 'lumber',
    food: 'farm',
    stone: 'quarry',
    gold: 'market',
    iron: 'forge',
    crystal: 'shrine',
  }[k] as BuildingId;
  const perLevel = {
    wood: 0.5,
    food: 0.5,
    stone: 0.4,
    gold: 0.35,
    iron: 0.25,
    crystal: 0.2,
  }[k];
  const extra = k === 'iron' && chosen(s, 'station', 'miners') ? 0.1 : 0;
  const basic = s.jobs[k] * base * (1 + s.buildings[building] * perLevel);
  const bonus = basic ? (p[k] - extra) / basic : 1;
  return `${s.jobs[k]} 人 × ${base} 基础/秒 × ${(1 + s.buildings[building] * perLevel).toFixed(2)} 建筑 × ${bonus.toFixed(3)} 研究与加成${extra ? ' + 0.1 矿工支援' : ''} = ${p[k].toFixed(3)}/秒（未扣消耗与满仓）`;
}
export function jobReason(s: State, job: Job) {
  if (!s.buildings.fire) return '先点燃营火';
  const b = (
    {
      wood: 'lumber',
      food: 'farm',
      stone: 'quarry',
      gold: 'market',
      iron: 'forge',
      crystal: 'shrine',
    } as Partial<Record<Job, BuildingId>>
  )[job];
  return b && !s.buildings[b]
    ? `需要${D.BUILDINGS.find((x) => x.id === b)!.name}`
    : '';
}
export function build(s0: State, id: BuildingId) {
  if (
    !D.BUILDINGS.some((b) => b.id === id) ||
    buildingReason(s0, id) ||
    !canPay(s0, buildingCost(s0, id)) ||
    !Campaign.canAffordMaterials(s0, Campaign.buildingMaterialCost(s0, id))
  )
    return s0;
  const s = clone(s0);
  pay(s, buildingCost(s, id));
  Campaign.spendMaterials(s, Campaign.buildingMaterialCost(s, id));
  s.buildings[id]++;
  Guild.ensureApplicants(s);
  if (id === 'fire') {
    log(
      s,
      '你独自守住了火。没有住民，也没有人替你干活。先收集材料，搭起能遮雨的小屋。',
      'story',
    );
  } else
    log(
      s,
      `${D.BUILDINGS.find((b) => b.id === id)!.name}${s.buildings[id] > 1 ? '升至 ' + s.buildings[id] + ' 级' : '建成'}。`,
      'good',
    );
  settle(s);
  return s;
}
function settle(s: State) {
  Guild.ensureApplicants(s);
  const n = Math.min(s.pendingSettlers, populationCap(s) - s.population);
  if (n > 0) {
    s.pendingSettlers -= n;
    s.population += n;
    log(s, `${n} 位等待安置的旅人搬进新居。请为他们安排工作。`, 'good');
  }
}
export const manualAmount = (s: State, k: Resource) =>
  Math.floor(
    (k === 'wood' && !s.buildings.fire ? 2 : D.MANUAL[k].amount) *
      (['wood', 'food', 'stone'].includes(k) && s.research.includes('tools')
        ? 1.5
        : 1),
  );
export const gatherCooldown = (s: State, k: Resource) =>
  Math.max(0, D.MANUAL[k].seconds - (s.time - s.gatherTimes[k]));
export function gatherReason(s: State, k: Resource) {
  const d = D.MANUAL[k];
  if (k !== 'wood' && !s.buildings[d.need])
    return `需要${D.BUILDINGS.find((b) => b.id === d.need)!.name}`;
  if (s.paused) return '已暂停';
  if (s.resources[k] >= capacity(s, k)) return '已满仓';
  if (gatherCooldown(s, k)) return `冷却 ${Math.ceil(gatherCooldown(s, k))} 秒`;
  if (!canPay(s, d.cost)) return `需要 ${costText(d.cost)}`;
  if (
    Object.keys(d.cost).length &&
    capacity(s, k) - s.resources[k] < manualAmount(s, k)
  )
    return '仓库剩余空间不足';
  return '';
}
export function gather(s0: State, k: Resource) {
  if (!Object.hasOwn(D.MANUAL, k) || gatherReason(s0, k)) return s0;
  const s = clone(s0),
    before = s.resources[k];
  pay(s, D.MANUAL[k].cost);
  grant(s, { [k]: manualAmount(s, k) });
  s.gatherTimes[k] = s.time;
  s.gatherAt = s.time;
  log(
    s,
    `${D.MANUAL[k].name}：${D.RESOURCE_NAMES[k]} +${Math.round((s.resources[k] - before) * 100) / 100}。`,
  );
  return s;
}
export function hireWorker(s0: State) {
  if (
    !s0.buildings.hut ||
    s0.population >= populationCap(s0) ||
    !canPay(s0, { food: 10 })
  )
    return s0;
  const s = clone(s0);
  pay(s, { food: 10 });
  s.population++;
  log(s, '一位旅人决定留下。为新住民安排分工，城镇就会自己运转。');
  return s;
}
export function assign(s0: State, job: Job, delta: 1 | -1) {
  if (
    !Object.hasOwn(s0.jobs, job) ||
    ![1, -1].includes(delta) ||
    (delta === 1 && jobReason(s0, job)) ||
    s0.jobs[job] + delta < 0 ||
    (delta === 1 && !idleWorkers(s0))
  )
    return s0;
  const s = clone(s0);
  s.jobs[job] += delta;
  s.assigned = true;
  return s;
}
export function recruit(s0: State, id: string) {
  return Guild.hireApplicant(s0, id);
}
export function toggleParty(s0: State, id: string) {
  if (
    s0.battle ||
    s0.expedition ||
    !s0.heroes.some((h) => h.id === id) ||
    (!s0.party.includes(id) && s0.party.length >= 4)
  )
    return s0;
  const s = clone(s0);
  s.party = s.party.includes(id)
    ? s.party.filter((x) => x !== id)
    : [...s.party, id];
  if (s.party.includes(id)) {
    for (const [duty, assigned] of Object.entries(s.economy.duties)) {
      if (assigned === id) delete s.economy.duties[duty as Economy.Duty];
    }
  }
  return s;
}
export function partyAttackMultiplier(s: State) {
  return (
    1 +
    s.kit * 0.06 +
    (s.research.includes('steel') ? 0.15 : 0) +
    (s.research.includes('godslayer') ? 0.15 : 0)
  );
}
export function partyStats(s: State) {
  let hp = 0,
    attack = 0,
    defense = 0;
  for (const id of s.party) {
    const h = s.heroes.find((h) => h.id === id);
    if (!h) continue;
    const stats = Guild.individualStats(s, h);
    hp += stats.hp;
    attack += stats.attack;
    defense += stats.defense;
  }
  if (Guild.hasRole(s, 'rhea')) defense += 3;
  if (Guild.hasRole(s, 'orin')) defense += 6;
  if (s.research.includes('wards')) defense *= 1.2;

  hp *=
    1 +
    s.kit * 0.08 +
    (s.research.includes('memory') ? 0.2 : 0) +
    (chosen(s, 'key', 'chorus') ? 0.2 : 0);
  attack *= partyAttackMultiplier(s);
  return {
    hp: Math.round(hp),
    attack: Math.round(attack),
    defense: Math.round(defense),
    power: Math.round(attack + hp / 15 + defense / 2),
  };
}
export function awardXP(s: State, amount: number) {
  for (const h of s.heroes) {
    h.xp +=
      amount *
      (s.party.includes(h.id) ? 1 : 0.4) *
      (1 + s.buildings.tavern * 0.1) *
      Guild.talentExperience(h) *
      originEffect(h).experience *
      Economy.educationMultiplier(s) *
      Civic.civicExperience(s) *
      Civic.LEARNING_FACTORS[h.quality - 1];
    while (h.level < levelCap(s) && h.xp >= 60 + h.level * h.level * 10) {
      h.xp -= 60 + h.level * h.level * 10;
      h.level++;
      log(s, `${h.name}升至 ${h.level} 级。`, 'good');
    }
    h.xp = Math.min(h.xp, 60 + h.level * h.level * 10);
  }
}
export const trainCost = (h: Hero): Cost => ({
  gold: Math.ceil(
    (30 + h.level ** 2.1 * 20) *
      Guild.talentTraining(h) *
      originEffect(h).trainingGold *
      Civic.TRAINING_FACTORS[h.quality - 1],
  ),
  food: Math.ceil(
    (20 + h.level * 10) *
      originEffect(h).trainingFood *
      Civic.TRAINING_FACTORS[h.quality - 1],
  ),
});
export function train(s0: State, id: string) {
  const h = s0.heroes.find((h) => h.id === id);
  if (
    !h ||
    !s0.buildings.tavern ||
    Guild.heroAway(s0, id) ||
    h.level >= levelCap(s0) ||
    !canPay(s0, Civic.payableTrainCost(s0, h))
  )
    return s0;
  const s = clone(s0);
  const bill = Civic.payableTrainCost(s, h),
    gross = trainCost(h);
  pay(s, bill);
  s.civic.trainingCredit.gold = Math.max(
    0,
    s.civic.trainingCredit.gold - gross.gold!,
  );
  s.civic.trainingCredit.food = Math.max(
    0,
    s.civic.trainingCredit.food -
      Math.ceil(gross.food! * (Civic.buffActive(s, 'provisions') ? 0.75 : 1)),
  );
  const trained = s.heroes.find((x) => x.id === id)!;
  trained.trainingInvestment ||= { gold: 0, food: 0 };
  trained.trainingInvestment.gold += bill.gold!;
  trained.trainingInvestment.food += bill.food!;
  s.heroes.find((x) => x.id === id)!.level++;
  log(s, `${h.name}完成训练，升至 ${h.level + 1} 级。`, 'good');
  return s;
}
export function gearCost(h: Hero, kind: 'weapon' | 'armor'): Cost {
  return {
    iron: 12 + (h[kind] + 1) * 10,
    gold: 12 + (h[kind] + 1) * 12,
    ...(h[kind] > 0 ? { crystal: h[kind] * 6 } : {}),
  };
}
export function upgradeGear(s0: State, id: string, kind: 'weapon' | 'armor') {
  const h = s0.heroes.find((h) => h.id === id);
  if (
    !h ||
    !['weapon', 'armor'].includes(kind) ||
    Guild.heroAway(s0, id) ||
    h[kind] >= Math.min(6, s0.buildings.forge) ||
    !canPay(s0, gearCost(h, kind))
  )
    return s0;
  const s = clone(s0);
  pay(s, gearCost(h, kind));
  s.heroes.find((x) => x.id === id)![kind]++;
  log(
    s,
    `${Guild.heroDefinition(s, id).name}的${kind === 'weapon' ? '武器' : '护甲'}完成锻造。`,
    'good',
  );
  return s;
}
export const kitCost = (s: State): Cost => ({
  wood: 35 * (s.kit + 1),
  iron: 20 * (s.kit + 1),
  gold: 30 * (s.kit + 1),
  ...(s.kit ? { crystal: 10 * s.kit } : {}),
});
export const kitMaterialCost = (s: State): MaterialCost => ({
  boards: 8 * (s.kit + 1),
  ...(s.kit >= 1
    ? { [s.world.tech.includes('metallurgy') ? 'steel' : 'runes']: 6 * s.kit }
    : {}),
  ...(s.kit === 3
    ? { [s.world.tech.includes('dragoncraft') ? 'scale' : 'ember']: 20 }
    : {}),
  ...(s.kit === 4 ? { star: 16 } : {}),
});
export function kitReason(s: State) {
  if (s.kit >= 5) return '远行装备已完备';
  if (s.buildings.forge < s.kit + 1) return `需要 ${s.kit + 1} 级锻造坊`;
  if (Campaign.townRank(s) < s.kit + 1) return '需要研究下一阶段城镇技术';
  if (s.kit >= 1 && !s.buildings.shrine) return '需要学馆解析魔力材料';
  return '';
}
export function upgradeKit(s0: State) {
  if (
    s0.battle ||
    s0.expedition ||
    kitReason(s0) ||
    !canPay(s0, kitCost(s0)) ||
    !Campaign.canAffordMaterials(s0, kitMaterialCost(s0))
  )
    return s0;
  const s = clone(s0);
  pay(s, kitCost(s));
  Campaign.spendMaterials(s, kitMaterialCost(s));
  s.kit++;
  log(s, `远行装备升至 ${s.kit} 阶。全队的武器、帐篷与护具得到改善。`, 'good');
  return s;
}
export const discoveryCount = (s: State, r: number) =>
  D.REGIONS[r].thresholds.filter((n) => s.survey[r] >= n).length;
export function projectReady(s: State, r: number) {
  return discoveryCount(s, r) === 2 && !s.projects[D.PROJECTS[r].id];
}
export function completeProject(s0: State, r: number, choice: string) {
  const p = D.PROJECTS[r];
  if (
    !p ||
    !projectReady(s0, r) ||
    !p.choices.some((x) => x.id === choice) ||
    !canPay(s0, p.cost) ||
    !Campaign.canAffordMaterials(s0, Campaign.projectMaterialCost(s0, r))
  )
    return s0;
  const s = clone(s0);
  pay(s, p.cost);
  Campaign.spendMaterials(s, Campaign.projectMaterialCost(s, r));
  s.projects[p.id] = choice;
  log(
    s,
    `${p.name}完成：${p.choices.find((x) => x.id === choice)!.label}。${p.choices.find((x) => x.id === choice)!.effect}。`,
    'story',
  );
  return s;
}
export function researchReason(s: State, id: string) {
  const r = D.RESEARCH.find((r) => r.id === id);
  if (!r) return '未知研究';
  if (s.research.includes(id)) return '已经领悟';
  if (!Discovery.researchDiscovered(s, id))
    return '继续完成当前见闻，尚未发现这项手艺';
  if (Campaign.townRank(s) < r.chapter) return `需要城镇进阶 ${r.chapter} 阶`;
  if (r.discovery && discoveryCount(s, r.discovery) < 1)
    return `先勘察${D.REGIONS[r.discovery].name}取得线索`;
  const need = r.need || 'shrine';
  if (!s.buildings[need])
    return `先建造${D.BUILDINGS.find((b) => b.id === need)!.name}`;
  return Campaign.materialReason(s, r.materials || {});
}
export function research(s0: State, id: string) {
  const r = D.RESEARCH.find((r) => r.id === id);
  if (!r || researchReason(s0, id) || !canPay(s0, r.cost)) return s0;
  const s = clone(s0);
  pay(s, r.cost);
  Campaign.spendMaterials(s, r.materials || {});
  s.research.push(id);
  log(s, `领悟「${r.name}」。${r.desc}`, 'story');
  return s;
}
export const tradeUnlocked = (s: State, k: Resource) =>
  !!s.buildings.market &&
  Object.hasOwn(D.RESOURCE_NAMES, k) &&
  k !== 'gold' &&
  resourceVisible(s, k);
export const TRADE_BATCH_SIZE = 20;
export const TRADE_BATCH_CHOICES = [1, 10, 100, 1000] as const;
export type TradeBatch = number | 'max';
export function tradePrice(s: State, k: Resource, buy = true) {
  const price = {
    wood: 28,
    food: 28,
    stone: 34,
    iron: 90,
    crystal: 150,
    gold: 0,
  }[k];
  return Math.ceil(price * (buy ? 1 : 0.24));
}
export function tradeQuote(s: State, k: Resource, buy: boolean, requested: TradeBatch = 1) {
  const empty = (reason: string) => ({ batches: 0, amount: 0, gold: 0, maximum: 0, limited: false, reason });
  if (!tradeUnlocked(s, k)) return empty('先开放对应物资与集市');
  if (typeof buy !== 'boolean' || (requested !== 'max' && (!Number.isSafeInteger(requested) || requested < 1)))
    return empty('请选择有效交易份数');
  const price = tradePrice(s, k, buy);
  const available = buy ? Math.floor(s.resources.gold / price) : Math.floor(s.resources[k] / TRADE_BATCH_SIZE);
  const room = buy
    ? Math.floor((capacity(s, k) - s.resources[k]) / TRADE_BATCH_SIZE)
    : Math.floor((capacity(s, 'gold') - s.resources.gold) / price);
  const maximum = Math.max(0, Math.min(available, room));
  if (maximum < 1) return empty(available < 1
    ? buy ? '金币不足' : `不足 ${TRADE_BATCH_SIZE} 单位`
    : buy ? `需要 ${TRADE_BATCH_SIZE} 个空位` : '金币仓库空间不足');
  const batches = requested === 'max' ? maximum : Math.min(requested, maximum);
  return { batches, amount: TRADE_BATCH_SIZE * batches, gold: price * batches, maximum,
    limited: requested !== 'max' && batches < requested, reason: '' };
}
export function trade(s0: State, k: Resource, buy: boolean, batches: TradeBatch = 1) {
  const quote = tradeQuote(s0, k, buy, batches);
  if (quote.reason) return s0;
  const s = clone(s0);
  pay(s, buy ? { gold: quote.gold } : { [k]: quote.amount });
  grant(s, buy ? { [k]: quote.amount } : { gold: quote.gold });
  log(
    s,
    buy
      ? `买入 ${quote.amount} ${D.RESOURCE_NAMES[k]}，支付 ${quote.gold} 金币。`
      : `卖出 ${quote.amount} ${D.RESOURCE_NAMES[k]}，获得 ${quote.gold} 金币。`,
  );
  return s;
}
export function tradeReason(s: State, k: Resource, buy: boolean, batches: TradeBatch = 1) {
  return tradeQuote(s, k, buy, batches).reason;
}
export const regionOpen = Campaign.regionOpen;
export function routeInfo(s: State, r: number, route: Route) {
  const d = D.REGIONS[r],
    survey = route === 'survey';
  const duration = Math.ceil(
    (((d.duration *
      (survey ? 1.35 : 1) *
      (Guild.hasRole(s, 'finn') ? 0.85 : 1) *
      (chosen(s, 'station', 'traders') ? 0.85 : 1) *
      (Guild.hasTalent(s, 'scout') ? 0.9 : 1)) /
      (1 + s.guild.doctrine.logistics * 0.06)) *
      (route === 'frontier' ? 1.15 : 1) *
      (s.guild.preparation.stance === 'cautious' ? 1.15 : 1)) /
      Math.min(3, Math.max(1, Guild.frontierInfo(s, r).ratio / 2)),
  );
  const cost = Math.ceil(
    d.cost *
      [1, 3, 4, 8, 12, 20][r] *
      (s.research.includes('supply_chain') ? 0.8 : 1) *
      (survey ? 1.3 : 1) *
      (chosen(s, 'watch', 'river') ? 0.85 : 1) *
      (1 - s.guild.outposts[r] * 0.1),
  );
  const reward: Cost = Object.fromEntries(
    Object.entries(d.reward).map(([k, v]) => [
      k,
      Math.ceil(
        v! *
          (survey ? 0.55 : 1) *
          (1 + s.guild.depths[r] * 0.25 + s.guild.outposts[r] * 0.25) *
          (k === 'wood' && chosen(s, 'watch', 'forest') ? 1.2 : 1),
      ),
    ]),
  );
  return {
    duration,
    cost,
    reward,
    power:
      r === 0 && route !== 'frontier'
        ? 40
        : Math.ceil(
            route === 'frontier'
              ? Guild.frontierInfo(s, r).power * 0.85
              : d.power * 0.65,
          ),
    route,
    chance: route === 'frontier' ? Guild.frontierInfo(s, r).chance : 1,
  };
}
export function dispatchReason(
  s: State,
  r = s.order.region,
  route = s.order.route,
  reserve = s.order.reserve,
) {
  if (!regionOpen(s, r)) return Campaign.regionReason(s, r);
  if (!s.party.length) return '等待编入至少一位伙伴';
  if (s.battle) return '首领战结束后继续委托';
  if (s.recoveryUntil > s.time)
    return `队伍休整中，还需 ${Math.ceil(s.recoveryUntil - s.time)} 秒`;
  const info = routeInfo(s, r, route);
  if (info.cost + reserve > capacity(s, 'food'))
    return '口粮容量不足：扩建仓库，或调低保留口粮';
  if (route === 'frontier' && Tactics.guardianReady(s, r))
    return '路线已抵达守敌，先击败守敌才能占领据点';
  if (route !== 'frontier' && partyStats(s).power < info.power)
    return `等待提升战力：${partyStats(s).power} / ${info.power}`;
  if (route === 'frontier' && s.guild.depths[r] >= 5)
    return '五处据点已打通，可调查、补给或挑战首领';
  if (s.resources.food < info.cost + reserve)
    return `等待口粮：需要 ${info.cost} 远征补给 + ${reserve} 储备`;
  return '';
}
function dispatch(s: State, r: number, route: Route, reserve = 0) {
  if (dispatchReason(s, r, route, reserve)) return false;
  const info = routeInfo(s, r, route);
  pay(s, { food: info.cost });
  s.expedition = {
    region: r,
    route: info.route,
    start: s.time,
    end: s.time + info.duration,
    power: partyStats(s).power,
    outcome: rollOutcome(s),
    chance: info.chance,
    success: info.chance === 1 || Guild.guildRandom(s) < info.chance,
    depth: s.guild.depths[r],
  };
  if (Guild.frontierInfo(s, r).guaranteed && s.expedition.outcome === 2)
    s.expedition.outcome = 0;
  s.order.reason = '';
  return true;
}
export function expedition(s0: State, r: number, route: Route = 'survey') {
  if (
    s0.expedition ||
    !['supply', 'survey', 'frontier'].includes(route) ||
    dispatchReason(s0, r, route, 0)
  )
    return s0;
  const s = clone(s0);
  dispatch(s, r, route);
  log(
    s,
    `小队出发，${s.expedition!.route === 'survey' ? '调查敌情' : s.expedition!.route === 'frontier' ? '推进据点' : '收集补给'}：${D.REGIONS[r].name}。`,
    'explore',
  );
  return s;
}
export function recallExpedition(s0: State) {
  if (!s0.expedition) return s0;
  const s = clone(s0),
    name = D.REGIONS[s.expedition!.region].name;
  s.expedition = null;
  s.order.enabled = false;
  s.order.reason = '已撤回，后续委托已停止';
  log(
    s,
    `小队从${name}立即撤回。已消耗的出发补给不返还，本趟不结算收益、推进或经验。`,
  );
  return s;
}
export function rememberMap(s0: State, region: number) {
  if (
    !Number.isInteger(region) ||
    !regionOpen(s0, region) ||
    s0.lastMap === region
  )
    return s0;
  const s = clone(s0);
  s.lastMap = region;
  return s;
}
export function setOrder(
  s0: State,
  patch: Partial<
    Pick<Order, 'enabled' | 'region' | 'route' | 'reserve' | 'autoBuy'>
  >,
) {
  const next = { ...s0.order, ...patch };
  if (
    !Number.isInteger(next.region) ||
    next.region < 0 ||
    next.region > 5 ||
    !['supply', 'survey', 'frontier'].includes(next.route) ||
    ![0, 20, 60, 120].includes(next.reserve) ||
    typeof next.enabled !== 'boolean' ||
    typeof next.autoBuy !== 'boolean'
  )
    return s0;
  const s = clone(s0);
  s.order = next;
  if (!s.expedition && s.order.enabled) resumeOrder(s);
  return s;
}
function resumeOrder(s: State) {
  if (!s.order.enabled || s.expedition || s.battle) return;
  const info = routeInfo(s, s.order.region, s.order.route);
  if (
    s.order.autoBuy &&
    s.buildings.market &&
    regionOpen(s, s.order.region) &&
    s.party.length &&
    s.recoveryUntil <= s.time &&
    (s.order.route === 'frontier'
      ? !Tactics.guardianReady(s, s.order.region)
      : partyStats(s).power >= info.power) &&
    s.resources.food < info.cost + s.order.reserve &&
    info.cost + s.order.reserve <= capacity(s, 'food')
  ) {
    const amount = Math.min(20, capacity(s, 'food') - s.resources.food),
      price = Math.ceil((tradePrice(s, 'food') * amount) / 20);
    if (s.resources.gold >= price) {
      pay(s, { gold: price });
      grant(s, { food: amount });
      log(
        s,
        `委托补给：花费 ${price} 金币，买入 ${Math.round(amount * 100) / 100} 口粮。`,
      );
    }
  }
  s.order.reason = dispatchReason(s);
  if (!s.order.reason)
    dispatch(s, s.order.region, s.order.route, s.order.reserve);
}
function settleExpedition(s: State) {
  const e = s.expedition!,
    info = routeInfo(s, e.region, e.route),
    result = D.EXPEDITION_OUTCOMES[e.outcome];
  const found: Cost = Object.fromEntries(
    Object.entries(info.reward).map(([k, n]) => [
      k,
      Math.ceil(n! * result.multiplier * (e.success ? 1 : 0.3)),
    ]),
  );
  const before = { ...s.resources };
  grant(s, found);
  const kept: Cost = {},
    lost: Cost = {};
  for (const key of Object.keys(found) as Resource[]) {
    kept[key] = Math.round((s.resources[key] - before[key]) * 100) / 100;
    if (found[key]! > kept[key]!)
      lost[key] = Math.round((found[key]! - kept[key]!) * 100) / 100;
  }
  const beforeIntel = s.guild.intel[e.region],
    beforeClues = discoveryCount(s, e.region);
  const progress = Guild.settleFrontier(s, e);
  const materials = Campaign.grantExpeditionMaterials(
    s,
    e.region,
    e.route,
    e.success,
  );
  if (materials) log(s, `区域材料：${materials}`, 'good');
  const equipment = e.success
    ? Guild.expeditionEquipment(s, e.region, e.depth)
    : '';
  s.lastExpedition = {
    time: s.time,
    region: e.region,
    outcome: e.outcome,
    found,
    kept,
    lost,
    success: e.success,
    progress,
    equipment,
    materials,
    route: e.route,
    chance: e.chance,
  };
  s.recoveryUntil = Math.max(s.recoveryUntil, s.time + result.rest);
  s.explored[e.region]++;
  if (e.success) s.civic.invitations = Math.min(200, s.civic.invitations + 1);
  if (e.route === 'survey') {
    s.survey[e.region]++;
    for (const n of [0, 1])
      if (s.survey[e.region] === D.REGIONS[e.region].thresholds[n])
        log(s, `发现 · ${D.REGIONS[e.region].discoveries[n]}`, 'story');
  }
  s.lastExpedition.intelGain = s.guild.intel[e.region] - beforeIntel;
  s.lastExpedition.clues = discoveryCount(s, e.region) - beforeClues;
  if (s.ending && e.route === 'supply') s.peaceRuns[e.region]++;
  awardXP(
    s,
    (25 + e.region * 14) * (1 + e.depth * 0.3) * (e.success ? 1 : 0.4),
  );
  log(
    s,
    `${D.REGIONS[e.region].name} · ${e.success ? result.name : '推进受挫'}${progress ? ` · 据点 +${progress}` : ''}${equipment ? ` · ${equipment}` : ''}：${costText(kept)}。${Object.keys(lost).length ? `满仓未带回 ${costText(lost)}。` : ''}${result.rest ? `休整 ${result.rest} 秒。` : ''}${projectReady(s, e.region) ? '线索齐全，可以建造城镇工程。' : ''}`,
    result.rest ? 'normal' : 'good',
  );
  s.expedition = null;
}
function pendingEvent(s: State) {
  if (!s.buildings.fire || s.time < s.nextEventAt) return null;
  const conditions = [
    s.population >= 2 && s.buildings.farm > 0,
    s.buildings.market > 0,
    s.buildings.lumber > 0 && s.buildings.farm > 0,
    s.cleared.length >= 1,
    s.buildings.market > 0,
    s.cleared.length >= 1,
    s.buildings.farm > 0 && s.buildings.lumber > 0,
    s.world.tech.includes('settlement'),
    s.heroes.length > 0,
    s.buildings.forge > 0,
  ];
  const eligible = D.EVENTS.map((e, i) => ({ e, i })).filter(
    ({ e, i }) => conditions[i] && (e.repeat || !s.eventDone.includes(e.id)),
  );
  s.nextEventAt = s.time + 90 + Math.floor(random(s) * 91);
  if (!eligible.length) return null;
  // The first family introduces choices; subsequent eligible visitors are random.
  if (!s.eventDone.includes('refugees') && conditions[0]) return 0;
  const weighted = eligible.flatMap((item) =>
    Array.from({ length: item.i >= 6 ? 3 : 1 }, () => item),
  );
  return weighted[Math.floor(random(s) * weighted.length)].i;
}
export function eventChoiceReason(s: State, choice: number) {
  if (s.event === null || ![0, 1].includes(choice)) return '没有待处理的来访';
  const c = Civic.visitorChoice(s, choice)!;
  if (
    c.equipment &&
    (!s.civic.offer || s.guild.inventory.length >= 120 - Number(!!s.battle))
  )
    return '装备库已满或报价尚未备好';
  if (capacityReason(s, c.cost)) return capacityReason(s, c.cost);
  if (!canPay(s, c.cost)) return `物资不足：需要 ${costText(c.cost)}`;
  for (const [k, v] of Object.entries(c.reward || {})) {
    const key = k as Resource;
    if (s.resources[key] - (c.cost[key] || 0) + v! > capacity(s, key))
      return `${D.RESOURCE_NAMES[key]}空间不足：需空出 ${v}，先消费或扩仓`;
  }
  return '';
}
export function declineVisitor(s0: State) {
  if (s0.event === null || !D.EVENTS[s0.event].repeat) return s0;
  const s = clone(s0);
  s.event = null;
  s.civic.offer = null;
  s.nextEventAt = s.time + 90 + Math.floor(random(s) * 91);
  log(s, '你婉拒了这次交易。商人收起货物，约定改日再来。');
  return s;
}
export function chooseEvent(s0: State, choice: number) {
  if (eventChoiceReason(s0, choice) || s0.event === null) return s0;
  const e = D.EVENTS[s0.event],
    c = Civic.visitorChoice(s0, choice)!;
  if (!canPay(s0, c.cost)) return s0;
  const s = clone(s0);
  pay(s, c.cost);
  if (!c.buff && !c.equipment && !s.flags.includes(c.effect))
    s.flags.push(c.effect);
  if (c.buff) s.civic.buffs[c.buff] = s.time + Civic.BUFFS[c.buff].seconds;
  if (c.equipment && s.civic.offer) s.guild.inventory.push(s.civic.offer.gear);
  s.civic.offer = null;
  if (!s.eventDone.includes(e.id)) s.eventDone.push(e.id);
  if (c.reward) grant(s, c.reward);
  s.event = null;
  s.nextEventAt = s.time + 90 + Math.floor(random(s) * 91);
  if (c.effect === 'settlers') {
    s.pendingSettlers += 2;
    settle(s);
  }

  log(s, `${e.title}：${c.label}。${c.detail}`, 'story');
  return s;
}
/** Production and dispatch run on whole game-second boundaries, so offline and small online steps are identical. */
export function advance(s0: State, seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0 || s0.paused) return s0;
  let s = Discovery.settleStory(clone(s0));
  const target = s.time + Math.min(MAX_OFFLINE, seconds);
  for (let t = Math.floor(s.time) + 1; t <= Math.floor(target); t++) {
    s.time = t;
    const priorResources = { ...s.resources };
    s.resources = productionStep(s);
    for (const k of Object.keys(s.resources) as Resource[])
      s.economy.production[k] += Math.max(
        0,
        s.resources[k] - priorResources[k],
      );
    Economy.economyTick(s);
    Campaign.worldTick(s);
    if (s.expedition && s.time >= s.expedition.end) settleExpedition(s);
    if (
      !s.battle &&
      !s.expedition &&
      s.combatAuto &&
      s.order.enabled &&
      s.order.route === 'frontier' &&
      Tactics.guardianReady(s, s.order.region)
    )
      s = Tactics.beginBattle(s, s.order.region, 'guardian');
    if (s.battle?.auto) s = Tactics.tacticalCombat(s, Tactics.autoCommand(s));
    resumeOrder(s);
    s = Discovery.settleStory(s);
    if (s.event === null) {
      const n = pendingEvent(s);
      if (n !== null && n >= 0) {
        s.event = n;
        Civic.prepareVisitor(s);
        log(s, `有人来访：${D.EVENTS[n].title}。`, 'story');
      }
    }
  }
  s.time = target;
  return s;
}
export function bossReason(s: State, r: number) {
  if (!regionOpen(s, r)) return '先打通通往这里的道路';
  const ready = s.guild.bossHunts?.readyAt[r] || 0;
  if (s.cleared.includes(r) && ready > s.time)
    return `首领残响重聚中：${Math.ceil(ready - s.time)} 秒`;
  if (s.guild.inventory.length >= 120)
    return '装备库已满，先为首领战利品留出1格';
  if (s.guild.depths[r] < BOSS_ACCESS_DEPTH)
    return `据点推进 ${s.guild.depths[r]}/${BOSS_ACCESS_DEPTH}：占领第三处据点后可挑战全盛首领`;
  if (r === 5 && !s.research.includes('godslayer')) return '先领悟弑神之理';
  if (s.expedition) return '队伍正在远征，可立即撤回或等待归来';
  if (s.battle) return '正在决战';
  if (s.recoveryUntil > s.time) return '队伍正在休整';
  if (!s.party.length) return '请先组建小队';
  const potionReason = preparedPotionReason(s);
  if (potionReason) return potionReason;
  if (!canPay(s, Guild.battlePreparationCost(s)))
    return `准备不足：${costText(Guild.battlePreparationCost(s))}`;
  return '';
}
export const battleFood = (s: State) => (chosen(s, 'bell', 'home') ? 23 : 30);
export function startBattle(s0: State, r: number) {
  return Tactics.beginBattle(s0, r, 'boss');
}
export function intent(b: Battle) {
  return Tactics.enemyIntent(b);
}
export function commandReason(s: State, c: Command) {
  return Tactics.tacticalReason(s, c);
}
export function combat(s: State, c: Command) {
  return Tactics.tacticalCombat(s, c);
}
export function rebuildReason(s: State, id: string) {
  if (!s.ending) return '终神决战之后开放';
  if (s.rebuild.includes(id)) return '重建已完成';
  if (id === 'homes' && s.population < 24) return '住民达到 24 人';
  if (id === 'roads' && s.peaceRuns.some((n) => !n))
    return '通关后，为六地各完成一次补给远征';
  if (id === 'memorial' && (s.heroes.length < 6 || s.buildings.shrine < 5))
    return '六位伙伴加入，并将学馆升到 5 级';
  return '';
}
export function rebuildTown(s0: State, id: string) {
  const p = D.REBUILD.find((p) => p.id === id);
  if (!p || rebuildReason(s0, id) || !canPay(s0, p.cost)) return s0;
  const s = clone(s0);
  pay(s, p.cost);
  s.rebuild.push(id);
  log(s, p.story, 'ending');
  if (s.rebuild.length === 3)
    log(
      s,
      '你曾是穿越者，现在是这里的人。新的旅程可以开始，也可以就留在这个完整的明天。',
      'ending',
    );
  return s;
}
export function inheritancePreview(s: State) {
  const e = s.economy;
  return {
    industry: Math.min(
      10,
      e.legacy.industry +
        Math.floor(
          [
            'forestry',
            'agriculture',
            'masonry',
            'commerce',
            'smelting',
            'attunement',
          ].reduce(
            (n, id) => n + e.development[id as Economy.DevelopmentId],
            0,
          ) / 12,
        ),
    ),
    scholarship: Math.min(
      10,
      e.legacy.scholarship +
        Math.floor(
          (e.development.education +
            e.development.carpentry +
            e.development.metalwork +
            e.development.inscription) /
            8,
        ),
    ),
    exploration: Math.min(
      10,
      e.legacy.exploration +
        Math.floor(e.routes.reduce((n, r) => n + r.level, 0) / 4),
    ),
  };
}
export function newJourney(s: State) {
  if (s.rebuild.length !== 3) return s;
  const next = freshState(
    Date.now(),
    Math.min(10, s.legacy + 2),
    s.journeys + 1,
  );
  next.economy.legacy = inheritancePreview(s);
  if (next.economy.legacy.industry > 0) {
    next.economy.modes = { ...s.economy.modes };
    next.economy.targets = { ...s.economy.targets };
    next.economy.reserve = s.economy.reserve;
  }
  return next;
}
export type Objective = {
  title: string;
  detail: string;
  view: View;
  tab?: string;
  building?: BuildingId;
  region?: number;
  research?: string;
  hero?: string;
  recipe?: string;
  tier?: number;
  work?: Campaign.WorkId;
  route?: Route;
};
function fundingGoal(
  s: State,
  cost: Cost,
  materials: MaterialCost,
  destination: Objective,
): Objective {
  if (capacityReason(s, cost))
    return {
      title: `先为「${destination.title}」扩仓`,
      detail: capacityReason(s, cost),
      view: 'town',
      tab: 'build',
      building: 'warehouse',
    };
  for (const id of Campaign.MATERIAL_IDS)
    if ((materials[id] || 0) > s.world.materials[id]) {
      const missing = Math.ceil(materials[id]! - s.world.materials[id]);
      const work = Campaign.WORK_RECIPES.find((w) => w.id === id);
      if (work) {
        if (!s.world.tech.includes(work.tech)) {
          const tech = Campaign.TECHNOLOGIES.find((t) => t.id === work.tech)!;
          const required = tech.requires.depth;
          if (
            required &&
            s.guild.depths[required.region] < required.value &&
            !s.cleared.includes(required.region)
          )
            return {
              title: `去${D.REGIONS[required.region].name}寻找新手艺`,
              detail: `${Campaign.MATERIAL_NAMES[id]}需要${tech.name}；先建立第 ${required.value} 处据点，带回研究线索。`,
              view: 'explore',
              tab: 'frontier',
              region: required.region,
            };
          return fundingGoal(s, tech.cost, tech.materials, {
            title: `先掌握${tech.name}`,
            detail: `${Campaign.MATERIAL_NAMES[id]}需要这门手艺；样品来自对应地区。`,
            view: 'research',
            tab: 'technology',
            research: work.tech,
          });
        }
        if (Campaign.workReason(s, work.id))
          return fundingGoal(s, work.cost, work.materials, {
            title: `准备${work.name}的第一批原料`,
            detail: Campaign.workReason(s, work.id),
            view: 'town',
            tab: 'workshop',
            work: work.id,
          });
        return {
          title: `为「${destination.title}」加工${Campaign.MATERIAL_NAMES[id]}`,
          detail: `还缺 ${missing}；当前每 ${Campaign.workDuration(s, work.id)} 秒制成 ${Economy.processingOutput(s, work.id)} 件。原料充足后可并行安排其他工作。`,
          view: 'town',
          tab: 'workshop',
          work: work.id,
        };
      }
      const region = Campaign.REGION_MATERIALS.indexOf(id);
      if (region >= 0)
        return {
          title: `从${D.REGIONS[region].name}带回${Campaign.MATERIAL_NAMES[id]}`,
          detail: `「${destination.title}」还缺 ${missing}；补给路线可以反复取得。`,
          view: 'explore',
          tab: 'mission',
          region,
          route: 'supply',
        };
    }
  const missing = Object.entries(cost)
    .filter(([k, v]) => s.resources[k as Resource] < v!)
    .sort(
      ([a, av], [b, bv]) =>
        bv! - s.resources[b as Resource] - (av! - s.resources[a as Resource]),
    );
  if (missing.length) {
    const [key] = missing[0],
      k = key as Resource,
      net = netProduction(s)[k];
    const source = (
      {
        wood: 'lumber',
        food: 'farm',
        stone: 'quarry',
        gold: 'market',
        iron: 'forge',
        crystal: 'shrine',
      } as Record<Resource, BuildingId>
    )[k];
    if (k === 'crystal' && !s.buildings.forge)
      return fundingGoal(
        s,
        buildingCost(s, 'forge'),
        Campaign.buildingMaterialCost(s, 'forge'),
        {
          title: '为学馆准备锻造坊',
          detail: '学馆需要借用铁匠的炉火；先建锻造坊，再建立魔晶来源。',
          view: 'town',
          tab: 'build',
          building: 'forge',
        },
      );
    if (jobReason(s, k))
      return {
        title: `先建立${D.RESOURCE_NAMES[k]}的来源`,
        detail: `${destination.title}需要${D.RESOURCE_NAMES[k]}；${jobReason(s, k)}。`,
        view: 'town',
        tab: 'build',
        building: source,
      };
    if (s.jobs[k] === 0 || net <= 0)
      return {
        title: `为${destination.title}安排${D.JOB_NAMES[k]}`,
        detail: `缺少${D.RESOURCE_NAMES[k]}；当前净收入 ${net.toFixed(2)}/秒。铁锭吃木石，魔晶吃金币，先补足上游。`,
        view: 'town',
        tab: 'workers',
      };
    const estimate = net > 0 ? Math.ceil((cost[k]! - s.resources[k]) / net) : 0;
    const improvement = D.RESEARCH.find(
      (r) =>
        !s.research.includes(r.id) &&
        Discovery.researchDiscovered(s, r.id) &&
        (r.production?.[k] || 0) > 1 &&
        canPay(s, r.cost) &&
        Campaign.canAffordMaterials(s, r.materials || {}),
    );
    if (
      improvement &&
      estimate > 180 &&
      destination.research !== improvement.id
    )
      return {
        title: `先研究${improvement.name}改善供给`,
        detail: `${D.RESOURCE_NAMES[k]}是当前瓶颈；${improvement.desc} 也可以继续积累，直接完成原计划。`,
        view: 'research',
        tab: 'town',
        research: improvement.id,
      };
    return {
      ...destination,
      detail: `还缺 ${missing.map(([k, v]) => `${Math.ceil(v! - s.resources[k as Resource])}${D.RESOURCE_NAMES[k as Resource]}`).join('、')}。${estimate > 0 ? `按当前分工，主要缺口约 ${Math.ceil(estimate / 60)} 分钟补齐；可调整生产。` : destination.detail}`,
    };
  }
  return destination;
}
function readinessGoal(s: State, r: number): Objective | null {
  const info = Guild.frontierInfo(s, r);
  if (info.ratio >= 0.85) return null;
  const members = s.party
    .map((id) => s.heroes.find((h) => h.id === id)!)
    .filter(Boolean);
  const tier = Campaign.gearTier(s);
  for (const slot of ['weapon', 'armor', 'charm'] as const)
    for (const h of members) {
      const item = s.guild.inventory.find((g) => g.id === h.equipment[slot]);
      if (item && item.tier >= tier) continue;
      const spare = s.guild.inventory
        .filter(
          (g) =>
            gearSlot(g) === slot &&
            !s.heroes.some((h) => Object.values(h.equipment).includes(g.id)),
        )
        .map((g) => ({
          g,
          effective: Guild.frontierInfo(Guild.equipGear(s, h.id, g.id), r)
            .effective,
        }))
        .filter((x) => x.effective > info.effective)
        .sort((a, b) => b.effective - a.effective)[0]?.g;
      if (spare)
        return {
          title: `为${h.name}换上${Guild.gearName(spare)}`,
          detail: `当前层有效战力 ${info.effective}/${Math.ceil(info.power * 0.85)}，装备库已有可用的提升。`,
          view: 'heroes',
          tab: 'inventory',
          hero: h.id,
        };
      if (s.guild.inventory.length >= 120)
        return {
          title: '整理装备库，腾出制作位置',
          detail:
            '装备库已满；先拆解闲置装备回收灵尘，再制作本次远征需要的装备。已穿戴物品不会被拆解。',
          view: 'heroes',
          tab: 'inventory',
        };
      const recipe =
        slot === 'weapon'
          ? h.role === 'finn'
            ? 'bow'
            : h.role === 'luna' && !Campaign.recipeUnlockReason(s, 'staff')
              ? 'staff'
              : 'blade'
          : slot === 'armor'
            ? r === 4 && !Campaign.recipeUnlockReason(s, 'firecoat')
              ? 'firecoat'
              : r === 3 && !Campaign.recipeUnlockReason(s, 'shadowcoat')
                ? 'shadowcoat'
                : 'plate'
            : 'vitality';
      return fundingGoal(
        s,
        Guild.recipeCost(s, recipe, tier),
        Campaign.recipeMaterialCost(s, recipe, tier),
        {
          title: `打造 T${tier} ${RECIPES.find((x) => x.id === recipe)!.name}`,
          detail: `为${h.name}补齐${slot === 'weapon' ? '武器' : slot === 'armor' ? '护甲' : '饰品'}。生产、工艺与装备共同决定能否走进下一处据点。`,
          view: 'heroes',
          tab: 'forge',
          hero: h.id,
          recipe,
        },
      );
    }
  const reserve = s.heroes.find((h) => !s.party.includes(h.id));
  if (s.party.length < 4 && reserve)
    return {
      title: `邀请${reserve.name}同行`,
      detail:
        '名册里已有可补充小队的伙伴；先编入队伍，再看当前据点的准备差距。',
      view: 'heroes',
      tab: 'roster',
      hero: reserve.id,
    };
  if (s.party.length < 4 && s.heroes.length < 12)
    return {
      title: '再找一位互补的同行者',
      detail: `当前层建议有效战力 ${Math.ceil(info.power * 0.85)}，小队只有 ${info.effective}。不同职业能补齐输出、防护与治疗。`,
      view: 'recruit',
    };
  const trainee = members
    .filter((h) => h.level < levelCap(s))
    .sort((a, b) => a.level - b.level)[0];
  if (trainee)
    return fundingGoal(
      s,
      trainCost(trainee),
      {},
      {
        title: `培养${trainee.name}`,
        detail: `当前层有效战力 ${info.effective}/${Math.ceil(info.power * 0.85)}。训练后再查看差距；提升装备、抗性也有效。`,
        view: 'heroes',
        tab: 'training',
        hero: trainee.id,
      },
    );
  return {
    title: '强化当前装备，准备更深处',
    detail: `当前层有效战力 ${info.effective}/${Math.ceil(info.power * 0.85)}。强化武器、护甲或配置当地抗性；补给路线仍能带回材料。`,
    view: 'heroes',
    tab: 'inventory',
  };
}
function gearSlot(item: Gear) {
  return RECIPES.find((r) => r.id === item.recipe)!.slot;
}
function guardianGrowthGoal(s: State, region: number): Objective | null {
  const target = combatRecommendation(region, s.guild.depths[region] + 1);
  const members = s.party.map((id) => s.heroes.find((h) => h.id === id)!);
  if (members.length < target.count) {
    const reserve = s.heroes.find((h) => !s.party.includes(h.id));
    if (reserve)
      return {
        title: `邀请${reserve.name}参加守敌战`,
        detail: `调查归来，开始准备真正的战斗。当前${members.length}/${target.count}人；组齐输出、防护与治疗后，为每人配齐装备。`,
        view: 'heroes',
        hero: reserve.id,
      };
    if (s.heroes.length < 12)
      return {
        title: '为守敌战补齐同行者',
        detail: `当前${members.length}/${target.count}人。培养现有低星伙伴同样有价值；推荐等级以整队配装和技能养成为前提。`,
        view: 'recruit',
      };
  }
  for (const h of members)
    for (const slot of target.slots) {
      if (h.equipment[slot]) continue;
      const spare = s.guild.inventory.find(
        (g) =>
          gearSlot(g) === slot &&
          !s.heroes.some((other) =>
            Object.values(other.equipment).includes(g.id),
          ),
      );
      if (spare)
        return {
          title: `给${h.name}装备${Guild.gearName(spare)}`,
          detail:
            '已有可用的装备。等级只是一部分，裸装无法承担当前守敌的伤害。',
          view: 'heroes',
          tab: 'inventory',
          hero: h.id,
        };
      if (s.guild.inventory.length >= 120) return {
        title: '整理装备库，为守敌配装腾出位置',
        detail: '先拆解闲置装备，再补齐当前队伍缺少的部位。已穿戴的物品会保留。',
        view: 'heroes', tab: 'inventory', hero: h.id,
      };
      const preferred = {
        weapon: h.role === 'finn' ? 'bow' : 'blade',
        armor:
          target.element === 'shadow'
            ? 'shadowcoat'
            : target.element === 'fire'
              ? 'firecoat'
              : target.element === 'radiant'
                ? 'dawncoat'
                : 'plate',
        charm: target.element === 'physical' ? 'vitality' : 'wardstone',
        head: 'cap',
        hands: 'grips',
        feet: 'boots',
      }[slot];
      const recipe = !Campaign.recipeUnlockReason(s, preferred)
        ? preferred
        : RECIPES.find(
            (r) => r.slot === slot && !Campaign.recipeUnlockReason(s, r.id),
          )?.id;
      if (!recipe) continue;
      const tier = Math.min(target.tier, Campaign.gearTier(s));
      return fundingGoal(
        s,
        Guild.recipeCost(s, recipe, tier),
        Campaign.recipeMaterialCost(s, recipe, tier),
        {
          title: `为${h.name}打造${RECIPES.find((r) => r.id === recipe)!.name}`,
          detail: `每人配齐${target.slots.length}个装备部位，再按守敌的养成参考强化、学习技能和调整防护。`,
          view: 'heroes',
          tab: 'forge',
          hero: h.id,
          recipe,
          tier,
        },
      );
    }
  const trainee = members.find(
    (h) => h.level < Math.min(target.level, levelCap(s)),
  );
  if (trainee)
    return fundingGoal(
      s,
      trainCost(trainee),
      {},
      {
        title: `训练${trainee.name}，备战当前守敌`,
        detail: `完整养成参考为Lv.${target.level}。已有装备仍需按阶段强化，学会并携带技能；只提升等级并不能替代配装。`,
        view: 'heroes',
        tab: 'training',
        hero: trainee.id,
      },
    );
  const learner = members.find(
    (h) => skillPoints(h) > 0 && roleTree(h.role).some(
      (node) => !learnSkillReason(s, h.id, node.id),
    ),
  );
  if (learner) return {
    title: `为${learner.name}选择技能分支`,
    detail: `还有${skillPoints(learner)}点技能未分配。在角色培养中打开技能树，选择一条路线并携带解锁的技能。`,
    view: 'heroes', tab: 'training', hero: learner.id,
  };
  return null;
}
export function objective(s: State): Objective {
  if (!s.buildings.fire)
    return {
      title: '在异乡点起第一簇火',
      detail: `枯枝 ${Math.floor(s.resources.wood)}/12；每次拾取2份，凑齐后再亲手点火。`,
      view: 'town',
      building: 'fire',
    };
  if (!s.buildings.hut)
    return {
      title: '搭起第一间遮雨的小屋',
      detail: `需要18木材，当前${Math.floor(s.resources.wood)}。亲自收集；火光不会替你招来工人。`,
      view: 'town',
      tab: 'build',
      building: 'hut',
    };
  if (!s.population)
    return {
      title: '为第一个来客备一餐',
      detail: '采集10口粮，在居民页接纳第一位住民。他会等待你的工作安排。',
      view: 'town',
      tab: 'workers',
    };
  for (const [building, job] of [
    ['lumber', 'wood'],
    ['farm', 'food'],
  ] as [BuildingId, Job][]) {
    if (!s.buildings[building])
      return {
        title: `建造${D.BUILDINGS.find((b) => b.id === building)!.name}`,
        detail: `${costText(buildingCost(s, building))}；先亲自采集缺少的物资，再安排住民到设施工作。`,
        view: 'town',
        tab: 'build',
        building,
      };
    if (
      !s.jobs[job] &&
      !s.chronicle.includes('workers') &&
      !s.research.length &&
      !Discovery.hasReturned(s)
    )
      return {
        title: `安排第一位${D.JOB_NAMES[job]}`,
        detail:
          idleWorkers(s) > 0
            ? '设施已经建好；在居民页点击对应岗位的加号，才会开始产出。'
            : '再接纳一位住民，或从已有岗位调出一人。',
        view: 'town',
        tab: 'workers',
      };
  }
  if (!s.buildings.quarry)
    return {
      title: '为下一批工具准备石料',
      detail: '建造采石场并安排石匠；也可以亲自采石补齐短缺。',
      view: 'town',
      tab: 'build',
      building: 'quarry',
    };
  if (!s.research.includes('tools'))
    return fundingGoal(
      s,
      D.RESEARCH.find((r) => r.id === 'tools')!.cost,
      {},
      {
        title: '跟木匠改良石斧与石镐',
        detail: '工具提高亲自采集的效率，住民则维持持续供给。',
        view: 'research',
        tab: 'town',
        research: 'tools',
      },
    );
  if (!s.assigned || s.population < 6)
    return {
      title: '安置住民，建立稳定的分工',
      detail: `现有 ${s.population}/6 位住民；为木、粮、石安排稳定的来源。`,
      view: 'town',
      tab: 'workers',
    };
  for (const id of ['market', 'tavern'] as BuildingId[])
    if (!s.buildings[id])
      return fundingGoal(
        s,
        buildingCost(s, id),
        Campaign.buildingMaterialCost(s, id),
        {
          title: `建造${D.BUILDINGS.find((b) => b.id === id)!.name}`,
          detail:
            id === 'tavern'
              ? '把委托贴到门上，邀请愿意同行的人。'
              : '把剩余物资带到集市，建立金币的来源。',
          view: 'town',
          tab: 'build',
          building: id,
        },
      );
  if (!s.heroes.length)
    return {
      title: '找到第一位同行者',
      detail: '看看今天来到酒馆的人。每位旅人的潜力、资质与经历不同。',
      view: 'recruit',
    };
  if (!s.party.length)
    return {
      title: '把伙伴编入小队',
      detail: '在队伍名册中选择同行者。',
      view: 'heroes',
    };
  if (!s.guild.crafts && !Discovery.hasReturned(s))
    return fundingGoal(
      s,
      Guild.recipeCost(s, 'blade', 1),
      {},
      {
        title: '为第一次远行做一把长剑',
        detail: '在队伍的手工锻造中制作，再到装备库交给伙伴。',
        view: 'heroes',
        tab: 'forge',
        recipe: 'blade',
      },
    );
  if (!Discovery.hasReturned(s)) {
    const unarmed = s.party
      .map((id) => s.heroes.find((h) => h.id === id)!)
      .find((h) => !h.equipment.weapon);
    const spare =
      unarmed &&
      s.guild.inventory.find(
        (g) =>
          gearSlot(g) === 'weapon' &&
          !s.heroes.some((h) => Object.values(h.equipment).includes(g.id)),
      );
    if (spare)
      return {
        title: '让伙伴带上刚做好的装备',
        detail: '选择一位旅人，把装备库里的武器穿戴到身上。',
        view: 'heroes',
        tab: 'inventory',
      };
    if (partyStats(s).power < routeInfo(s, 0, 'survey').power) {
      const trainee = s.heroes.find(
        (h) => s.party.includes(h.id) && h.level < levelCap(s),
      );
      if (trainee)
        return fundingGoal(
          s,
          trainCost(trainee),
          {},
          {
            title: `先带${trainee.name}练习远行`,
            detail: `初探需要战力 40，当前 ${partyStats(s).power}；训练提升资质对应的实际能力。`,
            view: 'heroes',
            tab: 'training',
            hero: trainee.id,
          },
        );
      return {
        title: '邀请另一位同行者',
        detail: '单人暂时无法护住行李，两个人相互照应后再初探。',
        view: 'recruit',
      };
    }
    return fundingGoal(
      s,
      { food: routeInfo(s, 0, 'survey').cost },
      {},
      {
        title: '沿森林边缘走一趟',
        detail:
          '第一次选择调查，带回样品与见闻。不要急着深入；这次归来会带来新的手艺。',
        view: 'explore',
        tab: 'mission',
        region: 0,
        route: 'survey',
      },
    );
  }
  if (s.ending)
    return {
      title: s.rebuild.length === 3 ? '终于不再是异乡人' : '把明天还给人间',
      detail: `重建 ${s.rebuild.length}/3。让胜利回到普通人的生活。`,
      view: 'destiny',
      tab: 'rebuild',
    };
  const nextTech = Campaign.TECHNOLOGIES.find(
    (t) =>
      t.rank > Campaign.townRank(s) &&
      !Campaign.technologyPrerequisiteReason(s, t.id),
  );
  if (nextTech)
    return fundingGoal(s, nextTech.cost, nextTech.materials, {
      title: `研究${nextTech.name}`,
      detail: nextTech.desc,
      view: 'research',
      tab: 'technology',
      research: nextTech.id,
    });
  if (
    Campaign.townRank(s) >= 1 &&
    !s.research.includes('axes') &&
    !s.research.includes('preservation')
  ) {
    const tech = D.RESEARCH.find((r) => r.id === 'axes')!;
    return fundingGoal(s, tech.cost, tech.materials || {}, {
      title: '改造古木锯架，支撑木板加工',
      detail: '也可以先改善粮食供给。两条产线会共同支撑下一段路。',
      view: 'research',
      tab: 'town',
      research: tech.id,
    });
  }
  const r = Campaign.objectiveRegion(s);
  if (Tactics.guardianReady(s, r))
    return (
      guardianGrowthGoal(s, r) || {
        title: '击败' + Tactics.enemyDefinition(s, r, 'guardian').name,
        detail:
          '已抵达守敌。核对养成参考中的装备强化、技能和防护，再选择挑战；战败保留路线。',
        view: 'explore',
        tab: 'frontier',
        region: r,
      }
    );
  if (s.guild.depths[r] < 1)
    return (
      readinessGoal(s, r) || {
        title: `在${D.REGIONS[r].name}建立落脚点`,
        detail: '先推进第一处据点，取得可研究的样品和工艺线索。',
        view: 'explore',
        tab: 'frontier',
        region: r,
      }
    );
  const localTech = r === 1 ? 'runecraft' : r === 2 ? 'metallurgy' : '';
  if (localTech && !s.world.tech.includes(localTech)) {
    const tech = Campaign.TECHNOLOGIES.find((t) => t.id === localTech)!;
    return fundingGoal(s, tech.cost, tech.materials, {
      title: `研究${tech.name}`,
      detail: tech.desc,
      view: 'research',
      tab: 'technology',
      research: tech.id,
    });
  }
  if (s.guild.depths[r] < 5)
    return (
      readinessGoal(s, r) || {
        title: `推进${D.REGIONS[r].name}的下一处据点`,
        detail: `已经建立 ${s.guild.depths[r]} 处据点；准备越充分，推进越快。`,
        view: 'explore',
        tab: 'frontier',
        region: r,
      }
    );
  if (r === 5 && !s.research.includes('godslayer')) {
    const tech = D.RESEARCH.find((t) => t.id === 'godslayer')!;
    return fundingGoal(s, tech.cost, tech.materials || {}, {
      title: '找到神律的裂缝',
      detail: tech.desc,
      view: 'research',
      tab: 'adventure',
      research: 'godslayer',
    });
  }
  return {
    title: `准备挑战${D.REGIONS[r].boss}`,
    detail:
      '先停止续派，在备战推演里确认阵容和指令；失败的预案可以换装后再试。',
    view: 'explore',
    tab: 'boss',
    region: r,
  };
}
export function migrateLegacy(raw: string): State {
  const old = decodeLegacy(raw),
    s = freshState(old.savedAt);
  s.time = Math.min(1e8, old.time);
  s.speed = old.speed;
  s.paused = old.paused;
  s.resources = Object.fromEntries(Object.entries(old.resources)) as Record<
    Resource,
    number
  >;
  s.buildings = { ...s.buildings, ...old.buildings };
  s.population = old.population;
  s.buildings.hut = Math.max(
    s.buildings.hut,
    Math.ceil((s.population - 3) / 3),
  );
  s.jobs = { ...old.jobs, iron: 0, crystal: 0 };
  s.heroes = old.heroes.map((h) =>
    Guild.legacyCharacter({ ...h, weapon: 0, armor: 0 }),
  );
  s.party = [...old.party];
  s.cleared = [...old.cleared];
  s.ending = old.ending;
  s.assigned = !!s.buildings.fire;
  s.research = [...old.research];
  s.kit = Math.min(5, old.cleared.length);
  s.buildings.forge = Math.max(s.buildings.forge, s.kit);
  s.explored = [...old.explored];
  s.survey = old.explored.map((n, r) =>
    s.cleared.includes(r)
      ? D.REGIONS[r].thresholds[1]
      : Math.min(n, D.REGIONS[r].thresholds[1]),
  );
  for (const r of s.cleared)
    s.projects[D.PROJECTS[r].id] = D.PROJECTS[r].choices[0].id;
  s.log = old.log.map((l) => ({ ...l, time: Math.min(1e8, l.time) }));
  if (old.expedition) {
    const info = routeInfo(s, old.expedition.region, 'supply'),
      fraction = Math.max(
        0,
        Math.min(
          1,
          (old.time - old.expedition.start) /
            (old.expedition.end - old.expedition.start),
        ),
      );
    s.expedition = {
      region: old.expedition.region,
      route: 'supply',
      power: partyStats(s).power,
      outcome: 0,
      chance: 1,
      success: true,
      depth: 0,
      start: s.time,
      end: s.time + Math.max(1, info.duration * (1 - fraction)),
    };
  }
  log(
    s,
    `旧手记已迁入新旅程，保留城镇、伙伴和已完成章节。${old.battle ? '旧战斗安全退出，请按新规则重新准备。' : ''}`,
    'story',
  );
  for (const r of s.cleared) {
    s.guild.depths[r] = 5;
    s.guild.intel[r] = 100;
    s.guild.outposts[r] = 1;
  }
  Guild.ensureApplicants(s);
  delete (s as Partial<State>).world;
  Campaign.migrateWorld(s);
  Economy.migrateEconomy(s);
  migrateStock(s);
  return s;
}
function migrateStock(s: State) {
  for (const k of Object.keys(s.resources) as Resource[]) {
    s.legacyStock[k] += Math.max(0, s.resources[k] - capacity(s, k));
    s.resources[k] = Math.min(s.resources[k], capacity(s, k));
  }
}
export function decodeSave(raw: string): State {
  if (raw.length > 750000) throw Error('手记过大');
  const data = JSON.parse(raw);
  if (data?.version === 1) return migrateLegacy(raw);
  const upgrading = data?.version === 2;
  if (upgrading && data.buildings && data.resources) {
    data.version = 3;
    data.buildings.warehouse = 0;
    data.gatherTimes = Object.fromEntries(
      Object.keys(D.RESOURCE_NAMES).map((k) => [k, data.gatherAt]),
    );
    data.legacyStock = blankResources();
    data.rng = Math.floor(data.savedAt) >>> 0 || 123456789;
    data.nextEventAt = data.time + 30;
    data.lastExpedition = null;
    if (data.expedition) data.expedition.outcome = 0;
  }
  if (data?.version === 3) {
    Guild.migrateGuild(data);
    data.version = 4;
  }
  if (data?.version === 4) {
    Campaign.migrateWorld(data);
    data.version = 5;
    data.battle = null;
    if (data.lastExpedition) data.lastExpedition.materials = '';
  }
  if (data?.version === 5) {
    data.version = 6;
    data.chronicle = Discovery.STORY_BEATS.filter((b) => b.when(data)).map(
      (b) => b.id,
    );
  }
  const upgradingCombat = data?.version === 6;
  if (upgradingCombat) {
    data.version = 7;
    data.lastMap = data.lastExpedition?.region ?? 0;
    data.combatAuto = false;
    data.lastBattle = null;
    for (const h of [
      ...(data.heroes || []),
      ...(data.guild?.applicants || []),
    ]) {
      if (
        h.activeSkill &&
        h.activeSkill !== Guild.DEFAULT_SKILL[h.role as D.HeroId]
      )
        h.legacySkill = h.activeSkill;
    }
  }
  const upgradingEconomy = data?.version === 7;
  if (upgradingEconomy) {
    data.version = 8;
    Economy.migrateEconomy(data);
  }
  if (data?.version === 8) {
    data.version = 9;
    data.civic = Civic.freshCivic();
    data.civic.invitations = Math.min(
      200,
      3 + (data.explored || []).reduce((a: number, b: number) => a + b, 0),
    );
  }
  if (data?.version === 9) data.version = 10;
  const s = data as State,
    n = (v: unknown, a = 0, b = 1e8) =>
      typeof v === 'number' && Number.isFinite(v) && v >= a && v <= b,
    i = (v: unknown, a = 0, b = 1e8) => n(v, a, b) && Number.isInteger(v),
    array = (v: unknown) => Array.isArray(v),
    unique = (v: unknown[]) => new Set(v).size === v.length,
    strings = (v: unknown) =>
      array(v) && (v as unknown[]).every((x) => typeof x === 'string'),
    record = (v: unknown, keys: string[]) =>
      !!v &&
      typeof v === 'object' &&
      !array(v) &&
      Object.keys(v).length === keys.length &&
      keys.every((k) => Object.hasOwn(v, k));
  const fresh = freshState();
  if (
    !s ||
    s.version !== 10 ||
    !i(s.lastMap, 0, 5) ||
    typeof s.combatAuto !== 'boolean' ||
    !strings(s.chronicle) ||
    !unique(s.chronicle) ||
    s.chronicle.some((id) => !Discovery.STORY_BEATS.some((b) => b.id === id)) ||
    !n(s.time) ||
    !n(s.savedAt, 0, 1e15) ||
    ![1, 3].includes(s.speed) ||
    typeof s.paused !== 'boolean' ||
    !record(s.resources, Object.keys(fresh.resources)) ||
    !Object.values(s.resources).every((v) => n(v)) ||
    !record(s.jobs, Object.keys(fresh.jobs)) ||
    !Object.values(s.jobs).every((v) => i(v, 0, 51)) ||
    !record(s.buildings, Object.keys(fresh.buildings)) ||
    !D.BUILDINGS.every((b) => i(s.buildings[b.id], 0, b.max)) ||
    !i(s.population, 0, 51) ||
    s.population > populationCap(s) ||
    idleWorkers(s) < 0
  )
    throw Error('城镇数据不完整');
  Civic.validateCivic(s);
  if (
    !array(s.heroes) ||
    s.heroes.length > 12 ||
    !unique(s.heroes.map((h) => h.id)) ||
    s.heroes.some(
      (h) =>
        !ids.includes(h.role) ||
        !i(h.level, 1, 40) ||
        !n(h.xp, 0, 20000) ||
        !i(h.weapon, 0, 6) ||
        !i(h.armor, 0, 6),
    ) ||
    !strings(s.party) ||
    s.party.length > 4 ||
    !unique(s.party) ||
    s.party.some((id) => !s.heroes.some((h) => h.id === id))
  )
    throw Error('伙伴数据无效');
  for (const a of [s.explored, s.survey, s.peaceRuns])
    if (!array(a) || a.length !== 6 || !a.every((x) => i(x)))
      throw Error('探索记录无效');
  if (
    !array(s.cleared) ||
    s.cleared.length > 6 ||
    !unique(s.cleared) ||
    s.cleared.some((r) => !i(r, 0, 5)) ||
    !s.projects ||
    typeof s.projects !== 'object' ||
    Array.isArray(s.projects) ||
    Object.entries(s.projects).some(([id, v]) => {
      const r = D.PROJECTS.findIndex((p) => p.id === id);
      return (
        r < 0 ||
        !D.PROJECTS[r].choices.some((c) => c.id === v) ||
        discoveryCount(s, r) !== 2
      );
    })
  )
    throw Error('章节记录无效');
  for (const a of [s.flags, s.eventDone, s.rebuild, s.research])
    if (!strings(a) || !unique(a) || a.length > 30) throw Error('手记条目无效');
  if (
    s.research.some((id) => !D.RESEARCH.some((r) => r.id === id)) ||
    s.rebuild.some((id) => !D.REBUILD.some((r) => r.id === id)) ||
    s.eventDone.some((id) => !D.EVENTS.some((e) => e.id === id)) ||
    s.flags.some(
      (id) => !D.EVENTS.some((e) => e.choices.some((c) => c.effect === id)),
    )
  )
    throw Error('未知手记条目');
  if (
    !i(s.kit, 0, 5) ||
    !i(s.pendingSettlers, 0, 2) ||
    typeof s.assigned !== 'boolean' ||
    typeof s.ending !== 'boolean' ||
    s.ending !== (s.cleared.length === 6) ||
    !i(s.legacy, 0, 10) ||
    !i(s.journeys, 0, 10000) ||
    !n(s.recoveryUntil) ||
    !n(s.gatherAt, -12) ||
    s.gatherAt > s.time ||
    !(s.event === null || i(s.event, 0, D.EVENTS.length - 1))
  )
    throw Error('成长数据无效');
  const o = s.order;
  if (
    !o ||
    typeof o.enabled !== 'boolean' ||
    typeof o.autoBuy !== 'boolean' ||
    !i(o.region, 0, 5) ||
    !['supply', 'survey', 'frontier'].includes(o.route) ||
    ![0, 20, 60, 120].includes(o.reserve) ||
    typeof o.reason !== 'string'
  )
    throw Error('委托记录无效');
  if (s.expedition) {
    const e = s.expedition;
    if (
      !i(e.region, 0, 5) ||
      !regionOpen(s, e.region) ||
      !['supply', 'survey', 'frontier'].includes(e.route) ||
      !n(e.start) ||
      e.start > s.time ||
      !n(e.end) ||
      e.end <= e.start ||
      e.end - e.start > 2000 ||
      !n(e.power) ||
      !s.party.length
    )
      throw Error('远征记录无效');
  } else if (s.expedition !== null) throw Error('远征记录缺失');
  if (s.battle) {
    const b = s.battle;
    if (
      !i(b.region, 0, 5) ||
      !regionOpen(s, b.region) ||
      s.expedition ||
      !s.party.length ||
      !n(b.hp, 1) ||
      !n(b.maxHp, 1) ||
      b.hp > b.maxHp ||
      !n(
        b.enemyHp,
        1,
        b.system === 2 ? b.enemyMaxHp : D.REGIONS[b.region].hp,
      ) ||
      !n(b.attack, 1) ||
      !n(b.defense) ||
      !i(b.round, 1) ||
      !i(b.energy, 0, 10) ||
      !i(b.supplies, 0, 100) ||
      !i(b.healCooldown, 0, 2) ||
      !record(b.cooldowns, s.party) ||
      !Object.values(b.cooldowns).every((v) => i(v, 0, 8)) ||
      !n(b.enemyShield, 0, b.enemyMaxHp || 1e8) ||
      ![b.ward, b.marked, b.burn, b.sealed].every((v) => i(v, 0, 2)) ||
      !strings(b.history) ||
      b.history.length > 35 ||
      b.history.some((x) => x.length > 1000)
    )
      throw Error('战斗记录无效');
  } else if (s.battle !== null) throw Error('战斗记录缺失');
  if (
    !array(s.log) ||
    s.log.length > 100 ||
    s.log.some(
      (l) =>
        !n(l.time) ||
        typeof l.text !== 'string' ||
        l.text.length > 3000 ||
        typeof l.kind !== 'string',
    )
  )
    throw Error('日志记录无效');
  if (
    !record(s.gatherTimes, Object.keys(D.RESOURCE_NAMES)) ||
    !Object.values(s.gatherTimes).every((v) => n(v, -12, s.time)) ||
    !record(s.legacyStock, Object.keys(D.RESOURCE_NAMES)) ||
    !Object.values(s.legacyStock).every((v) => n(v, 0, 1e9)) ||
    !i(s.rng, 1, 4294967295) ||
    !n(s.nextEventAt)
  )
    throw Error('仓储与随机记录无效');
  Tactics.validateBattleReport(s);
  Guild.validateGuild(s);
  Campaign.validateWorld(s);
  Economy.validateEconomy(s);
  if (
    s.expedition &&
    (!n(s.expedition.chance, 0, 1) ||
      typeof s.expedition.success !== 'boolean' ||
      !i(s.expedition.depth, 0, 5))
  )
    throw Error('远征准备快照无效');
  if (
    s.battle &&
    (![s.battle.resistance, s.battle.pierce, s.battle.ranged].every((v) =>
      n(v, 0, 1),
    ) ||
      !n(s.battle.bonus, 0.8, 3))
  )
    throw Error('战斗准备快照无效');
  if (s.battle) {
    if (upgradingCombat && s.battle.system !== 2) Tactics.migrateBattle(s);
    Tactics.validateBattle(s);
  }
  if (s.expedition && !i(s.expedition.outcome, 0, 3))
    throw Error('远征结果记录无效');
  if (s.lastExpedition !== null) {
    const r = s.lastExpedition;
    const cost = (v: unknown) =>
      !!v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      Object.entries(v).every(
        ([k, x]) => Object.hasOwn(D.RESOURCE_NAMES, k) && n(x),
      );
    if (
      !r ||
      (r.route !== undefined &&
        !['supply', 'survey', 'frontier'].includes(r.route)) ||
      (r.chance !== undefined && !n(r.chance, 0, 1)) ||
      (r.intelGain !== undefined && !n(r.intelGain, 0, 100)) ||
      (r.clues !== undefined && !i(r.clues, 0, 2)) ||
      !n(r.time, 0, s.time) ||
      !i(r.region, 0, 5) ||
      !i(r.outcome, 0, 3) ||
      !cost(r.found) ||
      !cost(r.kept) ||
      !cost(r.lost) ||
      typeof r.success !== 'boolean' ||
      !n(r.progress, 0, 260) ||
      typeof r.equipment !== 'string' ||
      r.equipment.length > 200 ||
      (r.materials !== undefined &&
        (typeof r.materials !== 'string' || r.materials.length > 200))
    )
      throw Error('远征战报无效');
  }
  for (const job of Object.keys(s.jobs) as Job[])
    if (jobReason(s, job)) s.jobs[job] = 0;
  if (upgrading) {
    migrateStock(s);
    log(
      s,
      '仓储规则更新：超出容量的旧物资已封存，可在仓库取用；新生产、采集与远征遵循容量上限。',
      'story',
    );
  } else if (
    (Object.keys(s.resources) as Resource[]).some(
      (k) => s.resources[k] > capacity(s, k) + 1e-8,
    )
  )
    throw Error('库存超过仓库容量');
  return s;
}
