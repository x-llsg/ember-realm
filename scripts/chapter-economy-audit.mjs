import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import * as G from '../lib/realm.ts';

const hashes = () => Object.fromEntries(readdirSync(new URL('../lib/', import.meta.url))
  .filter((file) => file.endsWith('.ts')).sort()
  .map((file) => [file, createHash('sha256').update(readFileSync(new URL(`../lib/${file}`, import.meta.url))).digest('hex')]));
const coreSources = hashes();
function fixture() {
  const s = G.freshState(1);
  s.assigned = true;
  s.guild.depths = [5, 5, 5, 5, 5, 5];
  s.cleared = [0, 1, 2, 3, 4, 5];
  s.ending = true;
  for (let r = 0; r < 6; r++) {
    s.survey[r] = G.REGIONS[r].thresholds[1];
    s.projects[G.PROJECTS[r].id] = G.PROJECTS[r].choices[0].id;
  }
  delete s.world;
  G.migrateWorld(s);
  for (const b of G.BUILDINGS) s.buildings[b.id] = G.buildingLimit(s, b.id);
  s.population = G.populationCap(s);
  for (const k of Object.keys(s.resources)) s.resources[k] = G.capacity(s, k) / 2;
  s.event = 0;
  return s;
}
const checks = G.PROCESSING_VARIANTS.map((recipe) => {
  const s = fixture(), locked = structuredClone(s);
  locked.guild.depths[recipe.region] = 1;
  assert.match(G.processingVariantReason(locked, recipe.work, recipe.id), /第二据点/);
  const selected = G.setWorkVariant(s, recipe.work, recipe.id);
  assert.notEqual(selected, s);
  const original = G.processingQuote(s, recipe.work), alternative = G.processingQuote(selected, recipe.work);
  assert.ok(Object.keys(original.materials).some((id) => !alternative.materials[id]));
  const local = G.PROJECTS[recipe.region];
  selected.projectExtensions = { [local.id]: local.choices[1].id };
  const combined = G.processingQuote(selected, recipe.work);
  assert.equal(combined.projectDiscount, true);
  assert.deepEqual(combined.materials, alternative.materials);
  assert.equal(combined.output, alternative.output);
  for (const [id, value] of Object.entries(combined.cost)) assert.equal(value, Math.ceil(alternative.cost[id] * 0.9));
  assert.deepEqual(G.decodeSave(JSON.stringify(selected)), selected);
  return {
    chapter: recipe.region + 1, region: G.REGIONS[recipe.region].name,
    capability: recipe.name, work: G.MATERIAL_NAMES[recipe.work],
    requiredTechnology: recipe.tech, secondSiteGate: true,
    specialMaterialsCreated: false, originalRetained: true,
    changedDependency: true, original, alternative, combined,
    saveRoundtrip: true,
  };
});
assert.equal(checks.length, 6);
assert.deepEqual(hashes(), coreSources);
const report = {
  rulesRevision: 'v020-six-chapter-development',
  evidence: 'Synthetic chapter capability fixtures. Verifies discovery, costs and persistence; not a legal playthrough or a claim about human playtime.',
  coreSources, sourceFreeze: true, chapters: checks, passed: true,
};
mkdirSync(new URL('../.test-results/', import.meta.url), { recursive: true });
writeFileSync(new URL('../.test-results/v020-chapter-economy.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ chapters: checks.length, coreFiles: Object.keys(coreSources).length, passed: true }));
