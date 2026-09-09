import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/realm.ts';

// Synthetic fixtures isolate bills, gates and clocks; campaign-economy owns
// complete legal routes. These assignments are not presented as playthroughs.
function town() {
  const s = G.freshState(1);
  s.assigned = true;
  s.cleared = [0, 1, 2, 3, 4];
  s.guild.depths = [5, 5, 5, 5, 5, 2];
  for (const r of s.cleared) {
    s.survey[r] = G.REGIONS[r].thresholds[1];
    s.projects[G.PROJECTS[r].id] = G.PROJECTS[r].choices[0].id;
  }
  delete s.world;
  G.migrateWorld(s);
  for (const b of G.BUILDINGS) s.buildings[b.id] = G.buildingLimit(s, b.id);
  s.population = G.populationCap(s);
  for (const k of Object.keys(s.resources))
    s.resources[k] = G.capacity(s, k) / 2;
  s.event = 0;
  s.order.enabled = false;
  return s;
}
const variants = G.PROCESSING_VARIANTS;

test('six chapters offer one distinct input alternative without creating any new material', () => {
  assert.deepEqual(variants.map((v) => v.region).sort(), [0, 1, 2, 3, 4, 5]);
  assert.equal(G.MATERIAL_IDS.length, 9);
  for (const recipe of variants) {
    const s = town();
    assert.equal(G.processingVariantReason(s, recipe.work, recipe.id), '');
    s.guild.depths[recipe.region] = 1;
    assert.match(
      G.processingVariantReason(s, recipe.work, recipe.id),
      /第二据点/,
    );
    assert.equal(G.setWorkVariant(s, recipe.work, recipe.id), s);
    s.guild.depths[recipe.region] = 2;
    s.world.tech = s.world.tech.filter((t) => t !== recipe.tech);
    assert.match(
      G.processingVariantReason(s, recipe.work, recipe.id),
      /先研究/,
    );
  }
  const start = G.freshState(1);
  for (const id of G.WORK_IDS)
    assert.deepEqual(G.processingVariants(start, id), []);
});

test('old saves select original recipes and keep resources, progress and production bills', () => {
  const s = town();
  s.world.work.boards = true;
  s.world.workProgress.boards = 3;
  delete s.economy.variants;
  const restored = G.decodeSave(JSON.stringify(s));
  assert.deepEqual(restored.economy.variants, {
    boards: 'original',
    steel: 'original',
    runes: 'original',
  });
  assert.deepEqual(restored.resources, s.resources);
  assert.deepEqual(restored.world, s.world);
  for (const w of G.WORK_RECIPES) {
    assert.deepEqual(G.processingBill(restored, w.id), {
      cost: w.cost,
      materials: w.materials,
    });
    assert.equal(G.processingOutput(restored, w.id), w.output);
  }
  assert.deepEqual(G.decodeSave(JSON.stringify(restored)), restored);
});

test('malformed, wrong-line and undiscovered selected recipe fields are rejected', () => {
  for (const value of [
    null,
    [],
    {},
    'joinery',
    { boards: 'joinery' },
    { boards: 'original', steel: 'original', runes: 'original', extra: 'bad' },
    { boards: 'unknown', steel: 'original', runes: 'original' },
    { boards: 'dragon', steel: 'original', runes: 'original' },
    { boards: 7, steel: 'original', runes: 'original' },
  ]) {
    const s = town();
    s.economy.variants = value;
    assert.throws(() => G.decodeSave(JSON.stringify(s)), /经营与后勤/);
  }
  const start = G.freshState(1);
  start.economy.variants.boards = 'joinery';
  assert.throws(() => G.decodeSave(JSON.stringify(start)), /经营与后勤/);
});

test('switching recipe or speed cannot transfer already elapsed processing time', () => {
  let s = town();
  s.world.work.boards = true;
  s.world.workProgress.boards = G.workDuration(s, 'boards') - 1;
  const original = structuredClone(s);
  s = G.setWorkVariant(s, 'boards', 'joinery');
  assert.equal(s.world.workProgress.boards, 0);
  assert.deepEqual(s.resources, original.resources);
  assert.deepEqual(s.world.materials, original.world.materials);
  assert.equal(s.world.work.boards, true);
  assert.equal(G.setWorkVariant(s, 'boards', 'joinery'), s);
  s.economy.development.carpentry = 2;
  s.world.workProgress.boards = 2;
  s = G.setWorkMode(s, 'boards', 'rush');
  assert.equal(s.world.workProgress.boards, 0);
  assert.equal(s.economy.modes.boards, 'rush');
});

for (const recipe of variants)
  test(`chapter ${recipe.region + 1}: ${recipe.name} pays its actual bill and receives only the same finished product`, () => {
    let s = G.setWorkVariant(town(), recipe.work, recipe.id);
    const quote = G.processingQuote(s, recipe.work);
    for (const [id, amount] of Object.entries(quote.materials))
      s.world.materials[id] = amount * 4;
    const before = structuredClone(s);
    s.world.work[recipe.work] = true;
    G.worldTick(s, quote.seconds);
    assert.equal(
      s.world.materials[recipe.work] - before.world.materials[recipe.work],
      quote.output,
    );
    assert.equal(s.economy.crafted[recipe.work], quote.output);
    for (const id of Object.keys(s.resources))
      assert.ok(
        Math.abs(
          s.resources[id] - (before.resources[id] - (quote.cost[id] || 0)),
        ) < 1e-8,
      );
    for (const id of G.MATERIAL_IDS.filter((id) => id !== recipe.work))
      assert.ok(
        Math.abs(
          s.world.materials[id] -
            (before.world.materials[id] - (quote.materials[id] || 0)),
        ) < 1e-8,
      );
    assert.equal(s.world.workProgress[recipe.work], 0);
    const original = G.WORK_RECIPES.find((w) => w.id === recipe.work);
    assert.ok(
      Object.keys(original.materials).some((id) => !quote.materials[id]),
    );
    assert.deepEqual(G.decodeSave(JSON.stringify(s)), s);
  });

test('regional shortage favors local substitution, ordinary stock shortage favors the original recipe', () => {
  for (const recipe of variants.slice(0, 3)) {
    const s = town(),
      original = G.processingQuote(s, recipe.work, 'original');
    for (const key of Object.keys(original.materials))
      s.world.materials[key] = 0;
    assert.notEqual(G.workReason(s, recipe.work), '');
    const alternative = G.setWorkVariant(s, recipe.work, recipe.id);
    assert.equal(G.workReason(alternative, recipe.work), '');
    assert.ok(
      G.workDuration(alternative, recipe.work) > G.workDuration(s, recipe.work),
    );
    for (const k of Object.keys(s.resources))
      s.resources[k] = original.cost[k] || 0;
    for (const [k, n] of Object.entries(original.materials))
      s.world.materials[k] = n;
    assert.equal(G.workReason(s, recipe.work), '');
    assert.notEqual(
      G.workReason(G.setWorkVariant(s, recipe.work, recipe.id), recipe.work),
      '',
    );
  }
});

test('late recipes compete for equipment samples and stop when those real inputs run out', () => {
  for (const recipe of variants.slice(3)) {
    let s = G.setWorkVariant(town(), recipe.work, recipe.id);
    const quote = G.processingQuote(s, recipe.work);
    const [sample, amount] = Object.entries(quote.materials)[0];
    assert.notEqual(G.workReason(s, recipe.work), '');
    s.world.materials[sample] = amount;
    s.world.work[recipe.work] = true;
    G.worldTick(s, quote.seconds);
    assert.equal(s.world.materials[sample], 0);
    assert.equal(s.world.materials[recipe.work], quote.output);
    const after = structuredClone(s);
    G.worldTick(s, 3600);
    assert.deepEqual(s, after);
  }
});

test('both paid local projects discount only that chapter alternative ordinary bill', () => {
  for (const recipe of variants) {
    let s = G.setWorkVariant(town(), recipe.work, recipe.id);
    const project = G.PROJECTS[recipe.region];
    s.projects[project.id] = project.choices[0].id;
    const before = G.processingQuote(s, recipe.work),
      original = G.processingQuote(s, recipe.work, 'original');
    s.projectExtensions = { [project.id]: project.choices[1].id };
    const after = G.processingQuote(s, recipe.work);
    assert.equal(after.projectDiscount, true);
    for (const [id, amount] of Object.entries(before.cost))
      assert.equal(after.cost[id], Math.ceil(amount * 0.9));
    assert.deepEqual(after.materials, before.materials);
    assert.equal(after.output, before.output);
    assert.equal(after.seconds, before.seconds);
    assert.deepEqual(
      G.processingQuote(s, recipe.work, 'original').cost,
      original.cost,
    );
  }
});

test('work modes, selected recipe quotes, target storage and reserve all use the same bill', () => {
  let s = town();
  s.economy.development.inscription = 4;
  s = G.setWorkVariant(s, 'runes', 'stellar');
  s = G.setWorkMode(s, 'runes', 'efficient');
  const quote = G.processingQuote(s, 'runes');
  assert.equal(quote.output, 6);
  assert.equal(quote.materials.star, 1.5);
  assert.equal(quote.cost.gold, 300);
  assert.equal(quote.perMinute, (quote.output * 60) / quote.seconds);
  s.world.materials.star = 10;
  s.world.work.runes = true;
  s.economy.development.storage = 2;
  s = G.setWorkTarget(s, 'runes', 0.25);
  s.world.materials.runes = G.workshopTarget(s, 'runes') - 5;
  assert.match(G.workReason(s, 'runes'), /满仓/);
  const full = structuredClone(s);
  G.worldTick(s, 3600);
  assert.deepEqual(s, full);
  s.world.materials.runes = 0;
  s = G.setResourceReserve(s, 0.5);
  s.resources.gold = G.capacity(s, 'gold') / 2;
  assert.match(G.workReason(s, 'runes'), /保留线/);
});

test('all six selected recipes preserve online, offline and save-partition equivalence', () => {
  for (const recipe of variants) {
    let s = G.setWorkVariant(town(), recipe.work, recipe.id);
    for (const id of G.MATERIAL_IDS.filter((id) => !G.WORK_IDS.includes(id)))
      s.world.materials[id] = G.materialCapacity(s, id) / 2;
    s.world.work[recipe.work] = true;
    const offline = G.advance(s, 1800);
    let online = structuredClone(s),
      partitioned = structuredClone(s);
    for (let i = 0; i < 30; i++) {
      online = G.advance(online, 60);
      partitioned = G.decodeSave(JSON.stringify(G.advance(partitioned, 60)));
    }
    assert.deepEqual(online, offline, recipe.id);
    assert.deepEqual(partitioned, offline, recipe.id);
    assert.ok(offline.economy.crafted[recipe.work] > 0);
  }
});
