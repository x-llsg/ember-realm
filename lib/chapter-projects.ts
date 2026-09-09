import type { State, Cost } from './realm.ts';
import * as G from './realm.ts';
import { PROJECTS } from './realm-data.ts';
import { REGION_MATERIALS, type MaterialCost } from './campaign-data.ts';

/** The original choice remains authoritative for old saves. Only a paid second
 * construction is recorded here; loading a save never grants an extra choice. */
export type ProjectExtensions = Record<string, string>;

export const CHAPTER_WORKS = [
  {
    name: '森林双岸',
    recipe: '拼接工艺',
    technology: 'settlement',
    clue: '第二据点带回旧桥榫接法，掌握定居工艺后可用更多木石替代古木。',
    first: '灯先照亮了一条路；另一岸的居民仍在等待。',
    complete:
      '守林人的灯接上溪边的水路。木工与农户共用运货车，两岸终于都能安稳过冬。',
  },
  {
    name: '灰钟新生',
    recipe: '晶砂刻印',
    technology: 'runecraft',
    clue: '第二据点的碎钟铭文可用魔晶重绘；掌握符文工艺后，以更多魔晶石金替代灵砂。',
    first: '新钟只奏出一个声部，警戒与归家还需要另一种声音。',
    complete:
      '警钟为前线报信，归钟为伤者引路。刻印工人与守墓人第一次共同值夜。',
  },
  {
    name: '赤砂通衢',
    recipe: '坩埚精炼',
    technology: 'metallurgy',
    clue: '第二据点的旧坩埚可精炼普通铁锭；掌握金属工艺后，用更多铁石木替代黑铁矿。',
    first: '第一批车队抵达了，矿工的炉火与商队的货单还没有连成一条线。',
    complete: '矿车不再停在半路，商队不再空车回城。矿工与行商共同维护转运站。',
  },
  {
    name: '王庭解誓',
    recipe: '魔焰熟化',
    technology: 'infernalcraft',
    clue: '第二据点留下可控的魔焰炉；掌握魔焰工艺后，用余烬熟化多批木板，绕开古木。',
    first: '破誓阵保护了第一批归来的人，还有人不敢放下盾牌。',
    complete:
      '反咏者读回被抹去的名字，持盾者守住阵外的街巷。破誓阵第一次用于保护日常生活。',
  },
  {
    name: '雪山归途',
    recipe: '龙鳞淬钢',
    technology: 'dragoncraft',
    clue: '第二据点的脱落龙鳞可用于淬火；掌握龙鳞工艺后，以龙鳞和金币换取批量精钢。',
    first: '登山队已有一种抵御古龙的办法，另一份技艺还留在雪线下。',
    complete:
      '破鳞矛撑起雪道护栏，庇护符交给夜行的搬运工。登山装备成为所有人的归途。',
  },
  {
    name: '天穹人间',
    recipe: '星髓刻印',
    technology: 'mythic',
    clue: '第二据点残留的星髓可以承载符文；掌握凡人的神话后，以星髓和金币进行批量刻印。',
    first: '钥匙解开了一重神律，另一面的名字仍没有写完。',
    complete:
      '钥匙不再只为一场决战而造。斩断束缚与众生共鸣同时留在人间，六地工匠开始共同订立自己的规则。',
  },
] as const;

export const CHAPTER_RECIPE_VARIANTS = [
  { work: 'boards', variant: 'joinery' },
  { work: 'runes', variant: 'resonance' },
  { work: 'steel', variant: 'crucible' },
  { work: 'boards', variant: 'infernal' },
  { work: 'steel', variant: 'dragon' },
  { work: 'runes', variant: 'stellar' },
] as const;

export function hasProjectChoice(
  s: State,
  project: string,
  choice: string,
): boolean {
  return (
    s.projects[project] === choice || s.projectExtensions?.[project] === choice
  );
}

export function chapterProjectCount(s: State, region: number): number {
  const project = PROJECTS[region];
  return project
    ? project.choices.filter((c) => hasProjectChoice(s, project.id, c.id))
        .length
    : 0;
}

export function chapterProjectDiscovered(s: State, region: number): boolean {
  return (
    !!PROJECTS[region] &&
    (G.discoveryCount(s, region) > 0 ||
      chapterProjectCount(s, region) > 0 ||
      s.cleared.includes(region))
  );
}

export function chapterProjectCost(
  s: State,
  region: number,
  choice: string,
): { cost: Cost; materials: MaterialCost } {
  const project = PROJECTS[region];
  if (!project?.choices.some((c) => c.id === choice))
    return { cost: {}, materials: {} };
  const extra = !!s.projects[project.id] && s.projects[project.id] !== choice;
  const factor = extra ? 2.5 : 1;
  const cost = Object.fromEntries(
    Object.entries(project.cost).map(([id, n]) => [id, Math.ceil(n! * factor)]),
  );
  const materials = Object.fromEntries(
    Object.entries(G.projectMaterialCost(s, region)).map(([id, n]) => [
      id,
      Math.ceil(n! * (extra ? 2 : 1)),
    ]),
  ) as MaterialCost;
  if (extra) {
    const local = REGION_MATERIALS[region];
    materials[local] =
      (materials[local] || 0) + [8, 12, 16, 24, 30, 40][region];
  }
  return { cost, materials };
}

export function chapterProjectGate(
  s: State,
  region: number,
  choice: string,
): string {
  const project = PROJECTS[region];
  if (!project?.choices.some((c) => c.id === choice)) return '未知工程方案';
  if (hasProjectChoice(s, project.id, choice)) return '此方案已完成';
  if (G.discoveryCount(s, region) < 2) return '先调查补全当地两条线索';
  if (
    s.projects[project.id] &&
    G.regionalDepth(s, region) < 4 &&
    !s.cleared.includes(region)
  )
    return '占领当地第四据点或击败首领后，可补建另一方案';
  return '';
}

export function chapterProjectReason(
  s: State,
  region: number,
  choice: string,
): string {
  const gate = chapterProjectGate(s, region, choice);
  if (gate) return gate;
  const bill = chapterProjectCost(s, region, choice);
  if (!G.canPay(s, bill.cost)) {
    const short = Object.entries(bill.cost).filter(
      ([id, n]) => s.resources[id as G.Resource] + 1e-8 < n!,
    );
    return `还缺 ${short.map(([id, n]) => `${G.RESOURCE_NAMES[id as G.Resource]} ${Math.ceil(n! - s.resources[id as G.Resource])}`).join('、')}`;
  }
  return G.materialReason(s, bill.materials);
}

export function chapterProjectReady(s: State, region: number): boolean {
  return !!PROJECTS[region]?.choices.some(
    (c) => !chapterProjectGate(s, region, c.id),
  );
}

export function completeChapterProject(
  s0: State,
  region: number,
  choice: string,
): State {
  if (chapterProjectReason(s0, region, choice)) return s0;
  const project = PROJECTS[region],
    bill = chapterProjectCost(s0, region, choice);
  const s = G.clone(s0),
    extra = !!s.projects[project.id];
  for (const [id, n] of Object.entries(bill.cost))
    s.resources[id as G.Resource] -= n!;
  G.spendMaterials(s, bill.materials);
  if (extra)
    s.projectExtensions = { ...s.projectExtensions, [project.id]: choice };
  else s.projects[project.id] = choice;
  const selected = project.choices.find((c) => c.id === choice)!;
  G.log(
    s,
    `${project.name} · ${selected.label}${extra ? '补建' : '建成'}。${selected.effect}。${extra ? CHAPTER_WORKS[region].complete : CHAPTER_WORKS[region].first}`,
    'story',
  );
  return s;
}

/** The workshop uses this completed project count for real local recipe bills. */
export function chapterServices(s: State, region: number) {
  const complete = chapterProjectCount(s, region) === 2;
  return {
    complete,
    resourceFactor: complete ? 0.9 : 1,
    name: CHAPTER_WORKS[region]?.name || '未知地区',
  };
}

export function chapterProjectSummary(s: State, region: number) {
  const count = chapterProjectCount(s, region);
  return {
    region,
    name: CHAPTER_WORKS[region]?.name || '',
    count,
    complete: count === 2,
    text:
      count === 2
        ? CHAPTER_WORKS[region].complete
        : CHAPTER_WORKS[region]?.first || '',
  };
}

export function validateChapterProjects(s: State): void {
  if (s.projectExtensions === undefined) return;
  const extra = s.projectExtensions;
  if (
    !extra ||
    typeof extra !== 'object' ||
    Array.isArray(extra) ||
    Object.keys(extra).length > PROJECTS.length
  )
    throw Error('工程补建记录无效');
  for (const [id, choice] of Object.entries(extra)) {
    const region = PROJECTS.findIndex((p) => p.id === id),
      project = PROJECTS[region];
    if (
      !project ||
      !s.projects[id] ||
      choice === s.projects[id] ||
      !project.choices.some((c) => c.id === choice) ||
      G.discoveryCount(s, region) !== 2 ||
      (G.regionalDepth(s, region) < 4 && !s.cleared.includes(region))
    )
      throw Error('工程补建记录无效');
  }
}
