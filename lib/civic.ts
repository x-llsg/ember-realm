import * as G from './realm.ts';
import type { BuildingId, Cost, Resource } from './realm-data.ts';

export const RENOVATION_MAX = 60;
export const BUFFS = {
  hands: { name: '巡回劳工', text: '木、粮、石生产 +25%', seconds: 600 },
  artisan: {
    name: '匠人指导',
    text: '木板、精钢、符文加工速度 +25%',
    seconds: 600,
  },
  lessons: { name: '实战讲习', text: '实战与留守教学经验 +40%', seconds: 600 },
  provisions: { name: '温暖食宿', text: '训练口粮费用 -25%', seconds: 600 },
} as const;
export type BuffId = keyof typeof BUFFS;
export interface CivicState {
  renovations: Partial<Record<BuildingId, number>>;
  buffs: Partial<Record<BuffId, number>>;
  invitations: number;
  trainingCredit: { gold: number; food: number };
  offer: { event: number; gear: G.Gear; cost: Cost } | null;
}
export function freshCivic(): CivicState {
  return {
    renovations: {},
    buffs: {},
    invitations: 3,
    trainingCredit: { gold: 0, food: 0 },
    offer: null,
  };
}
export function renovationLevel(s: G.State, id: BuildingId) {
  return s.civic.renovations[id] || 0;
}
export function renovationFactor(s: G.State, id: BuildingId, step = 0.03) {
  return 1 + renovationLevel(s, id) * step;
}
export function renovationCost(s: G.State, id: BuildingId): Cost {
  const b = G.BUILDINGS.find((b) => b.id === id)!;
  return Object.fromEntries(
    Object.entries(b.cost).map(([k, v]) => [
      k,
      Math.ceil(v! * 3 * 1.18 ** renovationLevel(s, id)),
    ]),
  );
}
export function renovationReason(s: G.State, id: BuildingId) {
  if (id === 'fire' || !s.buildings[id]) return '先建造建筑';
  if (renovationLevel(s, id) >= RENOVATION_MAX) return '六十级细部改良已完成';
  return (
    G.capacityReason(s, renovationCost(s, id)) ||
    (!G.canPay(s, renovationCost(s, id)) ? '营建物资不足' : '')
  );
}
export function renovationHelp(s: G.State, id: BuildingId) {
  const n = renovationLevel(s, id);
  const effect =
    id === 'warehouse'
      ? '普通资源容量'
      : id === 'hut'
        ? '全体工人生产效率'
        : id === 'tavern'
          ? '实战与留守教学经验'
          : '对应资源生产';
  const step = id === 'warehouse' ? 0.04 : id === 'hut' ? 0.01 : 0.03;
  return {
    title: '细部改良 · ' + G.BUILDINGS.find((b) => b.id === id)!.name,
    body:
      `当前改良 ${n}/${RENOVATION_MAX} 级。${effect} ×${(1 + n * step).toFixed(2)} → ×${(1 + (n + 1) * step).toFixed(2)}。` +
      (['lumber', 'forge', 'shrine'].includes(id)
        ? '\n对应加工速度每级另加 2%。'
        : '') +
      '\n改良与扩建独立：扩建开放设施与工位，改良持续提高效率，不受城镇阶段上限限制。倍率按等级相加，再与研究相乘；不会凭空增加工人或原料。\n下次费用：' +
      G.costText(renovationCost(s, id)),
  };
}
export function renovate(s0: G.State, id: BuildingId) {
  if (!G.BUILDINGS.some((b) => b.id === id) || renovationReason(s0, id))
    return s0;
  const s = G.clone(s0);
  for (const [k, v] of Object.entries(renovationCost(s, id)))
    s.resources[k as Resource] -= v!;
  s.civic.renovations[id] = renovationLevel(s, id) + 1;
  G.log(
    s,
    `${G.BUILDINGS.find((b) => b.id === id)!.name}完成第 ${renovationLevel(s, id)} 级改良。`,
    'good',
  );
  return s;
}
export function buffActive(s: G.State, id: BuffId) {
  return (s.civic.buffs[id] || 0) > s.time;
}
export function civicExperience(s: G.State) {
  return renovationFactor(s, 'tavern') * (buffActive(s, 'lessons') ? 1.4 : 1);
}
export function activeBuffs(s: G.State) {
  return (Object.keys(BUFFS) as BuffId[])
    .filter((id) => buffActive(s, id))
    .map((id) => ({
      id,
      ...BUFFS[id],
      remaining: Math.ceil(s.civic.buffs[id]! - s.time),
    }));
}
export const TRAINING_FACTORS = [0.4, 0.55, 0.75, 1, 1.2] as const;
export const LEARNING_FACTORS = [1.6, 1.4, 1.2, 1.05, 1] as const;
export function payableTrainCost(s: G.State, h: G.Hero): Cost {
  const c = G.trainCost(h);
  return {
    gold: Math.max(0, c.gold! - s.civic.trainingCredit.gold),
    food: Math.max(
      0,
      Math.ceil(c.food! * (buffActive(s, 'provisions') ? 0.75 : 1)) -
        s.civic.trainingCredit.food,
    ),
  };
}
export function recruitmentStage(s: G.State) {
  return s.cleared.length >= 5
    ? 5
    : s.cleared.length >= 3
      ? 4
      : s.cleared.length >= 2
        ? 3
        : s.cleared.length >= 1
          ? 2
          : s.guild.depths.some((n) => n >= 1)
            ? 1
            : 0;
}
export function recruitmentWeights(s: G.State): readonly number[] {
  return [
    [65, 29, 6, 0, 0],
    [45, 32, 20, 3, 0],
    [32, 33, 26, 8, 1],
    [20, 28, 35, 15, 2],
    [12, 23, 38, 24, 3],
    [6, 17, 39, 33, 5],
  ][recruitmentStage(s)];
}
export function recruitmentProgressHelp(s: G.State) {
  const stage = recruitmentStage(s);
  return {
    title: '公会声望与招募',
    body: `当前 1–5 星基础概率（不含保底）：${recruitmentWeights(s).join('% / ')}%。\n每四批第一位至少三星；各位置和下批出现率的完整概率见「角色出现率」。\n首次占领任意据点开放四星；击败首位首领开放五星，此后击败 2 / 3 / 5 位首领继续改善高星率。已招募与已出现角色保留。\n五星解锁前保底照常累计，最多存79位；解锁后若已存满79位，下一位即可触发，出现五星归零。${stage < 2 ? '当前五星尚未开放。' : ''}\n付费换批需要 1 封引荐信；成功远征每趟带回 1 封，上限200。每600游戏秒仍可免费换批，不耗信。新档备有3封。`,
  };
}
export function recruitmentRefreshReason(s: G.State) {
  return !s.buildings.tavern
    ? '需要酒馆'
    : s.time < s.guild.refreshAt && s.civic.invitations < 1
      ? '需要引荐信：成功远征可获得，或等待免费换批'
      : !G.canPay(s, G.refreshCost(s))
        ? '金币不足，可等待免费换批'
        : '';
}
export function visitorChoice(s: G.State, index: number) {
  if (s.event === null) return null;
  const c = G.EVENTS[s.event].choices[index];
  if (!c) return null;
  if (!c.buff && !c.equipment) return c;
  if (c.equipment && s.civic.offer?.event === s.event)
    return {
      ...c,
      cost: s.civic.offer.cost,
      detail: `${G.gearName(s.civic.offer.gear)}；${G.costText(s.civic.offer.cost)}。装备与价格已确定，成交后进入装备库。`,
    };
  const scale = [1, 2, 4, 8, 15, 25][G.townRank(s)];
  return {
    ...c,
    cost: Object.fromEntries(
      Object.entries(c.cost).map(([k, v]) => [k, Math.ceil(v! * scale)]),
    ),
    detail: c.buff
      ? `${BUFFS[c.buff].text}，持续10分钟。同类刷新时长，不叠倍率；按游戏时间计时。`
      : c.detail,
  };
}
export function prepareVisitor(s: G.State) {
  if (
    s.event === null ||
    !G.EVENTS[s.event].choices.some((c) => c.equipment) ||
    s.civic.offer?.event === s.event
  )
    return;
  const recipes = G.RECIPES.filter((r) => G.recipeDiscovered(s, r.id));
  if (!recipes.length) return;
  const recipe = recipes[Math.floor(G.guildRandom(s) * recipes.length)];
  const q = G.guildRandom(s);
  const gear: G.Gear = {
    id: 'visitor-' + ++s.guild.serial,
    recipe: recipe.id,
    tier: G.gearTier(s),
    rarity: q < 0.6 ? 2 : q < 0.95 ? 3 : 4,
    affix: Math.floor(G.guildRandom(s) * G.AFFIXES.length),
    upgrade: 0,
  };
  const base = G.recipeCost(s, recipe.id, gear.tier);
  const value = Object.entries(base).reduce(
    (n, [k, v]) =>
      n +
      v! *
        { wood: 0.6, food: 0.6, stone: 0.8, gold: 1, iron: 4, crystal: 8 }[
          k as Resource
        ],
    0,
  );
  s.civic.offer = {
    event: s.event,
    gear,
    cost: { gold: Math.ceil(value * (0.85 + 0.1 * gear.rarity)) },
  };
}
export function validateCivic(s: G.State) {
  const c = s.civic,
    int = (v: unknown, max: number) =>
      typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max;
  const record = (v: unknown) =>
    !!v && typeof v === 'object' && !Array.isArray(v);
  if (
    !record(c) ||
    !record(c.renovations) ||
    !record(c.buffs) ||
    !record(c.trainingCredit) ||
    Object.keys(c.trainingCredit).length !== 2 ||
    !int(c.invitations, 200) ||
    !Object.entries(c.renovations).every(
      ([id, n]) =>
        id !== 'fire' &&
        G.BUILDINGS.some((b) => b.id === id) &&
        int(n, 60) &&
        s.buildings[id as BuildingId] > 0,
    ) ||
    !Object.entries(c.buffs).every(
      ([id, n]) =>
        Object.hasOwn(BUFFS, id) &&
        typeof n === 'number' &&
        Number.isFinite(n) &&
        n >= 0 &&
        n <= s.time + 600,
    ) ||
    !['gold', 'food'].every((k) =>
      int(c.trainingCredit[k as 'gold' | 'food'], 1e8),
    )
  )
    throw Error('城镇改良或来访数据无效');
  for (const h of [...s.heroes, ...s.guild.applicants])
    if (
      h.trainingInvestment !== undefined &&
      (!record(h.trainingInvestment) ||
        Object.keys(h.trainingInvestment).length !== 2 ||
        !['gold', 'food'].every((k) =>
          int(h.trainingInvestment![k as 'gold' | 'food'], 1e8),
        ))
    )
      throw Error('培养账目无效');
  if (c.offer) {
    const o = c.offer,
      g = o.gear;
    if (
      o.event !== s.event ||
      !G.EVENTS[o.event]?.choices.some((c) => c.equipment) ||
      !g ||
      typeof g.id !== 'string' ||
      !G.RECIPES.some((r) => r.id === g.recipe) ||
      !int(g.tier, 6) ||
      g.tier < 1 ||
      !int(g.rarity, 4) ||
      g.rarity < 2 ||
      g.setId !== undefined ||
      !int(g.affix, G.AFFIXES.length - 1) ||
      g.upgrade !== 0 ||
      !int(o.cost.gold, 1e8) ||
      Object.keys(o.cost).length !== 1 ||
      s.guild.inventory.some((i) => i.id === g.id)
    )
      throw Error('来访装备报价无效');
  }
}
