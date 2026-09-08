import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/realm.ts';

// Constructed, validator-accepted unit fixtures with four away and two at home.
// No legal-campaign claim, player-save access or Site writes.
// Run: node --experimental-strip-types --test reserve-tests.mjs
const copy = structuredClone;
const modes = ['expedition', 'battle'];
const reload = (s) => G.decodeSave(JSON.stringify(s));
const hero = (s, id) => s.heroes.find((h) => h.id === id);
const item = (s, id) => s.guild.inventory.find((g) => g.id === id);
const resourceKeys = Object.keys(G.RESOURCE_NAMES);
function gear(s, recipe, owner) {
  const g = {
    id: `gear-${++s.guild.serial}`,
    recipe,
    tier: 3,
    rarity: 3,
    upgrade: 2,
    affix: 2,
  };
  s.guild.inventory.push(g);
  if (owner)
    owner.equipment[G.RECIPES.find((r) => r.id === recipe).slot] = g.id;
  return g.id;
}
function fixture(mode) {
  let s = G.freshState(1);
  s.rng = 123456789;
  s.assigned = true;
  s.event = 0;
  s.order.enabled = false;
  s.cleared = [0, 1, 2];
  for (const r of [0, 1, 2, 3]) {
    s.survey[r] = G.REGIONS[r].thresholds[1];
    s.projects[G.PROJECTS[r].id] = G.PROJECTS[r].choices[0].id;
    s.guild.depths[r] = 5;
    s.guild.intel[r] = 100;
  }
  delete s.world;
  G.migrateWorld(s);
  s.research.push('baskets');
  for (const b of G.BUILDINGS) s.buildings[b.id] = G.buildingLimit(s, b.id);
  s.population = G.populationCap(s);
  s.kit = 3;
  s.guild.dust = 1000;
  s.guild.salvage[3] = 30;
  G.ensureApplicants(s);
  for (const k of resourceKeys) s.resources[k] = G.capacity(s, k);
  for (let i = 0; i < 6; i++) {
    const h = G.makeApplicant(s, G.HEROES[i].id);
    Object.assign(h, {
      level: 16,
      xp: 0,
      quality: 5,
      origin: i === 4 ? '隐修者' : '边境流民',
      mastery: 1,
      talent: 'diligent',
      flaw: 'frail',
      weapon: 0,
      armor: 0,
    });
    h.aptitude = { hp: 100, attack: 100, defense: 100 };
    s.heroes.push(h);
    gear(s, i === 1 ? 'bow' : 'blade', h);
    gear(s, 'shadowcoat', h);
    gear(s, 'wardstone', h);
  }
  s.party = s.heroes.slice(0, 4).map((h) => h.id);
  const reserve = s.heroes.slice(4).map((h) => h.id);
  for (const id of G.MATERIAL_IDS) s.world.materials[id] = Math.min(200, G.materialCapacity(s, id));
  const idle = [gear(s, 'blade'), gear(s, 'plate')];
  assert.deepEqual(
    reload(s),
    s,
    'base fixture must satisfy current save validation',
  );
  const before = s;
  s =
    mode === 'expedition' ? G.expedition(s, 3, 'survey') : G.startBattle(s, 3);
  assert.notEqual(
    s,
    before,
    mode === 'expedition'
      ? G.dispatchReason(before, 3, 'survey', 0)
      : G.bossReason(before, 3),
  );
  assert.deepEqual(reload(s), s);
  return { s, reserve, idle };
}
function front(s) {
  const heroes = s.party.map((id) => hero(s, id));
  const worn = heroes.flatMap((h) => Object.values(h.equipment));
  return copy({
    party: s.party,
    heroes,
    gear: s.guild.inventory.filter((g) => worn.includes(g.id)),
    expedition: s.expedition,
    battle: s.battle,
    stats: G.partyStats(s),
    profile: G.partyProfile(s),
    preparation: s.guild.preparation,
  });
}
function allowed(s, action, label) {
  const original = copy(s),
    protectedBefore = front(s);
  const next = action(s);
  assert.notEqual(next, s, `${label} should succeed`);
  assert.deepEqual(s, original, `${label} mutated source`);
  assert.deepEqual(
    front(next),
    protectedBefore,
    `${label} affected deployed party`,
  );
  assert.deepEqual(reload(next), next, `${label} must produce a valid save`);
  return next;
}
function blocked(s, action, label) {
  const original = copy(s);
  assert.equal(action(s), s, `${label} should return original state`);
  assert.deepEqual(s, original, `${label} spent resources or mutated state`);
}
function charged(before, after, cost) {
  for (const k of resourceKeys)
    assert.ok(
      Math.abs(before.resources[k] - after.resources[k] - (cost[k] || 0)) <
        1e-8,
      k,
    );
}
function adjustments(start, reserve, idle) {
  let s = start;
  const [a, b] = reserve;
  s = allowed(s, (x) => G.train(x, a), 'reserve train');
  s = allowed(s, (x) => G.mentorHero(x, a), 'reserve mastery');
  s = allowed(s, (x) => G.mentorHero(x, a, true), 'reserve overcome');
  const transfer = hero(s, b).equipment.weapon;
  s = allowed(s, (x) => G.equipGear(x, a, transfer), 'reserve transfer');
  s = allowed(s, (x) => G.enhanceGear(x, transfer), 'reserve enhance');
  s = allowed(s, (x) => G.reforgeGear(x, transfer, 3), 'reserve reforge');
  s = allowed(s, (x) => G.unequipGear(x, a, 'armor'), 'reserve unload one');
  s = allowed(s, (x) => G.unequipAllGear(x, a), 'reserve unload all');
  s = allowed(s, (x) => G.dismantleGear(x, idle[0], { includeEnhanced: true }), 'idle dismantle');
  s = allowed(s, (x) => G.dismissHero(x, b), 'reserve dismiss');
  return s;
}

test('four deployed and two reserves: away helpers, fixed party and valid save in both modes', () => {
  for (const mode of modes) {
    const { s, reserve, idle } = fixture(mode);
    assert.equal(s.party.length, 4);
    assert.equal(reserve.length, 2);
    for (const h of s.heroes) {
      const away = s.party.includes(h.id);
      assert.equal(G.heroAway(s, h.id), away);
      assert.equal(Boolean(G.heroAwayReason(s, h.id)), away);
      for (const id of Object.values(h.equipment))
        assert.equal(G.gearAway(s, id), away);
      blocked(s, (x) => G.toggleParty(x, h.id), `party lock ${mode}/${h.id}`);
    }
    for (const id of idle) assert.equal(G.gearAway(s, id), false);
    assert.deepEqual(reload(s), s);
  }
});

test('reserve training, mastery and overcoming flaws charge exact costs without touching deployment', () => {
  for (const mode of modes) {
    const { s, reserve } = fixture(mode);
    const id = reserve[0];
    for (const [name, action, cost, check] of [
      [
        'train',
        (x) => G.train(x, id),
        G.trainCost(hero(s, id)),
        (h) => assert.equal(h.level, hero(s, id).level + 1),
      ],
      [
        'mastery',
        (x) => G.mentorHero(x, id),
        G.masteryCost(hero(s, id)),
        (h) => assert.equal(h.mastery, hero(s, id).mastery + 1),
      ],
      [
        'overcome',
        (x) => G.mentorHero(x, id, true),
        { gold: 120, food: 60 },
        (h) => assert.equal(h.flaw, 'overcome'),
      ],
    ]) {
      const next = allowed(s, action, `${mode}/${JSON.stringify(name)}`);
      charged(s, next, cost);
      const materials = name === 'mastery' ? G.masteryMaterials(s, hero(s, id)) : {};
      for (const key of G.MATERIAL_IDS)
        assert.equal(s.world.materials[key] - next.world.materials[key], materials[key] || 0, `${name}: ${key}`);
      check(hero(next, id));
    }
  }
});

test('reserves equip idle gear, transfer between reserves, unload one/all and dismiss with gear retained', () => {
  for (const mode of modes) {
    let { s } = fixture(mode);
    const { reserve, idle } = fixture(mode);
    const [a, b] = reserve;
    s = allowed(s, (x) => G.equipGear(x, a, idle[0]), 'equip idle');
    assert.equal(hero(s, a).equipment.weapon, idle[0]);
    const transferred = hero(s, b).equipment.weapon;
    s = allowed(
      s,
      (x) => G.equipGear(x, a, transferred),
      'transfer reserve gear',
    );
    assert.equal(hero(s, b).equipment.weapon, undefined);
    assert.equal(hero(s, a).equipment.weapon, transferred);
    const inventory = copy(s.guild.inventory);
    s = allowed(s, (x) => G.unequipGear(x, a, 'weapon'), 'single unload');
    assert.equal(hero(s, a).equipment.weapon, undefined);
    assert.deepEqual(s.guild.inventory, inventory);
    s = allowed(s, (x) => G.unequipAllGear(x, a), 'all unload');
    assert.deepEqual(hero(s, a).equipment, {});
    assert.deepEqual(s.guild.inventory, inventory);
    blocked(s, (x) => G.unequipAllGear(x, a), 'already empty all unload');
    const equipped = Object.values(hero(s, b).equipment);
    s = allowed(s, (x) => G.dismissHero(x, b), 'reserve dismiss');
    assert.equal(hero(s, b), undefined);
    assert.ok(equipped.every((id) => item(s, id)));
    assert.deepEqual(s.guild.inventory, inventory);
  }
});

test('reserve and idle enhancements/reforges work; dismantling still requires an unworn item', () => {
  for (const mode of modes) {
    let { s } = fixture(mode);
    const { reserve, idle } = fixture(mode);
    const id = reserve[0];
    const carried = hero(s, id).equipment.weapon;
    for (const target of [carried, idle[0]]) {
      const before = s,
        cost = G.enhancementCost(item(s, target)),
        original = copy(item(s, target));
      s = allowed(s, (x) => G.enhanceGear(x, target), 'enhance available gear');
      charged(before, s, cost);
      assert.deepEqual(item(s, target), {
        ...original,
        upgrade: original.upgrade + 1,
      });
      const dust = s.guild.dust;
      const fragments = s.guild.salvage[original.rarity];
      s = allowed(
        s,
        (x) => G.reforgeGear(x, target, 3),
        'reforge available gear',
      );
      assert.equal(item(s, target).affix, 3);
      assert.equal(s.guild.dust, dust - 40 * original.tier * original.rarity);
      assert.equal(s.guild.salvage[original.rarity], fragments - 2 * original.tier);
    }
    blocked(
      s,
      (x) => G.dismantleGear(x, carried),
      'reserve worn gear cannot be dismantled',
    );
    const unworn = copy(item(s, idle[1])),
      dust = s.guild.dust;
    s = allowed(s, (x) => G.dismantleGear(x, idle[1], { includeEnhanced: true }), 'idle dismantle');
    assert.equal(item(s, idle[1]), undefined);
    assert.equal(s.guild.dust, dust + unworn.tier * unworn.rarity * 4);
    s = allowed(
      s,
      (x) => G.unequipGear(x, id, 'weapon'),
      'unload before dismantling',
    );
    s = allowed(
      s,
      (x) => G.dismantleGear(x, carried, { includeEnhanced: true }),
      'dismantle formerly worn reserve weapon',
    );
    assert.equal(item(s, carried), undefined);
  }
});

test('all deployed hero/gear edits and reserve theft reject atomically in both modes', () => {
  for (const mode of modes) {
    const { s, reserve, idle } = fixture(mode);
    for (const id of s.party) {
      for (const [name, action] of [
        ['train', (x) => G.train(x, id)],
        ['mastery', (x) => G.mentorHero(x, id)],
        ['overcome', (x) => G.mentorHero(x, id, true)],
        ['equip idle', (x) => G.equipGear(x, id, idle[0])],
        [
          'equip reserve',
          (x) => G.equipGear(x, id, hero(x, reserve[0]).equipment.weapon),
        ],
        ['all unload', (x) => G.unequipAllGear(x, id)],
        ['dismiss', (x) => G.dismissHero(x, id)],
      ])
        blocked(s, action, `${mode}/${id}/${JSON.stringify(name)}`);
      for (const [slot, gearId] of Object.entries(hero(s, id).equipment)) {
        blocked(s, (x) => G.unequipGear(x, id, slot), 'deployed single unload');
        blocked(s, (x) => G.enhanceGear(x, gearId), 'deployed enhancement');
        blocked(s, (x) => G.reforgeGear(x, gearId, 3), 'deployed reforge');
        blocked(s, (x) => G.dismantleGear(x, gearId), 'deployed dismantle');
        for (const target of reserve)
          blocked(
            s,
            (x) => G.equipGear(x, target, gearId),
            'reserve cannot take deployed gear',
          );
      }
    }
  }
});

test('a full reserve adjustment sequence preserves dispatch snapshot and deployed expedition outcome', () => {
  const { s, reserve, idle } = fixture('expedition');
  const adjusted = adjustments(s, reserve, idle);
  assert.deepEqual(front(adjusted), front(s));
  assert.equal(adjusted.rng, s.rng);
  const seconds = s.expedition.end - s.time;
  const a = G.advance(s, seconds),
    b = G.advance(adjusted, seconds);
  assert.equal(a.expedition, null);
  assert.equal(b.expedition, null);
  assert.deepEqual(a.party, b.party);
  assert.deepEqual(
    a.party.map((id) => hero(a, id)),
    b.party.map((id) => hero(b, id)),
  );
  for (const k of [
    'time',
    'region',
    'outcome',
    'success',
    'progress',
    'equipment',
    'route',
    'chance',
    'intelGain',
    'clues',
  ])
    assert.deepEqual(a.lastExpedition[k], b.lastExpedition[k], k);
  assert.equal(a.rng, b.rng);
  assert.deepEqual(reload(b), b);
});

test('reserve edits leave every subsequent recommended combat command and round identical', () => {
  const { s, reserve, idle } = fixture('battle');
  let baseline = s,
    adjusted = adjustments(s, reserve, idle),
    actions = 0;
  // A round contains up to four hero actions; compare through the combat turn limit.
  while (baseline.battle && actions < 260) {
    assert.deepEqual(adjusted.battle, baseline.battle);
    const command = G.recommendedCommand(baseline);
    assert.equal(
      G.recommendedCommand(adjusted),
      command,
      `recommendation at action ${actions + 1}`,
    );
    assert.equal(
      G.commandReason(adjusted, command),
      G.commandReason(baseline, command),
    );
    baseline = G.combat(baseline, command);
    adjusted = G.combat(adjusted, command);
    actions++;
    assert.deepEqual(
      adjusted.battle,
      baseline.battle,
      `battle after action ${actions}`,
    );
    assert.deepEqual(adjusted.party, baseline.party);
    assert.deepEqual(
      adjusted.party.map((id) => hero(adjusted, id)),
      baseline.party.map((id) => hero(baseline, id)),
    );
  }
  assert.ok(actions > 4, 'comparison must exercise multiple rounds');
  assert.equal(
    baseline.battle,
    null,
    'bounded battle must reach a terminal result',
  );
  assert.deepEqual(adjusted.cleared, baseline.cleared);
  assert.equal(adjusted.recoveryUntil, baseline.recoveryUntil);
  assert.deepEqual(reload(adjusted), adjusted);
});
