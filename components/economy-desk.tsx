'use client';
import * as G from '@/lib/realm';
import { InfoHint, MaterialName } from './info-hint';
import { Pick, type Act, type Destination, short } from './realm-panels';

type Props = { s: G.State; act: Act; go?: (d: Destination) => void };
function Bill({
  s,
  cost,
  materials = {},
}: {
  s: G.State;
  cost: G.Cost;
  materials?: G.MaterialCost;
}) {
  return (
    <span className="flow-bill">
      {Object.entries(cost).map(([id, n]) => (
        <span
          key={id}
          className={s.resources[id as G.Resource] < n! ? 'short' : ''}
        >
          {G.RESOURCE_NAMES[id as G.Resource]} {short(n!)}
        </span>
      ))}
      {Object.entries(materials).map(([id, n]) => (
        <span
          key={id}
          className={s.world.materials[id as G.MaterialId] < n! ? 'short' : ''}
        >
          {G.MATERIAL_NAMES[id as G.MaterialId]} {n}
        </span>
      ))}
    </span>
  );
}
export function EconomyDesk({ s, act, go }: Props) {
  const recipes = G.WORK_RECIPES.filter((w) => s.world.tech.includes(w.tech));
  const routes = G.REGIONS.map((region, r) => ({ region, r })).filter(({ r }) =>
    G.routeDiscovered(s, r),
  );
  const plan = G.transportPlan(s),
    order = G.civicOrder(s);
  const available = G.DEVELOPMENTS.filter(
    (d) =>
      G.developmentDiscovered(s, d.id) &&
      G.developmentLevel(s, d.id) < G.DEVELOPMENT_MAX,
  );
  return (
    <section className="econ-board flow-desk" aria-label="城镇经营">
      <header className="econ-board-head">
        <strong>城镇经营</strong>
        <span>
          <button onClick={() => go?.({ view: 'town', tab: 'workers' })}>
            调配住民 · 空闲 {G.idleWorkers(s)} →
          </button>{' '}
          ·{' '}
          <button
            onClick={() => go?.({ view: 'research', tab: 'development' })}
          >
            {available.length} 项产线改良 →
          </button>
        </span>
      </header>
      <div className="flow-stock">
        {G.MATERIAL_IDS.filter((id) => G.materialDiscovered(s, id)).map(
          (id) => (
            <span key={id}>
              <MaterialName s={s} id={id} />
              <strong>
                {short(s.world.materials[id])}
                <small> / {G.materialCapacity(s, id)}</small>
              </strong>
            </span>
          ),
        )}
      </div>
      <div className="flow-columns">
        <div className="flow-column">
          <div className="flow-section-title">
            <strong>材料加工</strong>
            <small>产能、用料、库存共同决定产出</small>
          </div>
          {recipes.map((w) => {
            const bill = G.processingBill(s, w.id),
              output = G.processingOutput(s, w.id),
              seconds = G.workDuration(s, w.id),
              reason = G.workReason(s, w.id);
            return (
              <article className="flow-work" key={w.id}>
                <div className="flow-line">
                  <InfoHint
                    title={w.name}
                    body={
                      <>
                        <p>{w.text}</p>
                        <p>
                          每批 {G.costText(bill.cost)}，
                          {G.materialCostText(bill.materials)}，产出 {output}{' '}
                          件。改良工艺改善成材率；赶工提高产速但增加每批投入。
                        </p>
                      </>
                    }
                  >
                    <strong>{w.name}</strong>
                  </InfoHint>
                  <span>
                    {((output * 60) / seconds).toFixed(1)} 件/分 · {seconds}
                    秒/批
                  </span>
                  <button
                    className={
                      s.world.work[w.id] ? 'secondary-button' : 'primary-button'
                    }
                    onClick={() => act((x) => G.toggleWork(x, w.id))}
                  >
                    {s.world.work[w.id] ? '暂停' : '开工'}
                  </button>
                </div>
                <div className="flow-controls">
                  {G.workModesUnlocked(s, w.id) ? (
                    <Pick
                      value={s.economy.modes[w.id]}
                      label={`${w.name}生产方式`}
                      options={[
                        { value: 'steady', label: '标准加工' },
                        { value: 'efficient', label: '精作 · 用料75% / 速度⅔' },
                        { value: 'rush', label: '赶工 · 用料150% / 速度150%' },
                      ]}
                      onChange={(v) =>
                        act((x) => G.setWorkMode(x, w.id, v as G.WorkMode))
                      }
                    />
                  ) : (
                    <button
                      className="flow-link"
                      onClick={() =>
                        go?.({
                          view: 'research',
                          research: G.DEVELOPMENTS.find((d) => d.work === w.id)!
                            .id,
                        })
                      }
                    >
                      工艺2级开放精作与赶工 →
                    </button>
                  )}
                  {G.stockControlsUnlocked(s) && (
                    <Pick
                      label={`${w.name}库存目标`}
                      value={String(s.economy.targets[w.id])}
                      options={[0.25, 0.5, 0.75, 1].map((n) => ({
                        value: String(n),
                        label: `存至 ${n * 100}%`,
                      }))}
                      onChange={(v) =>
                        act((x) => G.setWorkTarget(x, w.id, Number(v)))
                      }
                    />
                  )}
                </div>
                <div className="flow-foot">
                  <progress
                    max={seconds}
                    value={Math.min(seconds, s.world.workProgress[w.id])}
                    aria-label={`${w.name}批次进度`}
                  />
                  <span>
                    {s.world.work[w.id]
                      ? reason ||
                        `持续生产 · 已制 ${short(s.economy.crafted[w.id])} 件`
                      : '等待开工'}
                  </span>
                </div>
              </article>
            );
          })}
          {!recipes.length && (
            <p className="flow-empty">
              木匠正在等一段结实的古木。先安排居民订单与产线改良，首次探索会带来加工手艺。
            </p>
          )}
        </div>
        <div className="flow-column">
          <div className="flow-section-title">
            <strong>地区后勤</strong>
            <span>
              {G.transportLines(s)}/{G.transportSlots(s)} 条 · 搬运工{' '}
              {G.transportWorkers(s)}
            </span>
          </div>
          {routes.map(({ region, r }) => {
            const route = s.economy.routes[r],
              bill = G.routeCost(s, r),
              reason = G.routeUpgradeReason(s, r),
              upkeep = G.routeUpkeep(s, r);
            return (
              <article className="flow-route" key={r}>
                <div className="flow-line">
                  <InfoHint
                    title={`${region.name} · ${G.ROUTE_STAGES[route.level]}`}
                    body={
                      <>
                        <p>
                          守住第一据点后修路，第三据点开放驿站。每次施工立即改善运量，不占用主队。
                        </p>
                        <p>
                          每分钟 {G.MATERIAL_NAMES[G.REGION_MATERIALS[r]]} +
                          {(G.routeYield(s, r) * 60).toFixed(2)}；粮{' '}
                          {(upkeep.food! * 60).toFixed(1)}、金{' '}
                          {(upkeep.gold! * 60).toFixed(1)}
                          。缺补给时按比例公平分配；满仓不扣费用。
                        </p>
                        <p>{reason || '物资备齐，可以施工。'}</p>
                        <Bill s={s} {...bill} />
                      </>
                    }
                  >
                    <strong>{region.name}</strong>
                  </InfoHint>
                  <span className="flow-route-stage">
                    {route.level}/4 · {G.ROUTE_STAGES[route.level]}
                  </span>
                  <button
                    className="secondary-button"
                    disabled={!!reason}
                    onClick={() => act((x) => G.upgradeRoute(x, r))}
                    title={reason || G.costText(bill.cost)}
                  >
                    {route.level >= 4
                      ? '已建成'
                      : route.level
                        ? '扩建'
                        : '修路'}
                  </button>
                </div>
                {route.level > 0 ? (
                  <div className="flow-line">
                    <span className="flow-yield">
                      {G.MATERIAL_NAMES[G.REGION_MATERIALS[r]]} +
                      {(plan.yields[r] * 60).toFixed(1)}/分
                    </span>
                    <div className="flow-stepper">
                      <button
                        aria-label={`减少${region.name}搬运工`}
                        disabled={!!G.routeAssignmentReason(s, r, -1)}
                        onClick={() => act((x) => G.assignRoute(x, r, -1))}
                      >
                        −
                      </button>
                      <span>{route.crew} 人</span>
                      <button
                        aria-label={`增加${region.name}搬运工`}
                        disabled={!!G.routeAssignmentReason(s, r, 1)}
                        title={G.routeAssignmentReason(s, r, 1)}
                        onClick={() => act((x) => G.assignRoute(x, r, 1))}
                      >
                        ＋
                      </button>
                    </div>
                    <button
                      className="flow-link"
                      disabled={!route.crew}
                      onClick={() => act((x) => G.toggleRoute(x, r))}
                    >
                      {route.enabled ? '停运' : '启运'}
                    </button>
                  </div>
                ) : (
                  <div className="flow-route-price">
                    <Bill s={s} {...bill} />
                    {G.regionalDepth(s, r) < 1 && <small>需第一据点</small>}
                  </div>
                )}
              </article>
            );
          })}
          {!routes.length && (
            <p className="flow-empty">
              首次探索带回路线，夺下据点后即可修建运输设施。运输工人从城镇住民中分配。
            </p>
          )}
          {routes.length > 0 && (
            <div className="flow-note">
              主队推进与后勤同时运行。修路 → 装卸营地 → 常驻驿站 → 地区商道。
            </div>
          )}
        </div>
        <div className="flow-column flow-management">
          <div className="flow-section-title">
            <strong>城镇事务</strong>
            <small>批量订单与留守人才</small>
          </div>
          <article className="flow-work">
            <div className="flow-line">
              <InfoHint
                title="居民订单"
                body="居民订单持续把木、粮、石等物资换成金币；不占用主队，不需要反复领取。每批完成时扣料并付款，缺料、达到保留线或金币仓满时停工；没有限时惩罚。"
              >
                <strong>{order.name}</strong>
              </InfoHint>
              <span>
                {order.seconds}秒 → {order.gold} 金
              </span>
              <button
                className={
                  s.economy.orderActive ? 'secondary-button' : 'primary-button'
                }
                onClick={() => act(G.toggleCivicOrder)}
              >
                {s.economy.orderActive ? '暂停' : '接单'}
              </button>
            </div>
            <Bill s={s} cost={order.cost} />
            <div className="flow-controls">
              {G.orderBatches(s).length > 1 ? (
                <Pick
                  label="订单批量"
                  value={String(s.economy.orderBatch || 1)}
                  options={G.orderBatches(s).map((n) => ({
                    value: String(n),
                    label: n === 1 ? '小额订单' : '批量承接 · ' + n + '份',
                  }))}
                  onChange={(v) => act((x) => G.setOrderBatch(x, Number(v)))}
                />
              ) : (
                <button
                  className="flow-link"
                  onClick={() =>
                    go?.({ view: 'research', research: 'commerce' })
                  }
                >
                  商事2级开放批量承接 →
                </button>
              )}
              {G.orderBatches(s).length > 1 && (
                <small title="更换订单规模时清空当前备货进度，已完成订单保持不变。">
                  重选后重新备货
                </small>
              )}
            </div>
            <div className="flow-foot">
              <progress
                max={order.seconds}
                value={s.economy.orderProgress}
                aria-label="居民订单进度"
              />
              <span>
                {s.economy.orderActive
                  ? G.orderReason(s) || `交付中 · 已完成 ${s.economy.orders} 单`
                  : '安排后自动承接'}
              </span>
            </div>
          </article>
          {G.stockControlsUnlocked(s) && (
            <div className="flow-reserve">
              <InfoHint
                title="原料保留线"
                body="后勤、工坊、教学和居民订单不会消耗低于此比例的基础资源，给建设与下一次出征留出余量。原料不足时工作暂停，补足后自动恢复。"
              >
                <strong>原料保留</strong>
              </InfoHint>
              <Pick
                label="原料保留比例"
                value={String(s.economy.reserve)}
                options={[0, 0.1, 0.25, 0.5].map((n) => ({
                  value: String(n),
                  label: n ? `保留 ${n * 100}%` : '全部可用',
                }))}
                onChange={(v) => act((x) => G.setResourceReserve(x, Number(v)))}
              />
            </div>
          )}
          {s.heroes.length > 1 && (
            <div className="flow-duties">
              <strong>留守任职</strong>
              {G.DUTIES.map((d) => (
                <div className="flow-duty" key={d.id}>
                  <InfoHint
                    title={d.name}
                    body={
                      <>
                        <p>{d.desc}</p>
                        <p>
                          只让未编入出战队伍的伙伴任职；任职不阻止培养。效率 ×
                          {G.dutyMultiplier(s, d.id).toFixed(2)}
                          。教官每10秒为每位可成长学员消耗2粮1金。
                        </p>
                      </>
                    }
                  >
                    {d.name}
                  </InfoHint>
                  <Pick
                    label={d.name}
                    value={s.economy.duties[d.id] || ''}
                    options={[
                      { value: '', label: '暂不安排' },
                      ...s.heroes
                        .filter(
                          (h) =>
                            !s.party.includes(h.id) &&
                            !Object.entries(s.economy.duties).some(
                              ([key, id]) => key !== d.id && id === h.id,
                            ),
                        )
                        .map((h) => ({
                          value: h.id,
                          label: `${h.name} · Lv.${h.level}`,
                        })),
                    ]}
                    onChange={(v) => act((x) => G.assignDuty(x, d.id, v))}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function GrowthChoices({
  s,
  go,
}: {
  s: G.State;
  go: (d: Destination) => void;
}) {
  if (!s.buildings.market) return null;
  const options = G.growthChoices(s);
  return (
    <div className="growth-choices" aria-label="并行成长目标">
      {options.map((o) => (
        <button key={o.key} onClick={() => go(o.destination)}>
          <small>{o.domain}</small>
          <strong>{o.name}</strong>
          <span>{o.status}</span>
        </button>
      ))}
    </div>
  );
}
