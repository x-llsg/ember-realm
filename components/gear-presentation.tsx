'use client';
import * as G from '@/lib/realm';
import { InfoHint, Term } from './info-hint';
import { HELP, affixHelp } from '@/lib/glossary';
import '@/app/gear-presentation.css';

export function GearWearer({ s, item }: { s: G.State; item: G.Gear }) {
  const owner = G.gearOwner(s, item.id);
  if (!owner) return <span>闲置</span>;
  const applicant = !s.heroes.some((hero) => hero.id === owner.id);
  return <span className="gear-wearer">
    <strong className={'gear-wearer-name potential-' + owner.quality}>{owner.name}</strong>
    <em className="gear-wearer-status">{G.heroAway(s, owner.id) ? '出征携带' : applicant ? '候选 · 已穿戴' : '已穿戴'}</em>
  </span>;
}

export function GearLabel({ s, item, withinControl = false }: { s: G.State; item: G.Gear; withinControl?: boolean }) {
  const recipe = G.RECIPES.find((r) => r.id === item.recipe)!;
  const stats = G.itemStats(s, item);
  return (
    <InfoHint
      withinControl={withinControl}
      className={'gear-name rarity-' + item.rarity}
      title={G.gearName(item)}
      body={
        <>
          <p>{recipe.text}</p>
          <p>{G.gearSetHelp(item)}</p>
          <p>
            攻击 +{Math.round(stats.attack)} · 生命 +{Math.round(stats.hp)} ·
            防御 +{Math.round(stats.defense)}
            <br />
            穿甲 {Math.round(stats.pierce * 100)}% · 暴击 +
            {Math.round(stats.crit * 100)}% · 闪避 +
            {Math.round(stats.dodge * 100)}%<br />火 / 暗 / 神抗{' '}
            {Math.round(stats.fire * 100)} / {Math.round(stats.shadow * 100)} /{' '}
            {Math.round(stats.radiant * 100)}%
          </p>
          <p>
            T{item.tier} · {G.QUALITY_NAMES[item.rarity - 1]} · 强化 +
            {item.upgrade}
          </p>
          <p>{HELP.tier.body}</p>
          <p>{affixHelp(item.affix, s, item).body}</p>
        </>
      }
    >
      {G.gearName(item)}
    </InfoHint>
  );
}
export function GearStats({
  s,
  item,
  base = false,
}: {
  s: G.State;
  item: G.Gear;
  base?: boolean;
}) {
  const a = G.itemStats(s, item, !base);
  return (
    <p className="guild-meta">
      {a.attack > 0 && `攻击 +${Math.round(a.attack)} `}
      {a.hp > 0 && `生命 +${Math.round(a.hp)} `}
      {a.defense > 0 && `防御 +${Math.round(a.defense)} `}
      {a.crit > 0 && (
        <InfoHint
          title="暴击率"
          body="提高单次攻击暴击的概率，个人总暴击率上限60%。"
        >
          暴击 +{Math.round(a.crit * 100)}%{' '}
        </InfoHint>
      )}
      {a.dodge > 0 && (
        <InfoHint
          title="闪避率"
          body="躲避敌人单体攻击的概率，个人总闪避率上限40%；不能躲避群体重击。"
        >
          闪避 +{Math.round(a.dodge * 100)}%{' '}
        </InfoHint>
      )}
      {a.critDamage > 0 && (
        <InfoHint
          title="暴击伤害"
          body="暴击基础造成150%伤害，此词条向倍率加算，最高300%。"
        >
          暴伤 +{Math.round(a.critDamage * 100)}%{' '}
        </InfoHint>
      )}
      {a.pierce > 0 && (
        <>
          <Term name="pierce">穿甲</Term> {Math.round(a.pierce * 100)}%{' '}
        </>
      )}
      {a.ranged > 0 && (
        <>
          <Term name="ranged">远程贡献</Term> {Math.round(a.ranged * 100)}%{' '}
        </>
      )}
      {a.fire > 0 && (
        <>
          <Term name="resistance">火抗</Term> {Math.round(a.fire * 100)}%{' '}
        </>
      )}
      {a.shadow > 0 && (
        <>
          <Term name="resistance">暗抗</Term> {Math.round(a.shadow * 100)}%{' '}
        </>
      )}
      {a.radiant > 0 && (
        <>
          <Term name="resistance">神抗</Term> {Math.round(a.radiant * 100)}
          %{' '}
        </>
      )}
    </p>
  );
}
