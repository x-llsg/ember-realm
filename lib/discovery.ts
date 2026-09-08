import type { State, View, BuildingId, Resource } from './realm.ts';
import * as C from './campaign.ts';
import * as D from './realm-data.ts';
import type { MaterialId } from './campaign-data.ts';
import { settleAchievements } from './achievements.ts';

export const hasReturned = (s: State) =>
  s.explored.some((n) => n > 0) || s.cleared.length > 0;
export const regionVisited = (s: State, r: number) =>
  s.explored[r] > 0 || s.guild.depths[r] > 0 || s.cleared.includes(r);
export function viewDiscovered(s: State, view: View): boolean {
  if (view === 'town') return true;
  if (view === 'research')
    return (
      s.research.length > 0 ||
      s.chronicle.includes('workers') ||
      (!!s.buildings.lumber &&
        !!s.buildings.farm &&
        s.jobs.wood > 0 &&
        s.jobs.food > 0)
    );
  if (view === 'recruit') return s.buildings.tavern > 0;
  if (view === 'heroes')
    return s.heroes.length > 0 || s.guild.crafts > 0 || hasReturned(s);
  if (view === 'explore') return s.heroes.length > 0 || hasReturned(s);
  return hasReturned(s);
}
export function buildingDiscovered(s: State, id: BuildingId): boolean {
  if (s.buildings[id]) return true;
  if (id === 'fire') return true;
  if (id === 'hut') return !!s.buildings.fire;
  if (id === 'lumber') return !!s.buildings.hut && s.population > 0;
  if (id === 'farm') return !!s.buildings.lumber && s.assigned;
  if (id === 'quarry')
    return (
      !!s.buildings.farm &&
      (s.jobs.food > 0 ||
        s.chronicle.includes('workers') ||
        s.research.length > 0)
    );
  if (id === 'warehouse') return !!s.buildings.quarry;
  if (id === 'market') return !!s.buildings.quarry;
  if (id === 'tavern')
    return !!s.buildings.market && s.population >= 6 && s.assigned;
  if (id === 'forge') return C.townRank(s) >= 1;
  return C.townRank(s) >= 1 && !!s.buildings.forge;
}
export function resourceDiscovered(s: State, k: Resource): boolean {
  if (k === 'wood') return true;
  if (k === 'food') return !!s.buildings.fire;
  if (k === 'stone') return !!s.buildings.hut;
  if (k === 'gold') return !!s.buildings.quarry || !!s.buildings.market;
  if (k === 'iron') return C.townRank(s) >= 1 || !!s.buildings.forge;
  return !!s.buildings.shrine || s.world.tech.includes('runecraft');
}
export function materialDiscovered(s: State, id: MaterialId): boolean {
  if (s.world.materials[id] > 0) return true;
  const recipe = C.WORK_RECIPES.find((r) => r.id === id);
  if (recipe) return s.world.tech.includes(recipe.tech);
  const r = C.REGION_MATERIALS.indexOf(id);
  return r >= 0 && regionVisited(s, r);
}
export function technologyDiscovered(s: State, id: string): boolean {
  if (s.world.tech.includes(id)) return true;
  const t = C.TECHNOLOGIES.find((t) => t.id === id);
  if (!t) return false;
  if (id === 'settlement') return regionVisited(s, 0);
  if (id === 'metallurgy') return regionVisited(s, 2);
  if (id === 'runecraft') return regionVisited(s, 1);
  if (id === 'citadel') return s.cleared.includes(1) || s.cleared.includes(2);
  if (id === 'dragoncraft') return regionVisited(s, 4);
  if (id === 'infernalcraft') return regionVisited(s, 3);
  return s.cleared.includes(3) && s.cleared.includes(4);
}
export function researchDiscovered(s: State, id: string): boolean {
  if (s.research.includes(id)) return true;
  const r = D.RESEARCH.find((r) => r.id === id);
  if (!r || !viewDiscovered(s, 'research') || C.townRank(s) < r.chapter)
    return false;
  if (r.tech && !s.world.tech.includes(r.tech)) return false;
  if (r.prior?.some((p) => !s.research.includes(p))) return false;
  if (
    r.depth &&
    s.guild.depths[r.depth[0]] < r.depth[1] &&
    !s.cleared.includes(r.depth[0])
  )
    return false;
  if (r.discovery && !regionVisited(s, r.discovery)) return false;
  return !r.need || !!s.buildings[r.need];
}
export function recipeDiscovered(s: State, id: string): boolean {
  if (s.guild.inventory.some((g) => g.recipe === id)) return true;
  return s.heroes.length > 0 && !C.recipeUnlockReason(s, id, 1);
}
export type StoryBeat = {
  id: string;
  title: string;
  text: string;
  unlocks: string;
  when: (s: State) => boolean;
};
export const STORY_BEATS: StoryBeat[] = [
  {
    id: 'fire',
    title: '独自守火',
    text: '湿木终于燃起来。火边只有你一个人。先搭起遮雨的屋檐，再为可能到来的旅人备一点食物。',
    unlocks: '小屋与口粮',
    when: (s) => !!s.buildings.fire,
  },
  {
    id: 'shelter',
    title: '不是一夜的营地',
    text: '小屋还空着。一个赶路的人在门外停下：“能用一餐热饭换个落脚处吗？”有人留下之后，才谈得上分工。',
    unlocks: '接纳住民；住民到来后可建伐木场',
    when: (s) => !!s.buildings.hut,
  },
  {
    id: 'resident',
    title: '第一个留下的人',
    text: '来客放下行囊，没有擅自拿走你的工具。“告诉我该在哪里干活。”先整理一片伐木场，才有长期工作的地方。',
    unlocks: '伐木场与岗位安排',
    when: (s) => s.population > 0,
  },
  {
    id: 'workers',
    title: '木匠的两张草图',
    text: '田里有人播种，林边也传来斧声。木匠把两张草图压在桌上：“现在，我们可以改善工具和储存了。”',
    unlocks: '最初的研究与采石场',
    when: (s) =>
      !!s.buildings.lumber &&
      !!s.buildings.farm &&
      s.jobs.wood > 0 &&
      s.jobs.food > 0,
  },
  {
    id: 'market',
    title: '山外有人走来',
    text: '商人沿着采石小道来到营地。他说林中还有一条旧路，只是运货的人再也没回来。你需要向敢走夜路的人打听。',
    unlocks: '集市；安置六位住民后可建酒馆',
    when: (s) => !!s.buildings.quarry,
  },
  {
    id: 'tavern',
    title: '门板上的第一张委托',
    text: '酒馆老板没有谈魔王，只问：“你要找的，是肯回来的同伴，还是最便宜的刀？”几名陌生旅人转头看向你。',
    unlocks: '旅人招募',
    when: (s) => !!s.buildings.tavern,
  },
  {
    id: 'companion',
    title: '第一次走出火光',
    text: '同行者摊开一小片树皮地图。“先走森林边缘。带够口粮，给我一把能用的武器；不用等到人人都是英雄。”',
    unlocks: '小队、基础装备与森林远征',
    when: (s) => s.heroes.length > 0,
  },
  {
    id: 'sample',
    title: '木头里藏着年轮',
    text: '小队带回一段沉重的古木。木匠削去焦黑树皮，发现它能支撑更大的屋架。“守住林中的落脚处，我们就能在这里定居。”',
    unlocks: '定居线索、手札与侦察研究',
    when: (s) => regionVisited(s, 0),
  },
  {
    id: 'settlement',
    title: '你给这地方起了名字',
    text: '古木做成的第一根梁升了起来。铁匠借走火种，抄书人开始整理样品。村落不再只靠拾柴过活，但加工也要吃掉木材和口粮。',
    unlocks: '工坊、锻造坊、学馆与村落研究',
    when: (s) => C.townRank(s) >= 1,
  },
  {
    id: 'fork',
    title: '岔路上的两种声音',
    text: '树林另一端，一条路传来钟声，另一条路落着红砂。钟声中有法术的痕迹，红砂下埋着矿脉。先把哪一种力量带回去，由你决定。',
    unlocks: '遗迹与赤砂的不同发展路线',
    when: (s) => s.guild.depths[0] >= 2 || s.cleared.includes(0),
  },
  {
    id: 'industry',
    title: '样品成为手艺',
    text: '第一次炼出的成品还很粗糙，却改变了每个人的工作。旧炉子追不上新配方，工匠把产线改造和武器订单摆在同一张桌上。',
    unlocks: '市镇产线研究与T2装备',
    when: (s) => C.townRank(s) >= 2,
  },
  {
    id: 'citadel',
    title: '城墙以内，城墙以外',
    text: '难民说王庭仍在向各地征粮，雪山上偶尔有火光。你不可能靠一支满身伤痕的小队解决一切。先让城镇能持续供养远征。',
    unlocks: '城塞生产、后勤与远方的威胁',
    when: (s) => C.townRank(s) >= 3,
  },
  {
    id: 'royal',
    title: '凡人的工坊',
    text: '龙鳞和余烬在炉中发出不同的光。工匠试着把它们做成护甲，而不是供品。城镇需要更强的炉火、粮路与魔力供应。',
    unlocks: '王城产线与针对性高阶装备',
    when: (s) => C.townRank(s) >= 4,
  },
  {
    id: 'sky',
    title: '神也会留下裂缝',
    text: '魔王的王冠与古龙的鳞片拼出同一幅星图。抄书人终于抬头：“法则不是天生的。既然能被写下，也就能被改写。”',
    unlocks: '天穹、神话工艺与最后的研究',
    when: (s) => C.townRank(s) >= 5,
  },
  {
    id: 'improvements',
    title: '同一座磨坊，另一种做法',
    text: '木匠在斧柄上刻下新的握位。炉火还是那炉火，安排和手艺却能一代代改进。每条产线有自己的改良，不必等远方传回捷报。',
    unlocks: '产线改良；每四级的工艺突破',
    when: (s) => (s.economy?.development.forestry || 0) > 0,
  },
  {
    id: 'shipping',
    title: '归来的不止是冒险者',
    text: '第一辆货车沿旧路出发。队伍还在前线，古木也将沿这条路送回城镇。给道路安排人手与补给，后方就不必跟着主队停工。',
    unlocks: '独立后勤、道路扩建与搬运分工',
    when: (s) => s.economy?.routes.some((r) => r.crew > 0) || false,
  },
  {
    id: 'work_modes',
    title: '快些，还是省些',
    text: '工匠把同一份订单分成两种做法：赶工要多费原料，精作则多花些时间。你开始决定产线怎样工作，而不仅是开与关。',
    unlocks: '精作与赶工',
    when: (s) =>
      Math.max(
        s.economy?.development.carpentry || 0,
        s.economy?.development.metalwork || 0,
        s.economy?.development.inscription || 0,
      ) >= 2,
  },
  {
    id: 'stock_rules',
    title: '写在仓门上的规矩',
    text: '管事记下了留给远征的口粮和工坊该存的成品。等你离开桌边，这些规矩也会替你照看城镇。',
    unlocks: '库存目标与原料保留线',
    when: (s) => (s.economy?.development.storage || 0) >= 2,
  },
  {
    id: 'home',
    title: '这次，没有人催你出发',
    text: '委托板上第一次出现修桥、开学和婚宴。你曾以为穿越是去改变世界，现在才明白，也可以让一些普通的日子继续下去。',
    unlocks: '战后重建',
    when: (s) => s.ending,
  },
];
export function storyBeat(s: State): StoryBeat | undefined {
  return STORY_BEATS.filter((b) => b.when(s)).at(-1);
}
/** Record only new discoveries; the rule predicates never depend on spendable stock. */
export function settleStory(s0: State): State {
  const fresh = STORY_BEATS.filter(
    (b) => b.when(s0) && !s0.chronicle.includes(b.id),
  );
  if (!fresh.length) return settleAchievements(s0);
  const s = structuredClone(s0);
  for (const b of fresh) {
    s.chronicle.push(b.id);
    s.log.unshift({
      time: s.time,
      text: `${b.title}：${b.text}（新发现：${b.unlocks}）`,
      kind: 'story',
    });
  }
  s.log = s.log.slice(0, 100);
  return settleAchievements(s);
}
