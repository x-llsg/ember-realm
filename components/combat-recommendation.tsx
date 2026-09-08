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
  const quality = ['白', '绿', '蓝', '紫', '金', '红'][target.rarity - 1];
  const extra = [
    target.mastery ? `专精${target.mastery}阶` : '',
    target.kit ? `行装${target.kit}阶` : '',
    target.smithing ? `工匠传承${target.smithing}阶` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="combat-recommendation" aria-label="推荐练度">
      <InfoHint
        title="推荐练度"
        body={
          <div className="combat-recommendation-help">
            <p>
              {target.count}人，Lv.{target.level}；T{target.tier}
              {quality}装 +{target.upgrade}，每人配齐{target.slots.length}
              个部位。
            </p>
            {extra && <p>{extra}。分配技能点，并按敌人调整防护。</p>}
            <p>
              这是养成参考，职业、技能与配装由你决定。
              {node === 6 && s.guild.depths[region] < 4
                ? '当前首领处于全盛状态，需要更充分的准备。'
                : ''}
            </p>
          </div>
        }
      >
        <span>
          推荐练度 · {target.count}人 Lv.{target.level} · T{target.tier}
          {quality}装 +{target.upgrade} · {target.slots.length}部位
        </span>
      </InfoHint>
    </div>
  );
}
