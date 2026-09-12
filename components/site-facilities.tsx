'use client';
import { useState } from 'react';
import * as G from '@/lib/realm';
import { SITES } from '@/lib/sites-data';
import * as E from '@/lib/site-economy';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { InfoHint } from './info-hint';
import { type Act, type Destination } from './realm-panels';
import { RelicSigil, WorldBill, WorldTime } from './world-ui';
import { PinPlan } from './planning-board';

export function SiteFacilities({
  s,
  act,
  go,
  initialSite,
}: {
  s: G.State;
  act: Act;
  go?: (d: Destination) => void;
  initialSite?: string;
}) {
  const [selected, setSelected] = useState<string | null>(initialSite || null),
    [confirm, setConfirm] = useState<E.FacilityModeId | null>(null),
    [region, setRegion] = useState<number | 'all'>(
      () => SITES.find((site) => site.id === initialSite)?.region ?? 'all',
    );
  const sites = SITES.filter(
    (site) => s.worldExploration.sites[site.id]?.firstCompleted,
  );
  if (!sites.length) return null;
  const site = sites.find((x) => x.id === selected),
    facility = site ? s.worldExploration.facilities[site.id] : null,
    regions = [
      ...new Set(
        SITES.filter(
          (item) => s.worldExploration.sites[item.id]?.discovered,
        ).map((item) => item.region),
      ),
    ].sort((a, b) => a - b),
    visibleSites = sites.filter(
      (item) => region === 'all' || item.region === region,
    );
  return (
    <section className="world-facilities" aria-label="地区设施">
      <div className="flow-section-title">
        <strong>发现地供给</strong>
        <small>
          {E.facilityLines(s)} 条 · {E.facilityWorkers(s)} 位住民
        </small>
      </div>
      <p className="world-hint">
        与商路共用居民和供给线路，修复后自行选定用途。
      </p>
      <nav className="world-facility-filters" aria-label="按地区筛选设施">
        <button
          type="button"
          aria-pressed={region === 'all'}
          onClick={() => setRegion('all')}
        >
          全部
        </button>
        {regions.map((r) => (
          <button
            type="button"
            key={r}
            aria-pressed={region === r}
            onClick={() => setRegion(r)}
          >
            {G.REGIONS[r].name}
          </button>
        ))}
      </nav>
      <div className="world-facility-list">
        {!visibleSites.length && (
          <p className="world-hint">
            此地区的地点尚未完成，完成后可在这里安排修复。
          </p>
        )}
        {visibleSites.map((site) => {
          const f = s.worldExploration.facilities[site.id],
            definition = E.FACILITY_MODES.find(
              (m) => m.siteId === site.id && m.mode === f.mode,
            ),
            quote = E.facilityRepairQuote(s, site.id);
          const reason =
            f.enabled && f.mode
              ? E.facilityModeQuote(s, site.id, f.mode).reason
              : E.facilityEnableReason(s, site.id);
          return (
            <article
              key={site.id}
              className={`world-facility-row${selected === site.id ? ' selected' : ''}`}
            >
              <button
                type="button"
                className="world-facility-name"
                onClick={() => {
                  setSelected(site.id);
                  setConfirm(null);
                }}
              >
                <InfoHint
                  withinControl
                  title={site.name}
                  body={`${G.REGIONS[site.region].name}的后方设施。${E.FACILITY_MODES.filter(
                    (m) => m.siteId === site.id,
                  )
                    .map((m) => m.name)
                    .join(' / ')}；一次运行一种用途，消耗实际物资与一位居民。`}
                >
                  {site.name}
                </InfoHint>
                <small>
                  {definition?.name ||
                    (f.repaired ? '尚未选择用途' : '等待修复')}
                </small>
              </button>
              {f.operation ? (
                <small>
                  {f.operation.kind === 'change' ? '改设' : '修复'}{' '}
                  {Math.ceil(f.operation.remainingSeconds)}秒
                </small>
              ) : !f.repaired ? (
                <button
                  type="button"
                  className="secondary-button"
                  title={quote.reason || '查看两种用途及修复账单'}
                  onClick={() => {
                    setSelected(site.id);
                    setConfirm(null);
                  }}
                >
                  修复详情
                </button>
              ) : (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={!f.enabled && !!reason}
                  title={reason}
                  onClick={() =>
                    act(
                      (x) => E.toggleFacility(x, site.id),
                      `${site.name}${f.enabled ? '已停工，居民和线路已释放。' : '已开工。'}`,
                    )
                  }
                >
                  {f.enabled ? '停工' : '开工'}
                </button>
              )}
              <small>
                {f.operation
                  ? '工程已付费，完成后保持关闭'
                  : !f.repaired
                    ? quote.reason || '材料已齐，可安排修复'
                    : f.enabled
                      ? reason ||
                        `运行中 · ${Math.floor(f.progress)}/${f.batchQuote?.seconds || definition?.seconds || 1}秒 · 已交付${f.completed}批`
                      : reason || '已关闭，未占用居民和线路'}
              </small>
            </article>
          );
        })}
      </div>
      <Dialog
        open={!!site}
        onOpenChange={(value) => {
          if (!value) setSelected(null);
        }}
      >
        <DialogContent className="world-drawer world-facility-drawer">
          {site && facility && (
            <>
              <DialogTitle className="world-drawer-title">
                {site.name}
              </DialogTitle>
              <DialogDescription className="world-drawer-description">
                {G.REGIONS[site.region].name} ·
                后方经营。两种用途共用同一座设施，一次运行一种。
              </DialogDescription>
              <div className="world-relic-scroll">
                {facility.operation && (
                  <WorldTime
                    label={
                      facility.operation.kind === 'change'
                        ? '用途改设'
                        : '设施修复'
                    }
                    seconds={facility.operation.remainingSeconds}
                    total={facility.operation.totalSeconds}
                  />
                )}
                <div className="world-facility-comparison">
                  {E.FACILITY_MODES.filter((m) => m.siteId === site.id).map(
                    (mode) => {
                      const quote = E.facilityModeQuote(s, site.id, mode.mode),
                        change = E.facilityChangeQuote(s, site.id, mode.mode),
                        chosen = facility.mode === mode.mode;
                      return (
                        <article className="world-facility-mode" key={mode.id}>
                          <RelicSigil id={site.relicId} />
                          <h3>
                            <InfoHint
                              title={mode.name}
                              body={`每批${quote.seconds}秒，完整消耗输入后产出；缺料、到保留线或仓满暂停，恢复后继续。`}
                            >
                              {mode.name}
                            </InfoHint>
                            {chosen && <small> · 当前</small>}
                          </h3>
                          <p className="world-hint">每批投入</p>
                          <WorldBill
                            s={s}
                            cost={quote.cost}
                            materials={quote.materials}
                          />
                          <div className="world-output">
                            <p className="world-hint">
                              每 {quote.seconds} 秒产出
                            </p>
                            <WorldBill
                              s={s}
                              cost={quote.outputCost}
                              materials={quote.outputMaterials}
                              potions={quote.outputPotions}
                              reward
                            />
                          </div>
                          {mode.tech.length > 0 && (
                            <p className="world-hint">
                              工艺：
                              {mode.tech
                                .map(
                                  (id) =>
                                    G.TECHNOLOGIES.find((t) => t.id === id)
                                      ?.name || '尚未掌握的工艺',
                                )
                                .join('、')}
                            </p>
                          )}
                          {quote.reason && (
                            <p className="world-blocker">{quote.reason}</p>
                          )}
                          <footer>
                            {facility.repaired && !chosen && (
                              <>
                                {facility.mode && (
                                  <>
                                    <p className="world-hint">
                                      改设 {change.seconds}{' '}
                                      秒，清除未完成批次，完工保持关闭。
                                    </p>
                                    <WorldBill
                                      s={s}
                                      cost={change.cost}
                                      materials={change.materials}
                                    />
                                  </>
                                )}
                              </>
                            )}
                            {chosen && (
                              <p className="world-hint">
                                当前用途 ·{' '}
                                {facility.enabled
                                  ? '占用1人、1条供给线路'
                                  : '关闭时不占用人员与线路'}
                              </p>
                            )}
                          </footer>
                        </article>
                      );
                    },
                  )}
                </div>
              </div>
              <footer className="world-site-actions town-facility-actions">
                {facility.repaired && (
                  <div className="town-facility-choices">
                    {E.FACILITY_MODES.filter((m) => m.siteId === site.id).map(
                      (mode) => {
                        const change = E.facilityChangeQuote(
                            s,
                            site.id,
                            mode.mode,
                          ),
                          chosen = facility.mode === mode.mode;
                        return !chosen ? (
                          <button
                            key={mode.id}
                            type="button"
                            className="secondary-button"
                            disabled={!!change.reason}
                            title={change.reason}
                            onClick={() => {
                              if (facility.mode && confirm !== mode.mode)
                                setConfirm(mode.mode);
                              else {
                                act(
                                  (x) =>
                                    E.setFacilityMode(x, site.id, mode.mode),
                                  `已安排${site.name}采用${mode.name}。`,
                                );
                                setConfirm(null);
                              }
                            }}
                          >
                            {confirm === mode.mode
                              ? `确认改设${mode.name}并清除未完进度`
                              : facility.mode
                                ? `改设为${mode.name}`
                                : `选定${mode.name}`}
                          </button>
                        ) : (
                          <span className="world-hint" key={mode.id}>
                            当前用途 · {mode.name}
                          </span>
                        );
                      },
                    )}
                  </div>
                )}
                <div className="town-facility-operation">
                  {!facility.repaired && !facility.operation ? (
                    <div>
                      <WorldBill s={s} {...E.facilityRepairQuote(s, site.id)} />
                      <PinPlan s={s} act={act} kind="facility" id={site.id} />
                      <p className="world-hint">
                        一次付款，后方修复，不占主队。工程不退款取消。
                      </p>
                    </div>
                  ) : (
                    <p className="world-hint">
                      缺料和满仓暂停时保留已分配岗位；主动停工才释放。
                    </p>
                  )}
                  <div className="world-button-row">
                    {!facility.repaired && !facility.operation && (
                      <button
                        type="button"
                        className="primary-button"
                        disabled={!!E.facilityRepairQuote(s, site.id).reason}
                        onClick={() =>
                          act(
                            (x) => E.repairFacility(x, site.id),
                            `已开始修复${site.name}。`,
                          )
                        }
                      >
                        开始修复 · {E.facilityRepairQuote(s, site.id).seconds}秒
                      </button>
                    )}
                    {facility.repaired && !facility.operation && (
                      <button
                        type="button"
                        className="primary-button"
                        disabled={
                          !facility.enabled &&
                          !!E.facilityEnableReason(s, site.id)
                        }
                        onClick={() => act((x) => E.toggleFacility(x, site.id))}
                      >
                        {facility.enabled
                          ? '停工并释放岗位'
                          : '分配1位居民开工'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setSelected(null);
                        go?.({
                          view: 'explore',
                          region: site.region,
                          site: site.id,
                        });
                      }}
                    >
                      查看地点
                    </button>
                  </div>
                </div>
              </footer>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
