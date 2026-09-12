import * as G from './realm.ts';
import * as D from './guild-data.ts';
import * as C from './campaign.ts';
import { originEffect } from './origins.ts';
import * as Skills from './skill-data.ts';
import { TALENT_RARITY_WEIGHTS } from './talent-data.ts';
import { GEAR_SLOTS, INVENTORY_CAP, RARITY_SCALE } from './equipment-data.ts';
import { gearTierScale, EQUIPMENT_DEFENSE_SCALE } from './equipment-growth.ts';
import { freshPotions, hasPreparedPotion, validatePotions } from './alchemy.ts';
import { masteryCost, masteryMaterials, masteryReason } from './mastery.ts';
export * from './mastery.ts';
import { freshSalvage, validateSalvage, bulkDismantleGear, reforgeQuote, type DismantleOptions } from './equipment-management.ts';
import { recordLoot, validateLoot } from './loot.ts';
import { freshAchievements, validateAchievements } from './achievements.ts';
import { dropProfile, rollDropRarity, type DropProfile } from './drop-progression.ts';
export { EQUIPMENT_BASE_SCALE, EQUIPMENT_DEFENSE_SCALE, gearTierScale } from './equipment-growth.ts';
export * from './skill-data.ts';
export { talentExperience, talentTraining } from './buildcraft.ts';
export const FIVE_STAR_PITY = 80;
import type { HeroId, Cost } from './realm-data.ts';

export function freshGuild(): G.State['guild'] {
  return {
    guardianHunts: { readyAt: [0, 0, 0, 0, 0, 0] },
    applicants: [],
    refreshAt: 0,
    rolls: 0,
    fiveStarMisses: 0,
    serial: 0,
    inventory: [],
    salvage: freshSalvage(),
    lootHistory: [],
    lootReadSerial: 0,
    lootSerial: 0,
    achievements: freshAchievements(),
    potions: freshPotions(),
    crafts: 0,
    dust: 0,
    depths: [0, 0, 0, 0, 0, 0],
    progress: [0, 0, 0, 0, 0, 0],
    intel: [0, 0, 0, 0, 0, 0],
    failures: [0, 0, 0, 0, 0, 0],
    outposts: [0, 0, 0, 0, 0, 0],
    doctrine: { logistics: 0, smithing: 0, scholarship: 0 },
    preparation: { stance: 'balanced', element: 'physical', remedy: false },
  };
}
export function guildRandom(s: G.State) {
  let x = s.rng;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  s.rng = x >>> 0;
  return s.rng / 4294967296;
}
const roll = (s: G.State, n: number) => Math.floor(guildRandom(s) * n);
function randomTalent(s: G.State) {
  const n = guildRandom(s) * 100;
  let total = 0;
  const rarity =
    TALENT_RARITY_WEIGHTS.findIndex((weight) => (total += weight) > n) + 1;
  const pool = D.TALENTS.filter((t) => t.rarity === rarity);
  return pool[roll(s, pool.length)].id;
}
const say = (s: G.State, text: string) => {
  s.log.unshift({ time: s.time, text, kind: 'good' });
  s.log = s.log.slice(0, 100);
};
const spend = (s: G.State, c: Cost) => {
  for (const [k, v] of Object.entries(c)) s.resources[k as G.Resource] -= v!;
};
export function heroDefinition(s: G.State, id: string) {
  const h =
    s.heroes.find((h) => h.id === id) ||
    s.guild.applicants.find((h) => h.id === id);
  const d = G.HEROES.find((d) => d.id === (h?.role || id)) || G.HEROES[0];
  const skill = Skills.selectedSkill(d.id, h?.activeSkill)!;
  return {
    ...d,
    skill: skill.name,
    skillText: skillHelp(skill.id).body,
    energy: skill.energy,
    cooldown: skill.cooldown,
    name: h?.name || d.name,
    initial: (h?.name || d.name).slice(0, 1),
  };
}
export function heroSkill(h: Pick<G.Hero, 'role' | 'activeSkill'>) {
  return Skills.selectedSkill(h.role, h.activeSkill)!;
}
export function skillHelp(id: Skills.SkillId) {
  const skill: Skills.SkillDefinition = Skills.SKILLS.find((s) => s.id === id)!;
  const heal = skill.healing;
  return {
    title: skill.name,
    body:
      skill.description +
      '\n' +
      skill.energy +
      ' 点共享士气 · 个人冷却 ' +
      skill.cooldown +
      ' 完整回合。' +
      (heal
        ? '\n治疗 = 本人生命×' +
          Math.round(heal.actorHp * 100) +
          '% + 本人攻击×' +
          Math.round(heal.actorAttack * 100) +
          '% + 目标生命上限×' +
          Math.round(heal.targetHp * 100) +
          '%。'
        : '\n伤害只由施技者的攻击、穿甲、暴击与目标防御决定。') +
      '\n根技能始终可用，另可携带已学分支技能，Lv.20开放第二分支技能栏；冷却在完整回合结束时计算。',
  };
}
export function setHeroSkill(s0: G.State, id: string, skillId: string) {
  const h = s0.heroes.find((h) => h.id === id),
    skill = h && Skills.selectedSkill(h.role, skillId);
  if (
    !h ||
    !skill ||
    !G.unlockedSkills(h).some((item) => item.id === skillId) ||
    heroAway(s0, id) ||
    heroSkill(h).id === skillId
  )
    return s0;
  const s = G.clone(s0);
  const hero = s.heroes.find((h) => h.id === id)!;
  hero.activeSkill = skill.id;
  if (hero.secondarySkill === skill.id) delete hero.secondarySkill;
  say(s, h.name + '改为携带「' + skill.name + '」。');
  return s;
}
/** Party membership stays frozen while away; town residents and their gear remain editable. */
export function heroAway(s: G.State, id: string) {
  return !!s.worldExploration?.activeRun?.partyIds.includes(id) || !!(s.expedition || s.battle) && s.party.includes(id);
}
export function heroAwayReason(s: G.State, id: string) {
  return heroAway(s, id) ? '该角色正在出征，归来后可调整' : '';
}
export function gearAway(s: G.State, id: string) {
  return s.heroes.some(
    (h) => heroAway(s, h.id) && Object.values(h.equipment).includes(id),
  );
}
export function hasRole(s: G.State, role: HeroId) {
  return s.party.some((id) => s.heroes.find((h) => h.id === id)?.role === role);
}
export function hasTalent(s: G.State, talent: D.TalentId) {
  return s.party.some(
    (id) => s.heroes.find((h) => h.id === id)?.talent === talent,
  );
}
export function recruitmentCost(h: G.Hero): Cost {
  return {
    gold: Math.ceil((18 + h.level * 7) * (1 + (h.quality - 1) * 0.18)),
    food: 8 + h.level * 2,
  };
}
export function refreshCost(s: G.State): Cost {
  return s.time >= s.guild.refreshAt
    ? {}
    : { gold: 20 + s.cleared.length * 25 };
}
export function roleOpen(s: G.State, role: HeroId) {
  if (role === 'nyx' || role === 'sylva') return C.townRank(s) >= 1;
  if (role === 'vera') return C.townRank(s) >= 2;
  return (
    ['rhea', 'finn', 'luna', 'kael'].includes(role) ||
    (role === 'orin' ? s.cleared.length >= 1 : s.cleared.length >= 3)
  );
}
export function makeApplicant(s: G.State, role?: HeroId): G.Hero {
  const pool = G.HEROES.filter((h) => roleOpen(s, h.id));
  const cls = role || pool[roll(s, pool.length)].id;
  const q = guildRandom(s);
  let cumulative = 0;
  const weights = G.recruitmentWeights(s);
  const quality =
    s.guild.fiveStarMisses >= FIVE_STAR_PITY - 1 && weights[4] > 0
      ? 5
      : weights.findIndex((w) => (cumulative += w) > q * 100) + 1;
  s.guild.fiveStarMisses =
    quality === 5 ? 0 : Math.min(79, (s.guild.fiveStarMisses || 0) + 1);
  const names = [
    '艾琳',
    '洛克',
    '米拉',
    '西恩',
    '菲雅',
    '莱特',
    '诺娅',
    '格雷',
    '薇拉',
    '瑞恩',
    '塞拉',
    '阿洛',
    '伊芙',
    '索恩',
    '莉娅',
    '尤恩',
    '奥莉',
    '卡尔',
    '尼娅',
    '雷恩',
  ];
  const surnames = [
    '·灰溪',
    '·渡鸦',
    '·雪松',
    '·长风',
    '·赤叶',
    '·曙光',
    '·石桥',
    '·黑橡',
    '·星渡',
    '·铜铃',
  ];
  const origins = [
    '边境流民',
    '旧王国佣兵',
    '山地猎户',
    '行商护卫',
    '学徒出身',
    '隐修者',
  ];
  const hp = 80 + roll(s, 51),
    attack = 80 + roll(s, 51),
    defense = 80 + roll(s, 51);
  return {
    id: `traveler-${++s.guild.serial}`,
    role: cls,
    name: names[roll(s, names.length)] + surnames[roll(s, surnames.length)],
    origin: origins[roll(s, origins.length)],
    quality,
    aptitude: { hp, attack, defense },
    talent: randomTalent(s),
    talentVersion: 2,
    flaw: 'overcome',
    mastery: 0,
    equipment: {},
    level: Math.max(1, s.cleared.length * 3),
    xp: 0,
    weapon: 0,
    armor: 0,
  };
}
export function ensureApplicants(s: G.State) {
  if (s.buildings.tavern && !s.guild.rolls) {
    s.guild.applicants = [
      makeApplicant(s, 'rhea'),
      makeApplicant(s, 'finn'),
      makeApplicant(s),
    ];
    s.guild.rolls = 1;
    s.guild.refreshAt = s.time + 600;
  }
}
export function refreshApplicants(s0: G.State, requested?: HeroId) {
  if (
    !s0.buildings.tavern ||
    !!G.recruitmentRefreshReason(s0) ||
    (requested && !roleOpen(s0, requested)) ||
    !G.canPay(s0, refreshCost(s0))
  )
    return s0;
  const s = G.clone(s0);
  spend(s, refreshCost(s0));
  if (s0.time < s0.guild.refreshAt) s.civic.invitations--;
  s.guild.applicants = [
    makeApplicant(s, requested),
    makeApplicant(s),
    makeApplicant(s),
  ];
  s.guild.rolls++;
  if (s.guild.rolls % 4 === 0)
    s.guild.applicants[0].quality = Math.max(3, s.guild.applicants[0].quality);
  s.guild.refreshAt = s.time + 600;
  say(
    s,
    '新一批旅人抵达酒馆。名字、资质与天赋已记录，利弊伴生，不会因读档改变。',
  );
  return s;
}
export function hireApplicant(s0: G.State, id: string) {
  const h =
    s0.guild.applicants.find((h) => h.id === id) ||
    s0.guild.applicants.find((h) => h.role === id);
  if (
    !h ||
    !s0.buildings.tavern ||
    s0.heroes.length >= 12 ||
    !G.canPay(s0, recruitmentCost(h))
  )
    return s0;
  const s = G.clone(s0);
  spend(s, recruitmentCost(h));
  s.heroes.push(structuredClone(h));
  s.guild.applicants = s.guild.applicants.filter((x) => x.id !== h.id);
  if (s.party.length < 4 && !s.expedition && !s.battle && !s.worldExploration.activeRun) s.party.push(h.id);
  say(
    s,
    `${h.name}加入名册，携带天赋「${D.TALENTS.find((t) => t.id === h.talent)!.name}」。${G.characterTalentHelp(h).body.split('\n')[0]}`,
  );
  return s;
}
export function dismissHero(s0: G.State, id: string) {
  const h = s0.heroes.find((h) => h.id === id);
  if (!h || heroAway(s0, id)) return s0;
  const s = G.clone(s0);
  s.heroes = s.heroes.filter((h) => h.id !== id);
  const credit = {
    gold: Math.floor((h.trainingInvestment?.gold || 0) * 0.8),
    food: Math.floor((h.trainingInvestment?.food || 0) * 0.8),
  };
  s.civic.trainingCredit.gold = Math.min(
    1e8,
    s.civic.trainingCredit.gold + credit.gold,
  );
  s.civic.trainingCredit.food = Math.min(
    1e8,
    s.civic.trainingCredit.food + credit.food,
  );
  for (const [duty, hero] of Object.entries(s.economy.duties))
    if (hero === id) delete s.economy.duties[duty as G.Duty];
  for (const [relic, hero] of Object.entries(s.worldExploration.relics.combat))
    if (hero === id) delete s.worldExploration.relics.combat[relic];
  s.party = s.party.filter((x) => x !== id);
  say(
    s,
    `${h.name}离开公会，装备归还仓库；留下 ${credit.gold} 金、${credit.food} 粮的训练抵扣，仅返还实际训练支付的80%。`,
  );
  return s;
}
export function mentorHero(s0: G.State, id: string, overcome = false) {
  const h = s0.heroes.find((h) => h.id === id);
  if (!h || heroAway(s0, id) || s0.buildings.tavern < 2) return s0;
  const cost = overcome ? { gold: 120, food: 60 } : masteryCost(h);
  if (
    (overcome ? h.flaw === 'overcome' : !!masteryReason(s0, h)) ||
    !G.canPay(s0, cost)
  )
    return s0;
  const s = G.clone(s0);
  spend(s, cost);
  if (!overcome) C.spendMaterials(s, masteryMaterials(s0, h));
  const hero = s.heroes.find((h) => h.id === id)!;
  if (overcome) hero.flaw = 'overcome';
  else hero.mastery++;
  say(
    s,
    `${hero.name}${overcome ? '克服了原有缺点' : `完成第 ${hero.mastery} 阶专精培养，原生生命、攻击与防御永久 +4%`}。`,
  );
  return s;
}
export function gearName(item: D.Gear) {
  return `${D.QUALITY_NAMES[item.rarity - 1]}·${item.setId ? (G.EQUIPMENT_SETS.find((x) => x.id === item.setId)?.name || '') + '·' : ''}${D.AFFIXES[item.affix].name}${D.RECIPES.find((r) => r.id === item.recipe)!.name} T${item.tier}${item.upgrade ? ` +${item.upgrade}` : ''}`;
}
export function itemStats(s: G.State, item: D.Gear, includeAffix = true) {
  const r = D.RECIPES.find((r) => r.id === item.recipe)!;
  const scale =
    gearTierScale(item.tier) *
    RARITY_SCALE[item.rarity - 1] *
    (1 + item.upgrade * 0.08) *
    (1 + s.guild.doctrine.smithing * 0.05);
  const stats = {
    attack: r.attack * scale,
    hp: r.hp * scale,
    defense: r.defense * scale * EQUIPMENT_DEFENSE_SCALE,
    pierce: r.pierce,
    ranged: r.ranged,
    fire: r.fire,
    shadow: r.shadow,
    radiant: r.radiant,
    crit: 0,
    dodge: 0,
    critDamage: 0,
  };
  const a = D.AFFIXES[item.affix];
  if (!includeAffix) return stats;
  if (a.stat === 'attack') stats.attack += 8 * scale;
  else if (a.stat === 'hp') stats.hp += 20 * scale;
  else stats[a.stat] += a.value;
  return stats;
}
export const POTENTIAL_GROWTH = [1, 1.35, 1.85, 2.6, 3.6] as const;

export function individualStats(s: G.State, h: G.Hero) {
  const d = G.HEROES.find((d) => d.id === h.role)!;
  const potential = POTENTIAL_GROWTH[h.quality - 1];
  const initial = 1 + (h.quality - 1) * 0.03;
  const mastery = 1 + h.mastery * 0.04;
  const levels = h.level - 1;
  const role = G.TREE_ROLES.find((role) => role.id === h.role)!;
  const tree = G.skillBonuses(h);
  // Aptitude and mastery improve native stats; equipment remains an additive path.
  // Legacy gear receives the small initial multiplier to avoid old-save regressions.
  const stats = {
    hp:
      ((((d.hp + h.armor * 30) * initial + levels * 24 * potential) *
        h.aptitude.hp) /
        100) *
      mastery,
    attack:
      ((((d.atk + h.weapon * 5) * initial + levels * 5 * potential) *
        h.aptitude.attack) /
        100) *
      mastery,
    defense:
      ((((d.def + h.armor * 2) * initial + levels * 0.8 * potential) *
        h.aptitude.defense) /
        100) *
      mastery,
    pierce: 0,
    ranged: Number(role.ranged),
    fire: 0,
    shadow: 0,
    radiant: 0,
    crit: Number(role.crit),
    dodge: Number(role.dodge),
    critDamage: 1.5,
  };
  for (const id of Object.values(h.equipment)) {
    const item = s.guild.inventory.find((g) => g.id === id);
    if (item) {
      const a = itemStats(s, item);
      for (const k of Object.keys(a) as (keyof typeof a)[]) stats[k] += a[k];
    }
  }
  const origin = originEffect(h);
  stats.hp *= origin.hp;
  stats.attack *= origin.attack;
  stats.defense *= origin.defense;
  stats.pierce += origin.pierce;
  stats.ranged += origin.ranged;
  stats.fire += origin.resistance;
  stats.shadow += origin.resistance;
  stats.radiant += origin.resistance;
  stats.hp *= 1 + tree.hp;
  stats.attack *= 1 + tree.attack;
  stats.defense *= 1 + tree.defense;
  stats.crit = Math.min(0.6, stats.crit + tree.crit);
  stats.dodge = Math.min(0.4, stats.dodge + tree.dodge);
  stats.critDamage = Math.min(3, stats.critDamage + tree.critDamage);
  const build = G.buildBonuses(s, h);
  for (const key of ['hp', 'attack', 'defense'] as const)
    stats[key] *= 1 + (build[key] || 0);
  for (const key of [
    'pierce',
    'crit',
    'dodge',
    'critDamage',
    'fire',
    'shadow',
    'radiant',
  ] as const)
    stats[key] += build[key] || 0;
  if (!h.talentVersion && h.flaw === 'reckless') stats.defense -= 2;
  stats.crit = Math.max(0, Math.min(0.6, stats.crit));
  stats.dodge = Math.max(0, Math.min(0.4, stats.dodge));
  stats.critDamage = Math.max(1, Math.min(3, stats.critDamage));
  stats.defense = Math.max(0, stats.defense);
  for (const k of ['fire', 'shadow', 'radiant', 'pierce'] as const)
    stats[k] = Math.max(0, Math.min(0.75, stats[k]));
  stats.ranged = Math.min(1, stats.ranged);
  return stats;
}
export function partyProfile(s: G.State) {
  const members = s.party
    .map((id) => s.heroes.find((h) => h.id === id))
    .filter((h): h is G.Hero => !!h);
  const stats = members.map((h) => individualStats(s, h));
  const count = Math.max(1, stats.length),
    attack = stats.reduce((v, h) => v + h.attack, 0) || 1;
  return {
    fire: stats.reduce((v, h) => v + h.fire, 0) / count,
    shadow: stats.reduce((v, h) => v + h.shadow, 0) / count,
    radiant: stats.reduce((v, h) => v + h.radiant, 0) / count,
    pierce: stats.reduce((v, h) => v + h.pierce * h.attack, 0) / attack,
    ranged: stats.reduce((v, h) => v + h.ranged * h.attack, 0) / attack,
  };
}
export function recipeCost(s: G.State, id: string, tier = C.gearTier(s)): Cost {
  const r = D.RECIPES.find((r) => r.id === id)!;
  if (tier === 1) {
    const starter: Record<string, Cost> = {
      blade: { wood: 90, stone: 45, gold: 45 },
      bow: { wood: 120, food: 45, gold: 50 },
      plate: { wood: 60, stone: 80, gold: 55 },
      vitality: { stone: 60, food: 60, gold: 55 },
    };
    return (
      starter[id] ||
      Object.fromEntries(
        Object.entries(r.cost).map(([k, v]) => [k, Math.ceil(v! * 2.4)]),
      )
    );
  }
  const n = Math.max(2, Math.min(6, tier)),
    magic = ['staff', 'shadowcoat', 'dawncoat', 'wardstone'].includes(id);
  const raw =
    [0, 0, 40, 100, 240, 500, 1000][n] *
    (r.slot === 'armor' ? 1.25 : r.slot === 'charm' ? 0.65 : 1);
  return {
    wood: [0, 0, 180, 420, 1000, 2200, 5000][n],
    gold: Math.ceil(
      [0, 0, 160, 400, 1000, 2200, 5000][n] * (r.slot === 'armor' ? 1.1 : 1),
    ),
    [magic ? 'crystal' : 'iron']: Math.ceil(raw * (magic ? 0.5 : 1)),
  };
}
export function forgeReason(s: G.State, id: string, tier = C.gearTier(s)) {
  const r = D.RECIPES.find((r) => r.id === id);
  if (!r) return '未知配方';
  if (!s.buildings.tavern) return '需要酒馆组织手工工坊';
  if (!Number.isInteger(tier) || tier < 1 || tier > C.gearTier(s))
    return '需要先掌握对应工艺';
  const unlock = C.recipeUnlockReason(s, id);
  if (unlock) return unlock;
  if (r.chapter && !s.buildings.forge) return '需要锻造坊';
  if (s.guild.inventory.length >= INVENTORY_CAP - Number(!!s.battle))
    return s.battle
      ? '为当前战斗的战利品保留最后1格，请先整理装备'
      : '装备库已满120件，请先拆解';
  return (
    G.capacityReason(s, recipeCost(s, id, tier)) ||
    C.materialReason(s, C.recipeMaterialCost(s, id, tier))
  );
}
function newGear(s: G.State, recipe: string, tier: number, profile?: DropProfile) {
  const n = guildRandom(s);
  return {
    id: `gear-${++s.guild.serial}`,
    recipe,
    tier,
    rarity: profile ? rollDropRarity(profile, n) : n < 0.5 ? 1 : n < 0.8 ? 2 : n < 0.95 ? 3 : n < 0.99 ? 4 : 5,
    affix: roll(s, D.AFFIXES.length),
    upgrade: 0,
  };
}
export function craftGear(s0: G.State, id: string, tier = C.gearTier(s0)) {
  if (forgeReason(s0, id, tier) || !G.canPay(s0, recipeCost(s0, id, tier)))
    return s0;
  const s = G.clone(s0);
  spend(s, recipeCost(s, id, tier));
  C.spendMaterials(s, C.recipeMaterialCost(s, id, tier));
  const item = newGear(s, id, tier);
  s.guild.crafts++;
  if (s.guild.crafts % 4 === 0) item.rarity = Math.max(3, item.rarity);
  s.guild.inventory.push(item);
  recordLoot(s, item, 'forge', '城镇锻造');
  say(s, `锻造完成：${gearName(item)}。每四次锻造至少获得一件稀有品质。`);
  return s;
}
export function equipGear(s0: G.State, heroId: string, itemId: string) {
  const h = s0.heroes.find((h) => h.id === heroId),
    item = s0.guild.inventory.find((g) => g.id === itemId);
  if (!h || !item || heroAway(s0, heroId) || gearAway(s0, itemId)) return s0;
  const slot = D.RECIPES.find((r) => r.id === item.recipe)!.slot,
    s = G.clone(s0);
  for (const member of [...s.heroes, ...s.guild.applicants])
    if (member.equipment[slot] === itemId) delete member.equipment[slot];
  s.heroes.find((h) => h.id === heroId)!.equipment[slot] = itemId;
  say(s, `${h.name}装备了${gearName(item)}。`);
  return s;
}
export function unequipGear(s0: G.State, id: string, slot: D.GearSlot) {
  if (
    heroAway(s0, id) ||
    ![...s0.heroes, ...s0.guild.applicants].some((h) => h.id === id && h.equipment[slot])
  )
    return s0;
  const s = G.clone(s0);
  delete [...s.heroes, ...s.guild.applicants].find((h) => h.id === id)!.equipment[slot];
  return s;
}
export function unequipAllGear(s0: G.State, id: string) {
  const h = [...s0.heroes, ...s0.guild.applicants].find((h) => h.id === id);
  if (!h || heroAway(s0, id) || !Object.keys(h.equipment).length) return s0;
  const s = G.clone(s0);
  [...s.heroes, ...s.guild.applicants].find((h) => h.id === id)!.equipment = {};
  say(s, `${h.name}卸下全部个人装备，物品已归还装备库。`);
  return s;
}
export function enhancementCost(item: D.Gear): Cost {
  return {
    iron: 8 * item.tier * (item.upgrade + 1),
    gold: 15 * item.tier * (item.upgrade + 1),
    ...(item.upgrade >= 3
      ? { crystal: 5 * item.tier * (item.upgrade - 2) }
      : {}),
  };
}
export function enhancementMaterials(
  s: G.State,
  item: D.Gear,
): import('./campaign-data.ts').MaterialCost {
  return item.upgrade < 3
    ? {}
    : {
        [s.world.tech.includes('metallurgy') ? 'steel' : 'runes']:
          (item.upgrade - 2) * item.tier * 2,
      };
}
export function enhanceGear(s0: G.State, id: string) {
  const item = s0.guild.inventory.find((g) => g.id === id);
  if (
    !item ||
    gearAway(s0, id) ||
    item.upgrade >= 8 ||
    !G.canPay(s0, enhancementCost(item)) ||
    !C.canAffordMaterials(s0, enhancementMaterials(s0, item))
  )
    return s0;
  const s = G.clone(s0);
  spend(s, enhancementCost(item));
  C.spendMaterials(s, enhancementMaterials(s, item));
  s.guild.inventory.find((g) => g.id === id)!.upgrade++;
  say(
    s,
    `强化成功：${gearName(s.guild.inventory.find((g) => g.id === id)!)}。`,
  );
  return s;
}
export function dismantleGear(s0: G.State, id: string, options: DismantleOptions = {}) {
  return bulkDismantleGear(s0, [id], options);
}
export function reforgeGear(s0: G.State, id: string, affix: number) {
  const quote = reforgeQuote(s0, id, affix);
  if (quote.reason) return s0;
  const s = G.clone(s0);
  s.guild.dust -= quote.dust;
  s.guild.salvage ??= freshSalvage();
  s.guild.salvage[quote.rarity] -= quote.material;
  s.guild.inventory.find((g) => g.id === id)!.affix = affix;
  say(s, `定向重铸完成：${D.AFFIXES[affix].name}。`);
  return s;
}
export function expeditionEquipment(
  s: G.State,
  region: number,
  depth: number,
  guaranteed = false,
) {
  const profile = dropProfile(s, region, 'expedition', depth, guaranteed);
  if (!profile.guaranteed && guildRandom(s) >= profile.chance) return '';
  const localRecipes = [
    ['blade', 'bow', 'plate', 'vitality'],
    ['staff', 'shadowcoat', 'wardstone'],
    ['pike', 'plate'],
    ['shadowcoat', 'dawncoat'],
    ['firecoat', 'bow'],
    ['dawncoat', 'wardstone'],
  ][region];
  // Finding a local item does not require already knowing how to forge it.
  const recipes = D.RECIPES.filter((r) => localRecipes.includes(r.id));
  if (!recipes.length) return '';
  const item = newGear(
    s,
    recipes[roll(s, recipes.length)].id,
    profile.tier,
    profile,
  );
  if (guaranteed) item.rarity = Math.max(3, item.rarity);
  if (s.guild.inventory.length < INVENTORY_CAP) {
    s.guild.inventory.push(item);
    G.recordLoot(s, item, 'expedition', `${G.REGIONS[region].name} · 远征收获`);
    return gearName(item);
  }
  const value = G.salvageYield(item);
  const dust = Math.min(9999 - s.guild.dust, value.dust);
  const material = Math.min(G.SALVAGE_CAP - G.salvageCount(s, item.rarity), value.material);
  s.guild.salvage ||= G.freshSalvage();
  s.guild.dust += dust;
  s.guild.salvage[item.rarity as keyof typeof s.guild.salvage] += material;
  const receipt = G.recordLoot(s, item, 'expedition', `${G.REGIONS[region].name} · 远征收获`, 'converted', {
    dust, rarity: item.rarity, material, lostDust: value.dust - dust, lostMaterial: value.material - material,
  });
  return `${gearName(item)}；${G.lootOutcomeText(receipt)}`;
}
export function doctrineCost(
  s: G.State,
  id: keyof G.State['guild']['doctrine'],
): Cost {
  const n = s.guild.doctrine[id] + 1;
  return {
    wood: Math.ceil(70 * n ** 1.6),
    gold: Math.ceil(90 * n ** 1.8),
    ...(id === 'smithing' ? { iron: 20 * n } : { stone: 50 * n }),
  };
}
export function studyDoctrine(
  s0: G.State,
  id: keyof G.State['guild']['doctrine'],
) {
  if (
    !Object.hasOwn(s0.guild.doctrine, id) ||
    !s0.buildings.tavern ||
    s0.guild.doctrine[id] >= Math.min(10, 2 + C.townRank(s0) * 2) ||
    !G.canPay(s0, doctrineCost(s0, id))
  )
    return s0;
  const s = G.clone(s0);
  spend(s, doctrineCost(s, id));
  s.guild.doctrine[id]++;
  return s;
}
export function outpostCost(s: G.State, r: number): Cost {
  const n = s.guild.outposts[r] + 1,
    m = (r + 1) ** 1.4 * n ** 1.6;
  return {
    wood: Math.ceil(90 * m),
    stone: Math.ceil(70 * m),
    gold: Math.ceil(60 * m),
  };
}
export function buildOutpost(s0: G.State, r: number) {
  if (
    !G.regionOpen(s0, r) ||
    s0.battle ||
    s0.guild.depths[r] < 1 ||
    s0.guild.outposts[r] >= 3 ||
    !G.canPay(s0, outpostCost(s0, r))
  )
    return s0;
  const s = G.clone(s0);
  spend(s, outpostCost(s, r));
  s.guild.outposts[r]++;
  say(
    s,
    `${G.REGIONS[r].name}驻地升至 ${s.guild.outposts[r]} 级：收益 +25%、补给消耗 -10%，决战承伤进一步减少。`,
  );
  return s;
}
export function frontierInfo(s: G.State, r: number) {
  const depth = s.guild.depths[r];
  const intel = s.guild.intel[r];
  const required = D.FRONTIER_REQUIREMENTS[Math.min(4, depth)];
  const power = G.partyStats(s).power;
  const base = G.REGIONS[r].power * [1, 1.4, 1.9, 2.5, 3.2][Math.min(4, depth)];
  const profile = partyProfile(s);
  const element = D.ENEMIES[r].element;
  const resist = element === 'physical' ? 0 : profile[element];
  const effective = power * (1 + resist * 0.55 + profile.pierce * 0.25);
  // Never round the comparison or probability. Display precision is separate.
  const ratio = effective / base;
  const rawChance =
    0.55 +
    (ratio - 1) * 0.32 +
    intel * 0.0015 +
    s.guild.outposts[r] * 0.04 +
    s.guild.failures[r] * 0.08 +
    (s.guild.preparation.stance === 'cautious' ? 0.08 : 0);
  const guaranteed = ratio >= 2 || s.guild.failures[r] >= 3 || rawChance >= 1;
  const chance = guaranteed ? 1 : Math.max(0.15, rawChance);
  // At ratio >= 4 one successful expedition completes the current layer.
  // For fixed preparation/depth, each improvement in ratio never reduces progress.
  const progress = Math.min(
    required,
    Math.max(
      8,
      Math.ceil(
        14 +
          intel / 10 +
          s.guild.outposts[r] * 3 +
          (Math.max(0, ratio - 1) * required) / 3,
      ),
    ),
  );
  return {
    depth,
    name: D.FRONTIERS[r][Math.min(4, depth)],
    required,
    power: Math.ceil(base),
    effective: Math.round(effective),
    chance,
    progress,
    guaranteed,
    ratio,
  };
}
export function settleFrontier(s: G.State, e: G.Expedition) {
  let progress = 0;
  if (e.route === 'survey') {
    s.guild.intel[e.region] = Math.min(
      100,
      s.guild.intel[e.region] +
        4 +
        s.guild.doctrine.scholarship * 2 +
        (hasTalent(s, 'scholar') ? 3 : 0),
    );
  }
  if (e.route === 'frontier' && s.guild.depths[e.region] < 5) {
    if (e.success) {
      progress = Math.min(
        frontierInfo(s, e.region).progress,
        D.FRONTIER_REQUIREMENTS[s.guild.depths[e.region]] -
          s.guild.progress[e.region],
      );
      s.guild.progress[e.region] += progress;
      s.guild.failures[e.region] = 0;
      const need = D.FRONTIER_REQUIREMENTS[s.guild.depths[e.region]];
      s.guild.progress[e.region] = Math.min(need, s.guild.progress[e.region]);
      if (s.guild.progress[e.region] >= need)
        say(
          s,
          '道路已抵达守敌：' +
            D.FRONTIERS[e.region][s.guild.depths[e.region]] +
            '。击败守敌才能占领据点。',
        );
    } else {
      s.guild.failures[e.region]++;
      s.guild.intel[e.region] = Math.min(100, s.guild.intel[e.region] + 2);
      const before = s.guild.progress[e.region];
      s.guild.progress[e.region] = Math.min(
        D.FRONTIER_REQUIREMENTS[s.guild.depths[e.region]] - 1,
        s.guild.progress[e.region] + 3,
      );
      progress = s.guild.progress[e.region] - before;
      say(
        s,
        `推进受挫，仍保留 ${progress} 点推进与 2 点情报。下次成功率 +8%，连续三次失败后下次必定成功。`,
      );
    }
  }
  return progress;
}
export function setPreparation(
  s0: G.State,
  patch: Partial<G.State['guild']['preparation']>,
) {
  if (s0.battle || s0.expedition) return s0;
  const next = { ...s0.guild.preparation, ...patch };
  if (
    !['balanced', 'cautious', 'assault'].includes(next.stance) ||
    !Object.hasOwn(D.ELEMENT_NAMES, next.element) ||
    typeof next.remedy !== 'boolean'
  )
    return s0;
  const s = G.clone(s0);
  s.guild.preparation = next;
  return s;
}
export function battlePreparationCost(s: G.State): Cost {
  const p = s.guild.preparation;
  return {
    food: G.battleFood(s) + (p.remedy ? 30 : 0),
    gold: p.remedy ? 25 : 0,
  };
}
export function battleModifiers(s: G.State, r: number) {
  const p = partyProfile(s),
    e = D.ENEMIES[r].element,
    prep = s.guild.preparation;
  return {
    resistance: Math.min(
      0.75,
      (e === 'physical' ? 0 : p[e]) +
        (hasPreparedPotion(s, e) ? 0.2 : 0),
    ),
    pierce: p.pierce,
    ranged: p.ranged,
    bonus:
      (1 +
        s.guild.intel[r] * 0.001 +
        (hasTalent(s, 'hunter') && [0, 4].includes(r) ? 0.12 : 0)) *
      (prep.stance === 'assault' ? 1.12 : prep.stance === 'cautious' ? 0.9 : 1),
  };
}
export const enemyArmor = (s: G.State, r: number) =>
  G.enemyDefinition(s, r, 'boss').defense * G.bossArmorScale(s, r);
export function legacyCharacter(h: {
  id: HeroId;
  level: number;
  xp: number;
  weapon: number;
  armor: number;
}): G.Hero {
  const d = G.HEROES.find((d) => d.id === h.id);
  if (!d) throw Error('旧伙伴职业无效');
  return {
    ...h,
    role: h.id,
    name: d.name,
    origin: '初代同行者',
    quality: 3,
    aptitude: { hp: 100, attack: 100, defense: 100 },
    talent: 'diligent',
    flaw: 'overcome',
    mastery: 0,
    equipment: {},
  };
}
export function migrateGuild(s: G.State) {
  s.guild = freshGuild();
  s.heroes = s.heroes.map((h) =>
    legacyCharacter(h as Parameters<typeof legacyCharacter>[0]),
  );
  for (const r of s.cleared) {
    s.guild.depths[r] = 5;
    s.guild.intel[r] = 100;
    s.guild.outposts[r] = 1;
  }
  s.battle = null;
  if (s.expedition) {
    s.expedition.chance = 1;
    s.expedition.success = true;
    s.expedition.depth = s.guild.depths[s.expedition.region];
  }
  if (s.lastExpedition) {
    s.lastExpedition.success = true;
    s.lastExpedition.progress = 0;
    s.lastExpedition.equipment = '';
  }
  ensureApplicants(s);
}
export function validateGuild(s: G.State) {
  const n = (x: unknown, min: number, max: number) =>
    typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;
  const i = (x: unknown, min: number, max: number) =>
    n(x, min, max) && Number.isInteger(x);
  const list = (x: unknown, max: number) => Array.isArray(x) && x.length <= max;
  const g = s.guild;
  if (
    g.guardianHunts !== undefined &&
    (!g.guardianHunts ||
      typeof g.guardianHunts !== 'object' ||
      Array.isArray(g.guardianHunts) ||
      Object.keys(g.guardianHunts).length !== 1 ||
      !list(g.guardianHunts.readyAt, 6) ||
      g.guardianHunts.readyAt.length !== 6 ||
      !g.guardianHunts.readyAt.every((v) => n(v, 0, 1e8)))
  )
    throw Error('守敌再战记录无效');
  if (
    g.bossHunts !== undefined &&
    (!g.bossHunts ||
      typeof g.bossHunts !== 'object' ||
      Array.isArray(g.bossHunts) ||
      Object.keys(g.bossHunts).length !== 2 ||
      !list(g.bossHunts.wins, 6) ||
      !list(g.bossHunts.readyAt, 6) ||
      g.bossHunts.wins.length !== 6 ||
      g.bossHunts.readyAt.length !== 6 ||
      !g.bossHunts.wins.every((v) => i(v, 0, 1e8)) ||
      !g.bossHunts.readyAt.every((v) => n(v, 0, 1e8)))
  )
    throw Error('首领狩猎记录无效');
  if (
    !g ||
    !list(g.applicants, 3) ||
    !list(g.inventory, INVENTORY_CAP) ||
    !i(g.serial, 0, 1e8) ||
    !i(g.rolls, 0, 1e8) ||
    !i(g.crafts, 0, 1e8) ||
    !i(g.dust, 0, 9999) ||
    !n(g.refreshAt, 0, 1e8)
  )
    throw Error('公会记录无效');
  for (const [values, max] of [
    [g.depths, 5],
    [g.progress, 260],
    [g.intel, 100],
    [g.failures, 3],
    [g.outposts, 3],
  ] as [number[], number][]) {
    if (
      !list(values, 6) ||
      values.length !== 6 ||
      values.some((v) => !i(v, 0, max))
    )
      throw Error('据点记录无效');
  }
  if (
    !g.doctrine ||
    Object.keys(g.doctrine).length !== 3 ||
    !['logistics', 'smithing', 'scholarship'].every((k) =>
      i(g.doctrine[k as keyof typeof g.doctrine], 0, 10),
    )
  )
    throw Error('学派记录无效');
  if (
    !g.preparation ||
    !['balanced', 'cautious', 'assault'].includes(g.preparation.stance) ||
    !Object.hasOwn(D.ELEMENT_NAMES, g.preparation.element) ||
    typeof g.preparation.remedy !== 'boolean'
  )
    throw Error('备战方案无效');
  validatePotions(s);
  validateSalvage(s);
  validateLoot(s);
  validateAchievements(s);
  // Old saves kept batches but not the history of five-star draws. Credit completed batches.
  // A still-visible five-star is the only recent result we can verify.
  if (!Object.hasOwn(g, 'fiveStarMisses')) {
    const latestFive = g.applicants.findLastIndex((h) => h.quality === 5);
    g.fiveStarMisses =
      latestFive >= 0
        ? g.applicants.length - 1 - latestFive
        : Math.min(FIVE_STAR_PITY - 1, g.rolls * 3);
  }
  if (!i(g.fiveStarMisses, 0, FIVE_STAR_PITY - 1))
    throw Error('五星保底记录无效');
  const people = [...s.heroes, ...g.applicants];
  if (new Set(people.map((h) => h.id)).size !== people.length)
    throw Error('旅人身份重复');
  for (const h of people) {
    if (
      !h ||
      typeof h.id !== 'string' ||
      h.id.length > 60 ||
      !G.HEROES.some((d) => d.id === h.role) ||
      !Skills.selectedSkill(h.role, h.activeSkill) ||
      typeof h.name !== 'string' ||
      h.name.length > 40 ||
      typeof h.origin !== 'string' ||
      h.origin.length > 40 ||
      !i(h.quality, 1, 5) ||
      !i(h.mastery, 0, 5) ||
      !h.aptitude ||
      Object.keys(h.aptitude).length !== 3 ||
      !['hp', 'attack', 'defense'].every((k) => Object.hasOwn(h.aptitude, k)) ||
      !Object.values(h.aptitude).every((v) => i(v, 80, 130)) ||
      !D.TALENTS.some((t) => t.id === h.talent) ||
      (h.talentVersion !== undefined && h.talentVersion !== 2) ||
      !(h.flaw === 'overcome' || D.FLAWS.some((f) => f.id === h.flaw)) ||
      !h.equipment ||
      Array.isArray(h.equipment) ||
      Object.keys(h.equipment).some(
        (k) => !GEAR_SLOTS.includes(k as D.GearSlot),
      )
    )
      throw Error('随机旅人数据无效');
    G.validateHeroTree(h);
  }
  if (new Set(g.inventory.map((x) => x.id)).size !== g.inventory.length)
    throw Error('装备身份重复');
  for (const x of g.inventory) {
    if (
      typeof x.id !== 'string' ||
      x.id.length > 60 ||
      !D.RECIPES.some((r) => r.id === x.recipe) ||
      !i(x.tier, 1, 6) ||
      !i(x.rarity, 1, 6) ||
      (x.locked !== undefined && typeof x.locked !== 'boolean') ||
      (x.setId !== undefined &&
        !G.EQUIPMENT_SETS.some((set) => set.id === x.setId)) ||
      !i(x.affix, 0, D.AFFIXES.length - 1) ||
      !i(x.upgrade, 0, 8)
    )
      throw Error('装备记录无效');
  }
  const serials = [
    ...people.map((h) => h.id),
    ...g.inventory.map((x) => x.id),
  ].map((id) => Number(/^(?:traveler|gear)-(\d+)$/.exec(id)?.[1] || 0));
  if (g.serial < Math.max(0, ...serials)) throw Error('公会身份序号无效');
  const worn: string[] = [];
  for (const h of people)
    for (const [slot, id] of Object.entries(h.equipment)) {
      const item = g.inventory.find((x) => x.id === id);
      if (
        !item ||
        D.RECIPES.find((r) => r.id === item.recipe)!.slot !== slot ||
        worn.includes(id)
      )
        throw Error('装备归属无效');
      worn.push(id);
    }
  for (const h of g.applicants)
    if (
      !i(h.level, 1, 40) ||
      !n(h.xp, 0, 20000) ||
      h.weapon !== 0 ||
      h.armor !== 0
    )
      throw Error('候选旅人成长无效');
}
export function recommendedCommand(s: G.State): G.Command {
  return G.autoCommand(s);
}
export function forecastBattle(
  s: G.State,
  r: number,
  plan: 'balanced' | 'attack' = 'balanced',
) {
  const reason = G.bossReason(s, r);
  if (reason)
    return {
      reason,
      win: false,
      rounds: 0,
      actions: 0,
      hp: 0,
      trace: [] as G.Command[],
    };
  let sim = G.startBattle(s, r),
    lastHp = sim.battle!.hp,
    rounds = 1;
  const trace: G.Command[] = [];
  while (sim.battle && trace.length < 500) {
    const command = plan === 'attack' ? 'attack' : recommendedCommand(sim);
    trace.push(command);
    const before = sim.battle.hp;
    rounds = sim.battle.round;
    sim = G.combat(sim, command);
    lastHp =
      sim.battle?.hp ??
      sim.lastBattle?.hp ??
      (sim.cleared.includes(r) ? before : 0);
  }
  return {
    reason: '',
    win: !!sim.lastBattle?.won,
    rounds,
    actions: trace.length,
    hp: lastHp,
    trace,
  };
}
export function resolveBattle(s0: G.State) {
  let s = s0;
  for (let n = 0; s.battle && n < 500; n++)
    s = G.combat(s, recommendedCommand(s));
  return s;
}
