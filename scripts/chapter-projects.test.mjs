import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as G from '../lib/realm.ts';

// These fixtures isolate construction and accounting, not campaign difficulty.
// Separate historical saves verify migration; the legal campaign audit uses
// earned checkpoint stocks and real production without this fixture funding.
function town() {
  const s = G.freshState(1947652);
  s.world.tech = G.TECHNOLOGIES.map((t) => t.id);
  s.buildings = {
    fire: 1,
    hut: 16,
    warehouse: 12,
    lumber: 12,
    farm: 12,
    quarry: 12,
    market: 12,
    tavern: 3,
    forge: 12,
    shrine: 12,
  };
  s.population = 30;
  s.jobs.wood = 5;
  s.jobs.food = 5;
  s.jobs.stone = 5;
  s.jobs.gold = 5;
  s.jobs.iron = 5;
  s.jobs.crystal = 5;
  s.assigned = true;
  s.guild.depths.fill(5);
  s.survey = G.REGIONS.map((r) => r.thresholds[1]);
  s.nextEventAt = 1e8;
  for (const id of G.MATERIAL_IDS)
    s.world.materials[id] = G.materialCapacity(s, id);
  for (const id of Object.keys(s.resources))
    s.resources[id] = G.capacity(s, id);
  return s;
}

function paid(s, region, choice) {
  const before = structuredClone(s),
    bill = G.chapterProjectCost(s, region, choice);
  assert.equal(G.chapterProjectReason(s, region, choice), '');
  const next = G.completeProject(s, region, choice);
  assert.notEqual(next, s);
  assert.deepEqual(s, before, 'construction does not mutate its input');
  for (const id of Object.keys(s.resources))
    assert.equal(
      next.resources[id],
      s.resources[id] - (bill.cost[id] || 0),
      id,
    );
  for (const id of G.MATERIAL_IDS)
    assert.equal(
      next.world.materials[id],
      s.world.materials[id] - (bill.materials[id] || 0),
      id,
    );
  assert.deepEqual(
    next.guild.inventory,
    s.guild.inventory,
    'engineering does not award duplicate gear',
  );
  assert.deepEqual(
    next.cleared,
    s.cleared,
    'engineering does not defeat bosses',
  );
  return next;
}

for (let region = 0; region < 6; region++) {
  for (let first = 0; first < 2; first++) {
    test(`chapter ${region + 1}: either initial choice keeps its effect and the other is a separately paid extension (${first})`, () => {
      const project = G.PROJECTS[region];
      let s = town();
      const original = G.chapterProjectCost(
        s,
        region,
        project.choices[first].id,
      );
      assert.deepEqual(
        original.cost,
        project.cost,
        'old first-choice price is retained',
      );
      assert.deepEqual(original.materials, G.projectMaterialCost(s, region));
      s = paid(s, region, project.choices[first].id);
      assert.equal(s.projects[project.id], project.choices[first].id);
      assert.equal(G.chapterProjectCount(s, region), 1);
      assert.equal(G.chosen(s, project.id, project.choices[first].id), true);
      assert.equal(
        G.chosen(s, project.id, project.choices[1 - first].id),
        false,
      );
      const repeat = G.completeChapterProject(
        s,
        region,
        project.choices[first].id,
      );
      assert.equal(repeat, s, 'repeat construction is a no-op');
      const extensionBill = G.chapterProjectCost(
        s,
        region,
        project.choices[1 - first].id,
      );
      assert.ok(
        Object.keys(original.cost).every(
          (id) => extensionBill.cost[id] > original.cost[id],
        ),
      );
      s = paid(s, region, project.choices[1 - first].id);
      assert.equal(
        s.projects[project.id],
        project.choices[first].id,
        'the first choice is never overwritten',
      );
      assert.equal(
        s.projectExtensions[project.id],
        project.choices[1 - first].id,
      );
      assert.equal(G.chapterProjectCount(s, region), 2);
      for (const choice of project.choices)
        assert.equal(G.chosen(s, project.id, choice.id), true);
      assert.equal(G.chapterProjectReady(s, region), false);
      assert.equal(
        G.completeChapterProject(s, region, project.choices[1 - first].id),
        s,
      );
      assert.doesNotThrow(() => G.validateChapterProjects(s));
    });
  }

  test(`chapter ${region + 1}: extension gate opens at fourth actual site or an early boss clear`, () => {
    const project = G.PROJECTS[region];
    let s = town();
    s.guild.depths[region] = 3;
    s = paid(s, region, project.choices[0].id);
    assert.match(
      G.chapterProjectGate(s, region, project.choices[1].id),
      /第四据点/,
    );
    assert.equal(G.completeChapterProject(s, region, project.choices[1].id), s);
    const occupied = structuredClone(s);
    occupied.guild.depths[region] = 4;
    assert.equal(
      G.chapterProjectGate(occupied, region, project.choices[1].id),
      '',
    );
    const won = structuredClone(s);
    won.cleared.push(region);
    assert.equal(G.chapterProjectGate(won, region, project.choices[1].id), '');
  });

  test(`chapter ${region + 1}: joint supply changes actual alternate recipe bills without changing special ingredients or original recipes`, () => {
    const { work, variant } = G.CHAPTER_RECIPE_VARIANTS[region];
    const project = G.PROJECTS[region];
    let s = town();
    const originalBill = G.processingBill(s, work);
    s = G.setWorkVariant(s, work, variant);
    const before = G.processingBill(s, work),
      output = G.processingOutput(s, work),
      seconds = G.workDuration(s, work);
    s = paid(s, region, project.choices[0].id);
    assert.deepEqual(
      G.processingBill(s, work),
      before,
      'one construction has no joint-supply discount',
    );
    s = paid(s, region, project.choices[1].id);
    const after = G.processingBill(s, work);
    assert.ok(
      Object.entries(before.cost).some(([id, n]) => after.cost[id] < n),
      'an actual resource bill decreases',
    );
    assert.deepEqual(after.materials, before.materials);
    assert.equal(G.processingOutput(s, work), output);
    assert.equal(G.workDuration(s, work), seconds);
    s = G.setWorkVariant(s, work, 'original');
    assert.deepEqual(G.processingBill(s, work), originalBill);
  });
}

test('missing money or special ingredients never partially pays an initial or extended construction', () => {
  for (const extension of [false, true])
    for (const kind of ['resource', 'material']) {
      let s = town();
      if (extension) s = paid(s, 0, 'forest');
      const choice = extension ? 'river' : 'forest';
      if (kind === 'resource') s.resources.wood = 0;
      else s.world.materials.boards = 0;
      const before = structuredClone(s);
      assert.notEqual(G.chapterProjectReason(s, 0, choice), '');
      assert.equal(G.completeChapterProject(s, 0, choice), s);
      assert.deepEqual(s, before);
    }
});

test('choosing the forest and sand projects in a different order changes actual production and supply before convergence', () => {
  const s = town(),
    baseline = G.production(s);
  const forest = paid(s, 0, 'forest'),
    river = paid(s, 0, 'river');
  assert.ok(G.production(forest).wood > G.production(river).wood);
  assert.ok(G.production(river).food > G.production(forest).food);
  assert.ok(
    G.routeInfo(river, 0, 'survey').cost <
      G.routeInfo(forest, 0, 'survey').cost,
  );
  const bothA = paid(forest, 0, 'river'),
    bothB = paid(river, 0, 'forest');
  assert.deepEqual(G.production(bothA), G.production(bothB));
  const miners = paid(s, 2, 'miners'),
    traders = paid(s, 2, 'traders');
  assert.ok(G.production(miners).iron > baseline.iron);
  assert.ok(G.production(traders).gold > G.production(miners).gold);
  assert.ok(
    G.routeInfo(traders, 2, 'survey').duration <
      G.routeInfo(miners, 2, 'survey').duration,
  );
  assert.deepEqual(
    G.production(paid(miners, 2, 'traders')),
    G.production(paid(traders, 2, 'miners')),
  );
});

test('undiscovered chapters and their recipe stories stay hidden; each earned story is recorded once', () => {
  const fresh = G.freshState(12);
  for (let region = 0; region < 6; region++) {
    assert.equal(G.chapterProjectDiscovered(fresh, region), false);
    assert.equal(
      G.STORY_BEATS.find((b) => b.id === `chapter-work-${region}`).when(fresh),
      false,
    );
  }
  let s = town();
  for (let region = 0; region < 6; region++)
    for (const choice of G.PROJECTS[region].choices)
      s = paid(s, region, choice.id);
  const settled = G.settleStory(s);
  assert.deepEqual(G.settleStory(settled), settled);
  for (let region = 0; region < 6; region++) {
    assert.equal(
      settled.chronicle.filter((id) => id === `chapter-work-${region}`).length,
      1,
    );
    assert.equal(
      settled.chronicle.filter((id) => id === `chapter-home-${region}`).length,
      1,
    );
  }
});

test('malformed, duplicate, unearned or unknown extension records are rejected', () => {
  for (const record of [
    null,
    [],
    { unknown: 'forest' },
    { watch: 'forest' },
    { watch: 'unknown' },
    { bell: 'home' },
  ]) {
    const s = town();
    s.projects.watch = 'forest';
    s.projectExtensions = record;
    assert.throws(() => G.validateChapterProjects(s));
  }
  const s = town();
  s.projects.watch = 'forest';
  s.projectExtensions = { watch: 'river' };
  s.guild.depths[0] = 3;
  assert.throws(() => G.validateChapterProjects(s));
});

test('historical paid choices survive migration without inventing extensions, charges or rewards', () => {
  const old = JSON.parse(
    gunzipSync(
      readFileSync(new URL('./fixtures/v5-campaign.json.gz', import.meta.url)),
    ).toString('utf8'),
  ).afterRebuild;
  const s = G.decodeSave(JSON.stringify(old));
  assert.deepEqual(s.projects, old.projects);
  assert.equal(s.projectExtensions, undefined);
  assert.deepEqual(s.resources, old.resources);
  assert.deepEqual(s.world.materials, old.world.materials);
  assert.deepEqual(s.guild.inventory, old.guild.inventory);
  for (const [id, choice] of Object.entries(old.projects))
    assert.equal(G.chosen(s, id, choice), true);
  assert.deepEqual(G.decodeSave(JSON.stringify(s)), s);
});
