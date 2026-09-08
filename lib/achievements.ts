import * as G from './realm.ts';
import { REGIONS } from './realm-data.ts';

export interface AchievementState {
  unlocked: Record<string, number>;
  read: number;
  title: string | null;
}
export type AchievementCategory = 'town' | 'exploration' | 'party' | 'craft';
export const ACHIEVEMENT_CATEGORIES: Record<AchievementCategory, string> = {
  town: '城镇', exploration: '探索', party: '队伍装备', craft: '工艺',
};
export interface AchievementDefinition {
  id: string;
  name: string;
  title: string;
  category: AchievementCategory;
  text: string;
  target: number;
  progress: (s: G.State) => number;
  visible: (s: G.State) => boolean;
  destination: { view: G.View; tab?: string; region?: number };
}
const max = (values: number[]) => Math.max(0, ...values);
const gearVisible = (s: G.State) => !!s.guild.inventory.length || s.guild.crafts > 0;
export const ACHIEVEMENTS: AchievementDefinition[] = [
  { id: 'first-fire', name: '异乡第一夜', title: '执火者', category: 'town', text: '点燃营火。', target: 1, progress: (s) => s.buildings.fire, visible: () => true, destination: { view: 'town' } },
  { id: 'working-town', name: '烟火渐起', title: '拓荒人', category: 'town', text: '安排 3 名居民工作。', target: 3, progress: (s) => Object.values(s.jobs).reduce((a, b) => a + b, 0), visible: (s) => s.population > 0, destination: { view: 'town', tab: 'workers' } },
  { id: 'settlement', name: '此处是家', title: '筑城者', category: 'town', text: '将营地发展为村落。', target: 1, progress: (s) => G.townRank(s), visible: (s) => G.viewDiscovered(s, 'research'), destination: { view: 'research' } },
  { id: 'renovation', name: '精益求精', title: '营建大师', category: 'town', text: '一座建筑的细部改良达到 10 级。', target: 10, progress: (s) => max(Object.values(s.civic.renovations)), visible: (s) => G.hasReturned(s), destination: { view: 'town', tab: 'build' } },
  { id: 'first-trip', name: '踏出火光', title: '探路者', category: 'exploration', text: '完成第一次远征。', target: 1, progress: (s) => s.explored.reduce((a, b) => a + b, 0), visible: (s) => G.viewDiscovered(s, 'explore'), destination: { view: 'explore' } },
  { id: 'first-frontier', name: '立足荒野', title: '破阵者', category: 'exploration', text: '夺取一个据点。', target: 1, progress: (s) => max(s.guild.depths), visible: (s) => G.hasReturned(s), destination: { view: 'explore', region: 0 } },
  { id: 'full-region', name: '一方安宁', title: '守境人', category: 'exploration', text: '夺取任意地区的全部 5 处据点。', target: 5, progress: (s) => max(s.guild.depths), visible: (s) => max(s.guild.depths) > 0, destination: { view: 'explore' } },
  { id: 'all-frontiers', name: '万里归途', title: '荒野之主', category: 'exploration', text: '夺取六片地区的全部 30 处据点。', target: 30, progress: (s) => s.guild.depths.reduce((a, b) => a + b, 0), visible: (s) => G.regionVisited(s, 5), destination: { view: 'explore', region: 5 } },
  ...REGIONS.map((region, index): AchievementDefinition => ({
    id: `boss-${index}`, name: ['林间传说', '钟声安息', '古道重开', '永夜终结', '凡人屠龙', '向神举剑'][index],
    title: ['森林守望', '镇魂者', '古道行者', '破晓之刃', '屠龙者', '弑神者'][index],
    category: 'exploration', text: `击败${region.name}的首领。`, target: 1,
    progress: (s) => Number(s.cleared.includes(index)), visible: (s) => G.regionVisited(s, index),
    destination: { view: 'explore', region: index },
  })),
  { id: 'party-four', name: '四人成行', title: '同行者', category: 'party', text: '组成 4 人出战队伍。', target: 4, progress: (s) => s.party.length, visible: (s) => s.heroes.length > 0, destination: { view: 'heroes' } },
  { id: 'trained-ten', name: '百炼成锋', title: '老练旅人', category: 'party', text: '培养一名 10 级角色。', target: 10, progress: (s) => max(s.heroes.map((h) => h.level)), visible: (s) => s.heroes.length > 0, destination: { view: 'heroes' } },
  { id: 'mastery', name: '独当一面', title: '专精行家', category: 'party', text: '一名角色的专精达到 1 阶。', target: 1, progress: (s) => max(s.heroes.map((h) => h.mastery)), visible: (s) => G.townRank(s) >= 1, destination: { view: 'heroes' } },
  { id: 'fully-equipped', name: '整装出发', title: '整备专家', category: 'party', text: '为一名角色穿齐 6 个装备部位。', target: 6, progress: (s) => max(s.heroes.map((h) => Object.values(h.equipment).filter((id) => s.guild.inventory.some((i) => i.id === id)).length)), visible: gearVisible, destination: { view: 'heroes', tab: 'inventory' } },
  { id: 'four-set', name: '共鸣之力', title: '套装行家', category: 'party', text: '让一名角色激活同一套装的 4 件效果。', target: 4, progress: (s) => max(s.heroes.flatMap((h) => G.equippedSets(s, h).map((set) => set.count))), visible: (s) => s.guild.inventory.some((i) => !!i.setId), destination: { view: 'heroes', tab: 'inventory' } },
  { id: 'legendary-gear', name: '传说在手', title: '珍宝收藏家', category: 'party', text: '持有一件金色或红色装备。', target: 1, progress: (s) => Number(s.guild.inventory.some((i) => i.rarity >= 5)), visible: gearVisible, destination: { view: 'heroes', tab: 'inventory' } },
  { id: 'first-craft', name: '第一声锤鸣', title: '新晋匠人', category: 'craft', text: '完成第一次装备锻造。', target: 1, progress: (s) => s.guild.crafts, visible: (s) => s.buildings.tavern > 0, destination: { view: 'heroes' } },
  { id: 'tempered-gear', name: '千锤有声', title: '淬火匠人', category: 'craft', text: '将一件装备强化至 +3。', target: 3, progress: (s) => max(s.guild.inventory.map((i) => i.upgrade)), visible: gearVisible, destination: { view: 'heroes', tab: 'inventory' } },
  { id: 'six-technologies', name: '从见闻到工艺', title: '博学者', category: 'craft', text: '掌握 6 项城镇工艺。', target: 6, progress: (s) => s.world.tech.length, visible: (s) => G.viewDiscovered(s, 'research'), destination: { view: 'research' } },
  { id: 'smithing-three', name: '匠心传承', title: '锻造大师', category: 'craft', text: '工匠传承达到 3 阶。', target: 3, progress: (s) => s.guild.doctrine.smithing, visible: (s) => G.townRank(s) >= 1, destination: { view: 'town', tab: 'workshop' } },
];
export const freshAchievements = (): AchievementState => ({ unlocked: {}, read: 0, title: null });
export function settleAchievements(s0: G.State) {
  const previous = s0.guild.achievements || freshAchievements();
  const fresh = ACHIEVEMENTS.filter((a) => previous.unlocked[a.id] === undefined && a.progress(s0) >= a.target);
  if (!fresh.length) return s0;
  const s = G.clone(s0);
  s.guild.achievements = { ...previous, unlocked: { ...previous.unlocked } };
  for (const a of fresh) s.guild.achievements.unlocked[a.id] = s.time;
  return s;
}
export const achievementCount = (s: G.State) => Object.keys(s.guild.achievements?.unlocked || {}).length;
export const achievementUnread = (s: G.State) => Math.max(0, achievementCount(s) - (s.guild.achievements?.read || 0));
export function readAchievements(s0: G.State) {
  if (!achievementUnread(s0)) return s0;
  const s = G.clone(s0);
  s.guild.achievements!.read = achievementCount(s);
  return s;
}
export function selectAchievementTitle(s0: G.State, id: string | null) {
  const current = s0.guild.achievements || freshAchievements();
  if (current.title === id || (id !== null && (!ACHIEVEMENTS.some((a) => a.id === id) || current.unlocked[id] === undefined))) return s0;
  const s = G.clone(s0);
  s.guild.achievements = { ...current, title: id };
  return s;
}
export function achievementTitle(s: G.State) {
  return ACHIEVEMENTS.find((a) => a.id === s.guild.achievements?.title)?.title || '';
}
export function validateAchievements(s: G.State) {
  if (s.guild.achievements === undefined) s.guild.achievements = freshAchievements();
  const a = s.guild.achievements;
  if (!a || typeof a !== 'object' || Array.isArray(a) || !a.unlocked || typeof a.unlocked !== 'object' || Array.isArray(a.unlocked) ||
    Object.keys(a).some((key) => !['unlocked', 'read', 'title'].includes(key)) ||
    Object.entries(a.unlocked).some(([id, time]) => !ACHIEVEMENTS.some((d) => d.id === id) || !Number.isFinite(time) || time < 0 || time > s.time) ||
    !Number.isInteger(a.read) || a.read < 0 || a.read > Object.keys(a.unlocked).length ||
    (a.title !== null && (typeof a.title !== 'string' || a.unlocked[a.title] === undefined)))
    throw Error('成就记录无效');
}
