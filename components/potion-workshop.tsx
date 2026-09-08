'use client';

import { useState } from 'react';
import * as G from '@/lib/realm';
import { InfoHint, MaterialName, ResourceName } from './info-hint';
import { Pick, type Act } from './realm-panels';

/** Town production stays available while the party is away. */
export function PotionWorkshop({ s, act }: { s: G.State; act: Act }) {
  const [selected, setSelected] = useState(s.guild.preparation.element);
  const recipes = G.POTIONS.filter((p) => !G.potionUnlockReason(s, p.id));
  const recipe = recipes.find((p) => p.id === selected) || recipes[0];
  if (!recipe) return null;
  const reason = G.craftPotionReason(s, recipe.id);
  return (
    <section className="potion-workshop" aria-label="药剂调配">
      <div className="potion-workshop-head">
        <InfoHint
          title="药剂调配"
          body="消耗城镇物资和远征材料，调配后存入药剂库存。每份供全队使用一场；正式开战扣除，撤退不返还。队伍外出期间仍可调配。"
        >
          <strong>药剂调配</strong>
        </InfoHint>
        <span>
          库存 {G.potionCount(s, recipe.id)}/{G.potionCapacity(s)} 份
        </span>
      </div>
      <div className="potion-workshop-actions">
        <Pick
          label="药剂配方"
          value={recipe.id}
          onChange={(id) => setSelected(id as G.Element)}
          options={recipes.map((p) => ({ value: p.id, label: p.name }))}
        />
        <button
          type="button"
          className="secondary-button"
          disabled={!!reason}
          title={reason || `调配一份${recipe.name}`}
          onClick={() => act((current) => G.craftPotion(current, recipe.id))}
        >
          调配 +1
        </button>
      </div>
      <div className="potion-workshop-cost" aria-label="每份药剂成本">
        {Object.entries(recipe.cost).map(([key, value]) => (
          <span
            key={key}
            className={
              s.resources[key as G.Resource] < value! ? 'life-short' : ''
            }
          >
            {value} <ResourceName s={s} id={key as G.Resource} />
          </span>
        ))}
        {Object.entries(recipe.materials).map(([key, value]) => (
          <span
            key={key}
            className={
              s.world.materials[key as G.MaterialId] < value!
                ? 'life-short'
                : ''
            }
          >
            {value} <MaterialName s={s} id={key as G.MaterialId} />
          </span>
        ))}
      </div>
      <small>{reason || recipe.effect}</small>
    </section>
  );
}
