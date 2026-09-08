import * as G from './realm.ts';

export type HelpText = { title: string; body: string };

/** Player-facing rules audited against realm.ts, guild.ts and campaign.ts. No RNG is consumed here. */
export const HELP = {
  fiveStarPity: {
    title: '五星大保底',
    body: '首次击败首领后开放五星；普通五星率随战绩由1%升到5%。连续79位未出五星，第80位必为五星，提前出现立即重置。解锁前仍记录未出五星人数，最多保存79位，解锁后生效。三人批次逐人计数，按出现结算，读档不重抽。四批一次首位至少三星。',
  },
  potential: {
    title: '潜力与星级',
    body: `1–5 星的升级成长倍率分别为 ${G.POTENTIAL_GROWTH.join(' / ')}。每升一级，基础生命、攻击、防御分别增加 24、5、0.8，再乘潜力、对应资质和专精倍率。初始职业属性另按每多一星 +3% 计算；个人装备在这之后加算。1–5星分别用白、绿、蓝、紫、金显示，同时保留星数。星级不会因训练或专精提升。低星升级便宜、经验更快，适合先培养推进。`,
  },
  aptitudes: {
    title: '三项资质',
    body: '体、攻、防资质分别决定对应原生属性，100 为标准、130 为标准的 1.30 倍。新旅人的三项资质各自抽取 80–130 的整数，不共用总点数。资质同时影响初始属性与升级成长，个人六槽装备随后另加。现有培养动作不会重新抽取资质。',
  },
  mastery: {
    title: '专精培养',
    body: '专精共五阶，每阶使原生生命、攻击、防御的倍率增加 4%，五阶为 1.20 倍，装备属性随后另加。需要 2 级酒馆；五阶分别需要角色 8、16、22、30、36 级，并逐步掌握地区工艺、击败首领、夺取天穹据点。每阶消耗基础物资、加工材料与地区材料，实际费用列在培养按钮旁；隐修者每项费用减少 15% 后向上取整。出征者归来后培养，留守者照常培养。旧手记中已完成的专精全部保留。',
  },
  xp: {
    title: '经验',
    body: '当前 L 级升到下一级需要 60 + 10L² 经验。出战成员领取完整经验，候补领取 40%，再乘酒馆倍率 1 + 酒馆等级 × 10%。勤勉另乘 1.30，缺乏历练另乘 0.90；学徒出身再乘1.25；再乘1–5星经验系数1.6 / 1.4 / 1.2 / 1.05 / 1，以及教育、酒馆改良和讲习加成；这些修正也用于首领胜利经验。达到阶段等级上限后，最多保留当前一级所需经验，不能无限囤积。',
  },
  levels: {
    title: '等级与训练',
    body: '六个城镇阶段的等级上限为 6 / 10 / 16 / 24 / 32 / 40，城镇进阶会提高上限。训练支付金币与口粮后直接升一级，已有经验保持原数值。L 级训练基础花费为向上取整的 30 + 20L^2.1 金，以及 20 + 10L 粮；勤勉先把金币费用乘 0.85 再取整。上述训练费用再乘1–5星系数0.4 / 0.55 / 0.75 / 1 / 1.2；临时便餐另减25%口粮，公会训练抵扣自动使用。退役返还真实支付训练费用的80%为专用抵扣，免费经验不返还。新招旅人的初始等级为已击败首领数 × 3，最低 1 级，出身不直接增加等级，但可改变训练费用和经验。',
  },
  origins: {
    title: '出身',
    body: '六种出身等机会抽取，分别影响个人生存、伤害、抗性、训练费用、经验或专精费用。悬停具体出身可看加成；效果计入角色面板，与潜力、资质和天赋独立。',
  },
  talent: {
    title: '天赋',
    body: '每位新旅人具有一个利弊统一的天赋；白、绿、蓝、紫、金概率40% / 30% / 20% / 8% / 2%，与潜力独立抽取。高稀有度更专门化，悬停具体名字查看收益和代价。队伍同名天赋不叠加，旧人物天赋与原特性合并说明并保留原效果。',
  },
  flaw: {
    title: '旧档特性',
    body: '新旅人不再独立抽取缺点，收益与代价统一在天赋中。旧角色原有特性随天赋一起说明，保留原效果；已经克服的特性不会重新出现。',
  },
  rarity: {
    title: '装备品质',
    body: '装备白/绿/蓝/紫/金/红六档，数值倍率1 / 1.15 / 1.30 / 1.45 / 1.65 / 1.85。锻造概率50% / 30% / 15% / 4% / 1%，不会出红；每4件至少1件蓝装。首领胜利必掉当地套装，蓝60%、紫30%、金8%、红2%；守敌40%掉绿蓝紫套装，第3守敌必掉至少蓝装。套装件数与品质独立，可混搭。',
  },
  craftPity: {
    title: '每四次锻造保底',
    body: '全局第 4、8、12……次锻造会把该件装备的品质至少提高到稀有，换配方或阶级不重置计数。此前抽到高品质也不会取消本次固定保底。保底锻造结果为稀有95%、史诗4%、传说1%，不提高史诗或传说概率。远征与首领掉落不占用这项锻造计数。',
  },
  tier: {
    title: '装备阶级',
    body: `装备是独立于潜力的成长来源。T1–T6 同配方的攻、血、防相对 T1 倍率为 ${Array.from({length:6},(_,i)=>(G.gearTierScale(i+1)/G.gearTierScale(1)).toFixed(2)).join(' / ')}，再乘品质、强化和工匠传承倍率；预览直接显示实际数值。各城镇阶段最高可制作 T1 / T1 / T2 / T3 / T4 / T6，已经开放的低阶仍可选择。阶级不放大抗性、穿甲或远程比例；高阶费用还需要工艺和地区材料。`,
  },
  enhancement: {
    title: '强化',
    body: '强化必定成功，最高 +8，数值倍率为 1 + 强化等级 × 8%，+8 时为 1.64 倍。它提升装备的基础攻、血、防以及锋锐、坚韧词条，不提升抗性、穿甲或远程比例。升到 +4 起还会消耗魔晶及精钢或符文，费用随阶级和强化等级增加。只锁定出征角色携带的装备，留守与闲置装备可强化。',
  },
  affix: {
    title: '装备词条',
    body: `每件新装备从 ${G.AFFIXES.length} 种词条中等机会抽取一种。锋锐提供额外攻击，坚韧提供额外生命，二者乘装备完整数值倍率；其余词条按标明的固定值加算。暴击率、闪避率、穿甲和抗性上的百分比直接加减当前数值，例如 10% 暴击率获得 +8% 后变为 18%。定向重铸消耗 40 × 装备阶级 × 品质序号的锻造尘，以及 2 × 装备阶级的同品质残片；白至红的品质序号为 1 至 6。只能用同品质装备的分解残片，低品质无法代付或向上合成。选定后必定改成该词条。收藏不影响重铸，出征角色的装备须等待归来。`,
  },
  dust: {
    title: '锻造尘',
    body: '分解每件装备获得 装备阶级 × 品质序号 × 4 点锻造尘，以及等于装备阶级数量的同品质残片。六种残片独立保存，只用于同品质装备的定向重铸。锻造尘及每种残片上限均为 9999。批量分解默认保护套装、强化装备；已穿戴与收藏装备始终受到保护。主动分解若任一产物容量不足，默认整批不执行；只有在确认页明确允许丢弃超量材料，才按显示的实际入库量与损失执行。装备库满 120 件时，新掉落会转为对应产物，收获记录显示实际入库与超量损失。分解不返还制作、强化或重铸的原消耗。',
  },
  kit: {
    title: '全队行装',
    body: '行装最高 5 阶，每阶向全队攻击倍率增加 0.06、生命倍率增加 0.08。它是全队后勤，不占武器、护甲或饰品槽，也不增加防御或抗性。升级需要对应城镇阶段和锻造坊等级，第 2 阶起还需要学馆。与同一属性的研究加成先相加，再应用到全队属性。',
  },
  partyPower: {
    title: '队伍战力',
    body: '战力 = 四舍五入后的「全队攻击 + 全队生命 ÷ 15 + 全队防御 ÷ 2」。引擎先汇总未取整属性与全队加成，再计算战力，因此用屏幕上已取整的三项反算可能相差 1。穿甲、远程和抗性不会直接写入这个基础战力，但会影响地区有效战力或实际战斗。候补不参与战力；最多四人出战，职业不限，可重复搭配；每人的携带技能与冷却独立，职业和队伍天赋光环不重复叠加。',
  },
  pierce: {
    title: '穿甲',
    body: '每位角色先把敌方护甲乘以 1−自身穿甲，再按 100÷(100+剩余护甲) 计算该角色伤害。个人穿甲上限为 75%，实际增伤取决于敌方护甲。队伍摘要按个人攻击加权平均；据点有效战力倍率为 1 + 对应抗性 × 0.55 + 队伍穿甲 × 0.25。',
  },
  ranged: {
    title: '远程贡献',
    body: '半精灵游侠和龙裔猎人天生为 100%，逐星法师为 60%，荒林德鲁伊为 50%，行旅炼金师为 80%，其他职业可由装备补足，个人上限 100%。龙飞行时，每人的常规攻击保留比例为 25% + 75% × 自身远程贡献。队伍显示值按个人攻击加权平均，数值不会增加地面战的基础伤害。技能是否视为投射攻击以技能说明为准。',
  },
  resistance: {
    title: '元素抗性',
    body: '火、暗、神抗分别加算，个人每种上限 75%，队伍抗性取出战成员的算术平均。首领战只使用敌人的对应元素抗性，抵抗掉该比例伤害；物理敌人不读取这三种抗性。同元素战前附魔再给决战抗性 +20%，总上限仍为 75%。据点有效战力使用队伍对应抗性，不计这项战前附魔。',
  },
  intelligence: {
    title: '地区敌情',
    body: '各地区敌情独立保存，上限 100。每点给据点推进成功率增加 0.15%，并向首领伤害基础倍率增加 0.001，100 点对应 +10%。调查每趟获得 4 + 野外学术等级 × 2 点，出战成员中有博闻再加 3 点。敌情只是优势，0敌情也可挑战已通路首领；工程线索单独计算。',
  },
  frontier: {
    title: '据点推进',
    body: '每区五层分别需要 40 / 75 / 120 / 180 / 260 推进值，弱队也可尝试，低战力会推进较慢且更容易受挫。有效战力 = 基础战力 × (1 + 对应抗性 × 0.55 + 队伍穿甲 × 0.25)。达到敌势 2 倍必定成功，达到 4 倍时一次成功远征填满当前道路，另需击败守敌才占领据点。失败仍增加 3 推进值和 2 敌情，但不能靠失败完成该层；连续三败后的下一趟合格推进保底成功。敌情、驻地和谨慎姿态还会提高通常成功率，优势越大每趟推进越多。',
  },
  survey: {
    title: '调查',
    body: '调查提升敌情和工程线索，不直接夺取据点。满足出发门槛后按 100% 归来处理，每完成一趟调查都推进一次线索计数；伏击仍会改变物资收益并触发休整。相同条件下，调查耗时为普通补给的 1.35 倍、口粮基础消耗为 1.30 倍，基础物资奖励为 55%，之后各自取整。每趟地区样品为 2 + 当地已完成据点数，不享受车队运量加成。',
  },
  supply: {
    title: '补给运输',
    body: '补给用于反复运回基础物资和地区材料，不推进据点或增加调查线索。出发门槛满足后按 100% 归来处理，普通、丰收、伏击、宝匣仍会改变基础物资收益。地区材料每趟为 (4 + 2×当地深度) × 车队运量，向下取整；运量为 1 + (集市等级 + 仓库等级)÷4，其中除法结果向下取整，驿站补给网再乘 1.5。地区材料不乘丰收或伏击倍率，超过材料仓容量的部分无法带回。',
  },
} satisfies Record<string, HelpText>;

export type HelpKey = keyof typeof HELP;
export type StarChance = {
  stars: number;
  percent: number;
  cumulativePercent: number;
  growth: number;
};
const tidy = (n: number) => Number(n.toFixed(8));
const pct = (n: number) => `${Number(n.toFixed(4))}%`;

/** These are the exact published q thresholds in makeApplicant, not a sampled estimate. */
function starDistribution(s: G.State, pity: boolean): StarChance[] {
  const weights = [...G.recruitmentWeights(s)];
  if (pity) {
    weights[2] += weights[0] + weights[1];
    weights[0] = 0;
    weights[1] = 0;
  }
  let cumulative = 0;
  return weights.map((percent, index) => {
    cumulative += percent;
    return {
      stars: index + 1,
      percent,
      cumulativePercent: cumulative,
      growth: G.POTENTIAL_GROWTH[index],
    };
  });
}

/** Describes the next ordinary batch; already visible applicants never reroll. */
export function recruitingOdds(s: G.State) {
  const pool = G.HEROES.filter((h) => G.roleOpen(s, h.id));
  const opening = s.guild.rolls === 0;
  const batch = s.guild.rolls + 1;
  const firstSlotPity = !opening && batch % 4 === 0;
  const ordinary = starDistribution(s, false);
  // Carry miss streaks across each slot; a forced five-star resets the next slot.
  let states = new Map<string, number>([[s.guild.fiveStarMisses + ':0', 1]]);
  const slots: StarChance[][] = [];
  for (let position = 0; position < 3; position++) {
    const next = new Map<string, number>();
    const weights = [0, 0, 0, 0, 0];
    for (const [key, probability] of states) {
      const [misses, mask] = key.split(':').map(Number);
      const distribution =
        misses === 79 && ordinary[4].percent > 0
          ? [0, 0, 0, 0, 100]
          : starDistribution(s, position === 0 && firstSlotPity).map(
              (v) => v.percent,
            );
      distribution.forEach((percent, index) => {
        if (!percent) return;
        const probabilityNext = (probability * percent) / 100;
        weights[index] += probabilityNext * 100;
        const nextKey =
          (index === 4 ? 0 : Math.min(79, misses + 1)) +
          ':' +
          (mask | (1 << index));
        next.set(nextKey, (next.get(nextKey) || 0) + probabilityNext);
      });
    }
    let cumulative = 0;
    slots.push(
      weights.map((percent, index) => ({
        stars: index + 1,
        percent,
        cumulativePercent: (cumulative += percent),
        growth: G.POTENTIAL_GROWTH[index],
      })),
    );
    states = next;
  }
  const stars = ordinary.map((row, index) => ({
    stars: row.stars,
    ordinaryPercent: row.percent,
    cumulativePercent: row.cumulativePercent,
    nextSlotPercents: slots.map((slot) => slot[index].percent),
    nextBatchAveragePercent: tidy(
      slots.reduce((sum, slot) => sum + slot[index].percent, 0) / 3,
    ),
    atLeastOneInNextBatchPercent: tidy(
      [...states].reduce(
        (sum, [key, p]) =>
          sum + (Number(key.split(':')[1]) & (1 << index) ? p : 0),
        0,
      ) * 100,
    ),
    growth: row.growth,
  }));
  const roles = G.HEROES.map((h) => {
    const unlocked = pool.some((role) => role.id === h.id);
    const randomPositionPercent = unlocked ? 100 / pool.length : 0;
    const nextSlotPercents = opening
      ? [
          h.id === 'rhea' ? 100 : 0,
          h.id === 'finn' ? 100 : 0,
          randomPositionPercent,
        ]
      : [randomPositionPercent, randomPositionPercent, randomPositionPercent];
    return {
      id: h.id,
      name: h.role,
      unlocked,
      randomPositionPercent,
      nextSlotPercents,
      atLeastOneInNextBatchPercent: tidy(
        (1 -
          nextSlotPercents.reduce(
            (none, chance) => none * (1 - chance / 100),
            1,
          )) *
          100,
      ),
      unlockText: ['rhea', 'finn', 'luna', 'kael'].includes(h.id)
        ? '初始开放'
        : h.id === 'orin'
          ? '击败任意 1 位首领后开放'
          : h.id === 'ash'
            ? '击败任意 3 位首领后开放'
            : h.id === 'vera'
              ? '城镇发展至市镇阶段后开放'
              : '城镇发展至村落阶段后开放',
    };
  });
  const secondsToFree = Math.max(0, Math.ceil(s.guild.refreshAt - s.time));
  const refreshCost = G.refreshCost(s);
  return {
    title: '旅人出现率',
    body: [
      G.recruitmentProgressHelp(s).body,
      `五星保底进度 ${s.guild.fiveStarMisses}/80；${ordinary[4].percent > 0 ? `最多再 ${80 - s.guild.fiveStarMisses} 位必出五星` : '五星未开放，进度最多存79位'}。下批至少一位五星概率 ${stars[4].atLeastOneInNextBatchPercent.toFixed(2)}%。`,
      opening
        ? `建成酒馆后的首批前两位固定为${G.HEROES.find((h) => h.id === 'rhea')!.role}和${G.HEROES.find((h) => h.id === 'finn')!.role}，第三位随机，三人的潜力均照常抽取。`
        : `下一批为第 ${batch} 批，${firstSlotPity ? '第一位潜力至少 3 星，后两位照常抽取' : '三人的潜力均照常抽取'}；含首批累计每四批触发一次首位保底。`,
      `当前开放 ${pool.length} 种职业，每个随机位置各为 ${pct(100 / pool.length)}，同批可以出现重复职业。`,
      `当前新候选起始为 ${Math.max(1, s.cleared.length * 3)} 级；酒馆 ${s.buildings.tavern} 级提供经验与补给支持，不额外提高高星率。`,
      !s.buildings.tavern
        ? '需要先建酒馆；首批到来后，每 600 游戏秒可免费更换一批。'
        : `现在${secondsToFree ? `再等 ${secondsToFree} 游戏秒可免费刷新，立即刷新需 ${G.costText(refreshCost)}` : '可免费刷新'}，每次换批后重新计时 600 秒。`,
    ].join('\n'),
    ordinary,
    stars,
    roles,
    nextBatchNumber: batch,
    nextBatchKind: opening
      ? ('opening' as const)
      : ('ordinary-refresh' as const),
    firstSlotPity,
    refreshesUntilPity: opening ? 3 : 4 - (s.guild.rolls % 4),
    batchesUntilPity: 4 - (s.guild.rolls % 4),
    firstBatchCountsTowardPity: true,
    currentApplicantsAreFixed: true,
    rolesSampledWithReplacement: true,
    currentTavernLevel: s.buildings.tavern,
    potentialStageOffset: 0,
    potentialTavernOffset: 0,
    startingLevel: Math.max(1, s.cleared.length * 3),
    tavernExperienceMultiplier:
      (1 + s.buildings.tavern * 0.1) * G.renovationFactor(s, 'tavern'),
    tavernBattleSupplies: 3 + Math.max(0, s.buildings.tavern - 1),
    freeRefreshIntervalSeconds: 600,
    secondsToFreeRefresh: secondsToFree,
    refreshCost,
    refreshReason: G.recruitmentRefreshReason(s),
  };
}

const AFFIX_DETAIL: Record<(typeof G.AFFIXES)[number]['stat'], string> = {
  crit: '向个人暴击率增加8%；个人暴击率上限60%。暴击默认造成150%伤害。',
  dodge:
    '向个人闪避率增加6%；个人闪避上限40%。只能闪避敌方单体攻击，群体重击不能闪避。',
  critDamage:
    '暴击伤害 +20%，例如150%变为170%。只放大暴击命中的直接伤害。',
  attack:
    '这是额外的基础攻击数值，乘阶级、品质、强化和工匠传承的完整倍率，已经计入装备面板。',
  hp: '这是额外的基础生命数值，乘阶级、品质、强化和工匠传承的完整倍率，已经计入装备面板。',
  defense: '固定增加 3 点装备防御，不随阶级、品质、强化或工匠传承放大。',
  pierce:
    '向个人穿甲增加 12%，不随装备成长放大；超过个人 75% 上限的部分不生效。',
  fire: '向个人火抗增加 15%，不随装备成长放大；个人上限 75%，全队取出战成员平均。',
  shadow:
    '向个人暗抗增加 15%，不随装备成长放大；个人上限 75%，全队取出战成员平均。',
  radiant:
    '向个人神抗增加 15%，不随装备成长放大；个人上限 75%，全队取出战成员平均。',
};

export function affixHelp(index: number, s?: G.State, item?: G.Gear): HelpText {
  const affix = G.AFFIXES[index];
  if (!affix) return HELP.affix;
  const lines = [`${affix.text}。`, AFFIX_DETAIL[affix.stat]];
  if (s && item) {
    const candidate = { ...item, affix: index };
    const delta =
      G.itemStats(s, candidate)[affix.stat] -
      G.itemStats(s, candidate, false)[affix.stat];
    const value = ['pierce', 'fire', 'shadow', 'radiant', 'crit', 'dodge', 'critDamage'].includes(affix.stat)
      ? `${pct(delta * 100)}（个人上限截断前）`
      : tidy(delta).toString();
    lines.push(`这件装备的该词条原始贡献为 +${value}。`);
  }
  return { title: `词条 · ${affix.name}`, body: lines.join('\n') };
}

export function allAffixHelp(s?: G.State, item?: G.Gear) {
  return G.AFFIXES.map((affix, index) => ({
    index,
    name: affix.name,
    ...affixHelp(index, s, item),
  }));
}

const TALENT_DETAIL: Record<(typeof G.TALENTS)[number]['id'], string> = {
  hunter:
    '自身攻击加成在装备加入后计算；森林和龙脊首领的额外伤害需本人出战，同队多个猎兽直觉不重复叠加地区加成。',
  breaker: '装备穿甲与天赋相加后按个人 75% 上限截断；队伍摘要按个人攻击加权。',
  warden: '分别增加火、暗、神抗各 20%，与装备相加后个人各项最高 75%。',
  healer:
    '补给治疗增加的是治疗目标最大生命的 5%，需本人出战，同天赋多人不重复叠加。',
  scholar: '每趟调查固定多 3 点敌情，需本人出战，同天赋多人不重复叠加。',
  scout:
    '出战时全队远征耗时乘 0.90，与弓手、工程、后勤学派分别计算，多位寻路人不重复相乘。',
  diligent:
    '经验乘 1.30，包括引擎发放的首领胜利经验；训练的金币费用乘 0.85 后向上取整，口粮费用不变。',
  veteran:
    '持有者出战时，守敌与首领战初始士气从 5 提高到 6，同天赋多人不会继续增加。',
};

export function talentHelp(id: G.Hero['talent']): HelpText {
  const talent = G.TALENTS.find((t) => t.id === id);
  return talent
    ? {
        title: `天赋 · ${talent.name}`,
        body: `${talent.text}\n${TALENT_DETAIL[talent.id] || ''}`,
      }
    : HELP.talent;
}

export function flawHelp(id: G.Hero['flaw']): HelpText {
  if (id === 'overcome')
    return {
      title: '缺点已克服',
      body: '原来的缺点已永久移除，不会再次抽取。潜力、资质和天赋保持原值。',
    };
  const flaw = G.FLAWS.find((f) => f.id === id);
  return flaw
    ? {
        title: `缺点 · ${flaw.name}`,
        body: `${flaw.text}。\n${id === 'green' ? '在出战或候补的经验倍率计算中额外乘 0.90。' : '这项修正在个人装备加入后应用到对应属性。'}\n2 级酒馆可支付 120 金、60 粮永久克服。`,
      }
    : HELP.flaw;
}

export function regionRouteHelp(
  s: G.State,
  region: number,
  route: G.Route,
): HelpText {
  const base = HELP[route];
  if (!Number.isInteger(region) || !G.REGIONS[region]) return base;
  const info = G.routeInfo(s, region, route);
  const frontier = G.frontierInfo(s, region);
  return {
    title: `${G.REGIONS[region].name} · ${base.title}`,
    body: [
      `当前一趟 ${info.duration} 游戏秒，出发消耗 ${info.cost} 口粮，保留口粮另计。`,
      route === 'frontier'
        ? `当前有效战力比为 ${tidy(frontier.ratio)}，成功率 ${pct(frontier.chance * 100)}，成功时推进 ${frontier.progress}/${frontier.required}。`
        : `当前归来判定为 100%，地区样品 ${G.expeditionMaterialAmount(s, region, route)} 份；丰收和伏击另影响基础物资。`,
      (s.expedition
        ? '已有远征正在进行，可立即撤回后重新安排。'
        : G.dispatchReason(s, region, route, s.order.reserve)) ||
        '当前队伍、容量与补给条件已满足。',
    ].join('\n'),
  };
}
