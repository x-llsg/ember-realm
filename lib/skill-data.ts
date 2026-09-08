import {
  TREE_SKILLS,
  TREE_ROLES,
  type TreeSkill,
  type TreeRole,
} from './skill-tree-data.ts';
export type SkillRole = TreeRole;
export type SkillId = (typeof TREE_SKILLS)[number]['id'];
export type SkillDefinition = Omit<TreeSkill, 'id'> & { id: SkillId };
export const SKILLS: readonly SkillDefinition[] = TREE_SKILLS;
export const DEFAULT_SKILL = Object.fromEntries(
  TREE_ROLES.map((role) => [role.id, role.root]),
) as Record<SkillRole, SkillId>;
export const skillsForRole = (role: SkillRole): readonly SkillDefinition[] =>
  SKILLS.filter((skill) => skill.role === role);
export function selectedSkill(
  role: SkillRole,
  id?: string,
): SkillDefinition | undefined {
  return SKILLS.find(
    (skill) => skill.role === role && skill.id === (id ?? DEFAULT_SKILL[role]),
  );
}
