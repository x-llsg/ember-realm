import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as G from '../lib/realm.ts';

// Continuation audit, deliberately separate from new-game campaign balance.
// Every input is a previously earned chapter checkpoint; all new clues,
// ingredients and construction payments below use the public game actions.
const input =
  process.argv[2] || '.test-results/v16-standard-balanced/fixtures.json';
const output = process.argv[3] || '.test-results/v020-chapter-audit.json';
const raw = readFileSync(input),
  fixtures = JSON.parse(raw);
const hashes = () => Object.fromEntries(readdirSync(new URL('../lib/', import.meta.url))
  .filter((file) => file.endsWith('.ts')).sort()
  .map((file) => [file, createHash('sha256').update(readFileSync(new URL(`../lib/${file}`, import.meta.url))).digest('hex')]));
const coreSources = hashes();
const evidence = {
  version: '0.2.0',
  input,
  inputSha256: createHash('sha256').update(raw).digest('hex'),
  coreSources,
  scope:
    'Continuation from earned campaign checkpoints; no stock, technology, level, choice or map injection. Not a new-game playthrough, retention study or human playtime measurement.',
  chapters: [],
};

for (let region = 0; region < 6; region++) {
  let s = G.decodeSave(
    JSON.stringify(
      fixtures.afterVictories.find(
        (snapshot) => snapshot.cleared.at(-1) === region,
      ),
    ),
  );
  const started = s.time,
    actions = [],
    project = G.PROJECTS[region];
  const act = (name, fn) => {
    const next = fn(s);
    if (next !== s) actions.push(name);
    s = next;
  };
  const tick = (seconds) => {
    s = G.advance(s, seconds);
    assert.ok(
      s.time - started < 28800,
      'continuation must not stall for eight simulated hours',
    );
  };
  assert.equal(s.battle, null);
  assert.equal(s.expedition, null);
  while (G.discoveryCount(s, region) < 2) {
    if (s.recoveryUntil > s.time) tick(Math.ceil(s.recoveryUntil - s.time));
    const before = s;
    act('investigate', (x) => G.expedition(x, region, 'survey'));
    assert.notEqual(s, before, G.dispatchReason(s, region, 'survey', 0));
    tick(Math.ceil(s.expedition.end - s.time));
  }
  const { work, variant } = G.CHAPTER_RECIPE_VARIANTS[region];
  assert.equal(G.processingVariantReason(s, work, variant), '');
  act('choose local recipe', (x) => G.setWorkVariant(x, work, variant));
  const craftedBefore = s.economy.crafted[work];
  const beforeBill = G.processingBill(s, work),
    payments = [];
  for (const choice of project.choices) {
    const bill = G.chapterProjectCost(s, region, choice.id);
    for (const id of G.WORK_IDS) {
      if (bill.materials[id]) {
        act(`target ${id}`, (x) =>
          G.setWorkTarget(
            x,
            id,
            Math.ceil(bill.materials[id] + G.processingOutput(x, id)),
          ),
        );
        act(`start ${id}`, (x) => G.toggleWork(x, id, true));
      }
    }
    while (G.chapterProjectReason(s, region, choice.id)) {
      tick(10);
      for (const id of G.WORK_IDS)
        if (
          s.world.work[id] &&
          s.world.materials[id] >= (bill.materials[id] || 0)
        )
          act(`stop ${id}`, (x) => G.toggleWork(x, id, false));
    }
    const prior = structuredClone(s);
    act(`build ${choice.id}`, (x) => G.completeProject(x, region, choice.id));
    assert.equal(G.hasProjectChoice(s, project.id, choice.id), true);
    for (const id of Object.keys(bill.cost))
      assert.equal(prior.resources[id] - s.resources[id], bill.cost[id]);
    for (const id of Object.keys(bill.materials))
      assert.equal(
        prior.world.materials[id] - s.world.materials[id],
        bill.materials[id],
      );
    payments.push({ choice: choice.id, bill, time: s.time });
    assert.deepEqual(
      G.decodeSave(JSON.stringify(s)),
      s,
      'both payment checkpoints roundtrip',
    );
  }
  // A branch can fund its engineering with the other learned material (for
  // example runes instead of steel). Prove the newly unlocked local method by
  // commissioning a real trial batch rather than claiming a selection is use.
  if (s.economy.crafted[work] === craftedBefore) {
    act(`trial target ${work}`, (x) => G.setWorkTarget(x, work, Math.ceil(x.world.materials[work] + G.processingOutput(x, work))));
    act(`trial batch ${variant}`, (x) => G.toggleWork(x, work, true));
    while (s.economy.crafted[work] === craftedBefore) tick(1);
    act(`stop trial ${work}`, (x) => G.toggleWork(x, work, false));
    assert.deepEqual(G.decodeSave(JSON.stringify(s)), s, 'the paid trial batch roundtrips');
  }
  const afterBill = G.processingBill(s, work);
  const localCrafted = s.economy.crafted[work] - craftedBefore;
  assert.ok(localCrafted > 0, `chapter ${region + 1}: the local alternative must actually produce paid output, not merely become selectable`);
  assert.ok(
    Object.entries(beforeBill.cost).some(([id, n]) => afterBill.cost[id] < n),
  );
  assert.deepEqual(afterBill.materials, beforeBill.materials);
  s = G.settleStory(s);
  assert.ok(s.chronicle.includes(`chapter-work-${region}`));
  assert.ok(s.chronicle.includes(`chapter-home-${region}`));
  evidence.chapters.push({
    region,
    name: G.REGIONS[region].name,
    gameSeconds: s.time - started,
    actions,
    payments,
    recipe: G.processingRecipe(s, work).name,
    localCrafted,
    beforeBill,
    afterBill,
    completed: G.chapterProjectCount(s, region),
    saved: true,
    discovered: true,
    stockInjected: false,
  });
}
evidence.passed = evidence.chapters.every(
  (c) => c.completed === 2 && c.payments.length === 2,
);
evidence.unchangedSource = JSON.stringify(coreSources) === JSON.stringify(hashes());
assert.ok(evidence.unchangedSource, 'game sources changed during the continuation audit');
mkdirSync('.test-results', { recursive: true });
writeFileSync(output, JSON.stringify(evidence, null, 2));
console.log(
  JSON.stringify({
    passed: evidence.passed,
    chapters: evidence.chapters.length,
    output,
  }),
);
