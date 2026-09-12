'use client';
import { useState } from 'react';
import {
  Compass,
  Swords,
  Wrench,
  ArrowRight,
  Repeat2,
  PackageOpen,
  ChevronRight,
} from 'lucide-react';
import * as G from '@/lib/realm';
import * as S from '@/lib/site-exploration';
import { RELICS } from '@/lib/relic-data';
import type {
  SiteMethod,
  SiteRepeatOptions,
  SiteRewardKind,
  SiteVariant,
} from '@/lib/world-types';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { InfoHint } from './info-hint';
import { RegionScene, SiteEnemyPortrait } from './game-art';
import { PotionWorkshop } from './potion-workshop';
import { PinPlan } from './planning-board';
import { Pick, duration, type Act, type Destination } from './realm-panels';
import { RelicSigil, WorldBill, WorldTime } from './world-ui';

type Props = { s: G.State; act: Act; go: (d: Destination) => void };
const phases = {
  outbound: '前往地点',
  awaitingChoice: '已抵达 · 等待决定',
  resolving: '现场处理',
  battle: '地点战斗',
  returning: '携带收获返程',
};
const methodNames = { assault: '强攻', clever: '巧解' };
const helpNames = {
  shatter: '破盾',
  interrupt: '打断',
  shield: '护盾',
  heal: '治疗',
  cleanse: '净化',
  ranged: '远程',
};

export function rememberedSite(
  s: G.State,
  region: number,
  requested?: string | null,
) {
  const id =
    requested === undefined
      ? s.worldExploration.ui.lastSites[String(region)]
      : requested;
  return id &&
    s.worldExploration.sites[id]?.discovered &&
    S.siteDefinition(id)?.region === region
    ? id
    : null;
}

export function SiteNavigation({
  s,
  go,
  region,
  selected = null,
}: {
  s: G.State;
  go: Props['go'];
  region: number;
  selected?: string | null;
}) {
  const sites = S.SITES.filter(
    (site) =>
      site.region === region && s.worldExploration.sites[site.id]?.discovered,
  );
  if (!sites.length) return null;
  return (
    <nav className="world-place-nav" aria-label="地区主路与已发现地点">
      <button
        type="button"
        aria-pressed={!selected}
        onClick={() => go({ view: 'explore', region, site: null })}
      >
        主路
      </button>
      {sites.map((site) => (
        <button
          type="button"
          key={site.id}
          aria-pressed={selected === site.id}
          onClick={() => go({ view: 'explore', region, site: site.id })}
        >
          <InfoHint withinControl title={site.name} body={site.story}>
            {site.name}
          </InfoHint>
          {!s.worldExploration.sites[site.id].firstCompleted && (
            <span className="life-dot" />
          )}
        </button>
      ))}
    </nav>
  );
}

export function SiteExploreDesk({
  s,
  act,
  go,
  siteId,
}: Props & { siteId: string }) {
  const view = S.siteView(s, siteId),
    site = view.definition!,
    progress = view.progress!,
    variant = view.variant!,
    run = view.run;
  const [rewardKind, setRewardKind] = useState<SiteRewardKind>(
      run?.rewardKind || 'basic',
    ),
    [receiptOpen, setReceiptOpen] = useState(false),
    [repeatOpen, setRepeatOpen] = useState(false);
  const relic = RELICS.find((r) => r.id === site.relicId)!;
  const reward = run?.rewards || S.siteReward(s, siteId, rewardKind);
  const prep = run?.preparation || s.guild.preparation;
  const locked = !!s.expedition || !!s.battle || !!s.worldExploration.activeRun;
  const plan =
    s.worldExploration.repeatPlan?.siteId === siteId
      ? s.worldExploration.repeatPlan
      : null;
  const showResult = () => {
    act((x) => S.readSiteReceipt(x, siteId), '已查看地点收获。');
    setReceiptOpen(true);
  };
  const setPrep = (patch: Partial<G.State['guild']['preparation']>) => {
    if (!locked) act((x) => G.setPreparation(x, patch));
  };
  const potions = G.POTIONS.filter(
    (p) => !G.potionUnlockReason(s, p.id) || G.potionCount(s, p.id) > 0,
  );
  const pausedText = s.paused ? ' · 游戏已暂停' : '';
  const totalStage =
    run && run.phase !== 'battle' && run.phase !== 'awaitingChoice'
      ? S.siteStageSeconds(run.total)[run.phase]
      : 1;
  return (
    <>
      <div className="explore-desk explore-layout world-site-desk">
        <nav className="explore-regions" aria-label="已通路地区">
          <div className="explore-region-head">
            <Compass aria-hidden="true" />
            <strong>已知的道路</strong>
          </div>
          {G.REGIONS.map((r, id) => ({ r, id }))
            .filter(({ id }) => G.regionOpen(s, id))
            .map(({ r, id }) => (
              <button
                key={id}
                type="button"
                className={`explore-region-button${site.region === id ? ' selected' : ''}`}
                aria-pressed={site.region === id}
                onClick={() => go({ view: 'explore', region: id })}
              >
                <span className="explore-region-number">
                  {String(id + 1).padStart(2, '0')}
                </span>
                <span className="explore-region-copy">
                  <strong>{r.name}</strong>
                  <small>
                    {s.cleared.includes(id) ? '首领已败 · ' : '据点 '}
                    {s.guild.depths[id]}/5
                  </small>
                </span>
              </button>
            ))}
          <button
            className="explore-return-button"
            type="button"
            disabled={!progress.lastResult}
            onClick={showResult}
          >
            <PackageOpen aria-hidden="true" />
            上次地点收获
          </button>
        </nav>
        <div className="explore-location-bar">
          <SiteNavigation
            s={s}
            go={go}
            region={site.region}
            selected={site.id}
          />
        </div>
        <section className="world-site-center" aria-label={`${site.name}探索`}>
          <header className="world-site-head">
            <RegionScene region={site.region} />
            <RelicSigil id={site.relicId} />
            <div>
              <small>
                {G.REGIONS[site.region].name} ·{' '}
                {progress.firstCompleted ? '已探索地点' : '新的去处'}
              </small>
              <h2>
                <InfoHint title={site.name} body={site.story}>
                  {site.name}
                </InfoHint>
              </h2>
            </div>
          </header>
          <section
            className="world-journey-ledger"
            aria-label="行程费用与预计收获"
          >
            <div className="world-journey-cost">
              <InfoHint
                title="基础行程"
                body="出发时支付基础路费，覆盖去程、现场和归程；实际战斗耗时另计。两种处理方式的额外投入见下方路线。"
              >
                <strong>
                  {run ? '已付路费' : '基础行程'} ·{' '}
                  {duration(run?.total ?? view.travel.seconds)}
                </strong>
              </InfoHint>
              <WorldBill
                s={s}
                {...(run?.travelPaid || view.travel)}
                reward={!!run}
              />
            </div>
            <div className="world-journey-reward">
              <label htmlFor="site-reward">收获侧重</label>
              <Pick
                id="site-reward"
                label="支线收获侧重"
                value={run?.rewardKind || rewardKind}
                disabled={!!run}
                options={[
                  { value: 'basic', label: '回收基础补给' },
                  {
                    value: 'material',
                    label: G.materialDiscovered(
                      s,
                      G.REGION_MATERIALS[site.region],
                    )
                      ? `回收${G.MATERIAL_NAMES[G.REGION_MATERIALS[site.region]]}`
                      : '当地原料未发现 · 使用基础补给',
                  },
                ]}
                onChange={(v) => setRewardKind(v as SiteRewardKind)}
              />
              <WorldBill s={s} {...reward} reward empty="当前没有可回收物资" />
            </div>
          </section>
          <div className="world-site-body">
            <div className="world-preview">
              <InfoHint
                title={variant.name}
                body="现场状况在出发前已经确定。看预览、撤退或读档都不会刷新；成功收获全部结清后才出现下次预告，没有现实时间截止。"
              >
                <strong>{variant.name}</strong>
              </InfoHint>
              <span>{variant.description}</span>
            </div>
            {run && (
              <>
                <WorldTime
                  label={
                    (run.phase === 'resolving' && run.method === 'assault'
                      ? '接敌准备'
                      : phases[run.phase]) + pausedText
                  }
                  seconds={run.phase === 'awaitingChoice' ? 0 : run.remaining}
                  total={totalStage}
                />
                {run.waitingReason && (
                  <p className="world-blocker">{run.waitingReason}</p>
                )}
                {run.phase === 'awaitingChoice' && (
                  <p className="world-hint">
                    队伍已安全抵达。现在选择处理方式；城镇仍可备齐所需物资。
                  </p>
                )}
              </>
            )}
            <div className="world-routes">
              {(['assault', 'clever'] as SiteMethod[]).map((method) => {
                const paid =
                  run?.method === method && run.phase !== 'awaitingChoice';
                const quote = paid
                    ? { ...view.routes[method], ...run.paidExtra, reason: '' }
                    : view.routes[method],
                  known = progress.routesCompleted.includes(method);
                return (
                  <article className="world-route" key={method}>
                    <h3>
                      {method === 'assault' ? (
                        <Swords aria-hidden="true" />
                      ) : (
                        <Wrench aria-hidden="true" />
                      )}
                      <InfoHint
                        title={site[method]}
                        body={
                          method === 'assault'
                            ? `迎战${site.enemy}。使用真实个人回合战斗；裸装不是稳妥通路，培养、技能和装备决定结果。`
                            : `用额外物资完成现场处理，确定成功。${site.origin}或携带${helpNames[site.help]}技能的队员可减少部分普通费用；没有匹配也可支付全额完成。`
                        }
                      >
                        {site[method]}
                      </InfoHint>
                    </h3>
                    <p>
                      {method === 'assault' ? (
                        <span className="world-site-enemy-preview">
                          <SiteEnemyPortrait siteId={site.id} size="sm" />
                          <span>
                            迎战 {site.enemy}。读清意图，安排护盾、治疗与反制。
                          </span>
                        </span>
                      ) : (
                        '付出材料解决现场问题，按预计时间安全完成。无需指定职业或潜力。'
                      )}
                    </p>
                    <span className="world-known">
                      {known ? '✓ 已掌握，可安排重复' : '首次需亲自确认'}
                    </span>
                    {paid && <p className="world-hint">本次已经支付</p>}
                    <WorldBill
                      s={s}
                      {...quote}
                      reward={paid}
                      empty={
                        method === 'assault'
                          ? '基础粮已含在路费内'
                          : '无需额外物资'
                      }
                    />
                    {method === 'assault' && prep.element !== 'physical' && (
                      <p className="world-hint">
                        另消耗{' '}
                        {G.POTIONS.find((p) => p.id === prep.element)?.name ||
                          '所选药剂'}{' '}
                        1份
                      </p>
                    )}
                    {method === 'clever' && (
                      <InfoHint
                        title="队伍帮助"
                        body={`只计算出发时已学根技能及实际携带分支；${site.origin}或${helpNames[site.help]}能力择优帮助一次，不叠加、不要求特定职业。`}
                      >
                        <span className="world-hint">
                          {run?.helped || (!run && S.siteHelped(s, siteId))
                            ? '队伍帮助已计入报价'
                            : '可用出身或技能节约部分投入'}
                        </span>
                      </InfoHint>
                    )}
                    <footer>
                      {run?.phase === 'awaitingChoice' ? (
                        <p className="world-hint">
                          {method === 'assault'
                            ? '确认即使用准备及药剂，接敌期间撤回不退款。'
                            : '确认一次付费，完成现场作业后归来。'}
                        </p>
                      ) : !run?.method ? (
                        <PinPlan
                          s={s}
                          act={act}
                          kind="site"
                          id={`${siteId}:${method}`}
                        />
                      ) : (
                        <p className="world-hint">
                          {paid
                            ? '按已确认的安排进行，无需再次支付。'
                            : '本趟未选择这种方式。'}
                        </p>
                      )}
                      {quote.reason && !run?.method && (
                        <p className="world-blocker">{quote.reason}</p>
                      )}
                    </footer>
                  </article>
                );
              })}
            </div>
            {!progress.firstCompleted && (
              <div className="world-reward">
                <RelicSigil id={relic.id} />
                <div>
                  <strong>
                    首次归来 ·{' '}
                    <InfoHint title={relic.name} body={relic.description}>
                      {relic.name}
                    </InfoHint>
                  </strong>
                  <small>
                    未修复遗物 + 本地点设施修复资格 · 两种方式均可获得
                  </small>
                </div>
              </div>
            )}
            {progress.firstCompleted && (
              <div className="world-button-row">
                <button
                  type="button"
                  className="life-text-button"
                  onClick={() =>
                    go({
                      view: relic.kind === 'town' ? 'town' : 'heroes',
                      tab: relic.kind === 'town' ? 'workshop' : undefined,
                      relic: relic.id,
                    })
                  }
                >
                  查看{relic.name} →
                </button>
                <button
                  type="button"
                  className="life-text-button"
                  onClick={() =>
                    go({ view: 'town', tab: 'workshop', site: site.id })
                  }
                >
                  经营这处地点 →
                </button>
              </div>
            )}
          </div>
          <footer
            className={`world-site-actions${run?.phase === 'awaitingChoice' ? ' world-site-choosing' : ''}`}
          >
            <small>
              {run
                ? '撤回放弃尚未结算收获，已实际支付费用不退。'
                : progress.pendingReceipt
                  ? '归队成员可继续活动，先处理本地点上次收获再重访。'
                  : '选中与预览不扣费。地点不会成为主线首领的新门票。'}
            </small>
            <div className="world-button-row">
              {run?.phase === 'awaitingChoice' &&
                (['assault', 'clever'] as SiteMethod[]).map((method) => {
                  const quote = view.routes[method];
                  return (
                    <button
                      key={method}
                      type="button"
                      className={
                        method === 'clever'
                          ? 'primary-button'
                          : 'secondary-button'
                      }
                      disabled={!!quote.reason}
                      onClick={() =>
                        act(
                          (x) => S.chooseSiteRoute(x, method),
                          method === 'assault'
                            ? '已确认强攻，准备物资已支付。'
                            : `已安排${site.clever}。`,
                        )
                      }
                    >
                      {method === 'assault'
                        ? '确认强攻'
                        : `确认巧解 · ${site.clever}`}
                    </button>
                  );
                })}
              {run && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => act(S.recallSite, '已立即撤回支线队伍。')}
                >
                  立即撤回
                </button>
              )}
              {progress.lastResult && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={showResult}
                >
                  {progress.pendingReceipt ? '处理待领取物资' : '查看上次收获'}
                </button>
              )}
            </div>
          </footer>
        </section>
        <aside className="world-site-preparation" aria-label="地点出发准备">
          <div className="world-preparation-content">
            <header className="world-preparation-head">
              <h3>出战准备</h3>
              <button
                type="button"
                className="life-text-button"
                onClick={() => go({ view: 'heroes' })}
              >
                同行 {run?.partyIds.length ?? s.party.length}/4 →
              </button>
            </header>
            <div className="world-prep-row">
              <label htmlFor="site-stance">战术姿态</label>
              <Pick
                id="site-stance"
                label="支线战术姿态"
                value={prep.stance}
                disabled={locked}
                options={[
                  { value: 'balanced', label: '均衡 · 标准攻防' },
                  { value: 'cautious', label: '谨慎 · 伤害与承伤 −10%' },
                  { value: 'assault', label: '强攻 · 伤害与承伤 +12%' },
                ]}
                onChange={(v) => setPrep({ stance: v as typeof prep.stance })}
              />
            </div>
            {potions.length > 0 && (
              <div className="world-prep-row">
                <label htmlFor="site-potion">抗性药剂</label>
                <Pick
                  id="site-potion"
                  label="支线抗性药剂"
                  value={prep.element}
                  disabled={locked}
                  options={[
                    { value: 'physical', label: '不携带药剂' },
                    ...potions.map((p) => ({
                      value: p.id,
                      label: `${p.name} · ${G.potionCount(s, p.id)}份`,
                    })),
                  ]}
                  onChange={(v) => setPrep({ element: v as G.Element })}
                />
              </div>
            )}
            <label className="world-button-row world-remedy-choice">
              <input
                type="checkbox"
                checked={prep.remedy}
                disabled={locked}
                onChange={(e) => setPrep({ remedy: e.target.checked })}
              />
              <InfoHint
                title="额外应急药囊"
                body="沿用主队的应急准备。只有确认强攻才实际消耗准备费用，巧解不会消耗；当趟出发后不能更改准备。费用会计入中央的强攻报价。"
              >
                携带额外应急药囊
              </InfoHint>
            </label>
            <p className="world-hint">确认强攻时消耗，巧解不消耗。</p>
            <PotionWorkshop s={s} act={act} />
          </div>
          <div className="world-start">
            {progress.routesCompleted.length > 0 && (
              <button
                type="button"
                className="world-repeat-trigger life-text-button"
                aria-haspopup="dialog"
                onClick={() => setRepeatOpen(true)}
              >
                <Repeat2 size={13} aria-hidden="true" /> 重复探索设置
                <ChevronRight size={13} aria-hidden="true" />
              </button>
            )}
            {plan && (
              <p className="world-hint">
                <InfoHint
                  title={plan.enabled ? '重复安排中' : '重复已停'}
                  body={
                    plan.reason ||
                    '只按已确认的状况策略与预算执行。可打开重复探索设置查看或调整后续安排。'
                  }
                >
                  {plan.enabled ? '重复安排中' : '重复已停'} · 已完成{' '}
                  {plan.completed} 趟{plan.reason ? ' · 查看原因' : ''}
                </InfoHint>
              </p>
            )}
            {!run && (
              <>
                <button
                  type="button"
                  className="primary-button"
                  disabled={!!view.reason}
                  onClick={() =>
                    act(
                      (x) => S.startSite(x, siteId, rewardKind),
                      `已前往${site.name}。`,
                    )
                  }
                >
                  前往地点 <ArrowRight aria-hidden="true" />
                </button>
                {view.reason && <p className="world-blocker">{view.reason}</p>}
              </>
            )}
            {plan?.enabled && (
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  act(
                    (x) => S.setSiteRepeat(x, siteId, null),
                    '已停止后续重复，当前一趟继续。',
                  )
                }
              >
                停止后续重复
              </button>
            )}
          </div>
        </aside>
      </div>
      <Dialog open={repeatOpen} onOpenChange={setRepeatOpen}>
        <DialogContent className="world-drawer world-repeat-dialog">
          <DialogTitle className="world-drawer-title">重复探索设置</DialogTitle>
          <DialogDescription className="world-drawer-description">
            {site.name} · 只执行亲自完成过的路线。设置在点击应用后生效。
          </DialogDescription>
          {repeatOpen && (
            <SiteRepeatForm key={siteId} s={s} act={act} siteId={siteId} />
          )}
        </DialogContent>
      </Dialog>
      <SiteReceiptDialog
        s={s}
        act={act}
        go={go}
        siteId={siteId}
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
      />
    </>
  );
}

function SiteRepeatForm({
  s,
  act,
  siteId,
}: {
  s: G.State;
  act: Act;
  siteId: string;
}) {
  const progress = s.worldExploration.sites[siteId],
    definition = S.siteDefinition(siteId)!;
  const existing =
    s.worldExploration.repeatPlan?.siteId === siteId
      ? s.worldExploration.repeatPlan
      : null;
  const [options, setOptions] = useState<SiteRepeatOptions>(() =>
    existing
      ? structuredClone({
          strategies: existing.strategies,
          limit: existing.limit,
          reserve: existing.reserve,
          maxExtraCost: existing.maxExtraCost,
          maxExtraMaterials: existing.maxExtraMaterials,
        })
      : {
          strategies: { A: null, B: null },
          limit: 5,
          reserve: {},
          maxExtraCost: {},
          maxExtraMaterials: {},
        },
  );
  const [budget, setBudget] = useState(false);
  const repeatReason = S.siteRepeatReason(s, siteId, options);
  const sameRun = s.worldExploration.activeRun?.siteId === siteId;
  const active =
    !!s.expedition ||
    (!!s.battle && !sameRun) ||
    (!!s.worldExploration.activeRun && !sameRun);
  const strategy = (variant: SiteVariant, method: string) =>
    setOptions((o) => ({
      ...o,
      strategies: {
        ...o.strategies,
        [variant]: method
          ? {
              method: method as SiteMethod,
              rewardKind: o.strategies[variant]?.rewardKind || 'basic',
            }
          : null,
      },
    }));
  const updateCost = (
    kind: 'reserve' | 'maxExtraCost',
    key: G.Resource,
    raw: string,
  ) =>
    setOptions((o) => {
      const next = { ...o[kind] };
      if (raw === '') delete next[key];
      else next[key] = Math.max(0, Number(raw) || 0);
      return { ...o, [kind]: next };
    });
  return (
    <form
      className="world-repeat"
      onSubmit={(e) => {
        e.preventDefault();
        act((x) => S.setSiteRepeat(x, siteId, options), '已应用支线重复安排。');
      }}
    >
      <div className="world-repeat-body">
        <div className="world-repeat-strategies">
          {(['A', 'B'] as SiteVariant[]).map((v) => (
            <div key={v} className="world-prep-row">
              <label>
                {definition.variants[v].name}
                <Pick
                  label={`${definition.variants[v].name}自动方式`}
                  value={options.strategies[v]?.method || ''}
                  options={[
                    { value: '', label: '停止，等待我决定' },
                    ...progress.routesCompleted.map((method) => ({
                      value: method,
                      label: `${methodNames[method]} · ${definition[method]}`,
                    })),
                  ]}
                  onChange={(value) => strategy(v, value)}
                />
              </label>
              {options.strategies[v] && (
                <Pick
                  label={`${definition.variants[v].name}自动收获`}
                  value={options.strategies[v]!.rewardKind}
                  options={[
                    { value: 'basic', label: '回收基础补给' },
                    { value: 'material', label: '回收已发现的当地原料' },
                  ]}
                  onChange={(value) =>
                    setOptions((o) => ({
                      ...o,
                      strategies: {
                        ...o.strategies,
                        [v]: {
                          ...o.strategies[v]!,
                          rewardKind: value as SiteRewardKind,
                        },
                      },
                    }))
                  }
                />
              )}
            </div>
          ))}
        </div>
        <label className="world-repeat-limit">
          成功多少趟后停止
          <input
            aria-label="支线重复成功趟数"
            type="number"
            min={0}
            max={10000}
            value={options.limit}
            onChange={(e) =>
              setOptions((o) => ({
                ...o,
                limit: Math.min(
                  10000,
                  Math.max(0, Math.floor(Number(e.target.value) || 0)),
                ),
              }))
            }
          />
          <small>填 0 表示持续执行，仍受费用、保留量、战败及满仓约束。</small>
        </label>
        <button
          type="button"
          className="life-text-button"
          aria-expanded={budget}
          onClick={() => setBudget(!budget)}
        >
          {budget ? '收起' : '设置'}保留量与费用上限
        </button>
        {budget && (
          <div className="world-budget">
            {(Object.keys(G.RESOURCE_NAMES) as G.Resource[])
              .filter((key) => G.resourceVisible(s, key))
              .map((key) => (
                <div key={key} className="world-config-pair">
                  <label>
                    {G.RESOURCE_NAMES[key]}保留
                    <input
                      type="number"
                      min={0}
                      aria-label={`${G.RESOURCE_NAMES[key]}自动保留量`}
                      value={options.reserve[key] ?? ''}
                      placeholder="不保留"
                      onChange={(e) =>
                        updateCost('reserve', key, e.target.value)
                      }
                    />
                  </label>
                  <label>
                    单趟额外上限
                    <input
                      type="number"
                      min={0}
                      aria-label={`${G.RESOURCE_NAMES[key]}额外费用上限`}
                      value={options.maxExtraCost[key] ?? ''}
                      placeholder="不限"
                      onChange={(e) =>
                        updateCost('maxExtraCost', key, e.target.value)
                      }
                    />
                  </label>
                </div>
              ))}
            {G.MATERIAL_IDS.filter((id) => G.materialDiscovered(s, id)).map(
              (id) => (
                <label key={id}>
                  {G.MATERIAL_NAMES[id]}单趟额外上限
                  <input
                    type="number"
                    min={0}
                    aria-label={`${G.MATERIAL_NAMES[id]}额外费用上限`}
                    value={options.maxExtraMaterials[id] ?? ''}
                    placeholder="不限"
                    onChange={(e) =>
                      setOptions((o) => {
                        const next = { ...o.maxExtraMaterials };
                        if (e.target.value === '') delete next[id];
                        else
                          next[id] = Math.max(0, Number(e.target.value) || 0);
                        return { ...o, maxExtraMaterials: next };
                      })
                    }
                  />
                </label>
              ),
            )}
          </div>
        )}
        <p className="world-hint">
          陌生状况、缺料、战败和待领都会停止；恢复库存后需主动重启，不自动买药或分解装备。
        </p>
      </div>
      <footer className="world-repeat-apply">
        <button
          type="submit"
          className="secondary-button"
          disabled={active || !!repeatReason}
        >
          {sameRun ? '应用到下一趟' : '启用重复安排'}
        </button>
        {(active || repeatReason) && (
          <p className="world-hint">
            {active ? '请先结束当前的其他活动。' : repeatReason}
          </p>
        )}
      </footer>
    </form>
  );
}

export function SiteReceiptDialog({
  s,
  act,
  go,
  siteId,
  open,
  onOpenChange,
  onSelectSite,
}: Props & {
  siteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectSite?: (id: string) => void;
}) {
  const [discard, setDiscard] = useState(false);
  const site = S.siteDefinition(siteId),
    progress = s.worldExploration.sites[siteId],
    receipt = progress?.pendingReceipt || progress?.lastResult;
  const relic = RELICS.find((r) => r.siteId === siteId);
  const relicState = relic && s.worldExploration.relics.owned[relic.id];
  const relicDeployed =
    relic &&
    (relic.kind === 'town'
      ? s.worldExploration.relics.town.some((r) => r.id === relic.id)
      : !!s.worldExploration.relics.combat[relic.id]);
  const relicStatus = relicDeployed
    ? '已部署'
    : relicState?.repaired
      ? '已修复'
      : relicState?.operation
        ? '修复中'
        : '待修复';
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setDiscard(false);
        onOpenChange(value);
      }}
    >
      <DialogContent className="world-drawer world-receipt-drawer">
        {onSelectSite && (
          <nav className="world-filter-row" aria-label="地点收获选择">
            {S.SITES.filter(
              (p) => s.worldExploration.sites[p.id]?.lastResult,
            ).map((p) => (
              <button
                type="button"
                key={p.id}
                aria-pressed={p.id === siteId}
                onClick={() => {
                  setDiscard(false);
                  act((x) => S.readSiteReceipt(x, p.id), '已查看地点收获。');
                  onSelectSite(p.id);
                }}
              >
                {p.name}
                {s.worldExploration.sites[p.id].pendingReceipt ? ' · 待领' : ''}
              </button>
            ))}
          </nav>
        )}
        <DialogTitle className="world-drawer-title">
          {site?.name || '地点'} · 归来记录
        </DialogTitle>
        <DialogDescription className="world-drawer-description">
          {receipt?.won
            ? '旅人已经归队。发现与物资分别记录，查看不重复发奖。'
            : receipt?.retreated
              ? '本次主动撤回，未结算收获；已有进度保留。'
              : '本次未能完成地点，已有进度保留。'}
        </DialogDescription>
        {receipt && (
          <div className="world-relic-scroll world-receipt">
            {receipt.first && relic && (
              <section>
                <h3>首次收获 · 遗物入藏</h3>
                <div className="world-reward">
                  <RelicSigil id={relic.id} />
                  <InfoHint title={relic.name} body={relic.description}>
                    <strong>{relic.name}</strong>
                  </InfoHint>
                </div>
                <p className="world-hint">
                  遗物当前状态：{relicStatus}。本地点设施也已开放独立修复资格。
                </p>
                <div className="world-button-row">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      go({
                        view: relic.kind === 'town' ? 'town' : 'heroes',
                        tab: relic.kind === 'town' ? 'workshop' : undefined,
                        relic: relic.id,
                      });
                    }}
                  >
                    {relicState?.repaired
                      ? '查看遗物'
                      : relicState?.operation
                        ? '查看修复进度'
                        : '修复遗物'}{' '}
                    →
                  </button>
                  <button
                    type="button"
                    className="life-text-button"
                    onClick={() => {
                      onOpenChange(false);
                      go({
                        view: 'town',
                        tab: 'workshop',
                        site: receipt.siteId,
                      });
                    }}
                  >
                    查看地区设施 →
                  </button>
                </div>
              </section>
            )}
            <section>
              <h3>实际入库</h3>
              <WorldBill s={s} {...receipt.kept} reward empty="没有物资入库" />
            </section>
            {progress.pendingReceipt && (
              <section>
                <h3>待领取余量</h3>
                <WorldBill s={s} {...receipt.remaining} reward />
                <p className="world-hint">
                  此处暂不能再访，其他地点与主线照常可用。扩仓或消耗库存后可分批领取。
                </p>
              </section>
            )}
            {(Object.keys(receipt.abandoned.cost).length > 0 ||
              Object.keys(receipt.abandoned.materials).length > 0) && (
              <section>
                <h3>已明确放弃</h3>
                <WorldBill s={s} {...receipt.abandoned} reward />
              </section>
            )}
            <p className="world-hint">
              处理：
              {receipt.method === 'assault' ? site?.assault : site?.clever} ·
              状况：{site?.variants[receipt.variant].name}
            </p>
          </div>
        )}
        <footer className="world-site-actions">
          <p className="world-hint">关闭记录不放弃物资，也不会改变当前地图。</p>
          <div className="world-button-row">
            {progress?.pendingReceipt && (
              <>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() =>
                    act((x) => S.claimSite(x, siteId), '已按当前仓位领取物资。')
                  }
                >
                  按仓位领取
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    if (discard) {
                      act(
                        (x) => S.discardSite(x, siteId),
                        '已放弃所列剩余普通物资，遗物与地点进度保留。',
                      );
                      setDiscard(false);
                    } else setDiscard(true);
                  }}
                >
                  {discard ? '确认放弃以上剩余物资' : '放弃剩余物资…'}
                </button>
              </>
            )}
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

export function SiteActivity({ s, act, go }: Props) {
  const [receiptId, setReceiptId] = useState<string | null>(null),
    [dismissed, setDismissed] = useState('');
  const w = s.worldExploration,
    run = w.activeRun,
    plan = w.repeatPlan;
  const results = Object.entries(w.sites)
    .filter(([, p]) => p.pendingReceipt || (p.lastResult && !p.lastResult.read))
    .sort(
      (a, b) => (b[1].lastResult?.time || 0) - (a[1].lastResult?.time || 0),
    );
  const signature = `${plan?.siteId}:${plan?.completed}:${plan?.reason}`;
  const showActivity = !!(
    run ||
    results.length ||
    (plan && (plan.enabled || signature !== dismissed))
  );
  // Reading the last result can hide the bar, but must not hide an open dialog
  // while preserving its selection to accidentally reopen with the next trip.
  if (!showActivity && !receiptId) return null;
  const site = S.siteDefinition(run?.siteId || plan?.siteId || results[0]?.[0]);
  return (
    <>
      {showActivity && (
        <div className="world-activity" aria-label="支线活动与收获">
          {site && (
            <button
              type="button"
              onClick={() =>
                go({ view: 'explore', region: site.region, site: site.id })
              }
            >
              <Compass aria-hidden="true" />
              <strong>{site.name}</strong>
              <ChevronRight aria-hidden="true" />
            </button>
          )}
          <span className="world-activity-phase">
            {run
              ? `${run.phase === 'resolving' && run.method === 'assault' ? '接敌准备' : phases[run.phase]}${run.phase === 'awaitingChoice' || run.phase === 'battle' ? '' : ` · ${duration(run.remaining)}`}${s.paused ? ' · 暂停' : ''}`
              : plan
                ? `${plan.enabled ? '等待下一趟' : '重复已停'} · ${plan.reason || `已完成${plan.completed}趟`}`
                : '有新的地点收获'}
          </span>
          {results.length > 0 && (
            <button
              type="button"
              className="world-receipt-count"
              onClick={() => {
                const id = results[0][0];
                act((x) => S.readSiteReceipt(x, id), '已查看地点收获。');
                setReceiptId(id);
              }}
            >
              <PackageOpen aria-hidden="true" />
              收获 {results.length}
            </button>
          )}
          {plan?.enabled && (
            <button
              type="button"
              onClick={() =>
                act(
                  (x) => S.setSiteRepeat(x, plan.siteId, null),
                  '已停止后续重复。',
                )
              }
            >
              停止重复
            </button>
          )}
          {run && (
            <button
              type="button"
              onClick={() => act(S.recallSite, '已立即撤回支线队伍。')}
            >
              立即撤回
            </button>
          )}
          {!run && !plan?.enabled && !results.length && (
            <button
              type="button"
              aria-label="收起支线状态"
              onClick={() => setDismissed(signature)}
            >
              ×
            </button>
          )}
        </div>
      )}
      {receiptId && (
        <SiteReceiptDialog
          s={s}
          act={act}
          go={go}
          siteId={receiptId}
          onSelectSite={setReceiptId}
          open
          onOpenChange={(value) => {
            if (!value) setReceiptId(null);
          }}
        />
      )}
    </>
  );
}
