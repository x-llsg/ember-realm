import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import * as G from '../lib/realm.ts';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const hashes = () => Object.fromEntries(readdirSync(new URL('../lib/', import.meta.url))
  .filter((file) => file.endsWith('.ts')).sort()
  .map((file) => [file, hash(readFileSync(new URL(`../lib/${file}`, import.meta.url)))]));
const coreSources = hashes(), checks = [], fixtureHashes = {};
const close = (a, b, label) => assert.ok(Math.abs(a - b) < 1e-7, `${label}: ${a} != ${b}`);
for (const order of ['standard', 'branch']) {
  const base = new URL(`../.test-results/v020-${order}-balanced/`, import.meta.url);
  const campaign = JSON.parse(readFileSync(new URL('campaign.json', base)));
  assert.deepEqual(campaign.coreSources, coreSources, 'fixtures must come from this exact frozen core');
  assert.ok(campaign.checks.every((check) => check.passed));
  const bytes = readFileSync(new URL('fixtures.json', base));
  fixtureHashes[order] = hash(bytes);
  const fixtures = JSON.parse(bytes);
  for (const recipe of G.PROCESSING_VARIANTS) {
    let s = G.decodeSave(JSON.stringify(fixtures.beforeBattles[recipe.region]));
    assert.equal(s.battle, null);
    assert.equal(s.expedition, null);
    // Only player-facing actions alter the legal saved state. No stock,
    // progression, worker, material or building values are injected.
    for (const id of G.WORK_IDS) if (s.world.work[id]) s = G.toggleWork(s, id, false);
    const selected = G.setWorkVariant(s, recipe.work, recipe.id);
    assert.notEqual(selected, s);
    s = selected;
    const quote = G.processingQuote(s, recipe.work);
    assert.equal(quote.reason, '', `${order} ${recipe.id} must already have actual inputs`);
    const startTime = s.time, producedBefore = s.economy.crafted[recipe.work];
    let control = structuredClone(s);
    s = G.toggleWork(s, recipe.work, true);
    let elapsed = 0;
    while (s.economy.crafted[recipe.work] === producedBefore && elapsed++ < 300) {
      s = G.advance(s, 1);
      control = G.advance(control, 1);
    }
    assert.ok(elapsed <= 300, 'first batch must complete without additional resources');
    close(s.economy.crafted[recipe.work] - producedBefore, quote.output, 'single completed batch');
    // Until the completion tick both twins have identical input flows. The
    // final difference is exactly this recipe's bill and its finished output.
    for (const id of Object.keys(s.resources)) close(control.resources[id] - s.resources[id], quote.cost[id] || 0, id);
    for (const id of G.MATERIAL_IDS)
      close(s.world.materials[id] - control.world.materials[id], id === recipe.work ? quote.output : -(quote.materials[id] || 0), id);
    assert.deepEqual(G.decodeSave(JSON.stringify(s)), s);
    checks.push({ order, chapter: recipe.region + 1, region: G.REGIONS[recipe.region].name,
      recipe: recipe.name, fixtureTime: startTime, elapsed, cost: quote.cost, materials: quote.materials,
      output: quote.output, exactCounterfactualBill: true, saveRoundtrip: true });
  }
}
assert.deepEqual(hashes(), coreSources);
const report = { rulesRevision: 'v020-six-chapter-development', coreSources, sourceFreeze: true,
  evidence: 'Each original-policy legal campaign before-boss save was continued independently using public recipe switch, work toggle and advance actions. First batch only; this is not a claim that either complete campaign selected alternatives, nor a human playtime measurement.',
  fixtureHashes, continuations: checks, passed: true };
writeFileSync(new URL('../.test-results/v020-processing-campaign-audit.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ legalContinuations: checks.length, coreFiles: Object.keys(coreSources).length, passed: true }));
