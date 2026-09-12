import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as G from '../lib/realm.ts';
import * as S from '../lib/site-exploration.ts';
import * as F from '../lib/site-economy.ts';
import * as R from '../lib/relics.ts';

// These six checkpoints were earned by campaign-economy.mjs through public actions.
// Each chapter is an independent continuation, not one continuous speedrun.
const source = new URL('../.test-results/v030-standard-balanced/fixtures.json', import.meta.url);
const output = new URL('../.test-results/v030-world-playthrough/', import.meta.url);
mkdirSync(output, { recursive: true });
const sourceText = readFileSync(source, 'utf8');
const fixtures = JSON.parse(sourceText);
const hash = (v) => createHash('sha256').update(v).digest('hex');
const coreHashes = () => Object.fromEntries(readdirSync(new URL('../lib/', import.meta.url)).filter((n) => n.endsWith('.ts')).sort().map((n) => [n, hash(readFileSync(new URL(`../lib/${n}`, import.meta.url)))]));
const report = {
  source: source.pathname, sourceHash: hash(sourceText), coreBefore: coreHashes(),
  policy: 'Six independent continuations of legally earned pre-boss chapter checkpoints. Only public state-to-state actions and G.advance; no resources, discoveries, flags, or combat results injected. Both facility modes must actually produce one batch. Simulated game seconds are not measured human playtime. Existing stock and production at each checkpoint are preserved until explicit public management actions change them.',
  accounting: 'Direct action expenses are exact negative stock deltas. Advance stock changes are net of ordinary production, upkeep, processing and facility batches; facility quotes are separately recorded. First relic awards and facility batches are checked from durable state.',
  chapters: [], failures: [],
};
const endStates = [];
let s, chapter;
const stock = () => ({ resources: { ...s.resources }, materials: { ...s.world.materials }, potions: { ...s.guild.potions } });
function delta(before, after) {
  return Object.fromEntries(['resources', 'materials', 'potions'].map((group) => [group, Object.fromEntries(Object.keys(before[group]).filter((key) => Math.abs(after[group][key] - before[group][key]) > 1e-8).map((key) => [key, after[group][key] - before[group][key]]))]));
}
function action(label, fn, required = true) {
  const old = s, original = JSON.stringify(s), before = stock();
  s = fn(s);
  assert.equal(JSON.stringify(old), original, `${label} mutated its input`);
  if (required) assert.notEqual(s, old, `Blocked action: ${label}`);
  if (s !== old) chapter.actions.push({ time: s.time, label, delta: delta(before, stock()) });
  return s !== old;
}
function wait(seconds, purpose) {
  assert.ok(seconds >= 0 && seconds <= 7200, `Bounded wait: ${purpose}`);
  let left = Math.ceil(seconds);
  while (left > 0) {
    const n = Math.min(5, left), before = stock(), time = s.time;
    action(`时钟:${purpose}`, (x) => G.advance(x, n));
    chapter.waits.push({ time, seconds: n, purpose, delta: delta(before, stock()) });
    left -= n;
  }
}
function ensureResource(id, amount) {
  assert.ok(amount <= G.capacity(s, id), `仓储不足 ${id}: ${amount}`);
  for (let i = 0; s.resources[id] + 1e-8 < amount && i < 600; i++) {
    if (id !== 'gold' && !G.tradeReason(s, id, true, 1)) {
      action(`集市补给:${id}`, (x) => G.trade(x, id, true, Math.ceil((amount - s.resources[id]) / G.TRADE_BATCH_SIZE)));
    } else if (!G.gatherReason(s, id)) action(`手采补给:${id}`, (x) => G.gather(x, id));
    else wait(5, `补给:${id}`);
  }
  assert.ok(s.resources[id] + 1e-8 >= amount, `无法获得资源 ${id}`);
}
function ensureMaterial(id, amount, depth = 0) {
  assert.ok(depth < 8, '材料依赖不应成环');
  assert.ok(G.materialDiscovered(s, id), `未发现材料 ${id}`);
  if (s.world.materials[id] + 1e-8 >= amount) return;
  if (G.WORK_IDS.includes(id)) {
    const def = G.WORK_RECIPES.find((r) => r.id === id);
    assert.ok(s.world.tech.includes(def.tech), `加工门槛 ${def.tech}`);
    if (G.stockControlsUnlocked(s)) action(`加工目标:${id}`, (x) => G.setWorkTarget(x, id, 1), false);
    for (let i = 0; s.world.materials[id] + 1e-8 < amount && i < 120; i++) {
      const q = G.processingQuote(s, id);
      ensureBill(q, depth + 1);
      assert.equal(G.workReason(s, id), '', `${id}加工可执行`);
      if (!s.world.work[id]) action(`加工开工:${id}`, (x) => G.toggleWork(x, id, true));
      wait(Math.ceil(q.seconds + 1), `加工:${id}`);
    }
    if (s.world.work[id]) action(`加工停工:${id}`, (x) => G.toggleWork(x, id, false));
  } else {
    const r = G.REGION_MATERIALS.indexOf(id), route = s.economy.routes[r];
    assert.ok(route?.level, `没有真实材料路线 ${id}`);
    if (!route.crew) { freeWorker(); action(`调配搬运:${id}`, (x) => G.assignRoute(x, r, 1)); }
    if (!s.economy.routes[r].enabled) {
      for (let other = 0; other < 6; other++) if (other !== r && s.economy.routes[other].enabled) action(`暂缓供给:${other}`, (x) => G.toggleRoute(x, other));
      action(`启动供给:${id}`, (x) => G.toggleRoute(x, r));
    }
    for (let i = 0; s.world.materials[id] + 1e-8 < amount && i < 360; i++) {
      ensureBill({ cost: G.routeUpkeep(s, r), materials: {} }, depth + 1);
      wait(10, `运输:${id}`);
    }
  }
  assert.ok(s.world.materials[id] + 1e-8 >= amount, `无法获得材料 ${id}`);
}
function ensureBill(q, depth = 0) {
  for (const [id, n] of Object.entries(q.materials || {})) ensureMaterial(id, n, depth);
  for (const [id, n] of Object.entries(q.cost || {})) ensureResource(id, n);
}
function freeWorker() {
  if (G.idleWorkers(s) > 0) return;
  const job = Object.keys(s.jobs).sort((a, b) => s.jobs[b] - s.jobs[a])[0];
  assert.ok(s.jobs[job] > 0, '存在可调配的生产岗位');
  action(`腾出岗位:${job}`, (x) => G.assign(x, job, -1));
}
function basicRoom(id, amount) {
  if (G.capacity(s, id) - s.resources[id] + 1e-8 >= amount) return;
  assert.notEqual(id, 'gold', '设施不产金币');
  for (let i = 0; G.capacity(s, id) - s.resources[id] + 1e-8 < amount && i < 12; i++) {
    if (G.tradeReason(s, id, false)) {
      const buy = Object.keys(G.RESOURCE_NAMES).find((k) => k !== 'gold' && !G.tradeReason(s, k, true));
      assert.ok(buy, `满仓物资无法卖出 ${id}`);
      action(`集市腾金仓:${buy}`, (x) => G.trade(x, buy, true));
    }
    action(`集市腾仓:${id}`, (x) => G.trade(x, id, false, Math.ceil(amount / G.TRADE_BATCH_SIZE)));
  }
}
function makeOutputRoom(q) {
  for (const [id, n] of Object.entries(q.outputCost || {})) {
    while (s.jobs[id] > 0) action(`暂缓满仓生产:${id}`, (x) => G.assign(x, id, -1));
    basicRoom(id, n + 1);
  }
  for (const [id, n] of Object.entries(q.outputMaterials || {})) {
    const region = G.REGION_MATERIALS.indexOf(id);
    if (region >= 0 && s.economy.routes[region].enabled) action(`暂缓满仓供给:${id}`, (x) => G.toggleRoute(x, region));
    if (G.WORK_IDS.includes(id) && s.world.work[id]) action(`暂缓满仓加工:${id}`, (x) => G.toggleWork(x, id, false));
    for (let i = 0; s.world.materials[id] - (q.materials[id] || 0) + n > G.materialCapacity(s, id) && i < 32; i++) {
      const work = G.WORK_RECIPES.find((w) => s.world.tech.includes(w.tech) && G.processingBill(s, w.id).materials[id] && s.world.materials[w.id] + G.processingOutput(s, w.id) <= G.materialCapacity(s, w.id));
      assert.ok(work, `产出材料满仓，没有当前可用消耗：${id}`);
      ensureMaterial(work.id, s.world.materials[work.id] + G.processingOutput(s, work.id));
    }
  }
}
function save() {
  writeFileSync(new URL('results.json', output), JSON.stringify(report, null, 2));
  writeFileSync(new URL('fixtures.json', output), JSON.stringify({ chapters: endStates }, null, 2));
}

assert.equal(fixtures.beforeBattles.length, 6, '六章真实主线存档齐全');
for (let c = 0; c < 6; c++) {
  s = structuredClone(fixtures.beforeBattles[c]);
  chapter = { chapter: c + 1, region: G.REGIONS[c].name, checkpointTime: s.time, initial: stock(), actions: [], waits: [], sites: [], modes: [], blockers: [] };
  report.chapters.push(chapter);
  try {
    assert.ok(!s.paused && !s.battle && !s.expedition && !s.worldExploration.activeRun, '合法静止起点');
    if (G.stockControlsUnlocked(s) && s.economy.reserve) action('暂时取消原料保留线', (x) => G.setResourceReserve(x, 0));
    for (const site of S.SITES.filter((d) => d.region === c)) {
      const start = s.time, giftBefore = Object.keys(s.worldExploration.relics.owned).length;
      assert.ok(s.worldExploration.sites[site.id]?.discovered, `${site.id}由真实据点发现`);
      if (s.recoveryUntil > s.time) wait(s.recoveryUntil - s.time, '等待主线战后休整');
      ensureBill(S.siteTravelQuote(s, site.id));
      ensureBill(S.siteRouteQuote(s, site.id, 'clever'));
      const travel = S.siteTravelQuote(s, site.id);
      assert.equal(S.siteStartReason(s, site.id), '', '出行可达');
      action(`地点出发:${site.id}`, (x) => S.startSite(x, site.id, 'basic'));
      wait(s.worldExploration.activeRun.remaining, `去程:${site.id}`);
      assert.equal(s.worldExploration.activeRun.phase, 'awaitingChoice');
      const extra = S.siteRouteQuote(s, site.id, 'clever');
      ensureBill(extra);
      action(`巧解:${site.id}`, (x) => S.chooseSiteRoute(x, 'clever'));
      for (let i = 0; s.worldExploration.activeRun && i < 60; i++) wait(Math.max(1, s.worldExploration.activeRun.remaining), `现场与归程:${site.id}`);
      assert.equal(s.worldExploration.activeRun, null, '归程释放主队');
      assert.ok(s.worldExploration.sites[site.id].firstCompleted);
      assert.ok(s.worldExploration.sites[site.id].routesCompleted.includes('clever'));
      assert.equal(Object.keys(s.worldExploration.relics.owned).length, giftBefore + 1);
      const result = { id: site.id, name: site.name, start, finished: s.time, travel, extra, receipt: structuredClone(s.worldExploration.sites[site.id].lastResult) };
      chapter.sites.push(result);
      ensureBill(R.relicRepairQuote(s, site.relicId));
      result.relicRepair = R.relicRepairQuote(s, site.relicId);
      assert.equal(result.relicRepair.reason, '');
      action(`遗物修复:${site.relicId}`, (x) => R.repairRelic(x, site.relicId));
      ensureBill(F.facilityRepairQuote(s, site.id));
      result.facilityRepair = F.facilityRepairQuote(s, site.id);
      assert.equal(result.facilityRepair.reason, '');
      action(`设施修复:${site.id}`, (x) => F.repairFacility(x, site.id));
      wait(Math.max(s.worldExploration.relics.owned[site.relicId].operation?.remainingSeconds || 0, s.worldExploration.facilities[site.id].operation?.remainingSeconds || 0), `后方修复:${site.id}`);
      assert.ok(s.worldExploration.relics.owned[site.relicId].repaired && s.worldExploration.facilities[site.id].repaired);
      for (const mode of F.FACILITY_MODES.filter((m) => m.siteId === site.id)) {
        const modeStart = s.time;
        assert.ok(mode.tech.every((t) => s.world.tech.includes(t)), `${mode.id}工艺门槛已由主线开放`);
        ensureBill(F.facilityChangeQuote(s, site.id, mode.mode));
        assert.equal(F.facilityChangeQuote(s, site.id, mode.mode).reason, '', `${mode.id}改设可达`);
        action(`选择用途:${mode.id}`, (x) => F.setFacilityMode(x, site.id, mode.mode));
        if (s.worldExploration.facilities[site.id].operation) wait(s.worldExploration.facilities[site.id].operation.remainingSeconds, `设施改设:${mode.id}`);
        ensureBill(F.facilityModeQuote(s, site.id, mode.mode));
        makeOutputRoom(mode);
        ensureBill(F.facilityModeQuote(s, site.id, mode.mode));
        for (let r = 0; r < 6; r++) if (s.economy.routes[r].enabled) action(`腾出供给线路:${r}`, (x) => G.toggleRoute(x, r));
        freeWorker();
        assert.equal(F.facilityEnableReason(s, site.id), '', `${mode.id}岗位可达`);
        const q = F.facilityModeQuote(s, site.id, mode.mode);
        assert.equal(q.reason, '', `${mode.id}投入与出货空间齐备`);
        const completed = s.worldExploration.facilities[site.id].completed, before = stock();
        action(`设施开工:${mode.id}`, (x) => F.toggleFacility(x, site.id, true));
        wait(q.seconds, `设施首批:${mode.id}`);
        assert.equal(s.worldExploration.facilities[site.id].completed, completed + 1, `${mode.id}真实出货一批`);
        chapter.modes.push({ id: mode.id, name: mode.name, start: modeStart, finish: s.time, quote: q, netStock: delta(before, stock()), batches: 1 });
        action(`设施停工:${mode.id}`, (x) => F.toggleFacility(x, site.id, false));
      }
      if (s.worldExploration.sites[site.id].pendingReceipt) {
        const receipt = s.worldExploration.sites[site.id].pendingReceipt;
        for (const [id, n] of Object.entries(receipt.remaining.cost)) basicRoom(id, n);
        action(`分批领取:${site.id}`, (x) => S.claimSite(x, site.id));
        assert.equal(s.worldExploration.sites[site.id].pendingReceipt, null, '余量实际领完，不自动丢弃');
      }
      result.totalSeconds = s.time - start;
    }
    chapter.status = 'passed';
  } catch (error) {
    chapter.status = 'blocked';
    chapter.blockers.push(String(error.stack || error));
    report.failures.push({ chapter: c + 1, error: String(error.message || error) });
  }
  chapter.totalSeconds = s.time - chapter.checkpointTime;
  chapter.final = stock();
  if (chapter.status === 'passed') {
    const decoded = G.decodeSave(JSON.stringify(s));
    assert.deepEqual(decoded.worldExploration, s.worldExploration, '合法续玩结束存档保持支线/设施/遗物状态');
    chapter.saveRoundTrip = true;
  }
  endStates.push(s);
  save();
  console.log(JSON.stringify({ chapter: c + 1, status: chapter.status, seconds: chapter.totalSeconds, sites: chapter.sites.length, modes: chapter.modes.length, blocker: report.failures.at(-1)?.chapter === c + 1 ? report.failures.at(-1).error : null }));
}
report.coreAfter = coreHashes();
report.sourceStable = hash(readFileSync(source, 'utf8')) === report.sourceHash;
report.coreStable = JSON.stringify(report.coreBefore) === JSON.stringify(report.coreAfter);
report.summary = { sites: report.chapters.reduce((n, c) => n + c.sites.length, 0), modes: report.chapters.reduce((n, c) => n + c.modes.length, 0), failedChapters: report.failures.length, seconds: report.chapters.reduce((n, c) => n + c.totalSeconds, 0) };
save();
const lines = [
  '# V0.3 六章合法支线续玩验收', '',
  `结果：${report.summary.sites}/12 地点完成，${report.summary.modes}/24 设施用途实际出货；失败章节 ${report.summary.failedChapters}。`, '',
  '来源是本轮主线验收中由公开动作取得的六份首领战前存档，每章独立继续。没有注入物资、发现标记、遗物、设施或胜利结果。不是把六章串成一次游玩的速度记录，也不是无装备战斗平衡证据。', '',
  '| 章节 | 地点首通 | 用途出货 | 模拟秒数 | 额外加工等待 | 存档往返 |',
  '| --- | --- | --- | --- | --- | --- |',
  ...report.chapters.map((c) => `| ${c.chapter} ${c.region} | ${c.sites.length}/2 | ${c.modes.length}/4 | ${c.totalSeconds} | ${c.waits.filter((w) => w.purpose.startsWith('加工:')).reduce((n, w) => n + w.seconds, 0)} 秒 | ${c.saveRoundTrip ? '通过' : '未通过'} |`), '',
  '每处依次执行：支付基础出行费，抵达后明确支付巧解费，现场作业与归程，取得唯一未修复遗物，支付遗物与设施修复费，等待后方工程，再分别启用两种设施用途并等待各一批产出。', '',
  '仓储与调配观察：第一、二章的当地原料原本接近满仓，须暂停原有运输并把原料真实加工为木板或符文，才能容纳设施整批产出。基础物资满仓时暂停对应生产并在集市销售；设施需要的一位居民通过减少原有生产岗位调配，物流容量通过暂停运输线释放。满仓返程奖励保留为待领取，并在消费或交易后实际领完，没有自动丢弃。', '',
  '统计边界：results.json 中 action.delta 的非时钟负值是每次操作的实际支付/出售。waits 与时钟 action 的库存变化是普通生产、维护、加工和设施同时运行后的净值，不冒充毛产出或完整消费。每个设施模式另存真实报价、产出配方和已完成批次数。所有等待为模拟游戏时钟，不代表人类操作时长。', '',
  `本次执行代码哈希稳定：${report.coreStable}；源存档哈希稳定：${report.sourceStable}。没有使用额外机制注入 fixture。`, '',
  ...report.failures.map((f) => `阻塞：第 ${f.chapter} 章 — ${f.error}`),
];
writeFileSync(new URL('验收结果.md', output), lines.join('\n'));
console.log(JSON.stringify(report.summary));
process.exitCode = report.failures.length ? 1 : 0;
