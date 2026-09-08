'use client';
import { BattleDesk } from './battle-desk';
import { InfoHint, ResourceName, MaterialName } from './info-hint';
import { GuildTeam } from './guild-panels';
import { ExploreDesk } from './explore-desk';
import { useState, type ReactNode } from 'react';
import {
  Flame,
  TreePine,
  Wheat,
  Mountain,
  Coins,
  Gem,
  Anvil,
  Plus,
  Minus,
  Check,
  ArrowRight,
  Compass,
  Swords,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import * as G from '@/lib/realm';
import { EngineeringBoard } from './engineering-board';
import { BuildingBoard } from './economy-panels';
import { EconomyDesk } from './economy-desk';
export type Destination = {
  view: G.View;
  tab?: string;
  building?: G.BuildingId;
  region?: number;
  research?: string;
  hero?: string;
  recipe?: string;
  work?: G.WorkId;
  route?: G.Route;
};
export type Act = (fn: (s: G.State) => G.State, message?: string) => void;
type Props = {
  s: G.State;
  act: Act;
  go: (d: Destination) => void;
  focus: Destination;
};
const icons = {
  wood: TreePine,
  food: Wheat,
  stone: Mountain,
  gold: Coins,
  iron: Anvil,
  crystal: Gem,
};
const resources = Object.keys(G.RESOURCE_NAMES) as G.Resource[];
export const number = (n: number) => Math.floor(n).toLocaleString('zh-CN');
export const short = (n: number) =>
  n >= 1e6
    ? (n / 1e6).toFixed(1) + 'm'
    : n >= 1e4
      ? (n / 1e4).toFixed(1) + '万'
      : number(n);
export const duration = (n: number) => {
  const t = Math.max(0, Math.ceil(n));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
export function Pick({
  value,
  onChange,
  options,
  label,
  id,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <Select
      disabled={disabled}
      value={value}
      onValueChange={(v) => {
        if (v !== null) onChange(v);
      }}
      items={options}
    >
      <SelectTrigger id={id} className="life-select" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="life-options" alignItemWithTrigger={false}>
        {options.map((o) => (
          <SelectItem value={o.value} key={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function Meter({
  value,
  label,
  tone = 'gold',
}: {
  value: number;
  label: string;
  tone?: string;
}) {
  return (
    <Progress
      className={`life-meter ${tone}`}
      value={Math.max(0, Math.min(100, value))}
      aria-label={label}
    />
  );
}
function Cost({
  s,
  cost,
  reward = false,
}: {
  s: G.State;
  cost: G.Cost;
  reward?: boolean;
}) {
  return (
    <div className="life-cost">
      {Object.entries(cost).map(([k, v]) => {
        const Icon = icons[k as G.Resource];
        return (
          <span
            key={k}
            className={
              !reward && s.resources[k as G.Resource] < v! ? 'life-short' : ''
            }
          >
            <Icon />
            {v} <ResourceName s={s} id={k as G.Resource} />
          </span>
        );
      })}
    </div>
  );
}
export function Buy({
  s,
  cost,
  reason = '',
  label,
  onClick,
  materials = {},
}: {
  s: G.State;
  cost: G.Cost;
  reason?: string;
  label: string;
  onClick: () => void;
  materials?: G.MaterialCost;
}) {
  const blocked =
    reason || G.capacityReason(s, cost) || G.materialReason(s, materials);
  const missing = Object.entries(cost)
    .filter(([k, v]) => s.resources[k as G.Resource] < v!)
    .map(
      ([k, v]) =>
        `${G.RESOURCE_NAMES[k as G.Resource]} ${Math.ceil(v! - s.resources[k as G.Resource])}`,
    );
  return (
    <div className="life-buy">
      <Cost s={s} cost={cost} />
      {!!Object.keys(materials).length && (
        <small className="material-price">
          {Object.entries(materials).map(([k, v]) => (
            <span key={k}>
              {v} <MaterialName s={s} id={k as G.MaterialId} />{' '}
            </span>
          ))}
        </small>
      )}
      <button
        className="primary-button"
        disabled={!!blocked || !G.canPay(s, cost)}
        onClick={onClick}
      >
        {label}
        <ArrowRight />
      </button>
      {(blocked || !!missing.length) && (
        <p className="life-hint">{blocked || `还缺 ${missing.join('、')}`}</p>
      )}
    </div>
  );
}
function PaneTabs({
  value,
  onChange,
  items,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  items: { id: string; label: string; dot?: boolean }[];
  children: ReactNode;
}) {
  return (
    <Tabs className="life-subtabs" value={value} onValueChange={onChange}>
      <TabsList className="life-tabs" aria-label="当前功能">
        {items.map((t) => (
          <TabsTrigger value={t.id} key={t.id}>
            {t.label}
            {t.dot && <span className="life-dot" />}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}
function Pane({ value, children }: { value: string; children: ReactNode }) {
  return (
    <TabsContent value={value} className="life-pane">
      {children}
    </TabsContent>
  );
}
function Empty({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="life-empty">
      <Compass />
      <h2>{title}</h2>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function JournalEntries({ s }: { s: G.State }) {
  return (
    <>
      {s.log.map((l, i) => (
        <article key={`${l.time}-${i}`} className={`life-entry ${l.kind}`}>
          <small>
            第 {Math.floor(l.time / 300) + 1} 日 · {duration(l.time % 300)}
          </small>
          <p>{l.text}</p>
        </article>
      ))}
    </>
  );
}
export function ResourceStrip({
  s,
  act,
  go,
}: {
  s: G.State;
  act: Act;
  go: (d: Destination) => void;
}) {
  const p = G.netProduction(s),
    visible = resources.filter((k) => G.resourceVisible(s, k));
  const usage: Record<G.Resource, string> = {
    wood: '用于建筑、装备和工坊加工。建成伐木场并安排伐木工后才有自动产出。',
    food: '供住民日常消耗、招募训练和远征使用。农田建成后可安排农夫。',
    stone: '用于基础建设、装备和冶炼。采石场建成后可安排石匠。',
    gold: '用于招募、训练、锻造与交易。集市建成后可安排商人。',
    iron: '用于高阶建设、装备强化。自动冶炼每产出 1 铁锭消耗 2.5 木材和 5 石料，原料不足会减产。',
    crystal:
      '用于魔法研究、装备与工艺。自动生产每产出 1 魔晶消耗约 3.57 金币，金币不足会减产。',
  };
  return (
    <div
      className="resource-dock"
      aria-label="固定资源与手动采集"
      style={{
        gridTemplateColumns: 'repeat(' + visible.length + ',minmax(0,1fr))',
      }}
    >
      {visible.map((k) => (
        <div className="resource-cell" key={k}>
          <div className="resource-detail">
            <InfoHint
              className="resource-name"
              title={G.RESOURCE_NAMES[k] + ' · 库存与收支'}
              body={
                <>
                  <p>{usage[k]}</p>
                  <p>
                    库存 {number(s.resources[k])} / {G.capacity(s, k)}；净产量{' '}
                    {p[k].toFixed(2)}/秒，按 1 倍速计算，已包含工坊消耗。
                  </p>
                  <p>{G.productionFormula(s, k)}</p>
                  <p>
                    手动{G.MANUAL[k].name} +{G.manualAmount(s, k)}，冷却{' '}
                    {G.MANUAL[k].seconds} 秒；
                    {G.costText(G.MANUAL[k].cost) || '无需材料'}。
                    {G.gatherReason(s, k) || '现在可采集。'}
                  </p>
                  {s.legacyStock[k] > 0 && (
                    <p>
                      封存旧库存 {number(s.legacyStock[k])}，可在有空位时取用。
                    </p>
                  )}
                </>
              }
            >
              {G.RESOURCE_NAMES[k]}
            </InfoHint>
            <strong>
              <button
                className="resource-amount"
                onClick={() => act((x) => G.gather(x, k))}
                aria-label={'点击库存采集' + G.RESOURCE_NAMES[k]}
                aria-disabled={!!G.gatherReason(s, k)}
              >
                {short(s.resources[k])}
              </button>
              <small> / {short(G.capacity(s, k))}</small>
            </strong>
            <span className="resource-rate">
              {p[k] >= 0 ? '+' : ''}
              {p[k].toFixed(2)}
              <small> / 秒</small>
            </span>
          </div>
          <div className="resource-actions">
            <button
              className="resource-gather"
              aria-label={
                G.MANUAL[k].name +
                '，' +
                G.RESOURCE_NAMES[k] +
                '加' +
                G.manualAmount(s, k)
              }
              disabled={!!G.gatherReason(s, k)}
              onClick={() => act((x) => G.gather(x, k))}
            >
              {G.gatherCooldown(s, k) > 0
                ? Math.ceil(G.gatherCooldown(s, k)) + '秒'
                : G.MANUAL[k].name + ' +' + G.manualAmount(s, k)}
            </button>
            {s.legacyStock[k] > 0 && s.resources[k] < G.capacity(s, k) && (
              <button
                className="resource-extra"
                disabled={s.resources[k] >= G.capacity(s, k)}
                onClick={() => act(G.claimLegacyStock)}
                aria-label={'取用封存' + G.RESOURCE_NAMES[k]}
              >
                取旧
              </button>
            )}
            {s.resources[k] >= G.capacity(s, k) &&
              G.buildingDiscovered(s, 'warehouse') && (
                <button
                  className="resource-extra"
                  onClick={() =>
                    go({ view: 'town', tab: 'build', building: 'warehouse' })
                  }
                >
                  扩仓
                </button>
              )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TownPanel({ s, act, go, focus }: Props) {
  const [tab, setTab] = useState(
    focus.tab === 'ledger' ? 'build' : focus.tab || 'build',
  );
  const cool = G.gatherCooldown(s, 'wood');
  if (!s.buildings.fire)
    return (
      <div className="life-opening v7-opening">
        <div
          className={`camp-scene ${s.resources.wood >= 12 ? 'ready' : ''}`}
          aria-hidden="true"
        >
          <div className="camp-moon" />
          <div className="camp-ground" />
          <i className="camp-log" />
          <i className="camp-log second" />
          <i className="camp-flame" />
          <i className="camp-spark" />
          <i className="camp-spark second" />
        </div>
        <div className="life-opening-copy">
          <span className="life-kicker">序章 · 无人之地</span>
          <h2>风里还没有你的名字。</h2>
          <p>
            {s.resources.wood === 0
              ? '你独自醒在断墙下。没有住民，没有收入。附近散落着一些湿冷的枯枝。'
              : s.resources.wood < 12
                ? '你把枯枝一根根拢到避风处。这一点还不够，继续找找。'
                : '枯枝已经够了。现在，你可以亲手点燃它。'}
          </p>
          <div className="opening-stock">
            <span>干燥枯枝</span>
            <strong>{Math.floor(s.resources.wood)} / 12</strong>
            <Meter value={(s.resources.wood / 12) * 100} label="点火材料" />
          </div>
          <div className="opening-actions">
            <button
              className="secondary-button"
              disabled={!!G.gatherReason(s, 'wood')}
              onClick={() => act((x) => G.gather(x, 'wood'))}
            >
              拾取枯枝 · +2{cool > 0 ? `（${Math.ceil(cool)}秒）` : ''}
            </button>
            <button
              className="primary-button"
              disabled={s.paused || !G.canPay(s, G.buildingCost(s, 'fire'))}
              onClick={() => act((x) => G.build(x, 'fire'))}
            >
              <Flame />
              点燃营火 · 12木材
            </button>
          </div>
          <small>先收集，再点火。两项行动分别进行。</small>
        </div>
      </div>
    );
  const items = [
    { id: 'build', label: '建造' },
    ...(s.buildings.market ? [{ id: 'workshop', label: '经营' }] : []),
    ...(s.buildings.hut
      ? [{ id: 'workers', label: '居民', dot: G.idleWorkers(s) > 0 }]
      : []),
    ...(G.REGIONS.some((_, r) => G.discoveryCount(s, r) > 0)
      ? [
          {
            id: 'projects',
            label: '工程',
            dot: G.PROJECTS.some((_, r) => G.projectReady(s, r)),
          },
        ]
      : []),
    ...(s.buildings.market ? [{ id: 'market', label: '集市' }] : []),
    ...(s.event !== null || s.eventDone.length
      ? [{ id: 'events', label: '来访', dot: s.event !== null }]
      : []),
  ];
  return (
    <PaneTabs value={tab} onChange={setTab} items={items}>
      <Pane value="build">
        <BuildingBoard s={s} act={act} go={go} focus={focus} />
      </Pane>
      <Pane value="workshop">
        <EconomyDesk s={s} act={act} go={go} />
      </Pane>
      <Pane value="workers">
        <div className="life-card">
          <div className="life-title">
            <h2>让城镇自己运转</h2>
            <span>
              {s.population}/{G.populationCap(s)} 人 · 空闲 {G.idleWorkers(s)}
            </span>
          </div>
          <div className="life-card-body">
            {!s.population && (
              <p className="resident-intro">
                屋檐下还有空位。你需要亲自采集口粮，接纳愿意留下的人。
              </p>
            )}
            {!resources.some((k) => !G.jobReason(s, k)) && (
              <p className="life-hint">
                目前还没有可工作的设施。住民到来后，先去建造伐木场。
              </p>
            )}
            <div className="life-workers">
              {resources
                .filter((k) => !G.jobReason(s, k))
                .map((k) => {
                  const Icon = icons[k];
                  return (
                    <div key={k}>
                      <Icon />
                      <span>
                        <strong>{G.JOB_NAMES[k]}</strong>
                        <small>
                          {k === 'iron'
                            ? '耗木材、石料'
                            : k === 'crystal'
                              ? '消耗金币'
                              : `产出${G.RESOURCE_NAMES[k]}`}
                        </small>
                      </span>
                      <div className="life-stepper">
                        <button
                          aria-label={`减少${G.JOB_NAMES[k]}`}
                          disabled={!s.jobs[k]}
                          onClick={() =>
                            act((x) => G.assign(x, k, -1), '分工已调整。')
                          }
                        >
                          <Minus />
                        </button>
                        <strong>{s.jobs[k]}</strong>
                        <button
                          aria-label={`增加${G.JOB_NAMES[k]}`}
                          disabled={!G.idleWorkers(s)}
                          onClick={() =>
                            act(
                              (x) => G.assign(x, k, 1),
                              '分工已调整，生产会持续进行。',
                            )
                          }
                        >
                          <Plus />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
            <p className="life-hint">
              {s.pendingSettlers
                ? `${s.pendingSettlers} 位旅人正在等房间。扩建小屋后自动入住。`
                : '住民不会自然消耗口粮。远征和工坊按实际运行扣除补给。'}
            </p>
          </div>
          <div className="life-inline-actions">
            <button
              className="primary-button"
              disabled={
                !s.buildings.hut ||
                s.population >= G.populationCap(s) ||
                s.resources.food < 10
              }
              onClick={() => act(G.hireWorker)}
            >
              收留旅人 · 10 口粮
            </button>
            <button
              className="secondary-button"
              onClick={() => {
                go({ view: 'town', building: 'hut' });
              }}
            >
              扩建小屋
            </button>
          </div>
        </div>
      </Pane>
      <Pane value="projects">
        <EngineeringBoard s={s} act={act} go={go} focus={focus} />
      </Pane>
      <Pane value="market">
        <div className="life-card">
          <div className="life-title">
            <h2>边境集市</h2>
            <span>每份 20 单位</span>
          </div>
          <div className="life-card-body life-market">
            {resources
              .filter((k) => G.tradeUnlocked(s, k))
              .map((k) => (
                <div key={k}>
                  <strong>
                    {G.RESOURCE_NAMES[k]}
                    <small>持有 {short(s.resources[k])}</small>
                  </strong>
                  <button
                    className="secondary-button"
                    disabled={!!G.tradeReason(s, k, true)}
                    onClick={() => act((x) => G.trade(x, k, true))}
                  >
                    {G.tradeReason(s, k, true) ||
                      `买入 · ${G.tradePrice(s, k)} 金`}
                  </button>
                  <button
                    className="secondary-button"
                    disabled={!!G.tradeReason(s, k, false)}
                    onClick={() => act((x) => G.trade(x, k, false))}
                  >
                    {G.tradeReason(s, k, false) ||
                      `卖出 · ${G.tradePrice(s, k, false)} 金`}
                  </button>
                </div>
              ))}
          </div>
          <p className="life-hint">
            商队适合临时补缺。远征与工坊能提供更稳定的材料来源。
          </p>
        </div>
      </Pane>
      <Pane value="events">
        <div className="life-card">
          {s.event !== null ? (
            <>
              <span className="life-kicker">镇口有人等你 · 选择会留下影响</span>
              <h2>{G.EVENTS[s.event].title}</h2>
              <p className="life-prose">{G.EVENTS[s.event].text}</p>
              <div className="life-choices">
                {G.EVENTS[s.event].choices
                  .map((_c, i) => G.visitorChoice(s, i)!)
                  .map((c, i) => (
                    <button
                      key={c.label}
                      disabled={!!G.eventChoiceReason(s, i)}
                      onClick={() => act((x) => G.chooseEvent(x, i))}
                    >
                      <strong>
                        {c.label}
                        <ArrowRight />
                      </strong>
                      <span>{c.detail}</span>
                      {(c.buff || c.equipment) && (
                        <span>{G.costText(c.cost)}</span>
                      )}
                      {c.equipment && s.civic.offer && (
                        <span>
                          <b>
                            {
                              G.RECIPES.find(
                                (r) => r.id === s.civic.offer!.gear.recipe,
                              )!.text
                            }
                          </b>{' '}
                          ·{' '}
                          {Object.entries(G.itemStats(s, s.civic.offer.gear))
                            .filter(([, v]) => v > 0)
                            .map(
                              ([k, v]) =>
                                `${({ attack: '攻击', hp: '生命', defense: '防御', pierce: '穿甲', ranged: '远程', fire: '火抗', shadow: '暗抗', radiant: '神抗', crit: '暴击', dodge: '闪避', critDamage: '暴伤' } as Record<string, string>)[k]} ${['attack', 'hp', 'defense'].includes(k) ? Math.round(v) : Math.round(v * 100) + '%'}`,
                            )
                            .join(' · ')}
                        </span>
                      )}
                      {G.eventChoiceReason(s, i) && (
                        <span className="short">
                          {G.eventChoiceReason(s, i)}
                        </span>
                      )}
                    </button>
                  ))}
              </div>
              {G.EVENTS[s.event].repeat && (
                <button
                  className="life-text-button"
                  onClick={() => act(G.declineVisitor)}
                >
                  谢绝这次交易
                </button>
              )}
            </>
          ) : (
            <Empty
              title="街巷暂时安静"
              text="有些人带来问题，有些人留下新的生活。城镇发展后，会有新的来访。"
            />
          )}
          {s.eventDone.length > 0 && (
            <p className="life-hint">
              已经回应 {s.eventDone.length} 位来访者。你的决定记录在荒野手记中。
            </p>
          )}
        </div>
      </Pane>
    </PaneTabs>
  );
}
export function HeroesPanel(props: Props) {
  return <GuildTeam {...props} />;
}
export function ExplorePanel(props: Props) {
  return props.s.battle ? (
    <BattleDesk s={props.s} act={props.act} />
  ) : (
    <ExploreDesk {...props} />
  );
}
export function DestinyPanel({
  s,
  act,
  go,
  focus,
  onJourney,
}: {
  s: G.State;
  act: Act;
  go: Props['go'];
  focus: Destination;
  onJourney: () => void;
}) {
  const [tab, setTab] = useState(
      focus.tab && focus.tab !== 'research'
        ? focus.tab
        : s.ending
          ? 'rebuild'
          : 'chapters',
    ),
    [chapter, setChapter] = useState(s.lastExpedition?.region ?? 0),
    [rebuild, setRebuild] = useState(
      G.REBUILD.find((r) => !s.rebuild.includes(r.id))?.id || 'homes',
    );
  const p = G.REBUILD.find((p) => p.id === rebuild)!;
  return (
    <PaneTabs
      value={tab}
      onChange={setTab}
      items={[
        { id: 'chapters', label: '旅程' },
        ...(s.ending
          ? [{ id: 'rebuild', label: '人间的明天', dot: s.rebuild.length < 3 }]
          : []),
      ]}
    >
      <Pane value="chapters">
        <div className="life-card">
          <Pick
            label="翻阅章节"
            value={String(chapter)}
            onChange={(v) => setChapter(Number(v))}
            options={G.REGIONS.map((r, i) => ({ r, i }))
              .filter(({ i }) => G.regionVisited(s, i))
              .map(({ r, i }) => ({
                value: String(i),
                label: `第 ${i + 1} 章 · ${r.name}`,
              }))}
          />
          <span className="life-kicker">
            {s.cleared.includes(chapter) ? '已经写下的故事' : '未尽的旅程'}
          </span>
          <h2>{G.REGIONS[chapter].name}</h2>
          <p className="life-prose">
            {s.cleared.includes(chapter)
              ? G.REGIONS[chapter].story
              : G.REGIONS[chapter].desc}
          </p>
          <div className="life-vows">
            {[
              { r: 3, text: '击败魔王' },
              { r: 4, text: '屠灭古龙' },
              { r: 5, text: '凡人弑神' },
            ]
              .filter((v) => G.regionOpen(s, v.r))
              .map((v) => (
                <span key={v.r}>
                  {s.cleared.includes(v.r) ? <Check /> : <Swords />}
                  {v.text}
                </span>
              ))}
          </div>
          <button
            className="secondary-button"
            disabled={!G.regionOpen(s, chapter)}
            onClick={() => go({ view: 'explore', region: chapter })}
          >
            走进这片土地
            <ArrowRight />
          </button>
        </div>
      </Pane>
      <Pane value="rebuild">
        <div className="life-card">
          <Pick
            label="选择战后重建"
            value={p.id}
            onChange={setRebuild}
            options={G.REBUILD.map((p) => ({
              value: p.id,
              label: `${p.name}${s.rebuild.includes(p.id) ? ' · 已完成' : ''}`,
            }))}
          />
          <div className="life-card-body">
            <span className="life-kicker">
              尾声 · 战后重建 {s.rebuild.length}/3
            </span>
            <h2>{p.name}</h2>
            <p className="life-prose">
              {s.rebuild.includes(p.id) ? p.story : p.desc}
            </p>
            {p.id === 'roads' && !s.rebuild.includes(p.id) && (
              <div className="life-requirements">
                {G.REGIONS.map((r, i) => (
                  <button
                    key={r.name}
                    onClick={() => go({ view: 'explore', region: i })}
                  >
                    {s.peaceRuns[i] ? <Check /> : <Compass />}
                    {r.name}
                  </button>
                ))}
              </div>
            )}
            <p className="life-effect">
              你没有坐上神座。镇子的第一口锅仍在火上，伙伴们替你留着一碗热汤。
            </p>
          </div>
          {s.rebuild.length === 3 ? (
            <>
              <button className="primary-button" onClick={onJourney}>
                带着手艺，再走一程
                <ArrowRight />
              </button>
              <p className="life-hint">
                也可以继续生活在这里。新旅程永久生产加成 +10%，最高 50%。
              </p>
            </>
          ) : s.rebuild.includes(p.id) ? (
            <p className="life-effect">
              <Check />
              重建已经完成，镇子多了一种新的生活。
            </p>
          ) : (
            <Buy
              s={s}
              cost={p.cost}
              reason={G.rebuildReason(s, p.id)}
              label="完成这项重建"
              onClick={() => act((x) => G.rebuildTown(x, p.id))}
            />
          )}
        </div>
      </Pane>
    </PaneTabs>
  );
}
