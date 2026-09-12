'use client';
import { useState } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import * as G from '@/lib/realm';
import { RELICS } from '@/lib/relic-data';
import * as R from '@/lib/relics';
import { SITES } from '@/lib/sites-data';
import { FACILITY_MODES } from '@/lib/site-economy';
import type { TownRelicConfig } from '@/lib/site-economy-types';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { InfoHint } from './info-hint';
import { Pick, type Act, type Destination } from './realm-panels';
import { RelicSigil, WorldBill, WorldTime } from './world-ui';
import { PinPlan } from './planning-board';

type Props = {
  s: G.State;
  act: Act;
  kind: 'town' | 'combat';
  go?: (d: Destination) => void;
  initialId?: string;
};
type Relic = (typeof RELICS)[number];

export function RelicCollectionButton({ s, act, kind, go, initialId }: Props) {
  const [open, setOpen] = useState(!!initialId),
    [filter, setFilter] = useState<'town' | 'combat' | 'all'>(kind),
    [selected, setSelected] = useState(initialId || '');
  const owned = RELICS.filter((r) => s.worldExploration.relics.owned[r.id]);
  if (!owned.some((r) => r.kind === kind)) return null;
  const visible = owned.filter((r) => filter === 'all' || r.kind === filter);
  const relic = visible.find((r) => r.id === selected) || visible[0];
  const deployed =
    kind === 'town'
      ? s.worldExploration.relics.town.length
      : Object.keys(s.worldExploration.relics.combat).length;
  const slots = kind === 'town' ? R.townRelicSlots(s) : R.combatRelicSlots(s);
  return (
    <>
      <button
        type="button"
        className="world-relic-button"
        onClick={() => setOpen(true)}
      >
        <Sparkles aria-hidden="true" />
        {kind === 'town' ? '经营遗物' : '出征遗物'}{' '}
        <span>
          {deployed}/{slots}
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="world-drawer" aria-label="遗物收藏">
          <DialogTitle className="world-drawer-title">遗物收藏</DialogTitle>
          <DialogDescription className="world-drawer-description">
            探索带回的独特办法。修复后自行部署，收藏不会自动生效。
          </DialogDescription>
          <nav className="world-filter-row" aria-label="遗物用途筛选">
            {(['town', 'combat', 'all'] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={filter === k}
                onClick={() => setFilter(k)}
              >
                {k === 'town' ? '经营' : k === 'combat' ? '出征' : '全部收藏'}
              </button>
            ))}
          </nav>
          <div className="world-collection">
            <div className="world-collection-list" aria-label="已收藏遗物">
              {visible.map((r) => {
                const state = s.worldExploration.relics.owned[r.id];
                const active =
                  r.kind === 'town'
                    ? s.worldExploration.relics.town.some((x) => x.id === r.id)
                    : !!s.worldExploration.relics.combat[r.id];
                return (
                  <button
                    type="button"
                    key={r.id}
                    className="world-collection-item"
                    aria-pressed={r.id === relic?.id}
                    onClick={() => setSelected(r.id)}
                  >
                    <RelicSigil id={r.id} />
                    <span>
                      <strong>
                        <InfoHint
                          withinControl
                          title={r.name}
                          body={r.description}
                        >
                          {r.name}
                        </InfoHint>
                      </strong>
                      <small>
                        {state.operation
                          ? '修复中'
                          : !state.repaired
                            ? '待修复'
                            : active
                              ? '已部署'
                              : '可部署'}
                      </small>
                    </span>
                  </button>
                );
              })}
              {!visible.length && (
                <p className="world-hint">尚未收藏这一类遗物。</p>
              )}
            </div>
            {relic && (
              <RelicDetail
                key={relic.id}
                s={s}
                act={act}
                relic={relic}
                go={(d) => {
                  setOpen(false);
                  go?.(d);
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RelicDetail({
  s,
  act,
  relic,
  go,
}: {
  s: G.State;
  act: Act;
  relic: Relic;
  go: (d: Destination) => void;
}) {
  const current = s.worldExploration.relics.town.find((x) => x.id === relic.id);
  const works = G.WORK_RECIPES.filter((w) => s.world.tech.includes(w.tech));
  const routes = G.REGIONS.map((r, id) => ({
    value: String(id),
    label: r.name,
  })).filter((_, id) => s.economy.routes[id].level > 0);
  const facilities = SITES.filter(
    (p) => s.worldExploration.facilities[p.id]?.repaired,
  );
  const [config, setConfig] = useState<Omit<TownRelicConfig, 'id'>>(() =>
    current
      ? { ...current }
      : {
          mode: 'hand',
          target:
            relic.id === 'R07' || relic.id === 'R09'
              ? facilities[0]?.id || ''
              : works[0]?.id || 'boards',
          source: works[1]?.id || works[0]?.id || 'boards',
          routes: [
            Number(routes[0]?.value ?? 0),
            Number(routes[1]?.value ?? 0),
          ],
          counts: [1, 1],
          recipes: ['original', 'original'],
          skipBlocked: false,
        },
  );
  const [hero, setHero] = useState(
    s.worldExploration.relics.combat[relic.id] ||
      s.heroes.find((h) => !G.heroAway(s, h.id))?.id ||
      '',
  );
  const [confirmClear, setConfirmClear] = useState(false),
    [confirmApply, setConfirmApply] = useState(false);
  const state = s.worldExploration.relics.owned[relic.id],
    quote = R.relicRepairQuote(s, relic.id);
  const site = SITES.find((x) => x.id === relic.siteId)!;
  const activeHero = s.heroes.find(
    (h) => h.id === s.worldExploration.relics.combat[relic.id],
  );
  const deployed = relic.kind === 'town' ? !!current : !!activeHero;
  const slots =
    relic.kind === 'town' ? R.townRelicSlots(s) : R.combatRelicSlots(s);
  const count =
    relic.kind === 'town'
      ? s.worldExploration.relics.town.length
      : Object.keys(s.worldExploration.relics.combat).length;
  const appliedConfig = (): Omit<TownRelicConfig, 'id'> => {
    switch (relic.id) {
      case 'R01':
        return {
          mode: config.mode || 'hand',
          target: config.target,
          ...(config.mode === 'lend' ? { source: config.source } : {}),
        };
      case 'R03':
        return { target: config.target };
      case 'R05':
        return { routes: config.routes, counts: config.counts };
      case 'R07':
        return { source: config.source, target: config.target };
      case 'R09':
        return { target: config.target };
      case 'R11':
        return {
          target: config.target,
          recipes: config.recipes,
          counts: config.counts,
          skipBlocked: config.skipBlocked,
        };
      default:
        return {};
    }
  };
  const reason = state.repaired
    ? relic.kind === 'town'
      ? R.townRelicReason(s, relic.id, appliedConfig())
      : R.combatRelicReason(s, relic.id, hero || null)
    : quote.reason;
  const removeReason = deployed
    ? relic.kind === 'town'
      ? R.townRelicReason(s, relic.id, null)
      : R.combatRelicReason(s, relic.id, null)
    : '';
  const patch = (v: Partial<Omit<TownRelicConfig, 'id'>>) => {
    setConfirmApply(false);
    setConfig((c) => ({ ...c, ...v }));
  };
  const workOptions = works.map((w) => ({ value: w.id, label: w.name }));
  const facilityOptions = facilities.map((f) => ({
    value: f.id,
    label: `${f.name} · ${FACILITY_MODES.find((m) => m.siteId === f.id && m.mode === s.worldExploration.facilities[f.id].mode)?.name || '未设用途'}`,
  }));
  const variants = G.WORK_IDS.includes(config.target as G.WorkId)
    ? G.processingVariants(s, config.target as G.WorkId).map((v) => ({
        value: v.variant,
        label: v.name,
      }))
    : [];
  return (
    <section className="world-relic-detail" aria-label={`${relic.name}详情`}>
      <div className="world-relic-scroll">
        <header className="world-relic-identity">
          <RelicSigil id={relic.id} large />
          <div>
            <small>
              {relic.kind === 'town' ? '经营遗物' : '出征遗物'} ·{' '}
              {G.REGIONS[site.region].name}
            </small>
            <h3>
              <InfoHint title={relic.name} body={relic.description}>
                {relic.name}
              </InfoHint>
            </h3>
            <small>
              {state.repaired
                ? '已修复'
                : state.operation
                  ? '修复中'
                  : '待修复'}{' '}
              · {deployed ? '已部署' : '未部署'}
            </small>
          </div>
        </header>
        <p className="world-relic-copy">{relic.description}</p>
        <button
          type="button"
          className="life-text-button"
          onClick={() =>
            go({ view: 'explore', region: site.region, site: site.id })
          }
        >
          来自 {site.name} <ArrowRight aria-hidden="true" />
        </button>
        {state.operation ? (
          <WorldTime
            label="修复工程"
            seconds={state.operation.remainingSeconds}
            total={state.operation.totalSeconds}
          />
        ) : !state.repaired ? (
          <>
            <WorldBill s={s} {...quote} />
            <PinPlan s={s} act={act} kind="relic" id={relic.id} />
            <p className="world-hint">
              开始后一次付款，修复期间可以继续经营；完工后自行部署。修复不可退款取消。
            </p>
          </>
        ) : (
          <>
            <p className="world-hint">
              {relic.kind === 'town' ? '经营' : '出征'}已用 {count}/{slots} 槽
              {slots < 2
                ? ` · 击败任意${relic.kind === 'town' ? '两' : '三'}位地区首领开放第二槽`
                : ''}
              。
              {relic.kind === 'combat'
                ? '每人至多携带一件；下一次出发才采用新安排。'
                : '仅部署的遗物参与生产，原料、工人和物流仍须真实投入。'}
            </p>
            {activeHero && (
              <p className="world-hint">
                当前携带者：
                <strong className={'potential-' + activeHero.quality}>
                  {activeHero.name}
                </strong>
              </p>
            )}
            <div className="world-relic-config">
              {relic.kind === 'combat' ? (
                <>
                  <span className="world-hint">选择携带者</span>
                  <div className="world-filter-row">
                    {s.heroes.map((h) => (
                      <button
                        type="button"
                        key={h.id}
                        aria-pressed={hero === h.id}
                        disabled={G.heroAway(s, h.id)}
                        onClick={() => setHero(h.id)}
                      >
                        <span className={'potential-' + h.quality}>
                          {h.name}
                        </span>
                        {G.heroAway(s, h.id) ? ' · 在外' : ''}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  {relic.id === 'R01' && (
                    <label htmlFor="relic-mode">
                      支援方式
                      <Pick
                        id="relic-mode"
                        label="机关台支援方式"
                        value={config.mode || 'hand'}
                        options={[
                          { value: 'hand', label: '单线手摇' },
                          { value: 'lend', label: '暂借另一产线工时' },
                        ]}
                        onChange={(v) => patch({ mode: v as 'hand' | 'lend' })}
                      />
                    </label>
                  )}
                  {['R01', 'R03', 'R11'].includes(relic.id) && (
                    <label htmlFor="relic-target-work">
                      目标加工线
                      <Pick
                        id="relic-target-work"
                        label="遗物目标加工线"
                        value={config.target || ''}
                        options={workOptions}
                        onChange={(v) =>
                          patch({
                            target: v,
                            ...(relic.id === 'R11'
                              ? {
                                  recipes: [
                                    G.processingVariants(s, v as G.WorkId)[0]
                                      ?.variant || 'original',
                                    G.processingVariants(s, v as G.WorkId)[1]
                                      ?.variant || 'original',
                                  ] as [string, string],
                                }
                              : {}),
                          })
                        }
                      />
                    </label>
                  )}
                  {(relic.id === 'R07' ||
                    (relic.id === 'R01' && config.mode === 'lend')) && (
                    <label htmlFor="relic-source-work">
                      {relic.id === 'R07'
                        ? '等待到货的上游产线'
                        : '暂停并借出工时的产线'}
                      <Pick
                        id="relic-source-work"
                        label="遗物来源加工线"
                        value={config.source || ''}
                        options={workOptions}
                        onChange={(v) => patch({ source: v as G.WorkId })}
                      />
                    </label>
                  )}
                  {['R07', 'R09'].includes(relic.id) && (
                    <label htmlFor="relic-target-facility">
                      目标地区设施
                      <Pick
                        id="relic-target-facility"
                        label="遗物目标地区设施"
                        value={config.target || ''}
                        options={facilityOptions}
                        onChange={(v) => patch({ target: v })}
                      />
                    </label>
                  )}
                  {relic.id === 'R05' && (
                    <div className="world-config-pair">
                      {([0, 1] as const).map((i) => (
                        <label key={i}>
                          第{i + 1}条商路
                          <Pick
                            label={`轮转商路${i + 1}`}
                            value={String(config.routes?.[i] ?? '')}
                            options={routes}
                            onChange={(v) => {
                              const next: [number, number] = [
                                ...(config.routes || [0, 0]),
                              ];
                              next[i] = Number(v);
                              patch({ routes: next });
                            }}
                          />
                        </label>
                      ))}
                    </div>
                  )}
                  {relic.id === 'R11' && (
                    <div className="world-config-pair">
                      {([0, 1] as const).map((i) => (
                        <label key={i}>
                          第{i + 1}种配方
                          <Pick
                            label={`轮转配方${i + 1}`}
                            value={config.recipes?.[i] || ''}
                            options={variants}
                            onChange={(v) => {
                              const next: [string, string] = [
                                ...(config.recipes || ['', '']),
                              ];
                              next[i] = v;
                              patch({ recipes: next });
                            }}
                          />
                        </label>
                      ))}
                    </div>
                  )}
                  {['R05', 'R11'].includes(relic.id) && (
                    <div className="world-config-pair">
                      {([0, 1] as const).map((i) => (
                        <label key={i}>
                          第{i + 1}项轮转长度
                          <Pick
                            label={`第${i + 1}项轮转长度`}
                            value={String(config.counts?.[i] || 1)}
                            options={[1, 2, 3, 4, 5].map((n) => ({
                              value: String(n),
                              label: `${n}${relic.id === 'R05' ? '有效供给秒' : '整批'}`,
                            }))}
                            onChange={(v) => {
                              const next: [number, number] = [
                                ...(config.counts || [1, 1]),
                              ];
                              next[i] = Number(v);
                              patch({ counts: next });
                            }}
                          />
                        </label>
                      ))}
                    </div>
                  )}
                  {relic.id === 'R11' && (
                    <label htmlFor="relic-blocked">
                      遇到原料不足
                      <Pick
                        id="relic-blocked"
                        label="轮转缺料策略"
                        value={String(!!config.skipBlocked)}
                        options={[
                          { value: 'false', label: '暂停等待' },
                          { value: 'true', label: '跳过这项，尝试下一配方' },
                        ]}
                        onChange={(v) => patch({ skipBlocked: v === 'true' })}
                      />
                    </label>
                  )}
                  {relic.id === 'R09' && (
                    <p className="world-blocker">
                      改变配给或撤下会清除目标设施未完成批次，已入库成品保留。
                    </p>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
      <footer>
        {state.operation ? (
          <p className="world-hint">工程完成后可部署，当前无需再次支付。</p>
        ) : (
          <>
            {reason && <p className="world-blocker">{reason}</p>}
            <div className="world-button-row">
              <button
                type="button"
                className="primary-button"
                disabled={
                  !!reason ||
                  (state.repaired && relic.kind === 'combat' && !hero)
                }
                onClick={() => {
                  if (
                    state.repaired &&
                    relic.id === 'R09' &&
                    !confirmApply &&
                    ((s.worldExploration.facilities[current?.target || '']
                      ?.progress || 0) > 0 ||
                      (s.worldExploration.facilities[config.target || '']
                        ?.progress || 0) > 0)
                  ) {
                    setConfirmApply(true);
                    return;
                  }
                  if (!state.repaired)
                    act(
                      (x) => R.repairRelic(x, relic.id),
                      `已安排修复${relic.name}。`,
                    );
                  else if (relic.kind === 'town')
                    act(
                      (x) => R.configureTownRelic(x, relic.id, appliedConfig()),
                      `已安排${relic.name}。`,
                    );
                  else
                    act(
                      (x) => R.assignCombatRelic(x, relic.id, hero),
                      `已调整${relic.name}的携带者。`,
                    );
                  setConfirmApply(false);
                }}
              >
                {confirmApply
                  ? '确认应用并清除目标未完进度'
                  : !state.repaired
                    ? `开始修复 · ${quote.seconds}秒`
                    : deployed
                      ? '应用新安排'
                      : '部署遗物'}
              </button>
              {deployed && (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={!!removeReason}
                  title={removeReason}
                  onClick={() => {
                    if (relic.id === 'R09' && !confirmClear)
                      setConfirmClear(true);
                    else {
                      act(
                        (x) =>
                          relic.kind === 'town'
                            ? R.configureTownRelic(x, relic.id, null)
                            : R.assignCombatRelic(x, relic.id, null),
                        `已撤下${relic.name}。`,
                      );
                      setConfirmClear(false);
                    }
                  }}
                >
                  {confirmClear ? '确认撤下并清除未完进度' : '撤下'}
                </button>
              )}
            </div>
          </>
        )}
      </footer>
    </section>
  );
}

export function RelicDeploymentStrip({
  s,
  act,
  kind,
}: Pick<Props, 's' | 'act' | 'kind'>) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const selected = RELICS.filter(
    (r) =>
      r.kind === kind &&
      (kind === 'town'
        ? s.worldExploration.relics.town.some((c) => c.id === r.id)
        : !!s.worldExploration.relics.combat[r.id]),
  );
  if (!selected.length) return null;
  return (
    <div
      className="world-deployment-strip"
      aria-label={kind === 'town' ? '已部署经营遗物' : '已携带出征遗物'}
    >
      {selected.map((r) => {
        const hero = s.heroes.find(
          (h) => h.id === s.worldExploration.relics.combat[r.id],
        );
        const reason =
          kind === 'town'
            ? R.townRelicReason(s, r.id, null)
            : R.combatRelicReason(s, r.id, null);
        return (
          <div key={r.id}>
            <InfoHint title={r.name} body={r.description}>
              {r.name}
            </InfoHint>
            {hero && (
              <span className={'potential-' + hero.quality}>{hero.name}</span>
            )}
            <button
              type="button"
              disabled={!!reason}
              title={
                reason ||
                (r.id === 'R09'
                  ? '撤下将清除目标设施未完成批次'
                  : '撤下后停止此遗物效果')
              }
              aria-label={`撤下${r.name}`}
              onClick={() => {
                if (r.id === 'R09' && confirm !== r.id) setConfirm(r.id);
                else {
                  act(
                    (x) =>
                      kind === 'town'
                        ? R.configureTownRelic(x, r.id, null)
                        : R.assignCombatRelic(x, r.id, null),
                    `已撤下${r.name}。`,
                  );
                  setConfirm(null);
                }
              }}
            >
              {confirm === r.id ? '确认撤下并清未完进度' : '撤下'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
