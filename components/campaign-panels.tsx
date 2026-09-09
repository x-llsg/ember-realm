'use client';
import { InfoHint, MaterialName } from './info-hint';
import { GameIcon } from './game-art';
import { useState } from 'react';
import * as G from '@/lib/realm';
import { Buy, Pick, type Act, type Destination, number } from './realm-panels';
type Props = { s: G.State; act: Act; go?: (d: Destination) => void };

export function TechnologyPanel({
  s,
  act,
  initial,
}: Props & { initial?: string }) {
  const [selected, setSelected] = useState(
    G.TECHNOLOGIES.some(
      (t) => t.id === initial && G.technologyDiscovered(s, t.id),
    )
      ? initial!
      : G.TECHNOLOGIES.find(
          (t) =>
            G.technologyDiscovered(s, t.id) && !s.world.tech.includes(t.id),
        )?.id || 'settlement',
  );
  const t = G.TECHNOLOGIES.find((t) => t.id === selected)!;
  const done = s.world.tech.includes(t.id);
  return (
    <div className="campaign-detail">
      <Pick
        label="选择城镇进阶研究"
        value={selected}
        onChange={setSelected}
        options={G.TECHNOLOGIES.filter((t) =>
          G.technologyDiscovered(s, t.id),
        ).map((t) => ({
          value: t.id,
          label: `${s.world.tech.includes(t.id) ? '✓ ' : ''}${t.name}`,
        }))}
      />
      <article className="campaign-card">
        <span className="life-kicker">
          {G.TOWN_RANK_NAMES[G.townRank(s)]} · 探索带来新工艺
        </span>
        <h2 className="illustrated-research-heading">
          <GameIcon kind="research" id={t.id} size={36} />
          <span>{t.name}</span>
        </h2>
        <p>{t.desc}</p>
        <div className="campaign-effects">
          <span>
            当前建筑上限 <strong>{G.buildingLimit(s, 'lumber')}</strong>
          </span>
          <span>
            当前训练上限 <strong>Lv.{G.levelCap(s)}</strong>
          </span>
          <span>
            当前锻造能力 <strong>T{G.gearTier(s)}</strong>
          </span>
        </div>
        <p className="guild-meta">
          {G.technologyPrerequisiteReason(s, t.id) ||
            '样品已带回。工艺会开放新的生产、扩建与配方。'}
        </p>
        <Buy
          s={s}
          cost={t.cost}
          materials={t.materials}
          reason={done ? '已经掌握' : G.technologyReason(s, t.id)}
          label={done ? '已掌握此工艺' : '研究并应用'}
          onClick={() => act((x) => G.studyTechnology(x, t.id))}
        />
      </article>
    </div>
  );
}

export function WorkshopPanel({
  s,
  act,
  go,
  initial,
}: Props & { initial?: G.WorkId }) {
  const [selected, setSelected] = useState<G.WorkId>(initial || 'boards');
  const r = G.WORK_RECIPES.find((r) => r.id === selected)!;
  const quote = G.processingQuote(s, selected),
    variants = G.processingVariants(s, selected);
  const reason = G.workReason(s, selected);
  return (
    <div className="campaign-detail">
      <div className="campaign-stock" aria-label="地区与工坊材料仓">
        {(Object.keys(G.MATERIAL_NAMES) as G.MaterialId[])
          .filter((k) => G.materialDiscovered(s, k))
          .map((k) => (
            <span key={k}>
              <small>
                <MaterialName s={s} id={k} />
              </small>
              <strong>
                {number(s.world.materials[k])}
                <i>/{G.materialCapacity(s, k)}</i>
              </strong>
            </span>
          ))}
      </div>
      <Pick
        label="选择加工线"
        value={selected}
        onChange={(v) => setSelected(v as G.WorkId)}
        options={G.WORK_RECIPES.filter((r) =>
          s.world.tech.includes(r.tech),
        ).map((r) => ({
          value: r.id,
          label: `${r.name} · ${s.world.work[r.id] ? '已开启' : '未开启'}`,
        }))}
      />
      <article className="campaign-card">
        <h2 className="illustrated-research-heading">
          <GameIcon kind="material" id={r.id} size={32} />
          <span>{r.name}</span>
        </h2>
        <InfoHint
          title={quote.name}
          body={<p>{quote.text} 切换配方或生产方式会重新开始当前批次。</p>}
        >
          <strong>{quote.name}</strong>
        </InfoHint>
        {variants.length > 1 && (
          <Pick
            label="选择原料配方"
            value={quote.variant}
            options={variants.map((v) => ({ value: v.variant, label: v.name }))}
            onChange={(v) => act((x) => G.setWorkVariant(x, selected, v))}
          />
        )}
        <p className="material-price">
          每 {quote.seconds} 秒：{G.costText(quote.cost)}{' '}
          {G.materialCostText(quote.materials)} → {quote.output}{' '}
          <MaterialName s={s} id={r.id} />
        </p>
        <progress
          aria-label="本批加工进度"
          max={G.workDuration(s, selected)}
          value={s.world.workProgress[selected]}
        />
        <p className="guild-meta">
          {s.world.work[selected]
            ? reason ||
              `加工中 · ${Math.floor(s.world.workProgress[selected])}/${G.workDuration(s, selected)} 秒`
            : reason || '尚未安排加工'}
          。{G.workStations(s, selected)} 台加工设备；对应建筑在 4 / 7 / 10
          级扩产。满仓或缺料时不扣物资。
        </p>
        <div className="life-inline-actions">
          <button
            className="primary-button"
            disabled={!s.world.tech.includes(r.tech)}
            onClick={() => act((x) => G.toggleWork(x, selected))}
          >
            {s.world.work[selected] ? '暂停这条加工线' : '开启持续加工'}
          </button>
          <button
            className="secondary-button"
            onClick={() => go?.({ view: 'research', tab: 'technology' })}
          >
            查看工艺研究
          </button>
        </div>
      </article>
    </div>
  );
}

const rewards = [
  '古木 → 精制木板与定居扩建',
  '灵砂 → 符文、法杖与暗抗法衣',
  '黑铁矿 → 精钢、战矛与城防',
  '深渊余烬 → 破誓装备与王城工艺',
  '龙鳞 → 抗火猎装与屠龙工艺',
  '星髓 → T6 神话装备',
];
export function WorldMapPanel({
  s,
  region,
  select,
}: Props & { region: number; select: (r: number) => void }) {
  return (
    <div className="campaign-map">
      <p className="guild-meta">
        队伍把走通的道路画在这里。新的营地、见闻与胜利会带来下一条岔路。
      </p>
      <div className="campaign-nodes">
        {G.REGIONS.map((r, i) => ({ r, i }))
          .filter(({ i }) => G.regionOpen(s, i))
          .map(({ r, i }) => (
            <button
              key={r.name}
              className={`campaign-node ${i === region ? 'selected' : ''}`}
              onClick={() => select(i)}
            >
              <span>
                {String(i + 1).padStart(2, '0')} ·{' '}
                {s.cleared.includes(i)
                  ? '已平定'
                  : G.regionOpen(s, i)
                    ? `已通路 · 据点 ${s.guild.depths[i]}/5`
                    : '尚未通路'}
              </span>
              <strong className="illustrated-work-name">
                <GameIcon
                  kind="material"
                  id={G.REGION_MATERIALS[i]}
                  size={24}
                />
                {r.name}
              </strong>
              <small>
                {G.regionVisited(s, i) ? rewards[i] : '尚未带回当地样品'}
              </small>
              <small>
                {G.regionReason(s, i) || '可调查、推进或反复收集区域材料'}
              </small>
            </button>
          ))}
      </div>
    </div>
  );
}
