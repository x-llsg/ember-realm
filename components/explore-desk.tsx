'use client';
import '@/app/expedition-art.css';
import { EnemyPortrait, RegionScene } from './game-art';
import { PinPlan } from './planning-board';
import { BattleLoot } from './loot-notice';
import { HuntControl } from './hunt-controls';
import {
  SiteExploreDesk,
  SiteNavigation,
  rememberedSite,
} from './site-explore-desk';

import { InfoHint } from './info-hint';
import { CombatRecommendation } from './combat-recommendation';
import { PotionWorkshop } from './potion-workshop';
import { useState } from 'react';
import {
  ArrowRight,
  Check,
  Compass,
  Lock,
  ScrollText,
  Shield,
  Swords,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import * as G from '@/lib/realm';
import { MissionPlanner } from '@/components/mission-planner';
import {
  Buy,
  Pick,
  Meter,
  type Act,
  type Destination,
} from '@/components/realm-panels';

export type ExploreDeskProps = {
  s: G.State;
  act: Act;
  go: (destination: Destination) => void;
  focus: Destination;
};

type Detail =
  | 'battle-report'
  | 'intel'
  | 'return'
  | 'forecast'
  | 'outpost'
  | 'preparation'
  | null;
type Forecast = ReturnType<typeof G.forecastBattle>;
type ForecastReport = { key: string; prepared: Forecast; basic: Forecast };
const routeNames: Record<G.Route, string> = {
  survey: '调查',
  frontier: '推进',
  supply: '补给',
};

function initialRegion(s: G.State, requested?: number) {
  if (
    requested !== undefined &&
    G.REGIONS[requested] &&
    G.regionOpen(s, requested)
  )
    return requested;
  const suggested = s.lastMap;
  return G.regionOpen(s, suggested)
    ? suggested
    : G.REGIONS.findIndex((_, r) => G.regionOpen(s, r));
}

function initialRoute(s: G.State, focus: Destination): G.Route {
  if (!G.hasReturned(s)) return 'survey';
  return focus.route || (focus.tab === 'frontier' ? 'frontier' : 'survey');
}

function commandName(s: G.State, command: G.Command) {
  if (command.startsWith('unit:')) {
    const [, id, action] = command.split(':');
    return (
      (s.heroes.find((h) => h.id === id)?.name || '旅人') +
      ' · ' +
      (G.SKILLS.find((sk) => sk.id === action)?.name ||
        (
          {
            attack: '攻击',
            guard: '防守',
            break: '破势',
            heal: '补给',
          } as Record<string, string>
        )[action] ||
        action)
    );
  }
  if (command.startsWith('hero:')) {
    const id = command.slice(5),
      hero = s.heroes.find((h) => h.id === id);
    return hero
      ? `${hero.name} · ${G.heroDefinition(s, id).skill}`
      : '伙伴技能';
  }
  return (
    (
      {
        attack: '普通攻击',
        break: '破势',
        guard: '坚守',
        heal: '补给治疗',
        retreat: '撤退',
      } as Record<string, string>
    )[command] || '伙伴技能'
  );
}

/** Focus changes remount ExplorePanel through the existing focus.nonce key in app/page. */
export function ExploreDesk({ s, act, go, focus }: ExploreDeskProps) {
  const [selectedRegion] = useState(() => initialRegion(s, focus.region));
  const [mission, setMission] = useState(() => ({
    route: initialRoute(s, focus),
    revision: 0,
  }));
  const [detail, setDetail] = useState<Detail>(() =>
    focus.tab === 'reports' && s.lastExpedition
      ? 'return'
      : focus.tab === 'discoveries'
        ? 'intel'
        : null,
  );
  const [returnReport, setReturnReport] = useState<G.ExpeditionReport | null>(
    () => s.lastExpedition,
  );
  const [forecast, setForecast] = useState<ForecastReport | null>(null);

  const regions = G.REGIONS.map((definition, id) => ({
    definition,
    id,
  })).filter(({ id }) => G.regionOpen(s, id));
  const region = regions.some((x) => x.id === selectedRegion)
    ? selectedRegion
    : (regions[0]?.id ?? 0);
  const enemy = G.REGIONS[region],
    frontier = G.frontierInfo(s, region);
  const guardianNode =
    focus.guardian !== undefined &&
    focus.guardian >= 0 &&
    focus.guardian <= Math.min(4, frontier.depth)
      ? focus.guardian
      : Math.min(4, frontier.depth);
  const rematch = G.guardianRematch(s, region, guardianNode);
  const guardianLoot = G.dropProfile(
    s,
    region,
    'guardian',
    guardianNode,
    !rematch,
  );
  const bossLoot = G.dropProfile(
    s,
    region,
    'boss',
    5,
    !s.cleared.includes(region),
  );
  const guardian = G.enemyDefinition(s, region, 'guardian', guardianNode),
    boss = G.enemyDefinition(s, region, 'boss'),
    guardReady = rematch || G.guardianReady(s, region);
  const guardianBlocker = G.guardianReason(s, region, guardianNode);
  const clues = G.discoveryCount(s, region),
    intel = s.guild.intel[region],
    outpost = s.guild.outposts[region];
  const visited = G.regionVisited(s, region),
    returned = G.hasReturned(s);
  const approach = G.bossApproach(s, region);
  const bossRevealed = approach.accessible || s.cleared.includes(region);
  const modifiers = G.battleModifiers(s, region),
    prep = s.guild.preparation;
  const reason = G.bossReason(s, region),
    preparationLocked =
      !!s.expedition || !!s.battle || !!s.worldExploration.activeRun;
  const party = G.partyStats(s);

  // Exclude the ticking clock and ordinary stock growth. Include every preparation
  // input plus the current eligibility reason, so stale simulations are never shown.
  const forecastKey = JSON.stringify({
    region,
    party: s.party,
    heroes: s.heroes,
    inventory: s.guild.inventory,
    preparation: prep,
    potions: s.guild.potions,
    doctrine: s.guild.doctrine,
    intel: s.guild.intel,
    depths: s.guild.depths,
    outposts: s.guild.outposts,
    research: s.research,
    flags: s.flags,
    projects: s.projects,
    kit: s.kit,
    buildings: s.buildings,
    cleared: s.cleared,
    technology: s.world.tech,
    reason,
  });
  const currentForecast = forecast?.key === forecastKey ? forecast : null;
  const outpostReason = !G.regionOpen(s, region)
    ? G.regionReason(s, region)
    : s.battle
      ? '战后可建设'
      : frontier.depth < 1
        ? '夺取第一处据点后建设'
        : outpost >= 3
          ? '驻地已满级'
          : '';
  const layerReward =
    frontier.depth < 5
      ? G.FRONTIER_REWARDS[frontier.depth].replace(
          '本地区资源',
          G.RESOURCE_NAMES[G.FRONTIER_RESOURCES[region]],
        )
      : '五处据点奖励已生效，可以准备首领决战。';

  function selectRegion(id: number) {
    if (id === selectedRegion) return;
    go({ view: 'explore', region: id, route: 'survey' });
  }
  function prepareMission(route: G.Route) {
    setMission((previous) => ({
      route: returned ? route : 'survey',
      revision: previous.revision + 1,
    }));
    setDetail(null);
  }
  function changePreparation(patch: Partial<G.State['guild']['preparation']>) {
    if (preparationLocked) return;
    act((current) => G.setPreparation(current, patch));
    setForecast(null);
  }
  function openForecast() {
    if (reason) return;
    setForecast({
      key: forecastKey,
      prepared: G.forecastBattle(s, region),
      basic: G.forecastBattle(s, region, 'attack'),
    });
    setDetail('forecast');
  }
  function openReturn() {
    if (!s.lastExpedition) return;
    // Keep the selected immutable report even if another automated trip returns.
    setReturnReport(s.lastExpedition);
    setDetail('return');
  }

  function renderOutpost() {
    return (
      <section className="explore-outpost">
        <div className="explore-section-head">
          <strong>
            <InfoHint
              title="地区驻地"
              body={`每级物资收益 +25%、粮耗 −10%、本地区战斗承伤 −5%。当前物资 +${outpost * 25}% / 粮耗 −${outpost * 10}% / 承伤 −${outpost * 5}%。`}
            >
              地区驻地 <span>{outpost}/3</span>
            </InfoHint>
          </strong>
        </div>
        {outpost >= 3 ? (
          <p className="desk-muted">驻地建设完成</p>
        ) : (
          <Buy
            s={s}
            cost={G.outpostCost(s, region)}
            reason={outpostReason}
            label={outpost >= 3 ? '驻地已满级' : '建设驻地'}
            onClick={() => act((current) => G.buildOutpost(current, region))}
          />
        )}
      </section>
    );
  }

  function renderPreparation(prefix: string) {
    const potions = G.POTIONS.filter(
      (p) =>
        !G.potionUnlockReason(s, p.id) ||
        G.potionCount(s, p.id) > 0 ||
        prep.element === p.id,
    );
    return (
      <>
        <fieldset className="explore-preparations" disabled={preparationLocked}>
          <legend className="sr-only">出战准备</legend>
          <div className="explore-prep-row">
            <label htmlFor={`${prefix}-stance`}>姿态</label>
            <Pick
              id={`${prefix}-stance`}
              label="战术姿态"
              value={prep.stance}
              onChange={(value) =>
                changePreparation({ stance: value as typeof prep.stance })
              }
              options={[
                { value: 'balanced', label: '均衡 · 标准攻防' },
                { value: 'cautious', label: '谨慎 · 伤害与承伤 −10%' },
                { value: 'assault', label: '强攻 · 伤害与承伤 +12%' },
              ]}
            />
          </div>
          {potions.length > 0 && (
            <div className="explore-prep-row">
              <label htmlFor={`${prefix}-element`}>药剂</label>
              <Pick
                id={`${prefix}-element`}
                label="抗性药剂"
                value={prep.element}
                onChange={(value) =>
                  changePreparation({ element: value as G.Element })
                }
                options={[
                  { value: 'physical', label: '不携带抗性药剂' },
                  ...potions.map((potion) => ({
                    value: potion.id,
                    label: `${potion.name} · ${G.potionCount(s, potion.id)}份 · ${G.ELEMENT_NAMES[potion.element]}抗性 +20%`,
                  })),
                ]}
              />
            </div>
          )}
          <label className="explore-remedy" htmlFor={`${prefix}-remedy`}>
            <span>额外药囊 +2</span>
            <Switch
              id={`${prefix}-remedy`}
              checked={prep.remedy}
              disabled={preparationLocked}
              onCheckedChange={(checked) =>
                changePreparation({ remedy: checked })
              }
            />
          </label>
        </fieldset>
        <p
          className="explore-prep-cost"
          title="每次挑战守敌或首领时支付，推演不消耗材料"
        >
          出战费用：{G.costText(G.battlePreparationCost(s))}
          {prep.element !== 'physical' &&
            ` · 消耗1份${G.POTIONS.find((p) => p.id === prep.element)?.name || '抗性药剂'}`}
        </p>
        <PotionWorkshop s={s} act={act} />
      </>
    );
  }

  function renderBossSummary() {
    return bossRevealed ? (
      <section
        className="explore-boss explore-boss-summary"
        aria-label="地区首领目标"
      >
        <div className="explore-boss-identity">
          <span className="explore-boss-portrait" aria-hidden="true">
            <EnemyPortrait region={region} node={5} size="md" />
          </span>
          <div>
            <span className="explore-enemy-rank">
              地区首领 · {G.ELEMENT_NAMES[G.ENEMIES[region].element]}
            </span>
            <h3>
              <InfoHint
                title={enemy.boss}
                body={`${enemy.epithet}。${enemy.mechanic}\n生命 ${boss.hp.toLocaleString('zh-CN')} · 攻击 ${boss.attack} · 护甲 ${G.enemyArmor(s, region).toFixed(1)}\n敌情伤害 +${(s.guild.intel[region] / 10).toFixed(1)}%；敌情只提供伤害增益，不限制挑战时机。\n当前队伍：对应抗性 ${Math.round(modifiers.resistance * 100)}% · 穿甲 ${Math.round(modifiers.pierce * 100)}% · 远程 ${Math.round(modifiers.ranged * 100)}%`}
              >
                {enemy.boss}
              </InfoHint>
            </h3>
            <small>
              生命 {boss.hp.toLocaleString('zh-CN')} · 护甲{' '}
              {G.enemyArmor(s, region).toFixed(1)}
            </small>
          </div>
        </div>
        <div className="explore-boss-meta">
          <InfoHint title={approach.label} body={approach.detail}>
            <span className="boss-approach-state">
              {approach.label}
              {approach.weakened ? ' · 护甲 −15%' : ' · 可提前挑战'}
            </span>
          </InfoHint>
          <InfoHint
            title="首领套装与残响"
            body={`${G.dropHelp(bossLoot).body}\n首胜后每180游戏秒可再次挑战，仍需支付出战补给；不重复发首通物资、经验、解锁和剧情。读档保留战斗随机序列。`}
          >
            <span className="boss-loot-note">{G.dropSummary(bossLoot)}</span>
          </InfoHint>
        </div>
        <CombatRecommendation s={s} region={region} node={6} />
        {!s.cleared.includes(region) && (
          <PinPlan s={s} act={act} kind="boss" id={String(region)} />
        )}
        <HuntControl s={s} act={act} region={region} kind="boss" />
      </section>
    ) : (
      <section className="explore-boss explore-boss-unknown">
        <strong>
          <Shield aria-hidden="true" /> 首领行踪未明
        </strong>
        <p>占领 {approach.required} 处据点后，可提前挑战本地区首领。</p>
        <small>
          当前守敌造成{G.ELEMENT_NAMES[guardian.element]}
          伤害，先按敌人准备队伍。
        </small>
      </section>
    );
  }

  function renderBossPanel(prefix = 'explore') {
    return (
      <section className="explore-ready-panel">
        <header className="explore-ready-heading">
          <InfoHint
            title="出战准备"
            body="守敌与首领共用这份准备；开战时支付费用。队伍外出时锁定战术和携带药剂，归来后可调整；城镇仍可调配新药剂。敌情只提供增益，不限制挑战时机。"
          >
            <h3>出战准备</h3>
          </InfoHint>
          <button
            type="button"
            className="life-text-button"
            onClick={() => go({ view: 'heroes', tab: 'inventory' })}
          >
            调整装备 →
          </button>
        </header>
        <div className="explore-ready-body">
          <label className="guardian-auto">
            <input
              type="checkbox"
              checked={s.combatAuto}
              onChange={(event) =>
                act((x) => G.setCombatAuto(x, event.target.checked))
              }
            />
            守敌自动战斗{' '}
            <InfoHint
              title="自动推进"
              body="勾选后，重复推进的队伍在抵达守敌时自动付出准备费用并作战。每秒执行一步，随时可关闭；战败停止续派。自动使用实际属性、血条与冷却，不保证胜利。"
            >
              规则
            </InfoHint>
          </label>
          {renderPreparation(prefix)}
          {preparationLocked && !bossRevealed && (
            <small className="explore-prep-locked">
              队伍归来后可调整准备。
            </small>
          )}
        </div>
        {bossRevealed && (
          <footer className="explore-ready-footer">
            <span className="explore-challenge-target">
              首领 · {enemy.boss}
            </span>
            <div className="explore-boss-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={!!reason}
                onClick={openForecast}
              >
                战前推演
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={!!reason}
                onClick={() => {
                  go({
                    view: 'explore',
                    region,
                    guardian: guardianNode,
                    route: mission.route,
                  });
                  act((current) => G.startBattle(current, region));
                }}
              >
                <Swords aria-hidden="true" />
                {s.cleared.includes(region)
                  ? '再战首领残响'
                  : approach.weakened
                    ? '发起决战'
                    : '挑战全盛首领'}
              </button>
            </div>
            {reason && (
              <p className="explore-blocker" title={reason}>
                {reason}
              </p>
            )}
          </footer>
        )}
      </section>
    );
  }

  if (!s.buildings.tavern || !s.heroes.length) {
    return (
      <section className="life-card explore-empty">
        <Compass aria-hidden="true" />
        <h2>先找到愿意同行的人</h2>
        <p>建造酒馆，雇佣并编入至少一位伙伴，再一起走出火光。</p>
        <button
          type="button"
          className="primary-button"
          onClick={() =>
            go(
              s.buildings.tavern
                ? { view: 'recruit' }
                : { view: 'town', building: 'tavern' },
            )
          }
        >
          {s.buildings.tavern ? '招募冒险者' : '建造酒馆'}
          <ArrowRight aria-hidden="true" />
        </button>
      </section>
    );
  }

  const siteId = rememberedSite(s, region, focus.site);
  if (siteId)
    return (
      <SiteExploreDesk key={siteId} s={s} act={act} go={go} siteId={siteId} />
    );

  return (
    <>
      <div
        className="explore-desk explore-layout"
        data-focus={focus.tab || 'mission'}
      >
        <nav className="explore-regions" aria-label="已通路地区">
          <div className="explore-region-head">
            <Compass aria-hidden="true" />
            <strong>已知的道路</strong>
          </div>
          {regions.map(({ definition, id }) => (
            <button
              key={id}
              type="button"
              className={`explore-region-button${id === region ? ' selected' : ''}`}
              aria-pressed={id === region}
              onClick={() => selectRegion(id)}
            >
              <span className="explore-region-number" aria-hidden="true">
                {String(id + 1).padStart(2, '0')}
              </span>
              <span className="explore-region-copy">
                <strong>
                  <InfoHint
                    withinControl
                    title={definition.name}
                    body={`${definition.desc}${G.regionVisited(s, id) ? `\n地区材料：${G.MATERIAL_NAMES[G.REGION_MATERIALS[id]]}` : ''}`}
                  >
                    {definition.name}
                  </InfoHint>
                </strong>
                <small>
                  {s.expedition?.region === id
                    ? `队伍正在${routeNames[s.expedition.route]}`
                    : s.cleared.includes(id)
                      ? `首领已败 · ${s.guild.depths[id]}/5`
                      : returned
                        ? `据点 ${s.guild.depths[id]}/5`
                        : '等待第一次调查'}
                </small>
              </span>
            </button>
          ))}
          <button
            type="button"
            className="explore-return-button"
            disabled={!s.lastExpedition}
            onClick={openReturn}
          >
            <ScrollText aria-hidden="true" />
            <span>
              {s.lastExpedition ? '上次归来 · 见闻与收获' : '还没有回程记录'}
            </span>
          </button>
          {s.lastBattle && (
            <button
              type="button"
              className="explore-return-button"
              onClick={() => setDetail('battle-report')}
            >
              <Swords aria-hidden="true" />
              <span>
                上次战斗 ·{' '}
                {s.lastBattle.won
                  ? '胜利'
                  : s.lastBattle.retreated
                    ? '撤退'
                    : '失利'}
              </span>
            </button>
          )}
        </nav>
        <div className="explore-location-bar">
          <SiteNavigation s={s} go={go} region={region} />
        </div>

        <section
          className="explore-center"
          aria-labelledby="explore-region-title"
        >
          <div className="explore-map-scroll" aria-label="地图与据点">
            <div className="explore-map-overview">
              <header className="explore-heading">
                <RegionScene region={region} className="explore-region-scene" />
                <div className="explore-heading-copy">
                  <span className="life-kicker">
                    {String(region + 1).padStart(2, '0')} / {enemy.biome}
                  </span>
                  <h2 id="explore-region-title">
                    <InfoHint title={enemy.name} body={enemy.desc}>
                      {enemy.name}
                    </InfoHint>
                  </h2>
                </div>
                <button
                  type="button"
                  className="explore-party"
                  onClick={() => go({ view: 'heroes', tab: 'roster' })}
                  title={s.party
                    .map((id) => s.heroes.find((h) => h.id === id)?.name)
                    .filter(Boolean)
                    .join('、')}
                >
                  <span>
                    小队战力 <strong>{party.power}</strong>
                  </span>
                  <small>{s.party.length} 位同行者 · 调整队伍 →</small>
                </button>
              </header>

              <div className="explore-frontier">
                {returned ? (
                  <>
                    <ol className="explore-path" aria-label="本地区五处据点">
                      {G.FRONTIERS[region].map((name, index) => (
                        <li
                          key={name}
                          className={
                            index < frontier.depth
                              ? 'done'
                              : index === frontier.depth
                                ? 'current'
                                : ''
                          }
                          aria-current={
                            index === frontier.depth ? 'step' : undefined
                          }
                        >
                          <button
                            type="button"
                            disabled={index > frontier.depth}
                            aria-label={`${name}${index < frontier.depth ? ' · 已夺取，可再战' : index === frontier.depth ? ' · 当前据点' : ' · 尚未抵达'}`}
                            aria-pressed={index === guardianNode}
                            onClick={() =>
                              go({
                                view: 'explore',
                                region,
                                guardian: index,
                                route: mission.route,
                              })
                            }
                          >
                            <b>
                              {index < frontier.depth ? (
                                <Check aria-label="已夺取" />
                              ) : (
                                index + 1
                              )}
                            </b>
                            <span>{name}</span>
                          </button>
                        </li>
                      ))}
                    </ol>
                    <div className="explore-progress">
                      <strong>
                        <InfoHint
                          title={enemy.name + ' · 据点道路'}
                          body={
                            <>
                              <p>
                                {G.FRONTIERS[region]
                                  .map(
                                    (name, index) =>
                                      `${index + 1}. ${name}${index < frontier.depth ? '（已夺取）' : ''}`,
                                  )
                                  .join(' → ')}
                              </p>
                              <p>
                                {frontier.depth < 5 ? '下一据点首占奖励：' : ''}
                                {layerReward}
                              </p>
                              <p>
                                成功推进 +{frontier.progress}；当前{' '}
                                {s.guild.progress[region]}/{frontier.required}。
                              </p>
                            </>
                          }
                        >
                          {frontier.depth === 5 ? '道路已打通' : frontier.name}
                        </InfoHint>
                      </strong>
                      <span>
                        {frontier.depth === 5
                          ? '据点 5/5'
                          : `${s.guild.progress[region]}/${frontier.required} · 成功推进 +${frontier.progress}`}
                      </span>
                    </div>
                    <Meter
                      value={
                        frontier.depth === 5
                          ? 100
                          : (s.guild.progress[region] / frontier.required) * 100
                      }
                      label="当前据点推进"
                    />
                    <p className="explore-reward" title={layerReward}>
                      {frontier.depth < 5 ? '下一据点首占奖励：' : ''}
                      {layerReward}
                    </p>
                  </>
                ) : (
                  <p className="explore-reward">
                    先调查森林边缘。带回样品与见闻后，再选择深入据点或运输补给。
                  </p>
                )}
              </div>
            </div>
            {returned && (
              <div className="explore-encounters">
                <section className="explore-guardian" aria-label="据点守敌目标">
                  {returned && (
                    <div
                      className={`guardian-preview${guardReady ? ' ready' : ''}`}
                    >
                      <div className="guardian-identity">
                        <span className="guardian-portrait" aria-hidden="true">
                          <EnemyPortrait
                            region={region}
                            node={guardianNode}
                            size="sm"
                          />
                        </span>
                        <div className="guardian-identity-copy">
                          <InfoHint
                            title={guardian.name}
                            body={`生命 ${guardian.hp} · 攻击 ${guardian.attack} · 护甲 ${guardian.defense}。${G.ELEMENT_NAMES[guardian.element]}伤害。${rematch ? '再战按所选节点掉落当地套装，不重复首占奖励、经验或据点进度。' : '推荐练度包括装备与技能养成；战败保留路线。'}`}
                          >
                            <strong>{guardian.name}</strong>
                          </InfoHint>
                          <small>
                            {rematch
                              ? '再战守敌 · 不重复首占奖励'
                              : guardReady
                                ? '守敌已现身'
                                : '当前节点守敌'}{' '}
                            · 生命 {guardian.hp.toLocaleString('zh-CN')}
                          </small>
                        </div>
                      </div>
                      <div className="guardian-actions">
                        <button
                          className="primary-button"
                          disabled={!!guardianBlocker}
                          onClick={() => {
                            go({
                              view: 'explore',
                              region,
                              guardian: guardianNode,
                              route: mission.route,
                            });
                            act((x) =>
                              G.beginBattle(
                                x,
                                region,
                                'guardian',
                                guardianNode,
                              ),
                            );
                          }}
                        >
                          {rematch
                            ? '再战守敌'
                            : guardReady
                              ? '挑战守敌'
                              : '推进后挑战'}
                        </button>
                        <HuntControl
                          s={s}
                          act={act}
                          region={region}
                          kind="guardian"
                          node={guardianNode}
                        />
                      </div>
                      <InfoHint
                        {...G.dropHelp(guardianLoot)}
                        className="guardian-loot-note"
                      >
                        {G.dropSummary(guardianLoot)}
                      </InfoHint>
                      {guardReady && guardianBlocker && (
                        <small>{guardianBlocker}</small>
                      )}
                    </div>
                  )}
                  {returned && (
                    <div className="guardian-readiness">
                      <CombatRecommendation
                        s={s}
                        region={region}
                        node={guardianNode + 1}
                      />
                    </div>
                  )}
                </section>
                {renderBossSummary()}
              </div>
            )}
            <div className="explore-region-support">
              {returned && renderOutpost()}

              <section className="explore-intel">
                <div className="explore-section-head">
                  <strong>敌情 {intel}/100</strong>
                  <span>线索 {clues}/2</span>
                </div>
                <div className="life-inline-actions">
                  <button
                    type="button"
                    className="life-text-button"
                    onClick={() => setDetail('intel')}
                  >
                    {visited ? '阅读见闻与克制提示' : '查看调查目标'} →
                  </button>
                  {clues === 2 && (
                    <button
                      type="button"
                      className="life-text-button"
                      onClick={() =>
                        go({ view: 'town', tab: 'projects', region })
                      }
                    >
                      {s.projects[G.PROJECTS[region].id]
                        ? '地区工程 ✓'
                        : '回城完成工程'}{' '}
                      →
                    </button>
                  )}
                </div>
              </section>
            </div>
          </div>
          <MissionPlanner
            key={`${region}:${mission.revision}`}
            s={s}
            act={act}
            region={region}
            initial={returned ? mission.route : 'survey'}
            onRouteChange={(route) =>
              setMission((previous) =>
                previous.route === route ? previous : { ...previous, route },
              )
            }
          />
        </section>

        <aside className="explore-aside" aria-label="战斗准备与挑战">
          <div className="explore-aside-triggers">
            <button
              type="button"
              className="explore-aside-trigger"
              aria-haspopup="dialog"
              onClick={() => setDetail('intel')}
            >
              <ScrollText aria-hidden="true" />
              <span>见闻 · {clues}/2</span>
            </button>
            {returned && (
              <button
                type="button"
                className="explore-aside-trigger"
                aria-haspopup="dialog"
                onClick={() => setDetail('outpost')}
              >
                <Compass aria-hidden="true" />
                <span>驻地 · {outpost}/3</span>
              </button>
            )}
            {returned && (
              <button
                type="button"
                className="explore-aside-trigger"
                aria-haspopup="dialog"
                onClick={() => setDetail('preparation')}
              >
                <Swords aria-hidden="true" />
                <span>{bossRevealed ? '首领备战' : '守敌备战'}</span>
              </button>
            )}
          </div>
          {returned && renderBossPanel()}
        </aside>
      </div>

      <Dialog
        open={detail === 'battle-report'}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        <DialogContent className="v21-ui life-dialog explore-detail-dialog">
          <DialogTitle>
            {s.lastBattle?.enemy} ·{' '}
            {s.lastBattle?.won
              ? '胜利'
              : s.lastBattle?.retreated
                ? '主动撤退'
                : '战败'}
          </DialogTitle>
          <DialogDescription>
            {s.lastBattle?.rounds} 回合 · {s.lastBattle?.survivors} 人仍能战斗 ·
            保留最近 35 条行动
          </DialogDescription>
          <div className="battle-report-history">
            <BattleLoot
              receipt={s.lastBattle?.loot}
              go={(d) => {
                setDetail(null);
                go(d);
              }}
            />
            {s.lastBattle?.history.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={detail === 'outpost'}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        <DialogContent className="v21-ui life-dialog explore-detail-dialog">
          <DialogTitle>{enemy.name} · 驻地</DialogTitle>
          <DialogDescription>
            夺取第一处据点后，可以在这里建设远征驻地。
          </DialogDescription>
          {returned && renderOutpost()}
        </DialogContent>
      </Dialog>

      <Dialog
        open={detail === 'preparation'}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        <DialogContent className="v21-ui life-dialog explore-detail-dialog">
          <DialogTitle>{enemy.name} · 战斗准备</DialogTitle>
          <DialogDescription>
            按敌人的伤害类型准备药剂、装备与技能，再决定是否挑战。
          </DialogDescription>
          {returned && renderBossPanel('explore-dialog')}
        </DialogContent>
      </Dialog>

      <Dialog
        open={detail === 'intel'}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        <DialogContent className="v21-ui life-dialog explore-detail-dialog">
          <DialogTitle>{enemy.name} · 见闻与敌情</DialogTitle>
          <DialogDescription>
            调查积累故事线索与敌情，推进抵达守敌，战胜后夺取据点；两种用途可以分别安排。
          </DialogDescription>
          <p>
            敌情 {intel}/100 · 决战增伤 +{(intel / 10).toFixed(1)}% · 驻地承伤 −
            {outpost * 5}%
          </p>
          <div className="life-clues">
            {enemy.discoveries.map((text, index) => {
              const found = s.survey[region] >= enemy.thresholds[index];
              return (
                <article key={index} className={found ? 'found' : ''}>
                  <span>
                    {found ? (
                      <Check aria-label="已发现" />
                    ) : (
                      <Lock aria-label="待调查" />
                    )}
                  </span>
                  <div>
                    <strong>
                      {index === 0 ? '见闻' : '真相'} ·{' '}
                      {Math.min(s.survey[region], enemy.thresholds[index])}/
                      {enemy.thresholds[index]}
                    </strong>
                    <p>
                      {found ? text : '继续调查，小队会把这里的故事带回来。'}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
          {bossRevealed && (
            <>
              <p>{G.ENEMIES[region].tip}</p>
              <p>
                31
                回合起敌人逐步狂怒。药剂与装备提供对应抗性，适时打断可阻止敌人恢复或蓄力。
              </p>
            </>
          )}
          {returned && (
            <p>
              当前有效战力 {frontier.effective} / 基准 {frontier.power}
              。达到两倍基准，必定推进且不遭伏击；继续提高战力还能增加每趟推进。
            </p>
          )}
          <div className="life-inline-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => prepareMission('survey')}
            >
              安排调查
            </button>
            {clues === 2 && (
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  setDetail(null);
                  go({ view: 'town', tab: 'projects', region });
                }}
              >
                查看地区工程
                <ArrowRight aria-hidden="true" />
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={detail === 'return'}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        <DialogContent className="v21-ui life-dialog explore-detail-dialog">
          <DialogTitle>小队带回的见闻</DialogTitle>
          <DialogDescription>
            这是打开时选中的回程记录，收益与成功率不会因之后换装而改变。
          </DialogDescription>
          {returnReport ? (
            <>
              <h3>
                {G.REGIONS[returnReport.region].name} ·{' '}
                {returnReport.route ? routeNames[returnReport.route] : '远征'}
              </h3>
              <p>
                {returnReport.success ? '委托完成' : '推进受挫'} ·{' '}
                {G.EXPEDITION_OUTCOMES[returnReport.outcome].name}
              </p>
              {returnReport.chance !== undefined && (
                <p>
                  出发时成功率 {Math.floor(returnReport.chance * 1000) / 10}%
                </p>
              )}
              {returnReport.materials && <p>{returnReport.materials}</p>}
              <p>实际入库：{G.costText(returnReport.kept) || '无基础物资'}</p>
              {!!returnReport.progress && <p>推进 +{returnReport.progress}</p>}
              {!!returnReport.intelGain && (
                <p>敌情 +{returnReport.intelGain}</p>
              )}
              {!!returnReport.clues && (
                <p>
                  发现 {returnReport.clues} 条新线索，可在对应地区见闻中阅读。
                </p>
              )}
              {returnReport.equipment && <p>{returnReport.equipment}</p>}
              {!!Object.keys(returnReport.lost).length && (
                <p>仓库未能容纳：{G.costText(returnReport.lost)}</p>
              )}
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  if (G.regionOpen(s, returnReport.region))
                    selectRegion(returnReport.region);
                  setDetail('intel');
                }}
              >
                查看当地见闻
              </button>
            </>
          ) : (
            <p>小队还没有带回远征记录。</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={detail === 'forecast'}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        <DialogContent className="v21-ui life-dialog explore-detail-dialog">
          <DialogTitle>{enemy.boss} · 战前推演</DialogTitle>
          <DialogDescription>
            使用真实战斗规则逐回合计算，不花费物资。预案失败不代表所有操作都无法取胜。
          </DialogDescription>
          {currentForecast ? (
            <>
              <p>
                <strong>
                  按预案：
                  {currentForecast.prepared.win ? '可取胜' : '此次未能取胜'}
                </strong>{' '}
                · {currentForecast.prepared.rounds} 回合 · 余生命{' '}
                {currentForecast.prepared.hp}
              </p>
              <p>
                只普通攻击：{currentForecast.basic.win ? '取胜' : '战败'} ·{' '}
                {currentForecast.basic.rounds} 回合
              </p>
              <details className="explore-forecast-steps">
                <summary>查看预案动作</summary>
                <ol>
                  {currentForecast.prepared.trace.map((command, index) => (
                    <li key={index}>
                      第 {index + 1} 步 · {commandName(s, command)}
                    </li>
                  ))}
                </ol>
              </details>
            </>
          ) : (
            <p>地区、队伍或准备已改变，请按当前状态重新推演。</p>
          )}
          {reason && <p className="life-hint">{reason}</p>}
          <div className="life-inline-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setDetail(null)}
            >
              返回安排
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={!!reason}
              onClick={openForecast}
            >
              重新推演
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
