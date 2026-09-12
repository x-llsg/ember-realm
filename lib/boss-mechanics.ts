/**
 * Six deterministic two-phase boss patterns shared by manual and automatic combat.
 * attackScale multiplies enemyAttack (and aoeScale for an area attack).
 * Keep all remaining defense/resistance/guard/ward/outpost/stance logic once.
 */
export type BossIntentKind =
  | 'strike'
  | 'heavy'
  | 'ward'
  | 'restore'
  | 'channel'
  | 'flight'
  | 'seal';
export type BossTargetRule =
  | 'weighted'
  | 'keep'
  | 'lowest-ratio'
  | 'highest-attack';
export type BossPhase = 1 | 2;

export interface BossStep {
  id: string;
  kind: BossIntentKind;
  name: string;
  hint: string;
  attackScale: number;
  hits?: 1 | 2;
  target?: BossTargetRule;
  armorScale?: number;
  brokenArmorScale?: number;
  damageTakenScale?: number;
  barrierFraction?: number;
  healFraction?: number;
  ignoreArmor?: number;
  interruptScale?: number;
  burnRounds?: 0 | 2;
  sealRounds?: 0 | 2;
  exposeHits?: 0 | 2;
}
export interface BossDefinition {
  region: number;
  name: string;
  lesson: string;
  phaseNames: readonly [string, string];
  phaseThreshold: number;
  phases: readonly [readonly BossStep[], readonly BossStep[]];
}
export interface BossRuntime {
  version: 1;
  phase: BossPhase;
  phaseStartRound: number;
  /** Entry effects may run once only per full player round. */
  preparedRound: number;
}
export interface BossUnitView {
  id: string;
  hp: number;
  maxHp: number;
  attack: number;
}
export interface BossBattleView {
  kind: 'boss' | 'guardian' | 'site';
  region: number;
  round: number;
  enemyHp: number;
  enemyMaxHp: number;
  interrupted: boolean;
  shattered: boolean;
  target: string;
  units: readonly BossUnitView[];
  boss?: BossRuntime;
}

const step = (value: BossStep): BossStep => Object.freeze(value);

export const BOSS_MECHANICS: readonly BossDefinition[] = [
  {
    region: 0,
    name: '荆棘狼王',
    lesson: '保护明确被追猎的角色；可用防御、护盾或嘲讽。',
    phaseNames: ['荆棘猎手', '负伤狂猎'],
    phaseThreshold: 0.5,
    phases: [
      [
        step({
          id: 'scent',
          kind: 'strike',
          name: '嗅血追猎',
          attackScale: 0.7,
          target: 'lowest-ratio',
          hint: '锁定当前生命比例最低者，本轮轻咬；下一轮仍扑向此人。嘲讽只改变本轮受击者。',
        }),
        step({
          id: 'pounce',
          kind: 'strike',
          name: '裂喉扑击',
          attackScale: 1.65,
          target: 'keep',
          hint: '锁定角色承受一次重扑。防御降低75%承伤；护盾、护佑和嘲讽都有效。扑击不能打断。',
        }),
        step({
          id: 'thorns',
          kind: 'heavy',
          name: '荆棘横扫',
          attackScale: 0.85,
          hint: '全体受击，不暴击。为脆弱角色防御，或用群体护佑承接。',
        }),
        step({
          id: 'pant',
          kind: 'strike',
          name: '喘息换位',
          attackScale: 0.5,
          damageTakenScale: 1.15,
          hint: '狼王本轮伤害较低且受到伤害提高15%；治疗或集中输出。',
        }),
      ],
      [
        step({
          id: 'scent',
          kind: 'strike',
          name: '血嗅锁定',
          attackScale: 0.75,
          target: 'lowest-ratio',
          hint: '锁定生命比例最低者；下一轮发动两次扑咬，先安排保护。',
        }),
        step({
          id: 'pounce',
          kind: 'strike',
          name: '狂猎连扑',
          attackScale: 0.9,
          hits: 2,
          target: 'keep',
          hint: '对同一目标连续扑咬两次，每次90%基础攻击。防御和护佑覆盖两击，护盾按实际余量吸收。',
        }),
        step({
          id: 'thorns',
          kind: 'heavy',
          name: '狂乱扫尾',
          attackScale: 1,
          hint: '全体受击，不暴击；保护低血量角色。',
        }),
        step({
          id: 'pant',
          kind: 'strike',
          name: '力竭喘息',
          attackScale: 0.45,
          damageTakenScale: 1.2,
          hint: '狼王露出空隙，受到伤害提高20%；此时治疗或爆发。',
        }),
      ],
    ],
  },
  {
    region: 1,
    name: '无面守墓人',
    lesson: '区分可打碎的结界、可打断的吸魂与不应硬吃的钟震。',
    phaseNames: ['墓钟守望', '群魂苏醒'],
    phaseThreshold: 0.5,
    phases: [
      [
        step({
          id: 'ossuary',
          kind: 'ward',
          name: '白骨结界',
          attackScale: 0.55,
          barrierFraction: 0.06,
          exposeHits: 2,
          hint: '本轮护盾为首领最大生命的6%。破盾立即清除，留下两次20%增伤；也可直接打穿。',
        }),
        step({
          id: 'bell',
          kind: 'heavy',
          name: '墓钟震荡',
          attackScale: 0.85,
          hint: '暗属性全体攻击，不暴击。暗抗、护佑和个人防御均有效。',
        }),
        step({
          id: 'drain',
          kind: 'restore',
          name: '招魂回流',
          attackScale: 0.5,
          healFraction: 0.06,
          hint: '本轮结束恢复最大生命6%。打断或通用破势可阻止；未阻止也不会复活。',
        }),
        step({
          id: 'silence',
          kind: 'strike',
          name: '钟声间隙',
          attackScale: 0.55,
          damageTakenScale: 1.2,
          hint: '暂时失去魂灵庇护，受到伤害提高20%；适合治疗或爆发。',
        }),
      ],
      [
        step({
          id: 'ossuary',
          kind: 'ward',
          name: '群魂结界',
          attackScale: 0.6,
          barrierFraction: 0.08,
          exposeHits: 2,
          hint: '护盾提高到最大生命8%；破盾或直接输出仍可处理，不存在伤害免疫。',
        }),
        step({
          id: 'bell',
          kind: 'heavy',
          name: '三重丧钟',
          attackScale: 1.05,
          hint: '一次较强的暗属性全体攻击。名称不代表三次隐藏伤害；防御和护佑有效。',
        }),
        step({
          id: 'hush',
          kind: 'seal',
          name: '噤声咒',
          attackScale: 0.5,
          sealRounds: 2,
          hint: '本轮与下一轮不能治疗；护盾、防御和净化仍可使用，现有生命不会被扣除。',
        }),
        step({
          id: 'drain',
          kind: 'restore',
          name: '群魂回流',
          attackScale: 0.55,
          healFraction: 0.05,
          hint: '本轮结束恢复最大生命5%。治疗封印期间仍可用打断或破势阻止。',
        }),
        step({
          id: 'silence',
          kind: 'strike',
          name: '墓园静默',
          attackScale: 0.45,
          damageTakenScale: 1.25,
          hint: '治疗窗口重新打开，首领受到伤害提高25%。',
        }),
      ],
    ],
  },
  {
    region: 2,
    name: '黑铁督军',
    lesson: '高甲不能只堆普通攻击；破甲、破盾技能和穿甲配装提供不同解法。',
    phaseNames: ['黑铁军阵', '弃盾决战'],
    phaseThreshold: 0.5,
    phases: [
      [
        step({
          id: 'rampart',
          kind: 'ward',
          name: '黑铁壁垒',
          attackScale: 0.6,
          armorScale: 1.8,
          brokenArmorScale: 0.9,
          target: 'weighted',
          hint: '本轮护甲为基础1.8倍。破盾或破势拆掉加固后降至0.9倍；穿甲仍按实际护甲计算。',
        }),
        step({
          id: 'cleave',
          kind: 'strike',
          name: '破阵斩',
          attackScale: 1.55,
          ignoreArmor: 0.2,
          target: 'keep',
          hint: '保持上一轮目标，忽略目标20%防御，造成一次重斩。护盾、护佑、防御指令不受穿甲影响。',
        }),
        step({
          id: 'repair',
          kind: 'restore',
          name: '战地整备',
          attackScale: 0.5,
          healFraction: 0.06,
          hint: '本轮结束恢复最大生命6%。打断可阻止，或利用恢复回合安排补给。',
        }),
        step({
          id: 'seam',
          kind: 'strike',
          name: '铠甲接缝',
          attackScale: 0.55,
          armorScale: 0.75,
          damageTakenScale: 1.15,
          hint: '护甲降至基础75%，受到伤害提高15%；预留输出技能打接缝。',
        }),
      ],
      [
        step({
          id: 'rampart',
          kind: 'ward',
          name: '残甲抵抗',
          attackScale: 0.65,
          armorScale: 2,
          brokenArmorScale: 0.85,
          target: 'weighted',
          hint: '本轮护甲翻倍，破盾可拆至0.85倍。督军已放弃修复，不再恢复生命。',
        }),
        step({
          id: 'cleave',
          kind: 'strike',
          name: '双刃处刑',
          attackScale: 0.8,
          hits: 2,
          ignoreArmor: 0.2,
          target: 'keep',
          hint: '对已预告目标连斩两次，每次80%基础攻击并忽略20%防御。两击均可防御、护盾或嘲讽。',
        }),
        step({
          id: 'rain',
          kind: 'heavy',
          name: '碎铁风暴',
          attackScale: 0.95,
          hint: '全体物理攻击，不暴击。没有隐藏处决阈值，剩余生命和减伤决定生死。',
        }),
        step({
          id: 'seam',
          kind: 'strike',
          name: '铠甲崩口',
          attackScale: 0.5,
          armorScale: 0.65,
          damageTakenScale: 1.2,
          hint: '护甲降至基础65%，受到伤害提高20%；抓住窗口结束战斗。',
        }),
      ],
    ],
  },
  {
    region: 3,
    name: '魔王·莫尔迦斯',
    lesson: '提前准备封疗窗口，区分治疗与护盾，并为咏唱保留一次打断。',
    phaseNames: ['永夜王权', '王庭崩坏'],
    phaseThreshold: 0.5,
    phases: [
      [
        step({
          id: 'brand',
          kind: 'strike',
          name: '王庭烙印',
          attackScale: 0.85,
          target: 'highest-attack',
          hint: '锁定面板攻击最高的存活角色；目标可防御，也可用嘲讽接走本轮攻击。',
        }),
        step({
          id: 'edict',
          kind: 'seal',
          name: '禁愈敕令',
          attackScale: 0.55,
          sealRounds: 2,
          hint: '本轮与下一轮封禁治疗，下一轮将有毁灭咏唱。护盾、护佑和防御保持有效。',
        }),
        step({
          id: 'abyss',
          kind: 'channel',
          name: '永夜降临',
          attackScale: 1.15,
          interruptScale: 0.2,
          exposeHits: 2,
          hint: '本轮结束暗属性群攻。打断后仅保留20%伤害，并留下两次20%增伤；也可全员防御承接。',
        }),
        step({
          id: 'fracture',
          kind: 'strike',
          name: '王冠裂隙',
          attackScale: 0.5,
          damageTakenScale: 1.15,
          hint: '封禁结束，魔王受到伤害提高15%；治疗或集中输出。',
        }),
      ],
      [
        step({
          id: 'edict',
          kind: 'seal',
          name: '破碎王令',
          attackScale: 0.6,
          sealRounds: 2,
          hint: '本轮与下一轮封禁治疗。不要浪费行动尝试被禁用的治疗；盾与减伤仍可用。',
        }),
        step({
          id: 'abyss',
          kind: 'channel',
          name: '吞星永夜',
          attackScale: 1.25,
          interruptScale: 0.25,
          healFraction: 0.03,
          exposeHits: 2,
          hint: '未打断则发动群攻并恢复最大生命3%；打断取消恢复，伤害降至25%。',
        }),
        step({
          id: 'collapse',
          kind: 'heavy',
          name: '王庭倾覆',
          attackScale: 0.85,
          hint: '全体暗属性攻击，不可打断；低血量角色应防御或接受护佑。',
        }),
        step({
          id: 'fracture',
          kind: 'strike',
          name: '失冠之隙',
          attackScale: 0.45,
          damageTakenScale: 1.2,
          hint: '恢复治疗，魔王受到伤害提高20%，是重整和爆发窗口。',
        }),
      ],
    ],
  },
  {
    region: 4,
    name: '古龙·阿兹拉克',
    lesson: '远程、打断落地、火抗与净化各有用途；不能只把普攻当作全部策略。',
    phaseNames: ['霜峰盘旋', '熔血怒焰'],
    phaseThreshold: 0.5,
    phases: [
      [
        step({
          id: 'flight',
          kind: 'flight',
          name: '振翼升空',
          attackScale: 0.85,
          interruptScale: 0.5,
          exposeHits: 2,
          hint: '远程技能正常伤害；近战伤害为25%＋75%远程属性。打断可迫降，取消空中减伤并令本轮俯冲伤害减半。',
        }),
        step({
          id: 'breath',
          kind: 'heavy',
          name: '熔岩吐息',
          attackScale: 1,
          burnRounds: 2,
          hint: '全体火属性攻击；受到生命伤害且未防御/免燃者灼烧两次。火抗、护佑和完整吸收伤害的护盾均有效。',
        }),
        step({
          id: 'claw',
          kind: 'strike',
          name: '裂岩龙爪',
          attackScale: 1,
          hint: '地面定向攻击，所有武器正常生效。嘲讽、闪避和防御均有效。',
        }),
        step({
          id: 'vent',
          kind: 'strike',
          name: '龙鳞散热',
          attackScale: 0.5,
          damageTakenScale: 1.15,
          hint: '古龙受到伤害提高15%；适合净化残火、治疗或爆发。',
        }),
      ],
      [
        step({
          id: 'flight',
          kind: 'flight',
          name: '怒焰升空',
          attackScale: 0.9,
          interruptScale: 0.5,
          exposeHits: 2,
          hint: '保持远程/迫降两种解法；下一轮是强化吐息。',
        }),
        step({
          id: 'breath',
          kind: 'heavy',
          name: '焚山龙息',
          attackScale: 1.15,
          burnRounds: 2,
          hint: '更强的全体火伤，灼烧刷新到两次、不无限叠层。全员防御能避免新增灼烧。',
        }),
        step({
          id: 'tail',
          kind: 'heavy',
          name: '崩山扫尾',
          attackScale: 0.85,
          burnRounds: 0,
          hint: '全体受击，但这一招不会新增灼烧；可在保护低血角色的同时净化旧灼烧。',
        }),
        step({
          id: 'vent',
          kind: 'strike',
          name: '熔鳞裂口',
          attackScale: 0.45,
          damageTakenScale: 1.2,
          hint: '古龙受到伤害提高20%；地面治疗与输出窗口。',
        }),
      ],
    ],
  },
  {
    region: 5,
    name: '秩序之神·伊瑟',
    lesson:
      '公开的法则循环综合检验破盾、打断、抗性与输出时机，不要求隐藏口令。',
    phaseNames: ['无瑕律法', '神性崩解'],
    phaseThreshold: 0.5,
    phases: [
      [
        step({
          id: 'law',
          kind: 'seal',
          name: '禁愈法则',
          attackScale: 0.55,
          sealRounds: 2,
          hint: '本轮与下一轮封禁治疗，随后轮到裁决。用护盾或防御渡过，提前保留破势所需士气。',
        }),
        step({
          id: 'perfect',
          kind: 'ward',
          name: '无瑕法则',
          attackScale: 0.55,
          barrierFraction: 0.06,
          exposeHits: 2,
          hint: '展开最大生命6%的本轮护盾。破盾/破势可清除，也能直接打穿；不能把净化或普通护盾当作破盾。',
        }),
        step({
          id: 'judgment',
          kind: 'channel',
          name: '归零裁决',
          attackScale: 1.15,
          interruptScale: 0.25,
          healFraction: 0.03,
          exposeHits: 2,
          hint: '未打断则群攻并恢复最大生命3%；打断取消恢复、伤害降至25%。不会按百分比直接处死。',
        }),
        step({
          id: 'mortal',
          kind: 'strike',
          name: '神性剥落',
          attackScale: 0.55,
          damageTakenScale: 1.2,
          hint: '治疗开放，神明受到伤害提高20%。利用窗口恢复或输出。',
        }),
      ],
      [
        step({
          id: 'law',
          kind: 'seal',
          name: '终末法则',
          attackScale: 0.6,
          sealRounds: 2,
          hint: '本轮与下一轮封疗；顺序公开且固定，不会根据玩家刚选择的动作临时换招。',
        }),
        step({
          id: 'perfect',
          kind: 'ward',
          name: '破碎的完美',
          attackScale: 0.6,
          barrierFraction: 0.08,
          exposeHits: 2,
          hint: '本轮护盾提高到最大生命8%；破盾后两次增伤可用于主动技能。',
        }),
        step({
          id: 'judgment',
          kind: 'channel',
          name: '末日裁决',
          attackScale: 1.25,
          interruptScale: 0.35,
          healFraction: 0.04,
          exposeHits: 2,
          hint: '打断取消4%恢复、伤害降至35%；未能打断仍可通过护盾、神抗和逐人防御承接。',
        }),
        step({
          id: 'census',
          kind: 'heavy',
          name: '万物清算',
          attackScale: 0.85,
          ignoreArmor: 0.25,
          hint: '全体受击并忽略25%防御，不暴击。护盾、神抗、护佑和防御指令不会被忽略。',
        }),
        step({
          id: 'mortal',
          kind: 'strike',
          name: '众生的间隙',
          attackScale: 0.45,
          damageTakenScale: 1.25,
          hint: '神明受到伤害提高25%；法则暂停，留出完整的治疗与爆发回合。',
        }),
      ],
    ],
  },
];

export function bossDefinition(region: number): BossDefinition {
  const definition = BOSS_MECHANICS[region];
  if (!Number.isInteger(region) || !definition)
    throw new Error('Invalid boss region');
  return definition;
}

/** Pure read: never switches phases, rolls RNG or refreshes a barrier. */
export function bossStep(b: BossBattleView): BossStep {
  if (b.kind !== 'boss')
    throw new Error('Guardian uses its existing encounter pattern');
  const runtime = b.boss || {
    version: 1,
    phase: 1,
    phaseStartRound: 1,
    preparedRound: 0,
  };
  const cycle = bossDefinition(b.region).phases[runtime.phase - 1];
  return cycle[Math.max(0, b.round - runtime.phaseStartRound) % cycle.length];
}

/** Call at combat creation and after an enemy phase has fully finished only. */
export function prepareBossRound(b: BossBattleView): {
  runtime: BossRuntime;
  entered: boolean;
  transitioned: boolean;
  barrier: number;
  targetRule: BossTargetRule;
} {
  if (b.kind !== 'boss') throw new Error('Not a boss battle');
  let runtime: BossRuntime = b.boss
    ? { ...b.boss }
    : { version: 1, phase: 1, phaseStartRound: b.round, preparedRound: 0 };
  if (runtime.preparedRound === b.round)
    return {
      runtime,
      entered: false,
      transitioned: false,
      barrier: 0,
      targetRule: 'keep',
    };
  const transitioned =
    runtime.phase === 1 &&
    b.enemyHp > 0 &&
    b.enemyHp <= b.enemyMaxHp * bossDefinition(b.region).phaseThreshold;
  if (transitioned)
    runtime = { ...runtime, phase: 2, phaseStartRound: b.round };
  runtime.preparedRound = b.round;
  const intent = bossStep({ ...b, boss: runtime });
  return {
    runtime,
    entered: true,
    transitioned,
    barrier: Math.round(b.enemyMaxHp * (intent.barrierFraction || 0)),
    targetRule: intent.target || 'weighted',
  };
}

/** weightedFallback is supplied by the existing once-per-round target RNG. */
export function bossTarget(
  b: BossBattleView,
  rule: BossTargetRule,
  weightedFallback: string,
): string {
  const living = b.units.filter((u) => u.hp > 0);
  if (!living.length) return '';
  if (rule === 'keep' && living.some((u) => u.id === b.target)) return b.target;
  if (rule === 'lowest-ratio')
    return living.reduce((a, u) => (u.hp / u.maxHp < a.hp / a.maxHp ? u : a))
      .id;
  if (rule === 'highest-attack')
    return living.reduce((a, u) => (u.attack > a.attack ? u : a)).id;
  return living.some((u) => u.id === weightedFallback)
    ? weightedFallback
    : living[0].id;
}

/** The actual engine and the auto damage estimate must consume these same fields. */
export function bossResolution(b: BossBattleView) {
  const step = bossStep(b);
  const interruptible =
    step.interruptScale !== undefined || step.kind === 'restore';
  const countered = interruptible && b.interrupted;
  const broken = step.kind === 'ward' && b.shattered;
  return {
    step,
    heavy: step.kind === 'heavy' || step.kind === 'channel',
    hits: step.hits || 1,
    attackScale:
      step.attackScale * (countered ? (step.interruptScale ?? 1) : 1),
    armorScale: broken ? (step.brokenArmorScale ?? 1) : (step.armorScale ?? 1),
    damageTakenScale: step.damageTakenScale ?? 1,
    ignoreArmor: step.ignoreArmor ?? 0,
    healFraction: countered ? 0 : (step.healFraction ?? 0),
    sealRounds: step.sealRounds ?? 0,
    burnRounds: step.burnRounds ?? 0,
    flying: step.kind === 'flight' && !countered,
    countered,
    exposeHits: countered || broken ? (step.exposeHits ?? 0) : 0,
  };
}

export function bossPlayerDamageScale(
  b: BossBattleView,
  projectile: boolean,
  ranged: number,
) {
  const resolution = bossResolution(b);
  return (
    resolution.damageTakenScale *
    (resolution.flying && !projectile
      ? 0.25 + 0.75 * Math.min(1, Math.max(0, ranged))
      : 1)
  );
}

/** Use for final direct damage and DOT; armor penetration does not bypass barrier HP. */
export function absorbBossBarrier(barrier: number, damage: number) {
  const safeDamage = Math.max(0, Math.round(damage));
  const absorbed = Math.min(Math.max(0, barrier), safeDamage);
  return {
    absorbed,
    hpDamage: safeDamage - absorbed,
    remaining: Math.max(0, barrier - absorbed),
  };
}

export function validBossRuntime(
  value: unknown,
  round: number,
): value is BossRuntime {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const keys = ['version', 'phase', 'phaseStartRound', 'preparedRound'];
  return (
    Object.keys(v).length === keys.length &&
    keys.every((k) => Object.hasOwn(v, k)) &&
    v.version === 1 &&
    (v.phase === 1 || v.phase === 2) &&
    Number.isInteger(v.phaseStartRound) &&
    (v.phaseStartRound as number) >= 1 &&
    (v.phaseStartRound as number) <= round &&
    Number.isInteger(v.preparedRound) &&
    v.preparedRound === round
  );
}
