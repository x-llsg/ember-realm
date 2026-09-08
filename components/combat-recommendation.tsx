'use client';

import * as G from '@/lib/realm';
import { combatRecommendation } from '@/lib/combat-recommendation';
import { InfoHint } from './info-hint';

export function CombatRecommendation({
  s,
  region,
  node,
}: {
  s: G.State;
  region: number;
  node: number;
}) {
  const target = combatRecommendation(region, node);
  const members = s.party
    .map((id) => s.heroes.find((h) => h.id === id)!)
    .filter(Boolean);
  const equipped = members.reduce(
    (sum, h) =>
      sum +
      target.slots.filter((slot) => {
        const item = s.guild.inventory.find((g) => g.id === h.equipment[slot]);
        return (
          item &&
          item.tier >= target.tier &&
          item.rarity >= target.rarity &&
          item.upgrade >= target.upgrade
        );
      }).length,
    0,
  );
  const unused = members.reduce((sum, h) => sum + G.skillPoints(h), 0);
  const names = [...target.tech, ...target.research].map(
    (id) =>
      G.TECHNOLOGIES.find((t) => t.id === id)?.name ||
      G.RESEARCH.find((r) => r.id === id)?.name ||
      id,
  );
  const enemy = G.enemyDefinition(
    s,
    region,
    node === 6 ? 'boss' : 'guardian',
    node - 1,
  );
  const quality = ['白', '绿', '蓝', '紫', '金', '红'][target.rarity - 1];
  // Resolve the reference loadout with the same recipe gates as forging, using
  // this encounter's development stage instead of the player's later unlocks.
  const reference: G.State = {
    ...s,
    world: { ...s.world, tech: [...target.tech] },
    guild: {
      ...s.guild,
      depths: Array.from({ length: 6 }, (_, i) =>
        i === region ? node - 1 : region === 5 && i === 4 ? 5 : 0,
      ),
    },
  };
  const available = (recipe: string) =>
    !G.recipeUnlockReason(reference, recipe);
  const magical = target.element !== 'physical';
  const coat =
    target.element === 'shadow'
      ? 'shadowcoat'
      : target.element === 'fire'
        ? 'firecoat'
        : 'dawncoat';
  const armor = magical && available(coat) ? coat : 'plate';
  const charm = magical && available('wardstone') ? 'wardstone' : 'vitality';
  const weapons = target.roles.map((role) =>
    role === 'finn' || region === 4
      ? 'bow'
      : magical && available('staff')
        ? 'staff'
        : available('pike')
          ? 'pike'
          : 'blade',
  );
  const recipeName = (id: string) =>
    G.RECIPES.find((r) => r.id === id)?.name || id;
  const skills = target.roles
    .map((roleId) => {
      const role = G.HEROES.find((hero) => hero.id === roleId)?.id;
      if (!role) return undefined;
      const active = G.roleTree(role).find(
        (n) => n.branch === target.skillBranch && n.type === 'active',
      );
      const skillId =
        active && active.minLevel <= target.level
          ? active.skillId
          : G.DEFAULT_SKILL[role];
      return G.skillsForRole(role).find((skill) => skill.id === skillId)?.name;
    })
    .filter(Boolean);
  return (
    <div className="combat-recommendation" aria-label={enemy.name + '养成参考'}>
      <InfoHint
        title={enemy.name + ' · 推荐队伍'}
        body={
          <div className="combat-recommendation-help">
            <p>
              {target.count}人，Lv.{target.level}，以{target.quality}
              星、三项资质100、
              {G.TALENTS.find((t) => t.id === target.talent)?.name}
              天赋、{target.origin}出身为数值参照。
            </p>
            <p>
              参考阵容：
              {target.roles
                .map((id) => G.HEROES.find((h) => h.id === id)?.role || id)
                .join('、')}
              。
            </p>
            <p>
              每人：T{target.tier} {G.QUALITY_NAMES[target.rarity - 1]}装备 +
              {target.upgrade}；
              {target.slots.map((slot) => G.SLOT_NAMES[slot]).join('、')}
              全部配齐。武器依阵容顺序为{weapons.map(recipeName).join('、')}；
              护甲用{recipeName(armor)}，饰品用{recipeName(charm)}。
              {target.slots.length > 3 &&
                `其余部位为${['cap', 'grips', 'boots'].map(recipeName).join('、')}。`}
            </p>
            <p>
              专精{target.mastery}阶 · 全队行装{target.kit}阶
              {target.smithing ? ` · 工匠传承${target.smithing}阶` : ''}。
              {target.skillText}；参考主动技能：{skills.join('、')}。
            </p>
            <p>
              准备：{target.stance === 'cautious' ? '谨慎姿态' : target.stance}
              {target.element === 'physical'
                ? '，物理战不带抗性药剂'
                : `，${G.ELEMENT_NAMES[target.element]}抗性药剂`}
              {target.remedy ? '，额外药囊' : ''}。
            </p>
            {names.length > 0 && <p>发展参照：{names.join('、')}。</p>}
            <p>
              当前{members.length}/{target.count}人；参考装备{equipped}/
              {target.count * target.slots.length}件；未用技能点{unused}
              。这是完整养成的推荐等级，单纯升到该等级不代表能过；其他阵容按实际属性与技能结算。
            </p>
          </div>
        }
      >
        <span>
          养成参考 · {target.count}人 Lv.{target.level} · T{target.tier}
          {quality}装 +{target.upgrade} · {target.slots.length}部位
        </span>
      </InfoHint>
      <small>
        参考装备 {equipped}/{target.count * target.slots.length}
        {unused ? ` · 待分配技能点 ${unused}` : ''}
      </small>
    </div>
  );
}
