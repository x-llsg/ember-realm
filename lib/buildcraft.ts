import * as G from './realm.ts';
import type { BuildModifiers } from './equipment-data.ts';

export function talentBonuses(h: G.Hero): BuildModifiers {
  if (h.talentVersion === 2)
    return { ...G.TALENTS.find((t) => t.id === h.talent)!.stats };
  // Preserve the exact old positive/negative combination, including paid tempering.
  const result: BuildModifiers = {};
  if (h.talent === 'hunter') result.attack = 0.08;
  if (h.talent === 'breaker') result.pierce = 0.25;
  if (h.talent === 'warden') result.fire = result.shadow = result.radiant = 0.2;
  if (h.flaw === 'frail') result.hp = -0.08;
  if (h.flaw === 'hesitant')
    result.attack = (1 + (result.attack || 0)) * 0.94 - 1;
  return result;
}
export const talentExperience = (h: G.Hero) =>
  h.talentVersion === 2
    ? G.TALENTS.find((t) => t.id === h.talent)!.xp || 1
    : (h.talent === 'diligent' ? 1.3 : 1) * (h.flaw === 'green' ? 0.9 : 1);
export const talentTraining = (h: G.Hero) =>
  h.talentVersion === 2
    ? G.TALENTS.find((t) => t.id === h.talent)!.training || 1
    : h.talent === 'diligent'
      ? 0.85
      : 1;
export function characterTalentHelp(h: G.Hero) {
  const talent = G.TALENTS.find((t) => t.id === h.talent)!;
  const old: Record<string, string> = {
    hunter: '攻击 +8%；森林与龙巢伤害 +12%。',
    breaker: '穿甲 +25%。',
    warden: '三种元素抗性 +20%。',
    healer: '全队补给治疗 +5%（同名不叠加）。',
    scholar: '调查额外3敌情（同名不叠加）。',
    scout: '远征耗时 -10%（同名不叠加）。',
    diligent: '经验 +30%；训练金币 -15%。',
    veteran: '开战士气 +1（同名不叠加）。',
  };
  return {
    title: `${G.QUALITY_NAMES[talent.rarity - 1]}天赋 · ${talent.name}`,
    body:
      (h.talentVersion === 2
        ? talent.text
        : `${old[h.talent] || talent.text}\n传承特性：${G.FLAWS.find((f) => f.id === h.flaw)?.text || '已磨砺，无额外负面'}。旧有培养成果保留。`) +
      '\n天赋稀有度独立于潜力：白40%、绿30%、蓝20%、紫8%、金2%。稀有天赋更专门化，未必适合每个职业。',
  };
}
export function equippedSets(s: G.State, h: G.Hero) {
  const worn = new Set(Object.values(h.equipment));
  return G.EQUIPMENT_SETS.map((set) => ({
    ...set,
    count: s.guild.inventory.filter(
      (item) => worn.has(item.id) && item.setId === set.id,
    ).length,
  })).filter((set) => set.count > 0);
}
export function setBonuses(s: G.State, h: G.Hero): BuildModifiers {
  const result: BuildModifiers = {};
  for (const set of equippedSets(s, h))
    for (const bonus of [
      set.count >= 2 ? set.two : {},
      set.count >= 4 ? set.four : {},
    ])
      for (const [key, value] of Object.entries(bonus))
        result[key as keyof BuildModifiers] =
          (result[key as keyof BuildModifiers] || 0) + value!;
  return result;
}
export function buildBonuses(s: G.State, h: G.Hero): BuildModifiers {
  const result = setBonuses(s, h);
  for (const [key, value] of Object.entries(talentBonuses(h)))
    result[key as keyof BuildModifiers] =
      (result[key as keyof BuildModifiers] || 0) + value!;
  return result;
}
export function gearSetHelp(item: G.Gear) {
  const set = G.EQUIPMENT_SETS.find((x) => x.id === item.setId);
  return set
    ? `${set.name} · ${G.REGIONS[set.region].name}守敌/首领掉落。\n${set.text}\n只计算穿戴者本人不同槽位的件数；2件与4件效果相加，可配4+2或2+2+2。`
    : '散件可与任意套装混搭。套装由各地区守敌与首领掉落。';
}
export function monsterEquipment(
  s: G.State,
  region: number,
  kind: 'boss' | 'guardian',
  firstClear = true,
) {
  const random = () => {
    if (!s.battle?.rng) return G.guildRandom(s);
    let x = s.battle.rng;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    s.battle.rng = x >>> 0 || 1;
    return s.battle.rng / 4294967296;
  };
  const guaranteed = firstClear && s.battle?.node === 2;
  if (kind === 'guardian' && !guaranteed && random() >= 0.4) return;
  const n = random(),
    rarity =
      kind === 'boss'
        ? n < 0.02
          ? 6
          : n < 0.1
            ? 5
            : n < 0.4
              ? 4
              : 3
        : n < 0.1
          ? 4
          : n < 0.5 || guaranteed
            ? 3
            : 2,
    slot = G.GEAR_SLOTS[Math.floor(random() * 6)],
    recipes = G.RECIPES.filter(
      (recipe) =>
        recipe.slot === slot &&
        (recipe.chapter === 0 || !G.recipeUnlockReason(s, recipe.id)),
    );
  const item: G.Gear = {
    id: `gear-${++s.guild.serial}`,
    recipe: recipes[Math.floor(random() * recipes.length)].id,
    tier: Math.min(G.gearTier(s), [1, 2, 2, 4, 4, 6][region]),
    rarity,
    affix: Math.floor(random() * G.AFFIXES.length),
    upgrade: 0,
    setId: G.EQUIPMENT_SETS.find((set) => set.region === region)!.id,
  };
  if (s.guild.inventory.length >= G.INVENTORY_CAP) {
    // A valuable boss drop must not disappear into automatic dismantling.
    s.guild.serial--;
    throw Error('出战前必须为战利品预留装备空间');
  }
  s.guild.inventory.push(item);
  G.log(
    s,
    `${kind === 'boss' ? '首领战利品' : '守敌掉落'}：${G.gearName(item)}。`,
    rarity >= 5 ? 'story' : 'good',
  );
}
