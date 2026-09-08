'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Flame,
  Castle,
  Users,
  Compass,
  BookOpen,
  Settings,
  Pause,
  Play,
  Download,
  Upload,
  ArrowRight,
  ChevronRight,
  HelpCircle,
  RotateCcw,
  Check,
  Sun,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import * as G from '@/lib/realm';
import { InfoHint } from '@/components/info-hint';
import { GrowthChoices } from '@/components/economy-desk';
import { RecruitmentBoard, ResearchBoard } from '@/components/economy-panels';
import {
  TownPanel,
  HeroesPanel,
  ExplorePanel,
  DestinyPanel,
  ResourceStrip,
  JournalEntries,
  duration,
  number,
  type Destination,
} from '@/components/realm-panels';
const SAVE = 'ember-realm-save-v2',
  OLD = 'ember-realm-save-v1';
const NAV = [
  { id: 'town' as const, name: '城镇', icon: Castle },
  { id: 'recruit' as const, name: '招募', icon: Users },
  { id: 'heroes' as const, name: '队伍', icon: Users },
  { id: 'explore' as const, name: '远征', icon: Compass },
  { id: 'research' as const, name: '研究', icon: BookOpen },
  { id: 'destiny' as const, name: '手札', icon: BookOpen },
];
type Welcome = {
  seconds: number;
  trips: number;
  gains: G.Cost;
  message: string;
};
export default function Home() {
  const [s, setS] = useState(() => G.freshState(0)),
    ref = useRef(s),
    [ready, setReady] = useState(false),
    writable = useRef(false),
    [view, setView] = useState<G.View>('town'),
    [focus, setFocus] = useState<Destination & { nonce: number }>({
      view: 'town',
      nonce: 0,
    });
  const [storyScene, setStoryScene] = useState<string | null>(null);
  const [journal, setJournal] = useState(false),
    [settings, setSettings] = useState(false),
    [help, setHelp] = useState(false),
    [reset, setReset] = useState<'reset' | 'journey' | null>(null),
    [welcome, setWelcome] = useState<Welcome | null>(null),
    [loadError, setLoadError] = useState(''),
    [badRaw, setBadRaw] = useState(''),
    [notice, setNotice] = useState('先让第一簇火亮起来。'),
    [saveStatus, setSaveStatus] = useState('正在读取手记');
  const fileRef = useRef<HTMLInputElement>(null),
    lastTick = useRef(0);
  function commit(next: G.State, showStory = true) {
    if (writable.current && showStory) {
      const discovered = next.chronicle.filter(
        (id) => !ref.current.chronicle.includes(id),
      );
      if (discovered.length) setStoryScene(discovered.at(-1)!);
    }
    ref.current = next;
    setS(next);
  }
  function persist(next: G.State) {
    if (!writable.current) return false;
    try {
      localStorage.setItem(
        SAVE,
        JSON.stringify({ ...next, savedAt: Date.now() }),
      );
      setSaveStatus('已保存');
      return true;
    } catch {
      setSaveStatus('保存失败，请导出');
      return false;
    }
  }
  function go(d: Destination) {
    if (d.view === 'destiny' && d.tab === 'research')
      d = { ...d, view: 'research' };
    if (d.view === 'heroes' && !ref.current.heroes.length)
      d = { ...d, view: 'recruit' };
    if (d.view === 'explore' && d.region !== undefined) {
      const next = G.rememberMap(ref.current, d.region);
      if (next !== ref.current) {
        commit(next, false);
        persist(next);
      }
    }
    setView(d.view);
    setFocus({ ...d, nonce: Date.now() });
  }
  function act(fn: (s: G.State) => G.State, message?: string) {
    if (!ready) return;
    const before = ref.current,
      next = G.settleStory(fn(before));
    if (next === before) {
      setNotice('尚未满足条件，请查看操作旁的说明。');
      return;
    }
    commit(next);
    persist(next);
    setNotice(
      message ||
        ((next.battle?.actionCount ?? 0) > (before.battle?.actionCount ?? 0)
          ? next.battle?.history[0]
          : next.log[0]?.text) ||
        '安排已完成。',
    );
    if (next.ending && !before.ending) go({ view: 'destiny', tab: 'rebuild' });
  }
  function download(raw: string, name: string) {
    const url = URL.createObjectURL(
        new Blob([raw], { type: 'application/json' }),
      ),
      a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportSave() {
    download(
      JSON.stringify({ ...ref.current, savedAt: Date.now() }, null, 2),
      `余烬之境-第${G.day(ref.current)}日.json`,
    );
  }
  function backup() {
    try {
      const current = localStorage.getItem(SAVE) || localStorage.getItem(OLD);
      if (current) localStorage.setItem('ember-realm-before-restart', current);
    } catch {}
  }
  function beginFresh(journey = false) {
    backup();
    const next = journey ? G.newJourney(ref.current) : G.freshState();
    writable.current = true;
    commit(next);
    setReady(true);
    lastTick.current = Date.now();
    persist(next);
    setLoadError('');
    setReset(null);
    setSettings(false);
    go({ view: 'town' });
    setNotice(
      journey
        ? '旧日的手艺留下来，新的故事开始了。'
        : '新的星空下，第一簇火还在等待你。',
    );
  }
  async function importSave(file?: File) {
    if (!file) return;
    try {
      const raw = await file.text(),
        next = G.settleStory(G.decodeSave(raw));
      backup();
      next.savedAt = Date.now();
      writable.current = true;
      commit(next, false);
      setReady(true);
      lastTick.current = Date.now();
      persist(next);
      setSettings(false);
      setLoadError('');
      go({
        view: next.battle ? 'explore' : 'town',
        region: next.battle?.region,
      });
      setNotice('手记已经载入，故事继续。');
    } catch (e) {
      setNotice(
        `导入失败：${e instanceof Error ? e.message : '文件格式有误'}。当前进度保持不变。`,
      );
    }
    if (fileRef.current) fileRef.current.value = '';
  }
  useEffect(() => {
    let disposed = false;
    // Hydrate once from browser storage after the server render; cancel stale mounts.
    queueMicrotask(() => {
      if (disposed) return;
      try {
        const v2 = localStorage.getItem(SAVE),
          old = v2 ? null : localStorage.getItem(OLD),
          raw = v2 || old;
        setBadRaw(raw || '');
        let loaded = raw ? G.decodeSave(raw) : G.freshState();
        if (
          raw &&
          [2, 3, 4, 5].includes(JSON.parse(raw).version) &&
          !localStorage.getItem(
            `ember-realm-save-v${JSON.parse(raw).version}-backup`,
          )
        )
          localStorage.setItem(
            `ember-realm-save-v${JSON.parse(raw).version}-backup`,
            raw,
          );
        if (raw && !old) setNotice('欢迎回来。手记已载入，小镇的故事继续。');
        if (old) {
          try {
            if (!localStorage.getItem('ember-realm-save-v1-backup'))
              localStorage.setItem('ember-realm-save-v1-backup', old);
          } catch {}
          setNotice('旧手记已迁入。城镇与已完成章节保留，原版手记也仍在。');
        }
        const seconds =
          raw && !loaded.paused
            ? Math.min(
                G.MAX_OFFLINE,
                Math.max(0, (Date.now() - loaded.savedAt) / 1000),
              )
            : 0;
        if (seconds > 15) {
          const before = loaded;
          loaded = G.advance(loaded, seconds);
          const gains = Object.fromEntries(
            Object.keys(loaded.resources).map((k) => [
              k,
              loaded.resources[k as G.Resource] -
                before.resources[k as G.Resource],
            ]),
          );
          setWelcome({
            seconds,
            trips:
              loaded.explored.reduce((a, b) => a + b, 0) -
              before.explored.reduce((a, b) => a + b, 0),
            gains,
            message: loaded.order.enabled
              ? loaded.order.reason || '持续委托仍在执行。'
              : '队伍正在镇内休息。',
          });
        } else loaded = G.advance(loaded, seconds);
        loaded = G.settleStory(loaded);
        commit(loaded);
        writable.current = true;
        setReady(true);
        if (loaded.battle)
          go({ view: 'explore', region: loaded.battle.region });
        persist(loaded);
      } catch (e) {
        writable.current = false;
        setLoadError(
          `手记暂时无法读取：${e instanceof Error ? e.message : '浏览器存储不可用'}。原始文件没有被覆盖。`,
        );
        setSaveStatus('等待恢复手记');
      }
    });
    lastTick.current = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now(),
        elapsed = Math.max(0, (now - lastTick.current) / 1000);
      lastTick.current = now;
      if (!writable.current) return;
      const current = ref.current,
        next = G.advance(current, elapsed * (elapsed > 10 ? 1 : current.speed));
      if (next !== current) {
        commit(next);
        if (
          next.lastBattle !== current.lastBattle &&
          JSON.stringify(next.lastBattle) !== JSON.stringify(current.lastBattle)
        )
          setNotice(next.log[0]?.text || '战斗已结束。');
      }
    }, 500);
    const autosave = window.setInterval(() => persist(ref.current), 5000);
    const save = () => persist(ref.current);
    window.addEventListener('pagehide', save);
    const visibility = () => {
      if (document.hidden) save();
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      disposed = true;
      clearInterval(timer);
      clearInterval(autosave);
      window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  useEffect(() => {
    const context = (
      document as unknown as {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => unknown;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController(),
      tools = [
        {
          name: 'read_ember_realm',
          description:
            'Read the town, continuous expedition order, party and next objective.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true },
          execute: () => ({
            resources: ref.current.resources,
            order: ref.current.order,
            expedition: ref.current.expedition,
            party: G.partyStats(ref.current),
            objective: G.objective(ref.current),
            cleared: ref.current.cleared,
          }),
        },
        {
          name: 'gather_ember_resources',
          description:
            'Manually gather wood, food or stone, each with its own 3-second cooldown and storage limit.',
          inputSchema: {
            type: 'object',
            properties: {
              resource: { type: 'string', enum: ['wood', 'food', 'stone'] },
            },
            required: ['resource'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false },
          execute: async (input: unknown) => {
            if (!writable.current) throw Error('先恢复手记');
            const resource = (input as { resource?: G.Resource })?.resource;
            if (!resource || !['wood', 'food', 'stone'].includes(resource))
              throw Error('请选择木材、口粮或石料');
            const next = G.gather(ref.current, resource);
            if (next === ref.current) throw Error('采集仍在冷却，或时间已暂停');
            commit(next);
            persist(next);
            await new Promise<void>((r) => requestAnimationFrame(() => r()));
            return { resource, amount: next.resources[resource] };
          },
        },
      ];
    for (const tool of tools)
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: controller.signal }),
        ).catch(() => {});
      } catch {}
    return () => controller.abort();
  }, []);
  const goal = G.objective(s),
    e = s.expedition,
    stage = s.buildings.fire ? G.TOWN_RANK_NAMES[G.townRank(s)] : '无人之地';
  return (
    <Tabs
      value={view}
      onValueChange={(v) => {
        setView(v as G.View);
        setFocus({ view: v as G.View, nonce: Date.now() });
      }}
      orientation="vertical"
      className="life-shell v7-ui v8-ui v9-ui"
    >
      <header className="life-topbar">
        <button className="life-brand" onClick={() => go({ view: 'town' })}>
          <Flame />
          <span>
            余烬之境<small>THE EMBER REALM</small>
          </span>
        </button>
        <span className="life-world">
          <Sun />第 {G.day(s)} 日 <span>· {stage}</span>
        </span>
        <div className="life-tools">
          <span>{saveStatus}</span>
          <button aria-label="查看荒野手记" onClick={() => setJournal(true)}>
            <BookOpen />
          </button>
          <button aria-label="打开游戏设置" onClick={() => setSettings(true)}>
            <Settings />
          </button>
        </div>
      </header>
      <div className="life-layout">
        <aside className="life-nav">
          <span className="life-kicker">领主议事厅</span>
          <TabsList className="life-nav-list" aria-label="游戏区域">
            {NAV.filter((n) => G.viewDiscovered(s, n.id)).map((n) => (
              <TabsTrigger value={n.id} key={n.id}>
                <n.icon />
                {n.name}
                {n.id === 'explore' && (e || s.battle) && (
                  <span className="life-dot" />
                )}
              </TabsTrigger>
            ))}
          </TabsList>
          {G.regionOpen(s, 3) || G.regionOpen(s, 4) ? (
            <div className="life-oaths">
              <span className="life-kicker">三重誓愿</span>
              {[
                { r: 3, t: '击败魔王' },
                { r: 4, t: '屠灭古龙' },
                { r: 5, t: '凡人弑神' },
              ]
                .filter((q) => G.regionOpen(s, q.r))
                .map((q) => (
                  <span key={q.r}>
                    {s.cleared.includes(q.r) ? (
                      <Check />
                    ) : (
                      <span className="life-ring" />
                    )}
                    {q.t}
                  </span>
                ))}
            </div>
          ) : null}
          <button className="life-help-button" onClick={() => setHelp(true)}>
            <HelpCircle />
            旅人指南
          </button>
        </aside>
        <main className="life-main">
          <div className="life-heading">
            <div>
              <span className="life-kicker">
                {
                  [
                    '异乡的第一夜',
                    '钟声之外',
                    '断旗与归人',
                    '永夜将尽',
                    '龙眠之地',
                    '向神举剑',
                    '人间的明天',
                  ][s.cleared.length]
                }
              </span>
              <h1>
                {view === 'town'
                  ? '余烬镇'
                  : NAV.find((n) => n.id === view)!.name}
              </h1>
            </div>
            <span className="life-pill">
              {G.TOWN_RANK_NAMES[G.townRank(s)]}
              {G.hasReturned(s)
                ? ` · 已平定 ${s.cleared.length} 片地区`
                : ''}{' '}
              {s.legacy > 0 ? `· 传承 +${s.legacy * 5}%` : ''}
            </span>
          </div>
          {s.buildings.fire > 0 && <ResourceStrip s={s} act={act} go={go} />}
          {G.activeBuffs(s).length > 0 && (
            <div className="civic-buff-strip" aria-label="限时增益">
              {G.activeBuffs(s).map((b) => (
                <InfoHint
                  key={b.id}
                  title={b.name}
                  body={`${b.text}；剩余 ${Math.floor(b.remaining / 60)} 分 ${b.remaining % 60} 秒。同类效果刷新至10分钟，不叠加倍率；暂停时停止计时，离线照常结算。`}
                >
                  <span>
                    {b.name} · {Math.floor(b.remaining / 60)}:
                    {String(b.remaining % 60).padStart(2, '0')}
                  </span>
                </InfoHint>
              ))}
            </div>
          )}
          {s.buildings.fire > 0 && (
            <button className="life-objective" onClick={() => go(goal)}>
              <span>
                <small>接下来</small>
                <strong>{goal.title}</strong>
                <span>{goal.detail}</span>
              </span>
              <ArrowRight />
            </button>
          )}
          {!(view === 'explore' && s.battle) && <GrowthChoices s={s} go={go} />}
          {(e || s.order.enabled) && view !== 'explore' && (
            <div className="life-activity">
              {e && (
                <button onClick={() => act(G.recallExpedition)}>
                  立即撤回
                </button>
              )}
              <button
                onClick={() =>
                  go({ view: 'explore', region: e?.region ?? s.order.region })
                }
              >
                <Compass />
                <span>
                  {e
                    ? `${G.REGIONS[e.region].name} · ${duration(e.end - s.time)} 归来`
                    : s.order.reason || '等待下一次出发'}
                </span>
                <ChevronRight />
              </button>
              <button
                onClick={() =>
                  s.order.enabled
                    ? act(
                        (x) => G.setOrder(x, { enabled: false }),
                        '本次归来后休息。',
                      )
                    : go({
                        view: 'explore',
                        region: s.expedition?.region ?? s.order.region,
                        tab: 'mission',
                        route: s.expedition?.route ?? s.order.route,
                      })
                }
              >
                {s.order.enabled ? '归来后休息' : '调整下一次出发'}
              </button>
            </div>
          )}
          <TabsContent value="town" className="life-view">
            <TownPanel
              key={'town' + focus.nonce}
              s={s}
              act={act}
              go={go}
              focus={focus}
            />
          </TabsContent>
          <TabsContent value="heroes" className="life-view">
            <HeroesPanel
              key={'heroes' + focus.nonce}
              s={s}
              act={act}
              go={go}
              focus={focus}
            />
          </TabsContent>
          <TabsContent value="recruit" className="life-view">
            <RecruitmentBoard s={s} act={act} go={go} />
          </TabsContent>
          <TabsContent value="research" className="life-view">
            <ResearchBoard
              key={'research' + focus.nonce}
              s={s}
              act={act}
              focus={focus}
            />
          </TabsContent>
          <TabsContent value="explore" className="life-view">
            <ExplorePanel
              key={'explore' + focus.nonce}
              s={s}
              act={act}
              go={go}
              focus={focus}
            />
          </TabsContent>
          <TabsContent value="destiny" className="life-view">
            <DestinyPanel
              key={'destiny' + focus.nonce}
              s={s}
              act={act}
              go={go}
              focus={focus}
              onJourney={() => setReset('journey')}
            />
          </TabsContent>
          <button className="life-notice" onClick={() => setJournal(true)}>
            <span className="life-dot" />
            <output>{notice}</output>
            <ChevronRight />
          </button>
        </main>
      </div>
      <footer className="life-footer">
        <span>一簇营火，也能照亮诸神黄昏。</span>
        <div className="life-time">
          <button
            disabled={!ready}
            onClick={() =>
              act(
                (x) => ({ ...x, paused: !x.paused }),
                s.paused ? '时间继续。' : '时间已暂停，离线也不再结算。',
              )
            }
          >
            {s.paused ? <Play /> : <Pause />}
            {s.paused ? '继续' : '暂停'}
          </button>
          {([1, 3] as const).map((v) => (
            <button
              key={v}
              disabled={!ready}
              aria-pressed={s.speed === v}
              onClick={() =>
                act((x) => ({ ...x, speed: v }), `时间调整为 ${v} 倍速。`)
              }
            >
              {v}×
            </button>
          ))}
        </div>
        <button onClick={() => setHelp(true)}>
          <HelpCircle />
          玩法
        </button>
      </footer>
      <Dialog
        open={storyScene !== null}
        onOpenChange={(v) => {
          if (!v) setStoryScene(null);
        }}
      >
        <DialogContent className="life-dialog story-discovery">
          <DialogTitle>
            {G.STORY_BEATS.find((b) => b.id === storyScene)?.title}
          </DialogTitle>
          <DialogDescription>
            这一天，小镇多了一件值得记住的事。
          </DialogDescription>
          <p>{G.STORY_BEATS.find((b) => b.id === storyScene)?.text}</p>
          <p className="discovery-unlocks">
            {G.STORY_BEATS.find((b) => b.id === storyScene)?.unlocks}
          </p>
          <button
            className="primary-button"
            onClick={() => {
              setStoryScene(null);
              go(G.objective(ref.current));
            }}
          >
            {G.objective(s).title}
            <ArrowRight />
          </button>
        </DialogContent>
      </Dialog>
      <Dialog open={journal} onOpenChange={setJournal}>
        <DialogContent className="life-dialog life-log-dialog">
          <DialogTitle>荒野手记</DialogTitle>
          <DialogDescription>{notice}</DialogDescription>
          <div className="life-dialog-scroll">
            {G.STORY_BEATS.filter((b) => s.chronicle.includes(b.id)).map(
              (b) => (
                <details className="chronicle-entry" key={b.id}>
                  <summary>{b.title}</summary>
                  <p>{b.text}</p>
                  <small>新发现：{b.unlocks}</small>
                </details>
              ),
            )}
            <JournalEntries s={s} />
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={settings} onOpenChange={setSettings}>
        <DialogContent className="life-dialog">
          <DialogTitle>领主的手记</DialogTitle>
          <DialogDescription>
            自动保存于当前浏览器。导出手记可备份或带到免安装版继续游玩。
          </DialogDescription>
          <p>
            第 {G.day(s)} 日 · {stage} · {s.cleared.length}/6 章
          </p>
          <div className="life-inline-actions">
            <button
              className="primary-button"
              onClick={exportSave}
              disabled={!ready}
            >
              <Download />
              导出手记
            </button>
            <button
              className="secondary-button"
              onClick={() => fileRef.current?.click()}
            >
              <Upload />
              导入手记
            </button>
          </div>
          <p className="life-hint">
            离线最多结算 8 小时，满仓即停。以 1
            倍速生产和连续远征。首领战等待你操作。导入前会保留当前进度的本地恢复副本。
          </p>
          <div className="life-inline-actions">
            <button
              className="secondary-button"
              onClick={() => {
                setSettings(false);
                setHelp(true);
              }}
            >
              查看旅人指南
            </button>
            <button
              className="life-text-button"
              onClick={() => setReset('reset')}
            >
              <RotateCcw />
              重新开局
            </button>
          </div>
          <button
            className="life-text-button"
            onClick={() => {
              try {
                const raw =
                  localStorage.getItem('ember-realm-before-restart') ||
                  localStorage.getItem('ember-realm-save-v4-backup') ||
                  localStorage.getItem('ember-realm-save-v3-backup') ||
                  localStorage.getItem('ember-realm-save-v2-backup') ||
                  localStorage.getItem('ember-realm-save-v1-backup') ||
                  localStorage.getItem(OLD);
                if (raw) download(raw, '余烬之境-历史恢复副本.json');
                else setNotice('目前还没有生成历史恢复副本。');
              } catch {
                setNotice('浏览器存储不可用，请导出现有手记。');
              }
            }}
          >
            导出历史恢复副本
          </button>
        </DialogContent>
      </Dialog>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => void importSave(e.target.files?.[0])}
      />
      <AlertDialog
        open={reset !== null}
        onOpenChange={(v) => {
          if (!v) setReset(null);
        }}
      >
        <AlertDialogContent className="life-dialog">
          <AlertDialogTitle>
            {reset === 'journey' ? '带着手艺，再走一程？' : '让故事从头开始？'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {reset === 'journey'
              ? `新旅程重新展开六章，保留额外10%基础生产加成（最高50%），并按本次经营积累传承。下一轮工业传承 ${G.inheritancePreview(s).industry}/10、教范传承 ${G.inheritancePreview(s).scholarship}/10、拓荒传承 ${G.inheritancePreview(s).exploration}/10，分别提高生产、经验与后勤。有工业传承时保留生产方式和库存控制的操作权限及设置；设施和物资仍需重建。这是有限的重玩加速，也可继续经营当前城镇。`
              : '当前城镇和伙伴会被新旅程替换。浏览器会尝试保留一份恢复副本；你也可以先导出手记。'}
          </AlertDialogDescription>
          <div className="life-inline-actions">
            <AlertDialogCancel>留在这里</AlertDialogCancel>
            <AlertDialogAction onClick={() => beginFresh(reset === 'journey')}>
              确认开始新旅程
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={welcome !== null}
        onOpenChange={(v) => {
          if (!v) setWelcome(null);
        }}
      >
        <DialogContent className="life-dialog">
          <DialogTitle>你离开时，小镇依然醒着</DialogTitle>
          <DialogDescription>
            结算 {welcome ? duration(welcome.seconds) : ''} 的生产与委托，最多 8
            小时，按 1 倍速计算。满仓后停止对应产出；工坊不会空耗原料。
          </DialogDescription>
          {welcome && (
            <>
              <div className="life-return-gains">
                {Object.entries(welcome.gains)
                  .filter(([, v]) => Math.abs(v!) >= 1)
                  .map(([k, v]) => (
                    <span key={k}>
                      {G.RESOURCE_NAMES[k as G.Resource]}
                      <strong>
                        {v! >= 0 ? '+' : '−'}
                        {number(Math.abs(v!))}
                      </strong>
                    </span>
                  ))}
              </div>
              <p>
                小队完成了 <strong>{welcome.trips}</strong> 次往返。
              </p>
              <p className="life-hint">{welcome.message}</p>
              <button
                className="primary-button"
                onClick={() => setWelcome(null)}
              >
                回到镇子里
                <ArrowRight />
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!loadError} onOpenChange={() => {}}>
        <DialogContent className="life-dialog" showCloseButton={false}>
          <DialogTitle>先保管好这份手记</DialogTitle>
          <DialogDescription>{loadError}</DialogDescription>
          <div className="life-inline-actions">
            <button
              className="primary-button"
              onClick={() => fileRef.current?.click()}
            >
              导入有效备份
            </button>
            <button
              className="secondary-button"
              disabled={!badRaw}
              onClick={() => download(badRaw, '余烬之境-原始手记.json')}
            >
              导出原始文件
            </button>
          </div>
          <button
            className="life-text-button"
            onClick={() => {
              setLoadError('');
              setReset('reset');
            }}
          >
            保留原始文件，重新开局
          </button>
        </DialogContent>
      </Dialog>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="life-dialog life-guide">
          <DialogTitle>从第一夜，到人间的明天</DialogTitle>
          <DialogDescription>
            先建立供给，再委托冒险。偶尔回来做一个真正改变城镇的决定。
          </DialogDescription>
          <ol>
            {s.buildings.fire > 0 && (
              <li>
                <strong>让小镇接过你的工作</strong>
                <p>
                  点火后建小屋、收留住民、安排分工。木材、石料和口粮是早期基础；集市提供金币。顶部采集按钮各自冷却
                  3
                  秒，研究工具可提高采集量。满仓会停止增产，扩建仓库可继续积累。
                </p>
              </li>
            )}
            {G.viewDiscovered(s, 'recruit') && (
              <li>
                <strong>让伙伴自己往返</strong>
                <p>
                  酒馆每批迎来随机旅人，按职业与实际资质挑选同行者。潜力决定每级成长，五星系数为一星的
                  3.6
                  倍；三项资质独立随机，天赋、缺点和装备影响用途。远征先选择调查、推进或补给，再检查并确认派遣；需要时可勾选归来后重复。
                </p>
              </li>
            )}
            {G.hasReturned(s) && (
              <li>
                <strong>让发现改变城镇</strong>
                <p>
                  带回样品后，研究页会出现新手艺；发展城镇、改进产线，再用这些产物武装同行者。已经走过的地区可以持续供料。有效战力达到地区基准
                  2 倍，远征必定成功。
                </p>
              </li>
            )}
            {s.guild.depths.some((n) => n >= 4) && (
              <li>
                <strong>读懂敌人，再行动</strong>
                <p>
                  重甲怕穿甲，龙息需要火抗，神罚需要神抗。先在备战中推演，再决定阵容、装备、药剂与姿态。首领提前显示行动，破势可打断，坚守抵挡重击；第31回合起逐步狂怒。
                </p>
              </li>
            )}
            {s.ending && (
              <li>
                <strong>把故事写到生活里</strong>
                <p>
                  击败魔王、古龙与神明后，还有三项重建。全部完成后可选择带着生产加成再走一程，也可以留在完整的城镇里。
                </p>
              </li>
            )}
          </ol>
          <p className="life-hint">
            时间支持 1× / 3×，离线按 1× 结算，最多 8
            小时。暂停会同时停止离线收益。没有死亡删档。
          </p>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
