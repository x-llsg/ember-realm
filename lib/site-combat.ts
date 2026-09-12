import type { Battle } from './realm.ts';
import { GUARDIANS } from './guardian-data.ts';

export interface SiteCombatRuntime {
  ruleVersion: 1;
  siteId: string;
  runId: number;
  variant: 'A' | 'B';
  preparedRound: number;
  intentIndex: number;
  rememberedTarget: string;
}
type Kind =
  | 'strike'
  | 'heavy'
  | 'ward'
  | 'restore'
  | 'channel'
  | 'seal'
  | 'flight';
type Target = 'weighted' | 'lowest' | 'highest' | 'remembered';
export interface SiteStep {
  kind: Kind;
  name: string;
  mult: number;
  armor?: number;
  target?: Target;
  remember?: boolean;
  hits?: number;
  burn?: number;
  exposed?: number;
}
const step = (
  kind: Kind,
  name: string,
  mult: number,
  extra: Partial<SiteStep> = {},
): SiteStep => ({ kind, name, mult, ...extra });
const cycles: SiteStep[][] = [
  [
    step('ward', '检修防护', 0.6),
    step('strike', '齿刃', 1),
    step('heavy', '卸压', 1.5, { armor: 0.7 }),
  ],
  [
    step('strike', '嗅血', 0.7, { target: 'lowest', remember: true }),
    step('strike', '蓄扑', 1.7, { target: 'remembered' }),
    step('strike', '折返', 0.8, { armor: 0.8 }),
  ],
  [
    step('ward', '护钟', 0.6),
    step('strike', '校时', 1),
    step('restore', '回响', 0.6),
  ],
  [
    step('seal', '缄言', 0.6),
    step('strike', '追索', 1.5, { target: 'highest' }),
    step('strike', '整卷', 0.8, { armor: 0.8 }),
  ],
  [
    step('strike', '牵引', 0.8, { armor: 1.8 }),
    step('heavy', '卸载', 1.6, { armor: 0.65 }),
    step('strike', '重挂', 1),
  ],
  [
    step('flight', '跃沙', 0.9),
    step('strike', '落点', 1.2, { target: 'highest' }),
    step('heavy', '掠沙', 1.5, { armor: 0.8 }),
  ],
  [
    step('ward', '炉甲', 0.6),
    step('channel', '炉心过载', 1.8, { burn: 2 }),
    step('strike', '冷却', 0.8, { armor: 0.6 }),
  ],
  [
    step('seal', '庇护禁令', 0.6),
    step('strike', '误判', 1.5, { target: 'lowest' }),
    step('strike', '巡门', 0.8),
  ],
  [
    step('flight', '踏风', 0.9),
    step('strike', '冲台', 1.3),
    step('strike', '落台', 0.7, { armor: 0.7, exposed: 2 }),
  ],
  [
    step('restore', '热眠', 0.5),
    step('strike', '崩石', 1.1),
    step('channel', '热脉', 1.8),
    step('strike', '冷脉', 0.7),
  ],
  [
    step('ward', '轨盾', 0.6),
    step('strike', '裁定', 1.4, { target: 'highest' }),
    step('channel', '纠轨', 1.8),
  ],
  [
    step('seal', '独声', 0.6),
    step('ward', '唯一祷词', 0.6),
    step('channel', '审判', 1.9),
    step('strike', '回声空隙', 0.7),
  ],
];
const names = [
  '锈齿看守机',
  '荆棘追猎兽',
  '沉钟校时像',
  '缄言抄录官',
  '缚轨搬运者',
  '沙鳍巡掠者',
  '誓炉铸卫',
  '缚门誓影',
  '霜翼台卫',
  '眠鳞石卫',
  '断律轨道卫',
  '独声裁决像',
];
const hp = [1.1, 1.08, 1.1, 1.08, 1.08, 1.1, 1.08, 1.1, 1.1, 1.08, 1.08, 1.1];
const attack = [1, 1.03, 1, 1.02, 1, 1, 1.02, 1, 1, 1, 1, 1];
const armor = [1, 1, 1, 1, 1.1, 1, 1, 1, 1, 1.05, 1, 1];
export function siteCombatIndex(siteId: string) {
  return /^S(0[1-9]|1[0-2])$/.test(siteId) ? Number(siteId.slice(1)) - 1 : -1;
}
export function siteEnemyDefinition(siteId: string) {
  const index = siteCombatIndex(siteId);
  if (index < 0) throw Error('未知支线守敌');
  const region = Math.floor(index / 2),
    node = index % 2 ? 2 : 0;
  const original = GUARDIANS[region][node];
  return {
    ...original,
    region,
    node,
    name: names[index],
    hp: Math.max(1, Math.round(original.hp * hp[index])),
    attack: Math.max(1, Math.round(original.attack * attack[index])),
    defense: Math.max(1, Math.round(original.defense * armor[index])),
  };
}
export function siteSequence(siteId: string, variant: 'A' | 'B') {
  const index = siteCombatIndex(siteId);
  if (index < 0) throw Error('未知支线意图');
  const cycle = cycles[index].map((s) => ({ ...s }));
  const opening: SiteStep[] = [];
  if (variant === 'B') {
    switch (index) {
      case 0:
        opening.push(step('heavy', '屋顶泄压', 1.2));
        break;
      case 1:
        cycle[1] = step('heavy', '荆棘横扫', 1.2);
        cycle[2] = step('strike', '追猎扑杀', 1.4, { target: 'remembered' });
        break;
      case 2:
        cycle[2] = step('channel', '倒钟咏唱', 1.6);
        break;
      case 3:
        opening.push(step('restore', '纸页倒卷', 0.5));
        break;
      case 4:
        cycle[1].burn = 2;
        break;
      case 5:
        opening.push(cycle[0], step('flight', '流沙改道', 0.5));
        cycle.push(cycle.shift()!);
        break;
      case 6:
        opening.push(step('strike', '誓词重燃', 0.5, { burn: 2 }));
        break;
      case 7:
        cycle[1] = step('channel', '警报回响', 1.7);
        break;
      case 8:
        cycle.splice(2, 0, step('heavy', '逆风冰裂', 1.1));
        break;
      case 9:
        cycle[0] = step('ward', '逆流护茧', 0.6);
        break;
      case 10:
        cycle[1] = step('strike', '残环连裁', 0.75, {
          target: 'highest',
          hits: 2,
        });
        break;
      case 11:
        opening.push(step('heavy', '残响重叠', 1));
        break;
    }
  }
  return { opening, cycle };
}
export function siteStepAt(siteId: string, variant: 'A' | 'B', round: number) {
  const { opening, cycle } = siteSequence(siteId, variant);
  const offset = round - 1;
  return offset < opening.length
    ? { step: opening[offset], index: offset }
    : {
        step: cycle[(offset - opening.length) % cycle.length],
        index: opening.length + ((offset - opening.length) % cycle.length),
      };
}
const living = (b: Battle) => b.units.filter((u) => u.hp > 0);
function randomTarget(b: Battle) {
  let x = b.rng;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  b.rng = x >>> 0 || 1;
  const candidates = living(b);
  const weights = candidates.map((u) =>
    ['rhea', 'orin'].includes(u.role) ? 3 : 1,
  );
  let pick = (b.rng / 4294967296) * weights.reduce((a, n) => a + n, 0);
  for (let i = 0; i < candidates.length; i++)
    if ((pick -= weights[i]) < 0) return candidates[i].id;
  return candidates[0]?.id || '';
}
export function prepareSiteRound(b: Battle) {
  if (!b.site || b.site.preparedRound === b.round) return;
  const { step: current, index } = siteStepAt(
    b.site.siteId,
    b.site.variant,
    b.round,
  );
  const candidates = living(b);
  const target =
    current.target === 'highest'
      ? [...candidates].sort((a, c) => c.attack - a.attack)[0]?.id
      : current.target === 'lowest'
        ? [...candidates].sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp)[0]?.id
        : current.target === 'remembered'
          ? candidates.find((u) => u.id === b.site!.rememberedTarget)?.id ||
            [...candidates].sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp)[0]
              ?.id
          : randomTarget(b);
  b.target = target || candidates[0]?.id || '';
  if (current.remember) b.site.rememberedTarget = b.target;
  b.site.preparedRound = b.round;
  b.site.intentIndex = index;
  b.enemyShield = current.kind === 'ward' ? Math.round(b.enemyMaxHp * 0.1) : 0;
  if (current.exposed) b.marked = Math.max(b.marked, current.exposed);
}
export function siteResolution(b: Battle) {
  if (!b.site) return null;
  const { step: current } = siteStepAt(b.site.siteId, b.site.variant, b.round);
  return {
    step: current,
    heavy: current.kind === 'heavy' || current.kind === 'channel',
    hits: current.hits || 1,
    attackScale:
      current.mult * (current.kind === 'channel' && b.interrupted ? 0.3 : 1),
    armorScale:
      current.kind === 'ward' ? (b.shattered ? 0.8 : 1.4) : current.armor || 1,
    flying: current.kind === 'flight' && !b.interrupted,
    healFraction: current.kind === 'restore' && !b.interrupted ? 0.1 : 0,
    burnRounds:
      current.kind === 'channel' && b.interrupted ? 0 : current.burn || 0,
    sealRounds: current.kind === 'seal' ? 1 : 0,
    ignoreArmor: 0,
  };
}
export function siteIntent(b: Battle) {
  const r = siteResolution(b)!;
  const name =
    b.units.find((u) => u.id === (b.taunt || b.target))?.name || '伙伴';
  const notes: Record<Kind, string> = {
    strike: '可防守、护佑或提前治疗。',
    heavy: '全体重击不暴击、不能闪避。',
    ward: '屏障为最大生命10%，护甲×1.4；破势或破盾立即拆屏障，本轮护甲降至×0.8。',
    restore: '轮末恢复最大生命10%；破势或打断可阻止。',
    channel: '打断后攻击保留30%，仅留下两次攻击破绽。',
    seal: '只封禁本轮治疗；可以护盾、防守，下一轮恢复。',
    flight: '近身攻击受飞行减伤；破势或打断技能可立即迫降，投射技能正常作用。',
  };
  return {
    kind: r.step.kind,
    name: r.step.name,
    hint: `${r.heavy ? '全体' : name} · 攻击倍率${r.step.mult.toFixed(2)}${r.hits > 1 ? `×${r.hits}段` : ''}。${notes[r.step.kind]}${r.burnRounds ? '未防住会附加2轮灼烧。' : ''}`,
    heavy: r.heavy,
    mult: r.attackScale,
    enraged: b.round > 30,
  };
}
export function validSiteRuntime(b: Battle) {
  if (b.kind !== 'site') return b.site === undefined;
  const r = b.site;
  if (
    !r ||
    r.ruleVersion !== 1 ||
    siteCombatIndex(r.siteId) < 0 ||
    !['A', 'B'].includes(r.variant) ||
    !Number.isInteger(r.runId) ||
    r.runId < 0 ||
    r.preparedRound !== b.round ||
    typeof r.rememberedTarget !== 'string' ||
    (r.rememberedTarget && !b.units.some((u) => u.id === r.rememberedTarget))
  )
    return false;
  const def = siteEnemyDefinition(r.siteId);
  return (
    b.region === def.region &&
    b.node === def.node &&
    b.enemyName === def.name &&
    r.intentIndex === siteStepAt(r.siteId, r.variant, b.round).index &&
    !b.boss
  );
}
