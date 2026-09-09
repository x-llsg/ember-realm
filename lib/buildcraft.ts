import * as G from './realm.ts';
import type { BuildModifiers } from './equipment-data.ts';
import { dropProfile, rollDropRarity } from './drop-progression.ts';
export * from './drop-progression.ts';

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
    : '散件可与任意套装混搭。套装由各地区守敌与首领掉落；击败该区首个守敌后，可在装备管理中消耗地区材料和同品质残片，将散件重制为该区套装。';
}

/** A deterministic equipment route: region victories unlock patterns; earned salvage pays for certainty. */
export function setReforgePreview(s: G.State, gearId: string, setId: string) {
  const gear = s.guild.inventory.find((item) => item.id === gearId);
  const set = G.EQUIPMENT_SETS.find((item) => item.id === setId);
  const rarity = (gear?.rarity || 1) as G.SalvageRarity;
  const essences = {
    rarity,
    amount: gear ? gear.tier * 2 : 0,
    name: G.SALVAGE_MATERIALS.find((material) => material.rarity === rarity)!
      .name,
  };
  const cost: G.Cost =
    gear && set ? { gold: 30 * gear.tier * (set.region + 1) } : {};
  const materials: G.MaterialCost =
    gear && set
      ? { [G.REGION_MATERIALS[set.region]]: (8 + set.region * 4) * gear.tier }
      : {};
  const reason = !gear
    ? '装备已不在仓库'
    : !set
      ? '请选择有效套装'
      : !G.regionOpen(s, set.region) || s.guild.depths[set.region] < 1
        ? '先击败该地区第一处守敌，取得套装纹样'
        : G.gearAway(s, gearId)
          ? '装备正在出征，归来后才能重制'
          : gear.setId === setId
            ? '已经属于这套装备'
            : gear.locked
              ? '先取消收藏，再重制套装'
              : G.salvageCount(s, rarity) < essences.amount
                ? `${essences.name}不足：需要 ${essences.amount}`
                : G.materialReason(s, materials) ||
                  (!G.canPay(s, cost) ? `资源不足：${G.costText(cost)}` : '');
  return { cost, materials, essences, reason };
}
export function reforgeGearSet(s0: G.State, gearId: string, setId: string) {
  const bill = setReforgePreview(s0, gearId, setId);
  if (bill.reason) return s0;
  const s = G.clone(s0);
  for (const [key, amount] of Object.entries(bill.cost))
    s.resources[key as G.Resource] -= amount!;
  G.spendMaterials(s, bill.materials);
  s.guild.salvage ??= G.freshSalvage();
  s.guild.salvage[bill.essences.rarity] -= bill.essences.amount;
  const gear = s.guild.inventory.find((item) => item.id === gearId)!;
  gear.setId = setId;
  G.log(
    s,
    `${G.gearName(gear)}已重制为「${G.EQUIPMENT_SETS.find((set) => set.id === setId)!.name}」；品质、阶级、词条与强化保留。`,
    'good',
  );
  return s;
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
  const profile = dropProfile(s, region, kind, s.battle?.node ?? 0, firstClear);
  if (!profile.guaranteed && random() >= profile.chance) return;
  const n = random(),
    rarity = rollDropRarity(profile, n),
    slot = G.GEAR_SLOTS[Math.floor(random() * 6)],
    recipes = G.RECIPES.filter(
      (recipe) =>
        recipe.slot === slot &&
        (recipe.chapter === 0 || !G.recipeUnlockReason(s, recipe.id)),
    );
  const item: G.Gear = {
    id: `gear-${++s.guild.serial}`,
    recipe: recipes[Math.floor(random() * recipes.length)].id,
    tier: profile.tier,
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
  const receipt = G.recordLoot(
    s,
    item,
    kind,
    `${G.REGIONS[region].name} · ${s.battle?.enemyName || (kind === 'boss' ? '首领' : '据点守敌')}`,
  );
  G.log(
    s,
    `${kind === 'boss' ? '首领战利品' : '守敌掉落'}：${G.gearName(item)}。`,
    rarity >= 5 ? 'story' : 'good',
  );
  return receipt;
}
