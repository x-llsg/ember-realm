import * as G from './realm.ts';
import { GUARDIANS, BOSS_COMBAT } from './guardian-data.ts';
import * as Boss from './boss-mechanics.ts';
import * as Sets from './set-combat.ts';
export { setEffectHelp } from './set-combat.ts';

export interface CombatUnit {
  id: string;
  name: string;
  role: G.HeroId;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  crit: number;
  dodge: number;
  critDamage: number;
  pierce: number;
  ranged: number;
  resistance: number;
  shield: number;
  shieldTurns: number;
  evasion: number;
  castThisRound: string;
  cooldowns: Record<string, number>;
  ward: number;
  burn: number;
  regen: number;
  regenTurns: number;
  guard: number;
  preventBurn: boolean;
  healing: number;
  shieldPower: number;
  cooldownReduction: number;
  setEffect?: Sets.SetEffect;
  projectChoices?: string[];
}
export interface BattleReport {
  region: number;
  kind: 'boss' | 'guardian';
  node: number;
  enemy: string;
  won: boolean;
  retreated: boolean;
  rounds: number;
  history: string[];
  survivors: number;
  time: number;
  hp?: number;
  maxHp?: number;
  loot?: G.LootReceipt | null;
}

const alive = (b: G.Battle) => b.units.filter((u) => u.hp > 0);
/** Projects finished at home cannot rewrite an encounter that already departed. */
function battleChosen(s: G.State, project: string, choice: string) {
  const snapshot = s.battle?.units[0]?.projectChoices;
  return snapshot
    ? snapshot.includes(`${project}:${choice}`)
    : G.chosen(s, project, choice);
}
const projectChoiceIds = () =>
  G.PROJECTS.flatMap((project) =>
    project.choices.map((choice) => `${project.id}:${choice.id}`),
  );
const rand = (b: G.Battle) => {
  let x = b.rng;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  b.rng = x >>> 0 || 1;
  return b.rng / 4294967296;
};
const note = (b: G.Battle, message: string) => {
  b.history.unshift(`第 ${b.round} 回合 · ${message}`);
  b.history = b.history.slice(0, 35);
};
const spend = (s: G.State, cost: G.Cost) => {
  for (const [key, value] of Object.entries(cost))
    s.resources[key as G.Resource] -= value!;
};

export function guardianReady(s: G.State, region: number) {
  return (
    G.regionOpen(s, region) &&
    s.guild.depths[region] < 5 &&
    s.guild.progress[region] >= G.FRONTIER_REQUIREMENTS[s.guild.depths[region]]
  );
}
export const GUARDIAN_REMATCH_SECONDS = 30;
export function guardianRematch(s: G.State, region: number, node: number) {
  return (
    Number.isInteger(region) &&
    region >= 0 &&
    region < 6 &&
    Number.isInteger(node) &&
    node >= 0 &&
    node < 5 &&
    node < s.guild.depths[region]
  );
}
export function guardianRematchWait(s: G.State, region: number) {
  return Math.max(
    0,
    Math.ceil((s.guild.guardianHunts?.readyAt[region] || 0) - s.time),
  );
}
export function guardianReason(
  s: G.State,
  region: number,
  node = s.guild.depths[region],
) {
  if (!Number.isInteger(region) || region < 0 || region > 5)
    return '尚未发现通往这里的道路';
  if (s.guild.inventory.length >= G.INVENTORY_CAP)
    return '装备库已满，先为守敌掉落留出1格';
  if (!G.regionOpen(s, region)) return '尚未发现通往这里的道路';
  const rematch = guardianRematch(s, region, node);
  if (
    !rematch &&
    (node !== s.guild.depths[region] || !guardianReady(s, region))
  )
    return s.guild.depths[region] >= 5
      ? '五处守敌已击败，可选择已占据点再次挑战'
      : '先将当前路线推进至守敌所在处';
  if (!Number.isInteger(node) || node < 0 || node >= 5)
    return '请选择有效的据点守敌';
  if (rematch && guardianRematchWait(s, region))
    return `本地区守敌重整中，还需 ${guardianRematchWait(s, region)} 秒`;
  if (s.expedition) return '队伍在外，可立即撤回后准备';
  if (s.battle) return '先结束当前战斗';
  if (!s.party.length) return '请先编入旅人';
  if (s.recoveryUntil > s.time)
    return `队伍休整中，还需 ${Math.ceil(s.recoveryUntil - s.time)} 秒`;
  if (G.preparedPotionReason(s)) return G.preparedPotionReason(s);
  if (!G.canPay(s, G.battlePreparationCost(s)))
    return `准备不足：${G.costText(G.battlePreparationCost(s))}`;
  return '';
}
export function enemyDefinition(
  s: G.State,
  region: number,
  kind: 'boss' | 'guardian' = 'boss',
  node = s.guild.depths[region],
) {
  return kind === 'boss'
    ? BOSS_COMBAT[region]
    : GUARDIANS[region][Math.min(4, node)];
}
export function combatSkills(s: G.State, id: string) {
  const hero = s.heroes.find((h) => h.id === id);
  if (!hero) return [];
  const ids = [
    G.DEFAULT_SKILL[hero.role],
    G.heroSkill(hero).id,
    ...(hero.secondarySkill ? [hero.secondarySkill] : []),
  ];
  return [...new Set(ids)].map((key) =>
    G.SKILLS.find((skill) => skill.id === key)!,
  );
}
function makeUnits(
  s: G.State,
  region: number,
  element: G.Element,
): CombatUnit[] {
  const members = s.party.map((id) => s.heroes.find((h) => h.id === id)!);
  const baseHp = members.reduce(
    (sum, h) => sum + G.individualStats(s, h).hp,
    0,
  );
  const hpScale = G.partyStats(s).hp / Math.max(1, baseHp);
  const aura =
    ((G.hasRole(s, 'rhea') ? 3 : 0) + (G.hasRole(s, 'orin') ? 6 : 0)) /
    Math.max(1, members.length);
  return members.map((h) => {
    const a = G.individualStats(s, h),
      tree = G.skillBonuses(h),
      build = G.buildBonuses(s, h);
    const maxHp = Math.max(1, Math.round(a.hp * hpScale));
    return {
      id: h.id,
      name: h.name,
      role: h.role,
      hp: maxHp,
      maxHp,
      attack: a.attack * G.partyAttackMultiplier(s),
      defense: (a.defense + aura) * (s.research.includes('wards') ? 1.2 : 1),
      crit: a.crit,
      dodge: a.dodge,
      critDamage: a.critDamage,
      pierce: a.pierce,
      ranged: a.ranged,
      resistance: Math.min(
        0.75,
        (element === 'physical' ? 0 : a[element]) +
          (G.hasPreparedPotion(s, element) ? 0.2 : 0),
      ),
      shield: 0,
      shieldTurns: 0,
      evasion: 0,
      castThisRound: '',
      cooldowns: Object.fromEntries(
        combatSkills(s, h.id).map((skill) => [skill.id, 0]),
      ),
      ward: 0,
      burn: 0,
      regen: 0,
      regenTurns: 0,
      guard: 1,
      preventBurn: false,
      healing: Math.max(
        0.1,
        Math.min(3, 1 + tree.healing + (build.healing || 0)),
      ),
      shieldPower: Math.max(
        0.1,
        Math.min(3, 1 + tree.shield + (build.shield || 0)),
      ),
      cooldownReduction: Math.min(0.3, tree.cooldown + (build.cooldown || 0)),
      projectChoices: G.PROJECTS.flatMap((project) =>
        project.choices
          .filter((choice) => G.chosen(s, project.id, choice.id))
          .map((choice) => `${project.id}:${choice.id}`),
      ),
      ...(G.equippedSets(s, h).some((set) => set.count >= 4)
        ? {
            setEffect: Sets.createSetEffect(
              G.equippedSets(s, h).find((set) => set.count >= 4)!.id,
            ),
          }
        : {}),
    };
  });
}
function sync(b: G.Battle) {
  b.resistance =
    b.units.reduce((sum, u) => sum + u.resistance, 0) /
    Math.max(1, b.units.length);
  b.hp = b.units.reduce((sum, u) => sum + u.hp, 0);
  b.maxHp = b.units.reduce((sum, u) => sum + u.maxHp, 0);
  b.cooldowns = Object.fromEntries(
    b.units.map((u) => [u.id, Math.max(0, ...Object.values(u.cooldowns))]),
  );
  b.ward = Math.max(0, ...b.units.map((u) => u.ward));
  b.burn = Math.max(0, ...b.units.map((u) => u.burn));
  if (!alive(b).some((u) => u.id === b.selected && !b.acted.includes(u.id)))
    b.selected = alive(b).find((u) => !b.acted.includes(u.id))?.id || '';
}
function chooseTarget(b: G.Battle) {
  const candidates = alive(b);
  if (!candidates.length) return '';
  const weights = candidates.map((u) =>
    ['rhea', 'orin'].includes(u.role) ? 3 : 1,
  );
  let pick = rand(b) * weights.reduce((a, c) => a + c, 0);
  for (let i = 0; i < candidates.length; i++) {
    pick -= weights[i];
    if (pick < 0) return candidates[i].id;
  }
  return candidates[0].id;
}
export function createCombat(
  s: G.State,
  region: number,
  kind: 'boss' | 'guardian',
  node = s.guild.depths[region],
): G.Battle {
  const enemy = enemyDefinition(s, region, kind, node),
    stats = G.partyStats(s);
  G.guildRandom(s);
  const b: G.Battle = {
    system: 2,
    kind,
    node,
    region,
    units: makeUnits(s, region, enemy.element),
    acted: [],
    selected: s.party[0],
    target: '',
    healTarget: '',
    enemyName: enemy.name,
    enemyMaxHp: enemy.hp,
    enemyHp: enemy.hp,
    enemyAttack: enemy.attack,
    enemyDefense:
      enemy.defense * (kind === 'boss' ? G.bossArmorScale(s, region) : 1),
    enemyCrit: enemy.crit,
    enemyDodge: enemy.dodge,
    enemyElement: enemy.element,
    pattern: [...enemy.pattern],
    aoeScale: enemy.aoeScale,
    rng: s.rng,
    actionCount: 0,
    auto: s.combatAuto,
    interrupted: false,
    shattered: false,
    poison: 0,
    poisonTurns: 0,
    taunt: '',
    hp: stats.hp,
    maxHp: stats.hp,
    attack: stats.attack,
    defense: stats.defense,
    round: 1,
    energy: G.hasTalent(s, 'veteran') ? 6 : 5,
    supplies:
      3 +
      Math.max(0, s.buildings.tavern - 1) +
      (s.guild.preparation.remedy ? 2 : 0),
    healCooldown: 0,
    cooldowns: {},
    ...G.battleModifiers(s, region),
    ward: 0,
    marked: 0,
    burn: 0,
    enemyShield: 0,
    sealed: 0,
    history: [
      `${enemy.name}拦住去路。每名存活角色每轮行动一次，随后敌人出手。`,
    ],
  };
  sync(b);
  b.target = chooseTarget(b);
  b.dots = [];
  if (kind === 'boss') prepareBoss(b, false);
  return b;
}
function prepareBoss(b: G.Battle, rollTarget = true) {
  const prepared = Boss.prepareBossRound(b);
  b.boss = prepared.runtime;
  if (!prepared.entered) return;
  b.enemyShield = prepared.barrier;
  b.target = Boss.bossTarget(
    b,
    prepared.targetRule,
    rollTarget && prepared.targetRule === 'weighted'
      ? chooseTarget(b)
      : b.target,
  );
  if (prepared.transitioned)
    note(
      b,
      `首领进入「${Boss.bossDefinition(b.region).phaseNames[1]}」，新招式已预告。`,
    );
}
export function beginBattle(
  s0: G.State,
  region: number,
  kind: 'boss' | 'guardian',
  node = s0.guild.depths[region],
  origin: 'manual' | 'hunt' = 'manual',
) {
  if (
    !Number.isInteger(region) ||
    region < 0 ||
    region > 5 ||
    !['boss', 'guardian'].includes(kind) ||
    (kind === 'boss'
      ? G.bossReason(s0, region)
      : guardianReason(s0, region, node))
  )
    return s0;
  const s = G.clone(s0);
  if (origin !== 'hunt') G.haltHunt(s, '已开始手动挑战');
  spend(s, G.battlePreparationCost(s));
  s.battle = createCombat(
    s,
    region,
    kind,
    kind === 'boss' ? s.guild.depths[region] : node,
  );
  G.consumePreparedPotion(s);
  if (kind === 'boss' || guardianRematch(s, region, node))
    s.order.enabled = false;
  G.log(
    s,
    `${kind === 'boss' ? '首领战' : guardianRematch(s, region, node) ? '守敌再战' : '据点守敌战'}开始：${s.battle.enemyName}。`,
    'danger',
  );
  return s;
}
export function enemyIntent(b: G.Battle) {
  if (b.boss) {
    const r = Boss.bossResolution(b),
      step = r.step;
    const target =
      b.units.find((u) => u.id === (b.taunt || b.target))?.name || '前排';
    return {
      kind: step.kind,
      name: step.name,
      hint: `${r.heavy ? '目标：全体。' : `目标：${target}。`}${step.hint}`,
      heavy: r.heavy,
      mult: r.attackScale,
      enraged: b.round > 30,
    };
  }
  const cycles = [
    ['strike', 'strike', 'heavy'],
    ['ward', 'strike', 'heavy', 'strike'],
    ['heavy', 'strike', 'restore', 'strike'],
    ['strike', 'channel', 'strike', 'heavy'],
    ['flight', 'heavy', 'strike', 'heavy'],
    ['seal', 'strike', 'channel', 'heavy'],
  ];
  const pattern = b.pattern || cycles[b.region],
    kind = pattern[(b.round - 1) % pattern.length];
  const names: Record<string, string> = {
    strike: '定向攻击',
    heavy: '横扫重击',
    ward: '护盾结界',
    restore: '恢复补给',
    channel: '毁灭咏唱',
    flight: '升空俯冲',
    seal: '封禁治疗',
  };
  const target =
    b.units?.find((u) => u.id === (b.taunt || b.target))?.name || '前排';
  const hints: Record<string, string> = {
    strike: `目标：${target}。该角色可防御，或由同伴提供护盾与治疗。`,
    heavy: '攻击全体存活角色。逐人防御、护佑或提前治疗；重击不会暴击。',
    ward: '本轮攻击受结界减伤，破势或破盾技能可拆除。',
    restore: '本轮结束恢复16%生命，破势或打断技能可阻止。',
    channel: '本轮结束发动群体重击，打断可大幅减伤并留下破绽。',
    flight: `目标：${target}。远程攻击正常命中，近战本轮伤害降低。`,
    seal: '本轮与下一轮封印治疗，护盾、防御和伤害仍可使用。',
  };
  return {
    kind,
    name: names[kind] || '攻势',
    hint: hints[kind] || '',
    heavy: ['heavy', 'channel'].includes(kind),
    mult:
      kind === 'heavy'
        ? 2.1
        : kind === 'channel'
          ? 2.8
          : ['ward', 'seal'].includes(kind)
            ? 0.6
            : 1,
    enraged: b.round > 30,
  };
}
export const commandFor = (
  id: string,
  action: string,
  target?: string,
): G.Command => `unit:${id}:${action}${target ? ':' + target : ''}`;
function parse(s: G.State, command: G.Command) {
  const b = s.battle;
  if (command.startsWith('unit:')) {
    const [, id, action, target] = command.split(':');
    return { id, action, target };
  }
  if (command.startsWith('hero:')) {
    const id = command.slice(5);
    return {
      id,
      action: s.heroes.find((h) => h.id === id)
        ? G.heroSkill(s.heroes.find((h) => h.id === id)!).id
        : '',
    };
  }
  return { id: b?.selected || '', action: command };
}
function healTarget(b: G.Battle) {
  return (
    alive(b).find((u) => u.id === b.healTarget) ||
    alive(b).sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp)[0]
  );
}
export function tacticalReason(s: G.State, command: G.Command) {
  const b = s.battle;
  if (!b) return '尚未进入战斗';
  if (command === 'retreat') return '';
  const { id, action, target } = parse(s, command),
    unit = b.units.find((u) => u.id === id);
  if (target && !alive(b).some((u) => u.id === target)) return '治疗目标不可用';
  if (!unit) return '请选择出战角色';
  if (unit.hp <= 0) return '该角色已倒下';
  if (b.acted.includes(id)) return '该角色本轮已行动';
  const skill: G.SkillDefinition | undefined = combatSkills(s, id).find(
    (sk) => sk.id === action,
  );
  if (!['attack', 'guard', 'break', 'heal'].includes(action) && !skill)
    return '未携带这项技能';
  if (skill && unit.cooldowns[skill.id] > 0)
    return `个人冷却 ${unit.cooldowns[skill.id]} 回合`;
  const cost = skill?.energy || (action === 'break' ? 2 : 0);
  if (b.energy < cost) return `需要 ${cost} 点士气`;
  if ((action === 'heal' || skill?.supply) && b.supplies <= 0)
    return '药囊已用尽';
  if (action === 'heal' && b.healCooldown > 0)
    return `药囊冷却 ${b.healCooldown} 回合`;
  if (
    (action === 'heal' || skill?.heal || skill?.healing) &&
    (b.sealed > 0 || enemyIntent(b).kind === 'seal') &&
    !battleChosen(s, 'key', 'cut') &&
    !Sets.sealPurified(b) &&
    !(skill?.cleanseBurn && Sets.hasSet(unit, 'dawnbreak'))
  )
    return '治疗已被封禁';
  const patient =
    skill?.target === 'self'
      ? unit
      : target
        ? alive(b).find((u) => u.id === target)!
        : healTarget(b);
  if (
    (action === 'heal' ||
      (skill?.healing &&
        !skill.damage &&
        !skill.shield &&
        !skill.regen &&
        skill.target !== 'party')) &&
    patient.hp === patient.maxHp &&
    !patient.burn &&
    !Sets.canPrepareOverflow(unit, patient)
  )
    return '所选治疗目标生命已满';
  if (
    skill?.healing &&
    !skill.damage &&
    !skill.shield &&
    !skill.regen &&
    skill.target === 'party' &&
    alive(b).every((u) => u.hp === u.maxHp && !Sets.canPrepareOverflow(unit, u))
  )
    return '全员生命已满';
  return '';
}
export function selectCombatUnit(s0: G.State, id: string) {
  const b = s0.battle;
  if (
    !b ||
    !b.units.some((u) => u.id === id && u.hp > 0 && !b.acted.includes(id)) ||
    b.selected === id
  )
    return s0;
  const s = G.clone(s0);
  s.battle!.selected = id;
  return s;
}
export function selectHealTarget(s0: G.State, id: string) {
  if (
    !s0.battle ||
    (id && !alive(s0.battle).some((u) => u.id === id)) ||
    s0.battle.healTarget === id
  )
    return s0;
  const s = G.clone(s0);
  s.battle!.healTarget = id;
  return s;
}
export function setCombatAuto(s0: G.State, enabled: boolean) {
  if (typeof enabled !== 'boolean') return s0;
  const s = G.clone(s0);
  s.combatAuto = enabled;
  if (!enabled) G.haltHunt(s, '已切换为手动战斗');
  if (s.battle) s.battle.auto = enabled;
  return s;
}
function healUnit(
  b: G.Battle,
  u: CombatUnit,
  amount: number,
  source?: CombatUnit,
) {
  const restored = Math.min(u.maxHp - u.hp, Math.max(0, Math.round(amount)));
  u.hp += restored;
  if (restored) note(b, `${u.name}恢复 ${restored} 生命。`);
  Sets.overflowShield(b, source, u, Math.max(0, Math.round(amount) - restored));
  return restored;
}
function finish(s: G.State, won: boolean, retreat = false) {
  const b = s.battle!;
  const firstGuardian =
    b.kind === 'guardian' && s.guild.depths[b.region] === b.node;
  s.lastBattle = {
    region: b.region,
    kind: b.kind,
    node: b.node,
    enemy: b.enemyName,
    won,
    retreated: retreat,
    rounds: b.round,
    history: [...b.history],
    survivors: alive(b).length,
    time: s.time,
    hp: b.units.reduce((total, u) => total + u.hp, 0),
    maxHp: b.maxHp,
    loot: null,
  };
  if (won) {
    if (b.kind === 'guardian') {
      if (firstGuardian) {
        s.guild.depths[b.region]++;
        s.guild.progress[b.region] = 0;
        s.guild.failures[b.region] = 0;
        G.awardXP(s, 45 + b.region * 35 + b.node * 15);
        G.log(
          s,
          `击败${b.enemyName}，占领${G.FRONTIERS[b.region][b.node]}！${G.FRONTIER_REWARDS[b.node]}`,
          'story',
        );
      }
      s.guild.guardianHunts ||= { readyAt: [0, 0, 0, 0, 0, 0] };
      s.guild.guardianHunts.readyAt[b.region] =
        s.time + GUARDIAN_REMATCH_SECONDS;
    } else if (!s.cleared.includes(b.region)) {
      s.cleared.push(b.region);
      G.grant(s, G.REGIONS[b.region].first);
      G.awardXP(s, 90 + b.region * 30);
      G.log(s, `击败${b.enemyName}！${G.REGIONS[b.region].story}`, 'story');
      if (s.cleared.length === 6) {
        s.ending = true;
        G.log(
          s,
          '诸神黄昏之后，生活仍要继续。三项重建等待你把故事写完。',
          'ending',
        );
      }
    }
    s.lastBattle.loot =
      G.monsterEquipment(s, b.region, b.kind, firstGuardian) || null;
    if (b.kind === 'boss') {
      s.guild.bossHunts ||= {
        wins: [0, 0, 0, 0, 0, 0],
        readyAt: [0, 0, 0, 0, 0, 0],
      };
      s.guild.bossHunts.wins[b.region]++;
      s.guild.bossHunts.readyAt[b.region] = s.time + 180;
    }
    G.log(
      s,
      `${b.enemyName} · 胜利，${b.round} 回合，${alive(b).length}/${b.units.length} 人仍能战斗。`,
      'good',
    );
  } else {
    s.order.enabled = false;
    s.recoveryUntil = s.time + 30;
    G.log(
      s,
      `${retreat ? '主动撤退' : '战败撤回'}：${b.enemyName}。休整30秒；已有据点、路线推进和装备保留。`,
      'danger',
    );
  }
  s.battle = null;
  G.finishHuntBattle(s, b, won, retreat);
  return s;
}
/** Visible damage estimate shared by actual resolution and automatic defensive choices. */
export function incomingDamage(s: G.State, unit: CombatUnit, critical = false) {
  const b = s.battle!,
    w = enemyIntent(b),
    boss = b.boss ? Boss.bossResolution(b) : null;
  let damage =
    b.enemyAttack *
    (boss
      ? boss.attackScale * (w.heavy ? b.aoeScale : 1)
      : w.heavy
        ? b.aoeScale * (w.kind === 'channel' ? 1.25 : 1)
        : ['ward', 'seal'].includes(w.kind)
          ? 0.65
          : 1);
  damage *=
    (100 / (100 + unit.defense * (1 - (boss?.ignoreArmor || 0)))) *
    (1 - unit.resistance) *
    unit.guard *
    (unit.ward > 0 ? 0.55 : 1) *
    (critical ? 1.5 : 1);
  damage *= 1 + Math.max(0, b.round - 30) * 0.16;
  if (!boss && b.interrupted && w.kind === 'channel') damage *= 0.2;
  if (w.heavy && battleChosen(s, 'bell', 'alarm')) damage *= 0.85;
  if (battleChosen(s, 'key', 'chorus')) damage *= 0.9;
  damage *= 1 - s.guild.outposts[b.region] * 0.05;
  damage *=
    s.guild.preparation.stance === 'cautious'
      ? 0.9
      : s.guild.preparation.stance === 'assault'
        ? 1.12
        : 1;
  return Math.max(1, Math.round(damage));
}
function enemyTurn(s: G.State) {
  const b = s.battle!,
    warning = enemyIntent(b);
  if (b.poisonTurns > 0) {
    b.enemyHp = Math.max(0, b.enemyHp - b.poison);
    b.poisonTurns--;
    note(b, `持续伤害造成 ${b.poison}。`);
    if (b.enemyHp <= 0) return finish(s, true);
  }
  const boss = b.boss ? Boss.bossResolution(b) : null;
  for (const effect of b.dots || [])
    if (effect.turns > 0) {
      const hit = Boss.absorbBossBarrier(b.enemyShield, effect.damage);
      b.enemyShield = hit.remaining;
      b.enemyHp = Math.max(0, b.enemyHp - hit.hpDamage);
      effect.turns--;
      note(
        b,
        `${b.units.find((u) => u.id === effect.source)?.name || '旅人'}的${effect.kind === 'fire' ? '燃烧' : '毒伤'}造成 ${hit.hpDamage} 伤害。`,
      );
    }
  if (b.dots) b.dots = b.dots.filter((e) => e.turns > 0);
  if (b.enemyHp <= 0) return finish(s, true);
  const healing = boss
    ? boss.healFraction
    : warning.kind === 'restore' && !b.interrupted
      ? 0.16
      : warning.kind === 'channel' &&
          !b.interrupted &&
          b.region === 5 &&
          b.kind === 'boss'
        ? 0.08
        : 0;
  if (healing) {
    const amount = Math.round(b.enemyMaxHp * healing);
    b.enemyHp = Math.min(b.enemyMaxHp, b.enemyHp + amount);
    note(b, `敌人恢复 ${amount} 生命。`);
  }
  if (
    warning.kind === 'seal' &&
    !battleChosen(s, 'key', 'cut') &&
    !Sets.sealPurified(b)
  )
    b.sealed = boss ? boss.sealRounds : 2;
  if (!b.boss && warning.kind === 'channel' && b.interrupted) {
    b.marked = 2;
    note(b, '咏唱被打断，留下两次攻击破绽。');
  }
  const targets = warning.heavy
    ? alive(b)
    : [
        alive(b).find((u) => u.id === (b.taunt || b.target)) || alive(b)[0],
      ].filter(Boolean);
  const projectCounters = new Set<string>();
  for (const unit of targets)
    for (let hit = 0; hit < (boss?.hits || 1); hit++) {
      if (unit.hp <= 0) break;
      const dodgeRoll = rand(b),
        critRoll = rand(b);
      if (
        !warning.heavy &&
        dodgeRoll < Math.min(0.4, unit.dodge + unit.evasion)
      ) {
        note(b, `${unit.name}闪避了${warning.name}。`);
        Sets.afterSetHit(b, unit, true, false, 0);
        if (b.enemyHp <= 0) return finish(s, true);
        continue;
      }
      const critical = !warning.heavy && critRoll < b.enemyCrit;
      let damage = incomingDamage(s, unit, critical);
      const protectedHit = unit.guard < 1 || unit.ward > 0 || unit.shield > 0;
      const guardedDamage = damage;
      const absorbed = Math.min(unit.shield, damage);
      unit.shield -= absorbed;
      damage -= absorbed;
      unit.hp = Math.max(0, unit.hp - damage);
      note(
        b,
        `${warning.name} → ${unit.name}${critical ? ' · 暴击' : ''}，${damage} 伤害${absorbed ? `，护盾吸收 ${absorbed}` : ''}${unit.hp === 0 ? '，倒下' : ''}。`,
      );
      Sets.afterSetHit(b, unit, false, protectedHit, guardedDamage);
      if (
        unit.hp > 0 &&
        unit.guard <= 0.25 &&
        battleChosen(s, 'array', 'shields') &&
        !projectCounters.has(unit.id)
      ) {
        projectCounters.add(unit.id);
        Sets.responseDamage(b, unit, unit.attack * 0.4, '坚守护盾阵反击');
      }
      if (b.enemyHp <= 0) return finish(s, true);
      if (
        unit.hp > 0 &&
        (boss
          ? boss.burnRounds > 0 && damage > 0
          : b.enemyElement === 'fire' && warning.heavy) &&
        !unit.preventBurn &&
        unit.guard > 0.3
      )
        unit.burn = 2;
      if (
        unit.hp > 0 &&
        unit.guard <= 0.3 &&
        warning.heavy &&
        battleChosen(s, 'dragon', 'blood')
      ) {
        healUnit(b, unit, unit.maxHp * 0.08);
        unit.burn = 0;
      }
    }
  for (const unit of b.units) {
    if (unit.hp > 0 && unit.burn > 0) {
      const damage = Math.max(1, Math.round(unit.maxHp * 0.035));
      unit.hp = Math.max(0, unit.hp - damage);
      unit.burn--;
      note(b, `${unit.name}灼烧 ${damage}${!unit.hp ? '，倒下' : ''}。`);
    }
    if (unit.hp > 0 && unit.regenTurns > 0) {
      if (!b.sealed || battleChosen(s, 'key', 'cut'))
        healUnit(b, unit, unit.regen);
      unit.regenTurns--;
    }
    for (const key of Object.keys(unit.cooldowns))
      if (key !== unit.castThisRound)
        unit.cooldowns[key] = Math.max(0, unit.cooldowns[key] - 1);
    unit.castThisRound = '';
    unit.evasion = 0;
    unit.shieldTurns = Math.max(0, unit.shieldTurns - 1);
    if (!unit.shieldTurns) unit.shield = 0;
    unit.guard = 1;
    unit.preventBurn = false;
    unit.ward = Math.max(0, unit.ward - 1);
  }
  b.healCooldown = Math.max(0, b.healCooldown - 1);
  b.sealed = Math.max(0, b.sealed - 1);
  b.enemyShield = 0;
  b.shattered = false;
  b.interrupted = false;
  b.taunt = '';
  b.acted = [];
  b.round++;
  sync(b);
  if (!b.hp || b.round > 60) return finish(s, false);
  if (b.boss) prepareBoss(b);
  else b.target = chooseTarget(b);
  return s;
}
export function tacticalCombat(
  s0: G.State,
  command: G.Command,
  automatic = false,
): G.State {
  if (!s0.battle || tacticalReason(s0, command)) return s0;
  const s = G.clone(s0),
    b = s.battle!;
  if (!automatic && command !== 'retreat' && s.hunt?.enabled) {
    G.haltHunt(s, '已手动接管战斗');
    b.auto = false;
  }
  if (command === 'retreat') return finish(s, false, true);
  const { id, action, target } = parse(s, command),
    u = b.units.find((x) => x.id === id)!;
  if (target) b.healTarget = target;
  const skill: G.SkillDefinition | undefined = combatSkills(s, id).find(
    (x) => x.id === action,
  );
  const warning = enemyIntent(b);
  const exposedBefore = b.boss ? Boss.bossResolution(b).exposeHits : 0;
  let multiplier = 0,
    projectile = false;
  if (action === 'attack') {
    multiplier = 1;
    b.energy = Math.min(10, b.energy + 1);
  }
  if (action === 'guard') {
    u.guard = 0.25;
    b.energy = Math.min(
      10,
      b.energy + 1 + (battleChosen(s, 'array', 'shields') ? 1 : 0),
    );
    note(b, `${u.name}坚守，本轮承伤降低75%。`);
  }
  if (action === 'break') {
    multiplier = 0.85 * (battleChosen(s, 'key', 'cut') ? 1.1 : 1);
    b.energy -= 2;
    b.interrupted = true;
    b.shattered = true;
    note(b, `${u.name}破势，打断本轮咏唱与恢复、拆除结界。`);
    if (warning.heavy && battleChosen(s, 'array', 'chant')) {
      for (const friend of alive(b))
        friend.guard = Math.min(friend.guard, 0.35);
      note(b, '破咒战歌回应破势，本轮全队来袭伤害降低65%。');
    }
  }
  if (action === 'heal') {
    const target = healTarget(b);
    healUnit(
      b,
      target,
      target.maxHp *
        (0.38 +
          (G.hasRole(s, 'luna') ? 0.05 : 0) +
          (G.hasTalent(s, 'healer') ? 0.05 : 0) +
          (battleChosen(s, 'bell', 'home') ? 0.05 : 0)),
      u,
    );
    target.burn = 0;
    b.supplies--;
    b.healCooldown = 2;
  }
  if (skill) {
    b.energy -= skill.energy;
    u.cooldowns[skill.id] = Math.max(
      1,
      Math.ceil(skill.cooldown * (1 - u.cooldownReduction)),
    );
    u.castThisRound = skill.id;
    multiplier =
      skill.damage * (b.region >= 4 ? skill.lateBossMultiplier || 1 : 1);
    projectile = !!skill.projectile;
    note(b, `${u.name}使用「${skill.name}」。`);
    if (skill.interrupt) b.interrupted = true;
    if (skill.shatter) b.shattered = true;
    const targets =
      skill.target === 'party'
        ? alive(b)
        : [skill.target === 'ally' ? healTarget(b) : u];
    if (skill.incomingMultiplier)
      for (const target of targets)
        target.guard = Math.min(target.guard, skill.incomingMultiplier);
    if (skill.wardHits)
      for (const friend of targets)
        friend.ward = Math.max(friend.ward, skill.wardHits);
    if (skill.cleanseBurn) {
      const cleansed = targets.some((friend) => friend.burn > 0);
      const seal = b.sealed > 0 || warning.kind === 'seal';
      for (const friend of targets) friend.burn = 0;
      if (cleansed || seal) Sets.dawnResponse(b, u, seal);
    }
    if (skill.preventBurn)
      for (const friend of targets) friend.preventBurn = true;
    if (skill.healing)
      for (const target of targets)
        healUnit(
          b,
          target,
          (u.attack * skill.healing.actorAttack +
            u.maxHp * skill.healing.actorHp +
            target.maxHp * skill.healing.targetHp) *
            u.healing,
          u,
        );
    if (skill.shield)
      for (const target of targets) {
        target.shield = Math.min(
          Math.round(target.maxHp * 0.6),
          Math.max(
            target.shield,
            Math.round(
              (u.attack * skill.shield.actorAttack +
                u.maxHp * skill.shield.actorHp) *
                u.shieldPower,
            ),
          ),
        );
        target.shieldTurns = Math.max(target.shieldTurns, skill.shield.rounds);
      }
    if (skill.dot) {
      b.dots ||= [];
      const existing = b.dots.find(
        (e) => e.source === u.id && e.kind === skill.dot!.kind,
      );
      const effect = {
        source: u.id,
        kind: skill.dot.kind,
        damage: Math.round(u.attack * skill.dot.actorAttack),
        turns: skill.dot.rounds,
      };
      if (existing) Object.assign(existing, effect);
      else b.dots.push(effect);
    }
    if (skill.regen)
      for (const target of targets) {
        target.regen = Math.max(
          target.regen,
          Math.round(
            (u.attack * skill.regen.actorAttack +
              u.maxHp * skill.regen.actorHp) *
              u.healing,
          ),
        );
        target.regenTurns = Math.max(target.regenTurns, skill.regen.rounds);
      }
    if (skill.evasion) u.evasion = skill.evasion;
    if (skill.taunt) b.taunt = u.id;
    if (skill.supply) b.supplies -= skill.supply;
    if (skill.energyRefund)
      b.energy = Math.min(10, b.energy + skill.energyRefund);
  }
  if (b.boss && b.shattered) {
    if (b.enemyShield > 0) {
      b.enemyShield = 0;
      note(b, '结界已击碎。');
    }
  }
  if (b.boss && (action === 'break' || skill?.shatter || skill?.interrupt)) {
    const expose = Boss.bossResolution(b).exposeHits;
    if (expose && !exposedBefore) {
      b.marked = Math.max(b.marked, expose);
      note(b, `反制成功，留下${expose}次攻击破绽。`);
    }
  }
  if (
    (warning.kind === 'ward' &&
      b.shattered &&
      (action === 'break' || skill?.shatter)) ||
    (['channel', 'restore'].includes(warning.kind) &&
      b.interrupted &&
      (action === 'break' || skill?.interrupt))
  )
    Sets.dawnResponse(b, u, false);
  const detonate =
    !!skill?.detonateFire ||
    (action === 'break' && Sets.hasSet(u, 'abysswalk'));
  if (detonate) Sets.detonateFire(b, u, !!skill?.detonateFire);
  if (multiplier > 0) {
    const marked = b.marked > 0;
    if (marked) b.marked--;
    const dodgeRoll = rand(b),
      critRoll = rand(b);
    const dodged = dodgeRoll < b.enemyDodge,
      critical =
        !dodged && critRoll < Math.min(0.6, u.crit + (skill?.critBonus || 0));
    const storedPower = Sets.takeStoredPower(u);
    const weakPierce = Sets.consumeWeakness(b, u);
    let damage =
      (u.attack * multiplier + storedPower) *
      b.bonus *
      (marked ? 1.2 : 1) *
      (critical ? u.critDamage : 1);
    damage *=
      100 /
      (100 +
        b.enemyDefense *
          (b.boss ? Boss.bossResolution(b).armorScale : 1) *
          (1 -
            Math.min(0.75, u.pierce + (skill?.pierceBonus || 0) + weakPierce)) *
          (battleChosen(s, 'dragon', 'spear') ? 0.5 : 1));
    if (b.boss) damage *= Boss.bossPlayerDamageScale(b, projectile, u.ranged);
    if (!b.boss && warning.kind === 'flight' && !projectile)
      damage *= 0.25 + 0.75 * u.ranged;
    if (!b.boss && warning.kind === 'ward' && !b.shattered) damage *= 0.4;
    damage = dodged ? 0 : Math.max(1, Math.round(damage));
    const barrierHit = Boss.absorbBossBarrier(b.enemyShield, damage);
    b.enemyShield = barrierHit.remaining;
    damage = barrierHit.hpDamage;
    if (barrierHit.absorbed)
      note(b, `敌方结界吸收 ${barrierHit.absorbed} 伤害。`);
    b.enemyHp = Math.max(0, b.enemyHp - damage);
    note(
      b,
      `${u.name}${critical ? ' · 暴击' : ''}${dodged ? '的攻击被闪避' : `造成 ${damage} 伤害`}。`,
    );
    if (!dodged) {
      if (action === 'break' || skill?.shatter || skill?.pierceBonus)
        Sets.leaveWeakness(b, u);
      if (skill && !detonate) Sets.igniteSet(b, u);
    }
  }
  if (skill?.markHits) b.marked = skill.markHits;
  b.acted.push(id);
  b.actionCount++;
  sync(b);
  if (b.enemyHp <= 0) return finish(s, true);
  if (alive(b).every((unit) => b.acted.includes(unit.id))) return enemyTurn(s);
  return s;
}
/** Deterministic heuristic; uses visible intent and attributes, never future random rolls. */
export function autoCommand(s: G.State): G.Command {
  const b = s.battle;
  if (!b) return 'attack';
  const units = alive(b).filter((u) => !b.acted.includes(u.id)),
    w = enemyIntent(b);
  const lowest = alive(b).sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp)[0];
  const options = units
    .flatMap((u) =>
      combatSkills(s, u.id).map((skill) => ({
        u,
        skill,
        command: commandFor(
          u.id,
          skill.id,
          skill.target === 'ally' ? lowest?.id : undefined,
        ),
      })),
    )
    .filter((x) => !tacticalReason(s, x.command));
  if ((w.kind === 'seal' || b.sealed > 0) && !Sets.sealPurified(b)) {
    const cleanser = options.find(
      (x) => x.skill.cleanseBurn && Sets.hasSet(x.u, 'dawnbreak'),
    );
    if (cleanser) return cleanser.command;
  }
  if (
    ['channel', 'restore', 'ward', ...(b.boss ? ['flight'] : [])].includes(
      w.kind,
    ) &&
    !(w.kind === 'ward' ? b.shattered : b.interrupted)
  ) {
    const counter = options
      .filter((x) => (w.kind === 'ward' ? x.skill.shatter : x.skill.interrupt))
      .sort(
        (a, c) => c.u.attack * c.skill.damage - a.u.attack * a.skill.damage,
      )[0];
    if (counter) return counter.command;
    const breaker = units.find(
      (u) => !tacticalReason(s, commandFor(u.id, 'break')),
    );
    if (breaker) return commandFor(breaker.id, 'break');
  }
  if (lowest && lowest.hp / lowest.maxHp < 0.55) {
    const healer = options
      .filter(
        (x) =>
          (!!x.skill.heal || !!x.skill.healing) &&
          (x.skill.target !== 'self' || x.u.id === lowest.id),
      )
      .sort((a, c) => c.u.attack - a.u.attack)[0];
    if (healer)
      return commandFor(
        healer.u.id,
        healer.skill.id,
        healer.skill.target === 'ally' ? lowest.id : undefined,
      );
    const supplier = units.find(
      (u) => !tacticalReason(s, commandFor(u.id, 'heal', lowest.id)),
    );
    if (supplier) return commandFor(supplier.id, 'heal', lowest.id);
  }
  if (w.heavy && !b.interrupted) {
    const shieldHealer = options.find(
      (x) =>
        x.skill.healing &&
        Sets.hasSet(x.u, 'nightbell') &&
        alive(b).some(
          (friend) =>
            friend.hp / friend.maxHp > 0.8 &&
            Sets.canPrepareOverflow(x.u, friend),
        ),
    );
    if (shieldHealer) return shieldHealer.command;
    const protector = options.find(
      (x) =>
        (!!x.skill.wardHits && b.ward === 0) ||
        (!!x.skill.shield && alive(b).some((u) => !u.shield)) ||
        (!!x.skill.incomingMultiplier &&
          x.skill.target === 'party' &&
          alive(b).some((u) => u.guard === 1)),
    );
    if (protector) return protector.command;
    const threatened = units.find(
      (u) =>
        incomingDamage(s, u) * (b.boss ? Boss.bossResolution(b).hits : 1) >
        u.hp * 0.42,
    );
    if (threatened) return commandFor(threatened.id, 'guard');
  }
  const target = units.find((u) => u.id === (b.taunt || b.target));
  if (
    !w.heavy &&
    target &&
    incomingDamage(s, target) * (b.boss ? Boss.bossResolution(b).hits : 1) >
      target.hp * 0.7
  )
    return commandFor(target.id, 'guard');
  if (b.burn > 0) {
    const burned = alive(b)
      .filter((u) => u.burn > 0)
      .sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp)[0];
    for (const option of options.filter(
      (x) => x.skill.cleanseBurn && !x.skill.heal,
    )) {
      if (option.skill.target === 'self' && !option.u.burn) continue;
      if (option.skill.target === 'ally' && !burned) continue;
      const command = commandFor(
        option.u.id,
        option.skill.id,
        option.skill.target === 'ally' ? burned.id : undefined,
      );
      if (!tacticalReason(s, command)) return command;
    }
  }
  const renewal = options.find(
    (x) =>
      x.skill.regen &&
      alive(b).some((u) => u.hp < u.maxHp * 0.85 && !u.regenTurns),
  );
  if (renewal && b.energy >= 3 && !b.sealed && w.kind !== 'seal')
    return renewal.command;
  const detonator = options.find(
    (x) =>
      x.skill.detonateFire &&
      Sets.firePotential(b, x.u, true) >= x.u.attack * 0.7,
  );
  if (detonator) return detonator.command;
  const setDetonator = units.find(
    (u) =>
      Sets.hasSet(u, 'abysswalk') &&
      Sets.firePotential(b, u) >= u.attack * 0.6 &&
      !tacticalReason(s, commandFor(u.id, 'break')),
  );
  if (setDetonator) return commandFor(setDetonator.id, 'break');
  const attacks = options
    .filter((x) => x.skill.damage > 1 || x.skill.dot || x.skill.markHits)
    .sort(
      (a, c) =>
        c.u.attack * (c.skill.damage + (c.skill.dot?.actorAttack || 0)) -
        a.u.attack * (a.skill.damage + (a.skill.dot?.actorAttack || 0)),
    );
  if (attacks.length && b.energy >= 3) return attacks[0].command;
  return commandFor(
    units.sort((a, c) => c.attack - a.attack)[0]?.id || b.selected,
    'attack',
  );
}
export function migrateBattle(s: G.State) {
  const old = s.battle!,
    seed = s.rng,
    hpRatio = old.hp / old.maxHp,
    enemyRatio = old.enemyHp / G.REGIONS[old.region].hp;
  const battle = createCombat(s, old.region, 'boss');
  s.rng = seed;
  battle.round = old.round;
  battle.energy = Math.min(10, old.energy);
  battle.supplies = old.supplies;
  battle.enemyHp = Math.max(1, Math.round(battle.enemyMaxHp * enemyRatio));
  for (const unit of battle.units) {
    delete unit.setEffect;
    delete unit.projectChoices;
    unit.hp = Math.max(1, Math.round(unit.maxHp * hpRatio));
    for (const key of Object.keys(unit.cooldowns))
      unit.cooldowns[key] = old.cooldowns[unit.id] || 0;
  }
  battle.auto = false;
  battle.healCooldown = old.healCooldown;
  battle.marked = old.marked;
  battle.sealed = old.sealed;
  for (const unit of battle.units) {
    unit.ward = old.ward;
    unit.burn = old.burn;
  }
  sync(battle);
  // Migrated shared-health encounters keep their original intent cycle until finished.
  delete battle.boss;
  battle.history = [
    ...old.history,
    '旧战斗按剩余生命比例迁为个人回合制，补给和冷却保留。',
  ].slice(0, 35);
  s.battle = battle;
}
export function validateBattleReport(s: G.State) {
  const r = s.lastBattle;
  if (r === null) return;
  if (
    !r ||
    !Number.isInteger(r.region) ||
    r.region < 0 ||
    r.region > 5 ||
    !['boss', 'guardian'].includes(r.kind) ||
    !Number.isInteger(r.node) ||
    r.node < 0 ||
    r.node > 5 ||
    typeof r.enemy !== 'string' ||
    r.enemy.length > 60 ||
    typeof r.won !== 'boolean' ||
    typeof r.retreated !== 'boolean' ||
    (r.won && r.retreated) ||
    !Number.isInteger(r.rounds) ||
    r.rounds < 1 ||
    r.rounds > 61 ||
    !Number.isInteger(r.survivors) ||
    r.survivors < 0 ||
    r.survivors > 4 ||
    !Number.isFinite(r.time) ||
    r.time < 0 ||
    r.time > s.time ||
    ((r.hp !== undefined || r.maxHp !== undefined) &&
      (!Number.isFinite(r.hp) ||
        !Number.isFinite(r.maxHp) ||
        r.hp! < 0 ||
        r.maxHp! < 1 ||
        r.maxHp! > 1e8 ||
        r.hp! > r.maxHp!)) ||
    !Array.isArray(r.history) ||
    r.history.length > 35 ||
    r.history.some((l) => typeof l !== 'string' || l.length > 300) ||
    (r.loot !== undefined &&
      r.loot !== null &&
      (!G.validLootReceipt(s, r.loot) ||
        !r.won ||
        r.loot.source !== r.kind ||
        r.loot.time !== r.time))
  )
    throw Error('战斗回顾无效');
}
export function validateBattle(s: G.State) {
  const b = s.battle!;
  if (
    b.boss !== undefined &&
    (b.kind !== 'boss' || !Boss.validBossRuntime(b.boss, b.round))
  )
    throw Error('首领阶段无效');
  if (
    b.dots !== undefined &&
    (!Array.isArray(b.dots) ||
      b.dots.length > s.party.length * 2 ||
      new Set(b.dots.map((e) => e.source + ':' + e.kind)).size !==
        b.dots.length ||
      b.dots.some(
        (e) =>
          !s.party.includes(e.source) ||
          !['poison', 'fire'].includes(e.kind) ||
          !Number.isFinite(e.damage) ||
          e.damage < 0 ||
          e.damage > 1e8 ||
          !Number.isInteger(e.turns) ||
          e.turns < 1 ||
          e.turns > 3,
      ))
  )
    throw Error('持续伤害记录无效');
  const n = (v: unknown, min = 0, max = 1e8) =>
    typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  const i = (v: unknown, min = 0, max = 1e8) =>
    n(v, min, max) && Number.isInteger(v);
  if (
    typeof b.enemyName !== 'string' ||
    b.enemyName.length > 60 ||
    typeof b.selected !== 'string' ||
    typeof b.target !== 'string' ||
    typeof b.taunt !== 'string' ||
    typeof b.healTarget !== 'string' ||
    !['physical', 'shadow', 'fire', 'radiant'].includes(b.enemyElement) ||
    b.system !== 2 ||
    !['boss', 'guardian'].includes(b.kind) ||
    !i(b.node, 0, 5) ||
    !Array.isArray(b.units) ||
    b.units.length !== s.party.length ||
    new Set(b.units.map((u) => u.id)).size !== b.units.length ||
    !Array.isArray(b.acted) ||
    new Set(b.acted).size !== b.acted.length ||
    b.acted.some((id) => !s.party.includes(id)) ||
    !i(b.rng, 1, 4294967295) ||
    !i(b.actionCount) ||
    typeof b.auto !== 'boolean' ||
    typeof b.interrupted !== 'boolean' ||
    typeof b.shattered !== 'boolean' ||
    !n(b.enemyMaxHp, 1) ||
    !n(b.enemyAttack, 1) ||
    !n(b.enemyDefense) ||
    !n(b.enemyCrit, 0, 0.6) ||
    !n(b.enemyDodge, 0, 0.4) ||
    !n(b.aoeScale, 0, 3) ||
    !n(b.poison) ||
    !i(b.poisonTurns, 0, 4) ||
    !Array.isArray(b.pattern) ||
    !b.pattern.length ||
    b.pattern.length > 12 ||
    b.pattern.some(
      (k) =>
        ![
          'strike',
          'heavy',
          'channel',
          'ward',
          'seal',
          'flight',
          'restore',
        ].includes(k),
    ) ||
    !b.units.some((u) => u.id === b.target) ||
    (b.taunt && !s.party.includes(b.taunt)) ||
    (b.healTarget && !s.party.includes(b.healTarget))
  )
    throw Error('个人战斗状态无效');
  for (const u of b.units) {
    if (
      !s.party.includes(u.id) ||
      u.role !== s.heroes.find((h) => h.id === u.id)?.role ||
      typeof u.name !== 'string' ||
      u.name.length > 60 ||
      !n(u.hp, 0, u.maxHp) ||
      !n(u.maxHp, 1) ||
      !n(u.attack, 1) ||
      !n(u.defense) ||
      !n(u.crit, 0, 0.6) ||
      !n(u.dodge, 0, 0.4) ||
      !n(u.critDamage, 1, 3) ||
      !n(u.pierce, 0, 0.75) ||
      !n(u.ranged, 0, 1) ||
      !n(u.resistance, 0, 0.75) ||
      !n(u.shield, 0, u.maxHp) ||
      !i(u.ward, 0, 3) ||
      !i(u.burn, 0, 2) ||
      !n(u.regen) ||
      !i(u.regenTurns, 0, 4) ||
      !n(u.guard, 0.1, 1) ||
      typeof u.preventBurn !== 'boolean' ||
      !n(u.healing, 0.1, 3) ||
      !n(u.shieldPower, 0.1, 3) ||
      !n(u.cooldownReduction, 0, 0.3) ||
      !Sets.validSetEffect(u.setEffect, b.round, u.attack) ||
      ((u.projectChoices !== undefined ||
        b.units[0].projectChoices !== undefined) &&
        (!Array.isArray(u.projectChoices) ||
          new Set(u.projectChoices).size !== u.projectChoices.length ||
          u.projectChoices.some((id) => !projectChoiceIds().includes(id)) ||
          JSON.stringify(u.projectChoices) !==
            JSON.stringify(b.units[0].projectChoices))) ||
      !n(u.evasion, 0, 0.4) ||
      !i(u.shieldTurns, 0, 3) ||
      typeof u.castThisRound !== 'string' ||
      !u.cooldowns ||
      Array.isArray(u.cooldowns) ||
      Object.keys(u.cooldowns).length !== combatSkills(s, u.id).length ||
      Object.entries(u.cooldowns).some(
        ([key, v]) =>
          !combatSkills(s, u.id).some((sk) => sk.id === key) || !i(v, 0, 8),
      )
    )
      throw Error('角色血条或冷却记录无效');
  }
  if (
    b.hp !== b.units.reduce((sum, u) => sum + u.hp, 0) ||
    b.maxHp !== b.units.reduce((sum, u) => sum + u.maxHp, 0) ||
    !alive(b).some((u) => u.id === b.selected && !b.acted.includes(u.id))
  )
    throw Error('角色行动顺序无效');
  if (
    b.kind === 'guardian' &&
    !guardianRematch(s, b.region, b.node) &&
    (!guardianReady(s, b.region) || b.node !== s.guild.depths[b.region])
  )
    throw Error('据点守敌状态无效');
}
