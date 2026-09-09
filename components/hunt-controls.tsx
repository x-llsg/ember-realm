'use client';
import { useEffect, useState } from 'react';
import { Repeat2, Square, ChevronRight } from 'lucide-react';
import * as G from '@/lib/realm';
import { InfoHint } from './info-hint';
import { duration, type Act, type Destination } from './realm-panels';
import '@/app/hunt.css';
import '@/app/expedition-art.css';

const HUNT_HELP =
  '连续挑战选定的已击败怪物，自动等待重整并按正常规则战斗、支付补给和结算掉落。不会推进新据点，也不会重复首通奖励。每场采用开战时的队伍与准备，所选药剂逐场消耗。\n切换页面、离线仍会继续，暂停游戏则暂停。缺物资、缺药、装备满仓、战败或手动接管时停止。停止连刷只取消后续挑战，本场可继续或撤退。';

export function HuntControl({
  s,
  act,
  region,
  kind,
  node = 0,
}: {
  s: G.State;
  act: Act;
  region: number;
  kind: 'guardian' | 'boss';
  node?: number;
}) {
  const known =
    kind === 'boss'
      ? s.cleared.includes(region)
      : G.guardianRematch(s, region, node);
  if (!known) return null;
  const current =
    s.hunt?.enabled &&
    s.hunt.region === region &&
    s.hunt.kind === kind &&
    (kind === 'boss' || s.hunt.node === node);
  const reason = current ? '' : G.huntReason(s, region, kind, node);
  return (
    <div className="hunt-control">
      <button
        type="button"
        className={current ? 'secondary-button' : 'primary-button'}
        aria-pressed={!!current}
        disabled={!!reason}
        onClick={() =>
          act((state) =>
            current
              ? G.stopHunt(state)
              : G.startHunt(state, region, kind, node),
          )
        }
      >
        {current ? (
          <Square aria-hidden="true" />
        ) : (
          <Repeat2 aria-hidden="true" />
        )}
        {current ? '停止连刷' : kind === 'boss' ? '自动刷首领' : '自动刷此守敌'}
      </button>
      <InfoHint title="连续刷怪" body={HUNT_HELP}>
        连刷规则
      </InfoHint>
      {reason && <small className="hunt-blocker">{reason}</small>}
    </div>
  );
}

/** One compact, persistent control while the player works on another system. */
export function HuntActivity({
  s,
  act,
  go,
}: {
  s: G.State;
  act: Act;
  go: (destination: Destination) => void;
}) {
  const [dismissed, setDismissed] = useState('');
  const hunt = s.hunt;
  const status = G.huntStatus(s);
  useEffect(() => {
    if (status.enabled) setDismissed('');
  }, [status.enabled]);
  const signature = hunt
    ? JSON.stringify([
        hunt.region,
        hunt.kind,
        hunt.node,
        status.wins,
        status.drops,
        status.reason,
      ])
    : '';
  if (!hunt || (!status.enabled && (!status.reason || signature === dismissed)))
    return null;
  const phase = !status.enabled
    ? status.reason
    : s.paused
      ? '游戏已暂停'
      : status.phase === 'fighting'
        ? '自动战斗中'
        : status.wait > 0
          ? `重整 ${duration(status.wait)} 后再战`
          : '准备下一场';
  return (
    <section
      className={'hunt-activity' + (status.enabled ? ' active' : '')}
      aria-label="连续刷怪状态"
    >
      <button
        type="button"
        className="hunt-location"
        onClick={() =>
          go({
            view: 'explore',
            region: hunt.region,
            guardian: hunt.kind === 'guardian' ? hunt.node : undefined,
          })
        }
      >
        <Repeat2 aria-hidden="true" />
        <strong>
          {status.enabled ? '连刷' : '连刷已停'} · {status.target}
        </strong>
        <ChevronRight aria-hidden="true" />
      </button>
      <span className="hunt-phase">{phase}</span>
      <span className="hunt-count">
        已胜 <b>{status.wins}</b> 场 · 掉装 <b>{status.drops}</b> 件
      </span>
      <button
        type="button"
        className="hunt-link"
        onClick={() => go({ view: 'heroes', tab: 'inventory' })}
      >
        整理装备
      </button>
      {status.enabled ? (
        <button
          type="button"
          className="hunt-stop"
          onClick={() => act(G.stopHunt)}
        >
          停止连刷
        </button>
      ) : (
        <button
          type="button"
          className="hunt-close"
          aria-label="收起连刷结果"
          onClick={() => setDismissed(signature)}
        >
          ×
        </button>
      )}
    </section>
  );
}
