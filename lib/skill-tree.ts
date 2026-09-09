import * as G from './realm.ts';
import {
  SKILL_TREE_NODES,
  TREE_RULES,
  TREE_ROLES,
  type SkillTreeNode,
  type SkillModifier,
} from './skill-tree-data.ts';
export { SKILL_TREE_NODES, TREE_RULES, TREE_ROLES };
export { V14_THIRD_BRANCH_NAMES } from './skill-extension.ts';
export const roleTree = (role: G.HeroId): readonly SkillTreeNode[] =>
  SKILL_TREE_NODES.filter((node) => node.role === role);
export const totalSkillPoints = (h: G.Hero) =>
  TREE_RULES.pointLevels.filter((level) => h.level >= level).length;
export const spentSkillPoints = (h: G.Hero) =>
  roleTree(h.role)
    .filter((node) => h.learnedNodes?.includes(node.id))
    .reduce((sum, node) => sum + node.pointCost, 0);
export const skillPoints = (h: G.Hero) =>
  totalSkillPoints(h) - spentSkillPoints(h);
export function nodeKnown(h: G.Hero, node: SkillTreeNode) {
  return node.branch === 'root' || !!h.learnedNodes?.includes(node.id);
}
export function unlockedSkills(h: G.Hero): readonly G.SkillDefinition[] {
  const ids = roleTree(h.role)
    .filter((node) => node.type === 'active' && nodeKnown(h, node))
    .map((node) => node.skillId);
  return G.skillsForRole(h.role).filter(
    (skill) => ids.includes(skill.id) || skill.id === h.legacySkill,
  );
}
export function skillBonuses(h: G.Hero): Required<SkillModifier> {
  const result = {
    hp: 0,
    attack: 0,
    defense: 0,
    crit: 0,
    dodge: 0,
    critDamage: 0,
    healing: 0,
    shield: 0,
    cooldown: 0,
  };
  for (const node of roleTree(h.role))
    if (nodeKnown(h, node) && node.modifiers)
      for (const [key, value] of Object.entries(node.modifiers))
        result[key as keyof typeof result] += value!;
  result.cooldown = Math.min(0.3, result.cooldown);
  return result;
}
export function learnSkillReason(s: G.State, id: string, nodeId: string) {
  const h = s.heroes.find((h) => h.id === id),
    node = h && roleTree(h.role).find((n) => n.id === nodeId);
  if (!h || !node) return '不是该职业的技能';
  if (G.heroAway(s, id)) return '该角色出征中';
  if (nodeKnown(h, node)) return '已掌握';
  if (h.level < node.minLevel) return `需要 Lv.${node.minLevel}`;
  if (
    node.requires.some(
      (key) => !roleTree(h.role).some((n) => n.id === key && nodeKnown(h, n)),
    )
  )
    return '先学习连线的前置技能';
  if (skillPoints(h) < node.pointCost) return `需要 ${node.pointCost} 技能点`;
  return '';
}
export function learnSkill(s0: G.State, id: string, nodeId: string) {
  if (learnSkillReason(s0, id, nodeId)) return s0;
  const s = G.clone(s0),
    h = s.heroes.find((h) => h.id === id)!,
    node = roleTree(h.role).find((n) => n.id === nodeId)!;
  h.learnedNodes = [...(h.learnedNodes || []), nodeId];
  if (node.skillId) {
    h.activeSkill = node.skillId as G.SkillId;
    if (h.secondarySkill === h.activeSkill) delete h.secondarySkill;
  }
  G.log(s, `${h.name}学会「${node.name}」。`, 'good');
  return s;
}
export function resetSkills(s0: G.State, id: string) {
  const old = s0.heroes.find((h) => h.id === id);
  if (!old || G.heroAway(s0, id) || !old.learnedNodes?.length) return s0;
  const s = G.clone(s0),
    h = s.heroes.find((h) => h.id === id)!;
  h.learnedNodes = [];
  h.activeSkill = h.legacySkill || G.DEFAULT_SKILL[h.role];
  delete h.secondarySkill;
  G.log(s, `${h.name}重置技能树，已用技能点全部退回。`);
  return s;
}
export function skillNodeHelp(h: G.Hero, node: SkillTreeNode) {
  const names: Record<keyof SkillModifier, string> = {
    hp: '生命',
    attack: '攻击',
    defense: '防御',
    crit: '暴击率',
    dodge: '闪避率',
    critDamage: '暴击伤害',
    healing: '治疗效果',
    shield: '护盾效果',
    cooldown: '技能冷却缩短',
  };
  const detail = node.skillId
    ? G.skillHelp(node.skillId as G.SkillId).body
    : Object.entries(node.modifiers || {})
        .map(
          ([key, value]) =>
            `${names[key as keyof SkillModifier]} ${value! >= 0 ? '+' : ''}${Math.round(value! * 100)}%`,
        )
        .join('；');
  return {
    title: node.name,
    body:
      detail +
      (node.skillId ? skillBuildLinks(node.skillId) : '') +
      `\n${node.branch === 'root' ? '初始掌握' : `Lv.${node.minLevel} · ${node.pointCost} 技能点`}。`,
  };
}
/** Explain mechanical connections next to the learned node, without prescribing a mandatory party. */
export function skillBuildLinks(skillId: string) {
  const skill = G.SKILLS.find((s) => s.id === skillId);
  if (!skill) return '';
  const links: string[] = [];
  if (skill.healing)
    links.push(
      '沉钟四件：直接治疗的溢出量可变为预备护盾，治疗分支因此也能提前应对重击。',
    );
  if (
    skill.incomingMultiplier ||
    skill.wardHits ||
    skill.evasion ||
    skill.shield
  )
    links.push(
      '林守/铁壁四件：掩护承伤可触发反击或蓄力；选择被敌人盯住的受益者更有效。',
    );
  if (skill.dot?.kind === 'fire')
    links.push(
      '燃烧联动：可留待每轮结算，或让携带星陨咒/解构爆剂的队友消耗余火提前爆发。',
    );
  if (skill.detonateFire)
    links.push(
      '引爆时机：先由另一名队友点燃；剩余伤害80%立即结算，上限120%本人攻击。过早引爆会牺牲持续伤害。',
    );
  if (skill.shatter || skill.pierceBonus)
    links.push(
      '龙痕四件：命中后为其他队友留下猎痕；先开弱点，再让主攻手行动。',
    );
  if (skill.cleanseBurn)
    links.push(
      '破晓四件：这项净化还可解除治疗封印，同时给全队短盾；封禁回合也能施放。',
    );
  return links.length ? '\n\n搭配方向：' + links.join('\n') : '';
}
export function setSecondarySkill(s0: G.State, id: string, skillId: string) {
  const h = s0.heroes.find((h) => h.id === id);
  if (
    !h ||
    G.heroAway(s0, id) ||
    h.level < 20 ||
    skillId === G.DEFAULT_SKILL[h.role] ||
    skillId === G.heroSkill(h).id ||
    (skillId && !G.unlockedSkills(h).some((skill) => skill.id === skillId))
  )
    return s0;
  const s = G.clone(s0),
    hero = s.heroes.find((h) => h.id === id)!;
  if (skillId) hero.secondarySkill = skillId as G.SkillId;
  else delete hero.secondarySkill;
  return s;
}
export function validateHeroTree(h: G.Hero) {
  if (
    h.secondarySkill !== undefined &&
    (h.level < 20 ||
      h.secondarySkill === G.DEFAULT_SKILL[h.role] ||
      h.secondarySkill === G.heroSkill(h).id ||
      !unlockedSkills(h).some((skill) => skill.id === h.secondarySkill))
  )
    throw Error('第二技能栏无效');
  if (
    h.learnedNodes !== undefined &&
    (!Array.isArray(h.learnedNodes) ||
      h.learnedNodes.length > 12 ||
      new Set(h.learnedNodes).size !== h.learnedNodes.length ||
      h.learnedNodes.some(
        (id) =>
          !roleTree(h.role).some(
            (node) =>
              node.id === id &&
              node.branch !== 'root' &&
              node.minLevel <= h.level &&
              node.requires.every((key) =>
                roleTree(h.role).some((n) => n.id === key && nodeKnown(h, n)),
              ),
          ),
      ) ||
      skillPoints(h) < 0)
  )
    throw Error('技能树点数或前置无效');
  if (
    h.legacySkill !== undefined &&
    !G.skillsForRole(h.role).some(
      (skill) =>
        skill.id === h.legacySkill && 'legacyId' in skill && skill.legacyId,
    )
  )
    throw Error('旧技能记录无效');
  if (
    !unlockedSkills(h).some(
      (skill) => skill.id === (h.activeSkill || G.DEFAULT_SKILL[h.role]),
    )
  )
    throw Error('尚未掌握携带技能');
}
