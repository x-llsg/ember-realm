'use client';
import { InfoHint, Term } from './info-hint';
import { regionRouteHelp } from '@/lib/glossary';
import { useState } from 'react';
import { ArrowRight, Search, Swords, Package } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import * as G from '@/lib/realm';
import { duration, type Act } from './realm-panels';
const purposes = [
  {
    id: 'survey' as const,
    name: '调查',
    icon: Search,
    lead: '查清这里发生了什么',
    detail: '增加故事线索与敌情，不夺取据点。',
  },
  {
    id: 'frontier' as const,
    name: '推进',
    icon: Swords,
    lead: '抵达下一处守敌',
    detail: '推进道路，击败尽头的守敌后获得通路与奖励。',
  },
  {
    id: 'supply' as const,
    name: '补给',
    icon: Package,
    lead: '带回工坊所需的材料',
    detail: '沿外围运输原料，不推进故事或据点。',
  },
];
export function MissionPlanner({
  s,
  act,
  region,
  initial,
  onRouteChange,
}: {
  s: G.State;
  act: Act;
  region: number;
  initial?: G.Route;
  onRouteChange?: (route: G.Route) => void;
}) {
  const [route, setRoute] = useState<G.Route>(initial || 'survey');
  const [repeat, setRepeat] = useState(false),
    [confirm, setConfirm] = useState(false);
  const info = G.routeInfo(s, region, route),
    purpose = purposes.find((p) => p.id === route)!;
  const reason = G.dispatchReason(s, region, route, 0);
  const e = s.expedition,
    frontier = G.frontierInfo(s, region);
  const equipmentLoot = G.dropProfile(s, region, 'expedition', frontier.depth);
  return (
    <div className="life-card expedition-planner">
      <fieldset
        className="mission-choices"
        aria-label="选择远征用途，只预览不出发"
      >
        {purposes
          .filter((p) => G.hasReturned(s) || p.id === 'survey')
          .map((p) => (
            <button
              key={p.id}
              className={p.id === route ? 'selected' : ''}
              aria-pressed={p.id === route}
              onClick={() => {
                setRoute(p.id);
                onRouteChange?.(p.id);
              }}
            >
              <p.icon />
              <strong>
                <InfoHint withinControl {...regionRouteHelp(s, region, p.id)}>
                  {p.name}
                </InfoHint>
              </strong>
              <span>{p.lead}</span>
            </button>
          ))}
      </fieldset>
      <div className="mission-body">
        <div className="mission-description">
          <p>{purpose.detail}</p>
        </div>
        <div className="mission-bill">
          <span>
            耗时 <b>{duration(info.duration)}</b>
          </span>
          <span>
            口粮 <b>{info.cost}</b>
          </span>
          <span
            title={
              route === 'frontier'
                ? '参考战力，弱队也可尝试'
                : '出发需要达到的最低战力'
            }
          >
            {route === 'frontier' ? '参考战力' : '战力'}{' '}
            <b>
              {route === 'frontier' ? '' : '≥'}
              {info.power}
            </b>
          </span>
        </div>
        <p className="mission-yield">
          {G.expeditionMaterialPreview(s, region, route)}
        </p>
        {G.hasReturned(s) && <p className="mission-drop">
          <InfoHint {...G.dropHelp(equipmentLoot)}>成功归来：{G.dropSummary(equipmentLoot)}</InfoHint>
        </p>}
        {route === 'survey' && G.hasReturned(s) && (
          <p className="life-hint">
            线索 {G.discoveryCount(s, region)}/2 ·{' '}
            <Term name="intelligence">敌情</Term> {s.guild.intel[region]}
            /100；调查完成后可阅读见闻。
          </p>
        )}
        {route === 'frontier' && (
          <p className="life-hint">
            {frontier.guaranteed
              ? '必定成功'
              : '成功率 ' + Math.floor(frontier.chance * 1000) / 10 + '%'}{' '}
            · 有效战力 {frontier.effective}/{frontier.power} · 成功推进 +
            {frontier.progress}。有效战力达到基准两倍必成。
          </p>
        )}
        {!e && reason && <p className="mission-blocker">{reason}</p>}
        {e && (
          <p className="life-hint">
            队伍正在{G.REGIONS[e.region].name}
            {purposes.find((p) => p.id === e.route)!.name}。
          </p>
        )}
      </div>
      <div className="mission-bottom">
        {e && (
          <button
            className="mission-stop"
            onClick={() => act(G.recallExpedition)}
          >
            立即撤回
          </button>
        )}
        {s.order.enabled ? (
          <button
            className="mission-stop"
            onClick={() =>
              act(
                (x) => G.setOrder(x, { enabled: false }),
                '本次归来后停止续派。',
              )
            }
          >
            归来后停止续派
          </button>
        ) : e ? (
          <span className="mission-repeat">单次远征 · 归来后休息</span>
        ) : (
          G.hasReturned(s) && (
            <label className="mission-repeat">
              <input
                type="checkbox"
                checked={repeat}
                onChange={(e) => setRepeat(e.target.checked)}
              />
              归来后重复此用途
            </label>
          )
        )}
        <button
          className="primary-button"
          disabled={!!reason || !!e}
          onClick={() => setConfirm(true)}
        >
          {e ? `${duration(e.end - s.time)} 后归来` : `检查${purpose.name}安排`}{' '}
          <ArrowRight />
        </button>
      </div>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent className="life-dialog mission-confirm">
          <DialogTitle>
            确认{purpose.name} · {G.REGIONS[region].name}
          </DialogTitle>
          <DialogDescription>{purpose.detail}</DialogDescription>
          <p>
            {s.party
              .map((id) => s.heroes.find((h) => h.id === id)?.name)
              .join('、')}
          </p>
          <p>
            扣除 {info.cost} 口粮 · 耗时 {duration(info.duration)} ·{' '}
            {repeat
              ? '归来后继续同类远征，缺料会暂停'
              : '只执行这一次，归来后休息'}
          </p>
          {reason && <p className="short">{reason}</p>}
          <div className="life-inline-actions">
            <button
              className="secondary-button"
              onClick={() => setConfirm(false)}
            >
              返回调整
            </button>
            <button
              className="primary-button"
              disabled={!!reason}
              onClick={() => {
                act((x) => {
                  if (G.dispatchReason(x, region, route, 0)) return x;
                  return repeat
                    ? G.setOrder(x, {
                        enabled: true,
                        region,
                        route,
                        reserve: 0,
                        autoBuy: false,
                      })
                    : G.expedition(
                        G.setOrder(x, { enabled: false }),
                        region,
                        route,
                      );
                });
                setConfirm(false);
              }}
            >
              确认派遣{repeat ? '并续派' : ''}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
