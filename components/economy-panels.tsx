'use client';
import { PinPlan } from './planning-board';
import { GuildRecruitment } from './guild-panels';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { InfoHint, ResourceName, MaterialName } from './info-hint';
import * as G from '@/lib/realm';
import { type Act, type Destination } from './realm-panels';

type Props = { s: G.State; act: Act; go: (d: Destination) => void };
const keys = Object.keys(G.RESOURCE_NAMES) as G.Resource[];
export function Price({ s, cost }: { s: G.State; cost: G.Cost }) {
  return (
    <span className="econ-price">
      {Object.entries(cost).map(([k, v]) => (
        <span
          key={k}
          className={s.resources[k as G.Resource] + 1e-8 < v! ? 'short' : ''}
        >
          <ResourceName s={s} id={k as G.Resource} /> {v}
        </span>
      ))}
    </span>
  );
}
export function QuickGather({ s, act }: Pick<Props, 's' | 'act'>) {
  const [workshop, setWorkshop] = useState(false);
  return (
    <section
      className={`econ-gather ${workshop ? 'workshop' : ''}`}
      aria-label="手动采集"
    >
      <span className="econ-gather-label">手动采集</span>
      {keys
        .filter((k) => G.resourceVisible(s, k))
        .map((k) => {
          const i = keys.indexOf(k);
          const reason = G.gatherReason(s, k),
            cd = G.gatherCooldown(s, k);
          return (
            <button
              key={k}
              className={i < 3 ? 'basic' : 'advanced'}
              disabled={!!reason}
              title={
                reason ||
                `${G.MANUAL[k].seconds} 秒冷却${Object.keys(G.MANUAL[k].cost).length ? ' · 消耗 ' + G.costText(G.MANUAL[k].cost) : ''}`
              }
              onClick={() => act((x) => G.gather(x, k))}
              aria-label={`${G.MANUAL[k].name}，${G.RESOURCE_NAMES[k]}加${G.manualAmount(s, k)}`}
            >
              <span>
                {G.MANUAL[k].name} <strong>+{G.manualAmount(s, k)}</strong>
              </span>
              <small>
                {s.paused
                  ? '已暂停'
                  : reason === '已满仓'
                    ? '已满仓'
                    : cd > 0
                      ? `${Math.ceil(cd)}秒`
                      : reason
                        ? reason
                        : k === 'iron'
                          ? '木2 石4 · 6秒'
                          : k === 'crystal'
                            ? '金3 · 8秒'
                            : `${G.MANUAL[k].seconds}秒冷却`}
              </small>
            </button>
          );
        })}
      {keys.some((k) => G.resourceVisible(s, k) && keys.indexOf(k) >= 3) && (
        <button
          className="econ-gather-switch"
          onClick={() => setWorkshop(!workshop)}
        >
          {workshop ? '采集' : '加工'}
          <ArrowRight />
        </button>
      )}
    </section>
  );
}
const shortEffect: Record<G.BuildingId, string> = {
  fire: '照亮营地；开放采粮与住所',
  hut: '人口上限 +3',
  warehouse: '全部资源容量 ×2',
  lumber: '每人木材 +0.325/秒（加成前）',
  farm: '每人口粮 +0.325/秒（加成前）',
  quarry: '开放石匠；每人石料 +0.20/秒',
  market: '开放商人；每人金币 +0.077/秒',
  tavern: '招募冒险者；经验 +10%、药囊 +1',
  forge: '开放锻造；每人铁锭 +0.03/秒',
  shrine: '开放高阶研究；每人魔晶 +0.014/秒',
};
function buildingEffect(s: G.State, id: G.BuildingId) {
  const stats: Partial<Record<G.BuildingId, [number, number, string]>> = {
    lumber: [0.65, 0.5, '木'],
    farm: [0.65, 0.5, '粮'],
    quarry: [0.5, 0.4, '石'],
    market: [0.22, 0.35, '金'],
    forge: [0.12, 0.25, '铁'],
    shrine: [0.07, 0.2, '晶'],
  };
  const v = stats[id],
    level = s.buildings[id],
    max = G.BUILDINGS.find((b) => b.id === id)!.max;
  if (!v) return level >= max ? '已完成全部建设' : shortEffect[id];
  const after = v[0] * (1 + (level + 1) * v[1]);
  if (!level)
    return `未建造：0产出；建成分工后每人 ${after.toFixed(3)} ${v[2]}/秒（加成前）`;
  const before = v[0] * (1 + level * v[1]);
  return level >= max
    ? `每人基础 ${before.toFixed(3)} ${v[2]}/秒（满级）`
    : `每人基础 ${before.toFixed(3)} → ${after.toFixed(3)} ${v[2]}/秒`;
}
function BuildingExplanation({ s, id }: { s: G.State; id: G.BuildingId }) {
  const b = G.BUILDINGS.find((b) => b.id === id)!;
  const work = (
    { lumber: 'boards', forge: 'steel', shrine: 'runes' } as Partial<
      Record<G.BuildingId, G.WorkId>
    >
  )[id];
  const hasWork =
    work &&
    s.buildings[id] > 0 &&
    s.world.tech.includes(G.WORK_RECIPES.find((r) => r.id === work)!.tech);
  return (
    <>
      <p>{b.desc}</p>
      <p>{buildingEffect(s, id)}</p>
      <p>{G.renovationHelp(s, id).body}</p>
      <p>
        当前 {s.buildings[id]} 级，本阶段上限 {G.buildingLimit(s, id)} 级。
        {G.buildingReason(s, id) || '前置设施已满足。'}
      </p>
      {hasWork && (
        <p>
          加工每件 {G.workDuration(s, work)} 秒；4 / 7 / 10
          级增加加工设备。升级会加快加工，原料单耗不变。
        </p>
      )}
      {id === 'warehouse' && (
        <p>
          容量：
          {keys
            .filter((k) => G.resourceVisible(s, k))
            .map((k) => G.RESOURCE_NAMES[k] + ' ' + G.capacity(s, k))
            .join(' · ')}
          。
        </p>
      )}
      {id === 'tavern' && (
        <p>
          升级提高旅人经验收益、药囊数量，2
          级开放专精培养。随机旅人出现率不受酒馆等级影响。
        </p>
      )}
      <p>{b.effect}</p>
    </>
  );
}

export function BuildingBoard({
  s,
  act,
  go,
  focus,
}: Props & { focus: Destination }) {
  const buildings = G.BUILDINGS.filter(
    (b) => b.id !== 'fire' && G.buildingVisible(s, b.id),
  );
  return (
    <div className="econ-board dense-building-board">
      <div className="econ-board-head">
        <strong>城镇建设</strong>
        <span>
          人口 {s.population}/{G.populationCap(s)} ·{' '}
          {G.TOWN_RANK_NAMES[G.townRank(s)]}
        </span>
        <button onClick={() => go({ view: 'town', tab: 'workers' })}>
          居民分工 →
        </button>
      </div>
      <div className="dense-list-caption">
        <span>建筑 / 等级 · 悬停查看用途</span>
        <span>下一次建设费用</span>
        <span>操作</span>
      </div>
      <div className="dense-building-list">
        {buildings.map((b) => {
          const level = s.buildings[b.id],
            limit = G.buildingLimit(s, b.id),
            max = level >= b.max,
            stageDone = level >= limit,
            cost = max || stageDone ? {} : G.buildingCost(s, b.id),
            materials = max || stageDone ? {} : G.buildingMaterialCost(s, b.id),
            reason = G.buildingReason(s, b.id),
            cap = G.capacityReason(s, cost),
            blocked = reason || cap || G.materialReason(s, materials);
          return (
            <article
              key={b.id}
              className={
                'dense-building-row' +
                (focus.building === b.id ? ' desk-focused' : '')
              }
            >
              <InfoHint
                className="dense-building-name"
                title={b.name}
                body={<BuildingExplanation s={s} id={b.id} />}
                side="right"
              >
                <strong>{b.name}</strong>
                <span>
                  扩建 {level}/{limit} · 改良 {G.renovationLevel(s, b.id)}
                </span>
              </InfoHint>
              <div className="dense-building-cost">
                {stageDone ? (
                  <small className="desk-muted">
                    {max ? '扩建完成 · 仍可改良' : '扩建待进阶 · 仍可改良'}
                  </small>
                ) : (
                  <>
                    <Price s={s} cost={cost} />
                    {!G.materialReason(s, materials) && (
                      <small className="material-price">
                        {Object.entries(materials).map(([k, v]) => (
                          <span key={k}>
                            {v}{' '}
                            <MaterialName s={s} id={k as G.MaterialId} />{' '}
                          </span>
                        ))}
                      </small>
                    )}
                    {blocked && <small className="life-hint">{blocked}</small>}
                  </>
                )}
              </div>
              <div className="building-upgrades">
                {!stageDone && <PinPlan s={s} act={act} kind="building" id={b.id} />}
                <button
                  className="econ-action"
                  disabled={!!blocked || stageDone || !G.canPay(s, cost)}
                  onClick={() => act((x) => G.build(x, b.id))}
                >
                  {stageDone ? '已完成' : level ? '升级' : '建造'}
                  <span className="sr-only">{b.name}</span>
                </button>
                {level > 0 && (
                  <InfoHint withinControl {...G.renovationHelp(s, b.id)}>
                    <button
                      className="econ-action"
                      disabled={!!G.renovationReason(s, b.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        act((x) => G.renovate(x, b.id));
                      }}
                      aria-label={'改良' + b.name}
                    >
                      改良 +1
                    </button>
                  </InfoHint>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <p className="econ-footnote">
        {!s.buildings.hut
          ? '先搭起住所，再接纳愿意留下的人。'
          : !s.population
            ? '小屋还空着，准备口粮后接纳旅人。'
            : '建好设施后安排居民工作；新建筑随城镇发展逐步揭示。'}
      </p>
    </div>
  );
}
export { ResearchBoard } from './research-desk';
export function RecruitmentBoard(props: Props) {
  return <GuildRecruitment {...props} />;
}
