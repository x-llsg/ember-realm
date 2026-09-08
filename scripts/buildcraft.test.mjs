import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/realm.ts';

// Deliberately constructed mechanism fixtures. They do not claim legal progression.
// Only this external test file is written. Public actions are checked for payment,
// immutability and persistence; direct monsterEquipment calls exercise loot rules.
const copy = structuredClone;
const reload = (s) => G.decodeSave(JSON.stringify(s));
const close = (a, b, label = '') =>
  assert.ok(Math.abs(a - b) < 1e-7, `${label}: ${a} != ${b}`);
const recipes = ['blade', 'plate', 'vitality', 'cap', 'grips', 'boots'];
const keys = Object.keys(G.RESOURCE_NAMES);
function fund(s) {
  for (const key of keys) s.resources[key] = G.capacity(s, key);
  for (const id of G.MATERIAL_IDS)
    s.world.materials[id] = G.materialCapacity(s, id);
  return s;
}
function town() {
  const s = G.freshState(197723154);
  Object.assign(s.buildings, {
    fire: 1,
    warehouse: 4,
    hut: 3,
    lumber: 2,
    farm: 2,
    quarry: 2,
    market: 2,
    tavern: 2,
    forge: 2,
    shrine: 2,
  });
  s.population = 12;
  s.assigned = true;
  s.nextEventAt = 100000;
  s.guild.depths.fill(3);
  s.guild.depths[0] = 5;
  s.explored.fill(1);
  s.cleared = [1, 2, 3, 4];
  s.world.tech = G.TECHNOLOGIES.map((t) => t.id);
  s.research = ['tools', 'baskets', 'godslayer'];
  s.heroes = ['rhea', 'finn', 'luna', 'kael', 'orin', 'vera'].map((role) => {
    const h = G.makeApplicant(s, role);
    Object.assign(h, {
      level: 10,
      xp: 0,
      quality: 3,
      origin: '初代同行者',
      aptitude: { hp: 100, attack: 100, defense: 100 },
      talent: 'scholar',
      flaw: 'overcome',
      mastery: 0,
      learnedNodes: [],
      activeSkill: G.DEFAULT_SKILL[role],
    });
    delete h.talentVersion;
    return h;
  });
  s.party = s.heroes.slice(0, 4).map((h) => h.id);
  fund(s);
  assert.deepEqual(reload(s), s);
  return s;
}
function item(s, recipe = 'blade', setId, extra = {}) {
  const x = {
    id: `gear-${++s.guild.serial}`,
    recipe,
    tier: 1,
    rarity: 3,
    upgrade: 0,
    affix: 2,
    ...(setId ? { setId } : {}),
    ...extra,
  };
  s.guild.inventory.push(x);
  return x;
}
function wear(s, hero, ids, setId) {
  for (const recipe of ids) {
    const x = item(s, recipe, setId);
    hero.equipment[G.RECIPES.find((r) => r.id === recipe).slot] = x.id;
  }
}
function action(s, fn) {
  const before = copy(s),
    after = fn(s);
  assert.notEqual(after, s, 'public action must succeed');
  assert.deepEqual(s, before, 'input state unchanged');
  assert.deepEqual(reload(after), after, 'result reloads');
  return after;
}
function inverse(y, shift, left) {
  let x = y >>> 0;
  for (let i = 0; i < 32; i++)
    x = (y ^ (left ? x << shift : x >>> shift)) >>> 0;
  return x;
}
function seed(q) {
  return inverse(
    inverse(inverse(Math.floor(q * 4294967296) >>> 0, 5, true), 17, false),
    13,
    true,
  );
}
function merchant(s) {
  s.event = G.EVENTS.findIndex((e) => e.id === 'equipment_peddler');
  G.prepareVisitor(s);
  assert.ok(s.civic.offer);
  return s;
}
function fill(s, n) {
  while (s.guild.inventory.length < n) item(s);
  return s;
}

test('six different slots equip together and each contributes usable statistics', () => {
  let s = town();
  const id = s.heroes[0].id;
  assert.deepEqual(G.GEAR_SLOTS, [
    'weapon',
    'armor',
    'charm',
    'head',
    'hands',
    'feet',
  ]);
  for (const recipe of recipes) {
    const before = G.individualStats(s, s.heroes[0]),
      x = item(s, recipe);
    s = action(s, (s) => G.equipGear(s, id, x.id));
    const after = G.individualStats(s, s.heroes[0]);
    assert.ok(
      after.hp > before.hp ||
        after.attack > before.attack ||
        after.defense > before.defense,
      recipe,
    );
  }
  assert.equal(Object.keys(s.heroes[0].equipment).length, 6);
  assert.equal(new Set(Object.values(s.heroes[0].equipment)).size, 6);
});
test('new-slot transfer removes former owner, quick removal returns every piece without destroying it', () => {
  let s = town();
  wear(s, s.heroes[0], recipes, 'wildwatch');
  const ids = s.guild.inventory.map((x) => x.id);
  const cap = s.heroes[0].equipment.head;
  s = action(s, (s) => G.equipGear(s, s.heroes[1].id, cap));
  assert.equal(s.heroes[0].equipment.head, undefined);
  assert.equal(s.heroes[1].equipment.head, cap);
  s = action(s, (s) => G.unequipGear(s, s.heroes[1].id, 'head'));
  s = action(s, (s) => G.unequipAllGear(s, s.heroes[0].id));
  assert.deepEqual(s.heroes[0].equipment, {});
  assert.deepEqual(
    s.guild.inventory.map((x) => x.id),
    ids,
  );
});
test('away heroes and their new-slot gear stay locked while reserve new slots remain editable', () => {
  let s = town();
  wear(s, s.heroes[0], ['cap'], 'wildwatch');
  const reserveItem = item(s, 'boots');
  s = action(s, (s) => G.startBattle(s, 0));
  const snapshot = copy(s.battle);
  assert.equal(G.unequipGear(s, s.heroes[0].id, 'head'), s);
  assert.equal(G.equipGear(s, s.heroes[4].id, s.heroes[0].equipment.head), s);
  s = action(s, (s) => G.equipGear(s, s.heroes[4].id, reserveItem.id));
  s = action(s, (s) => G.unequipAllGear(s, s.heroes[4].id));
  assert.deepEqual(s.battle, snapshot);
});
test('two and four piece thresholds activate exactly once; six pieces do not duplicate a set bonus', () => {
  const s = town(),
    h = s.heroes[0];
  for (let n = 0; n <= 6; n++) {
    if (n) wear(s, h, [recipes[n - 1]], 'wildwatch');
    const bonus = G.setBonuses(s, h);
    close(bonus.hp || 0, n >= 2 ? 0.08 : 0);
    close(bonus.dodge || 0, n >= 4 ? 0.08 : 0);
    close(bonus.healing || 0, n >= 4 ? 0.15 : 0);
  }
});
test('four-plus-two and two-plus-two-plus-two builds combine independent thresholds', () => {
  const s = town(),
    h = s.heroes[0];
  wear(s, h, recipes.slice(0, 4), 'nightbell');
  wear(s, h, recipes.slice(4), 'ironvow');
  assert.deepEqual(G.setBonuses(s, h), {
    shadow: 0.15,
    shield: 0.25,
    cooldown: 0.1,
    defense: 0.15,
  });
  s.guild.inventory = [];
  h.equipment = {};
  wear(s, h, recipes.slice(0, 2), 'wildwatch');
  wear(s, h, recipes.slice(2, 4), 'abysswalk');
  wear(s, h, recipes.slice(4), 'dawnbreak');
  assert.deepEqual(G.setBonuses(s, h), {
    hp: 0.08,
    attack: 0.08,
    radiant: 0.15,
  });
});
test('set counts are personal and unworn equipment or a reserve set cannot boost another hero', () => {
  const s = town(),
    h = s.heroes[0];
  wear(s, h, ['blade'], 'wildwatch');
  wear(s, s.heroes[4], recipes, 'wildwatch');
  item(s, 'cap', 'wildwatch');
  assert.deepEqual(G.setBonuses(s, h), {});
  assert.equal(G.equippedSets(s, h)[0].count, 1);
  const withoutReserve = copy(s);
  withoutReserve.heroes[4].equipment = {};
  assert.deepEqual(G.partyStats(s), G.partyStats(withoutReserve));
});
test('set HP is included once in canonical statistics and is lost on removing a threshold piece', () => {
  let s = town();
  wear(s, s.heroes[0], recipes.slice(0, 4), 'ironvow');
  const plain = copy(s);
  for (const x of plain.guild.inventory) delete x.setId;
  const a = G.individualStats(s, s.heroes[0]),
    base = G.individualStats(plain, plain.heroes[0]);
  close(a.hp, base.hp * 1.15);
  close(a.defense, base.defense * 1.15);
  s = action(s, (s) => G.unequipGear(s, s.heroes[0].id, 'head'));
  assert.equal(G.setBonuses(s, s.heroes[0]).hp, undefined);
  close(G.setBonuses(s, s.heroes[0]).defense, 0.15);
});
test('set healing, shield and cooldown bonuses reach battle snapshots and respect the shared cap', () => {
  let s = town(),
    h = s.heroes[2];
  h.talentVersion = 2;
  h.talent = 'oracle';
  wear(s, h, recipes.slice(0, 4), 'nightbell');
  const tree = G.skillBonuses(h),
    before = copy(s);
  s = action(s, (s) => G.startBattle(s, 0));
  const u = s.battle.units.find((x) => x.id === h.id);
  close(u.healing, 1 + tree.healing + 0.25);
  close(u.shieldPower, 1 + tree.shield + 0.25 + 0.25);
  close(u.cooldownReduction, 0.3);
  const bonuses = G.buildBonuses(before, before.heroes[2]);
  for (const [key, value] of Object.entries({
    shadow: 0.15,
    shield: 0.5,
    cooldown: 0.3,
    healing: 0.25,
    attack: -0.2,
    critDamage: -0.2,
  }))
    close(bonuses[key], value, key);
});
test('unified talents apply both benefit and drawback, including sub-one healing snapshots', () => {
  let s = town(),
    h = s.heroes[0];
  const plain = G.individualStats(s, h);
  h.talentVersion = 2;
  h.talent = 'bloodedge';
  const changed = G.individualStats(s, h);
  close(changed.hp, plain.hp * 0.85);
  close(changed.attack, plain.attack * 1.18);
  close(changed.crit, plain.crit + 0.08);
  s = action(s, (s) => G.startBattle(s, 0));
  close(s.battle.units[0].healing, 0.8);
});
test('negative resistance and dodge cannot underflow and six-slot stacking respects combat caps', () => {
  const s = town(),
    h = s.heroes[0];
  h.talentVersion = 2;
  h.talent = 'glassstar';
  let a = G.individualStats(s, h);
  assert.equal(a.fire, 0);
  assert.equal(a.shadow, 0);
  assert.equal(a.radiant, 0);
  wear(s, h, recipes, 'dragonscar');
  for (const x of s.guild.inventory) x.affix = 7;
  a = G.individualStats(s, h);
  assert.equal(a.crit, 0.6);
  h.talent = 'livingwall';
  for (const x of s.guild.inventory) x.affix = 8;
  a = G.individualStats(s, h);
  assert.ok(a.dodge >= 0 && a.dodge <= 0.4);
  h.talent = 'warden';
  for (const x of s.guild.inventory) x.affix = 4;
  assert.equal(G.individualStats(s, h).fire, 0.75);
});
test('v9 migration preserves old positive-negative combinations and paid tempering', () => {
  for (const flaw of ['frail', 'hesitant', 'reckless', 'green', 'overcome']) {
    const s = town(),
      h = s.heroes[0];
    h.talent = 'hunter';
    h.flaw = flaw;
    s.version = 9;
    const baseline = copy(s);
    baseline.heroes[0].talent = 'scholar';
    baseline.heroes[0].flaw = 'overcome';
    const base = G.individualStats(baseline, baseline.heroes[0]);
    const loaded = reload(s),
      a = G.individualStats(loaded, loaded.heroes[0]);
    assert.equal(loaded.version, 10);
    assert.equal(loaded.heroes[0].talentVersion, undefined);
    close(a.attack, base.attack * 1.08 * (flaw === 'hesitant' ? 0.94 : 1));
    close(a.hp, base.hp * (flaw === 'frail' ? 0.92 : 1));
    close(a.defense, base.defense - (flaw === 'reckless' ? 2 : 0));
    assert.deepEqual(loaded.heroes[0], h);
    assert.deepEqual(reload(loaded), loaded);
  }
});
test('new talent experience and training preserve diligent economics; only legacy green adds the old penalty', () => {
  const s = town(),
    h = s.heroes[0];
  h.talent = 'diligent';
  h.flaw = 'green';
  close(G.talentExperience(h), 1.3 * 0.9);
  close(G.talentTraining(h), 0.85);
  const oldGold = G.trainCost(h).gold;
  h.talentVersion = 2;
  h.flaw = 'overcome';
  close(G.talentExperience(h), 1.3);
  close(G.talentTraining(h), 0.85);
  assert.equal(G.trainCost(h).gold, oldGold);
  const cost = G.payableTrainCost(s, h),
    trained = action(s, (s) => G.train(s, h.id));
  for (const key of keys)
    close(s.resources[key] - trained.resources[key], cost[key] || 0, key);
  assert.equal(trained.heroes[0].talent, 'diligent');
  assert.equal(trained.heroes[0].talentVersion, 2);
});
test('generated talents have actual rarity distribution independent of locked early hero potential', () => {
  const s = G.freshState(7654321),
    counts = [0, 0, 0, 0, 0];
  let lowGold = false;
  for (let n = 0; n < 2500; n++) {
    const h = G.makeApplicant(s, 'rhea'),
      t = G.TALENTS.find((t) => t.id === h.talent);
    assert.equal(h.talentVersion, 2);
    assert.equal(h.flaw, 'overcome');
    assert.ok(h.quality <= 3);
    counts[t.rarity - 1]++;
    if (t.rarity === 5 && h.quality <= 2) lowGold = true;
  }
  assert.equal(lowGold, true);
  for (const [i, p] of [0.4, 0.3, 0.2, 0.08, 0.02].entries())
    assert.ok(Math.abs(counts[i] / 2500 - p) < 0.035, `${i + 1}: ${counts[i]}`);
});
test('all six equipment rarities increase native stats and retain their relative quality value', () => {
  const s = town();
  const white = G.itemStats(s, {
    id: 'quality-baseline',
    recipe: 'blade',
    tier: 1,
    rarity: 1,
    affix: 2,
    upgrade: 0,
  }, false);
  let last = 0;
  assert.equal(G.QUALITY_NAMES.length, 6);
  for (let rarity = 1; rarity <= 6; rarity++) {
    const g = {
        id: 'gear-1',
        recipe: 'blade',
        tier: 1,
        rarity,
        affix: 2,
        upgrade: 0,
      },
      stats = G.itemStats(s, g, false);
    assert.ok(stats.attack > last);
    last = stats.attack;
    close(stats.attack / white.attack, [1, 1.15, 1.3, 1.45, 1.65, 1.85][rarity - 1]);
    assert.ok(!G.gearName(g).includes('undefined'));
  }
});

test('every recipe grows at every tier, quality and enhancement step without adding absent native stats', () => {
  const s = town();
  for (const recipe of G.RECIPES) {
    for (let tier = 1; tier <= 6; tier++) {
      for (let rarity = 1; rarity <= 6; rarity++) {
        for (let upgrade = 0; upgrade <= 8; upgrade++) {
          const gear = { id: 'growth-fixture', recipe: recipe.id, tier, rarity, upgrade, affix: 2 };
          const current = G.itemStats(s, gear, false);
          for (const key of ['hp', 'attack', 'defense']) {
            const label = `${recipe.id} T${tier} Q${rarity} +${upgrade} ${key}`;
            assert.ok(Number.isFinite(current[key]) && current[key] >= 0, label);
            if (!recipe[key]) {
              assert.equal(current[key], 0, label);
              continue;
            }
            for (const [axis, first] of [['tier', 1], ['rarity', 1], ['upgrade', 0]]) {
              if (gear[axis] <= first) continue;
              const previous = G.itemStats(s, { ...gear, [axis]: gear[axis] - 1 }, false);
              assert.ok(current[key] > previous[key], `${label}: ${axis} must improve`);
            }
          }
        }
      }
    }
  }
});

test('equipment growth and smithing never multiply native special effects or fixed affix bonuses', () => {
  const s = town();
  const fixedBonuses = { defense: 3, pierce: 0.12, fire: 0.15, shadow: 0.15, radiant: 0.15, crit: 0.08, dodge: 0.06, critDamage: 0.2 };
  for (const recipe of G.RECIPES) {
    for (const smithing of [0, 10]) {
      s.guild.doctrine.smithing = smithing;
      for (let tier = 1; tier <= 6; tier++) {
        for (let rarity = 1; rarity <= 6; rarity++) {
          for (const upgrade of [0, 3, 8]) {
            const gear = { id: 'special-fixture', recipe: recipe.id, tier, rarity, upgrade, affix: 2 };
            const base = G.itemStats(s, gear, false);
            for (const key of ['pierce', 'ranged', 'fire', 'shadow', 'radiant', 'crit', 'dodge', 'critDamage'])
              close(base[key], recipe[key] || 0, `${recipe.id} native ${key}`);
            for (const [affix, effect] of G.AFFIXES.entries()) {
              if (!(effect.stat in fixedBonuses)) continue;
              const actual = G.itemStats(s, { ...gear, affix });
              for (const key of Object.keys(base))
                close(actual[key] - base[key], key === effect.stat ? fixedBonuses[effect.stat] : 0,
                  `${recipe.id} T${tier} Q${rarity} +${upgrade} ${effect.stat} -> ${key}`);
            }
          }
        }
      }
    }
  }
});

test('native equipment defense receives the mitigation increase while the defensive affix stays exactly plus three', () => {
  const s = town();
  s.guild.doctrine.smithing = 5;
  const affix = G.AFFIXES.findIndex(a => a.stat === 'defense');
  for (const recipe of G.RECIPES.filter(r => r.defense && (r.attack || r.hp))) {
    for (let tier = 1; tier <= 6; tier++) {
      for (const rarity of [1, 3, 6]) {
        for (const upgrade of [0, 3, 8]) {
          const gear = { id: 'defense-fixture', recipe: recipe.id, tier, rarity, upgrade, affix };
          const native = G.itemStats(s, gear, false);
          const reference = recipe.attack ? native.attack / recipe.attack : native.hp / recipe.hp;
          close(native.defense / recipe.defense, reference * 2, `${recipe.id} native defense`);
          const equipped = G.itemStats(s, gear);
          close(equipped.defense - native.defense, 3, `${recipe.id} fixed defensive affix`);
          for (const key of Object.keys(native).filter(key => key !== 'defense'))
            close(equipped[key], native[key], `${recipe.id} defensive affix leaves ${key} unchanged`);
        }
      }
    }
  }
});

test('attack and health affixes keep gaining value with paid equipment development', () => {
  const s = town();
  for (const recipe of G.RECIPES) {
    for (const stat of ['hp', 'attack']) {
      const affix = G.AFFIXES.findIndex((a) => a.stat === stat);
      const gear = { id: 'flat-affix-fixture', recipe: recipe.id, tier: 1, rarity: 1, upgrade: 0, affix };
      const contribution = (g) => G.itemStats(s, g)[stat] - G.itemStats(s, g, false)[stat];
      assert.ok(contribution(gear) > 0, `${recipe.id} ${stat}`);
      for (const [axis, from, to] of [['tier', 1, 6], ['rarity', 1, 6], ['upgrade', 0, 8]]) {
        let previous = contribution({ ...gear, [axis]: from });
        for (let value = from + 1; value <= to; value++) {
          const current = contribution({ ...gear, [axis]: value });
          assert.ok(current > previous, `${recipe.id} ${stat} ${axis} ${value}`);
          previous = current;
        }
      }
      const before = contribution(gear);
      s.guild.doctrine.smithing = 10;
      assert.ok(contribution(gear) > before, `${recipe.id} ${stat} smithing`);
      s.guild.doctrine.smithing = 0;
    }
  }
});

test('legacy and current saves retain gear identity, investments, sets and ownership after equipment rebalance', () => {
  for (const version of [9, 10]) {
    const s = town();
    s.version = version;
    for (let tier = 1; tier <= 6; tier++) {
      for (let rarity = 1; rarity <= 6; rarity++) {
        const index = (tier - 1) * 6 + rarity - 1;
        const gear = item(s, recipes[index % recipes.length], G.EQUIPMENT_SETS[index % 6].id, {
          tier, rarity, upgrade: index % 9, affix: index % G.AFFIXES.length,
        });
        if (index < 6)
          s.heroes[0].equipment[G.RECIPES.find((r) => r.id === gear.recipe).slot] = gear.id;
      }
    }
    const before = copy(s);
    const stats = G.individualStats(s, s.heroes[0]);
    const loaded = reload(s);
    assert.deepEqual(s, before, 'loading does not modify the input save');
    assert.deepEqual(loaded.guild.inventory, before.guild.inventory);
    assert.equal(loaded.guild.serial, before.guild.serial);
    assert.deepEqual(loaded.heroes.map((h) => h.equipment), before.heroes.map((h) => h.equipment));
    assert.deepEqual(G.individualStats(loaded, loaded.heroes[0]), stats);
    assert.deepEqual(reload(loaded), loaded);
  }
});
test('ordinary forging reaches gold but never red and charges exactly the quoted bill', () => {
  for (const [q, rarity] of [
    [0.001, 1],
    [0.6, 2],
    [0.9, 3],
    [0.97, 4],
    [0.999, 5],
  ]) {
    const s = town();
    s.rng = seed(q);
    const cost = G.recipeCost(s, 'blade', 1),
      material = G.recipeMaterialCost(s, 'blade', 1);
    const after = action(s, (s) => G.craftGear(s, 'blade', 1));
    const gear = after.guild.inventory.at(-1);
    assert.equal(gear.rarity, rarity);
    assert.equal(gear.setId, undefined);
    for (const key of keys)
      close(s.resources[key] - after.resources[key], cost[key] || 0);
    for (const key of G.MATERIAL_IDS)
      close(
        s.world.materials[key] - after.world.materials[key],
        material[key] || 0,
      );
  }
});
test('the fourth craft still guarantees blue without accidentally creating boss equipment', () => {
  const s = town();
  s.guild.crafts = 3;
  s.rng = seed(0.001);
  const after = action(s, (s) => G.craftGear(s, 'cap', 1));
  assert.equal(after.guild.inventory.at(-1).rarity, 3);
  assert.equal(after.guild.inventory.at(-1).setId, undefined);
});
test('boss loot has exact blue-purple-gold-red boundaries and always contains one local set item', () => {
  for (const [q, rarity] of [
    [0.00001, 6],
    [0.01999, 6],
    [0.02001, 5],
    [0.09999, 5],
    [0.10001, 4],
    [0.39999, 4],
    [0.40001, 3],
    [0.99999, 3],
  ]) {
    const s = town();
    s.rng = seed(q);
    const n = s.guild.inventory.length;
    G.monsterEquipment(s, 0, 'boss');
    const x = s.guild.inventory.at(-1);
    assert.equal(s.guild.inventory.length, n + 1);
    assert.equal(x.rarity, rarity);
    assert.equal(x.setId, 'wildwatch');
    assert.equal(x.tier, 1);
    assert.deepEqual(reload(s), s);
  }
});
test('all six boss pools use their own region set and tier cap and can reach all six slots', () => {
  const slots = new Set();
  for (let region = 0; region < 6; region++) {
    const s = town();
    for (let n = 0; n < 32; n++) {
      G.monsterEquipment(s, region, 'boss');
      const x = s.guild.inventory.at(-1);
      assert.equal(
        G.EQUIPMENT_SETS.find((set) => set.id === x.setId).region,
        region,
      );
      assert.ok(x.tier <= [1, 2, 2, 4, 4, 6][region]);
      assert.ok(x.tier <= G.gearTier(s));
      slots.add(G.RECIPES.find((r) => r.id === x.recipe).slot);
    }
  }
  assert.deepEqual([...slots].sort(), [...G.GEAR_SLOTS].sort());
});
test('third guardians guarantee local blue-or-purple; ordinary guardians can miss and never generate red', () => {
  for (const q of [0.001, 0.5, 0.999]) {
    const s = town();
    s.battle = { node: 2 };
    s.rng = seed(q);
    G.monsterEquipment(s, 0, 'guardian');
    assert.equal(s.guild.inventory.length, 1);
    assert.ok([3, 4].includes(s.guild.inventory[0].rarity));
  }
  const missing = town();
  missing.rng = seed(0.9);
  G.monsterEquipment(missing, 0, 'guardian');
  assert.equal(missing.guild.inventory.length, 0);
  const s = town();
  for (let n = 0; n < 80; n++) G.monsterEquipment(s, 1, 'guardian');
  assert.ok(s.guild.inventory.length > 0);
  assert.ok(s.guild.inventory.every((x) => x.rarity >= 2 && x.rarity <= 4));
});
test('full equipment storage prevents a paid boss challenge before deducting supplies', () => {
  const s = fill(town(), G.INVENTORY_CAP),
    before = copy(s);
  assert.equal(G.startBattle(s, 0), s);
  assert.match(G.bossReason(s, 0), /装备/);
  assert.deepEqual(s, before);
});
test('ongoing battle reserves its final loot slot against both forging and visitor purchase', () => {
  let s = fill(town(), 118);
  s = action(s, (s) => G.startBattle(s, 0));
  s = action(s, (s) => G.craftGear(s, 'blade', 1));
  assert.equal(s.guild.inventory.length, 119);
  const battle = copy(s.battle);
  assert.equal(G.craftGear(s, 'blade', 1), s);
  merchant(s);
  const choice = G.EVENTS[s.event].choices.findIndex((c) => c.equipment);
  assert.ok(G.eventChoiceReason(s, choice));
  assert.equal(G.chooseEvent(s, choice), s);
  assert.deepEqual(s.battle, battle);
  s.battle.enemyHp = 1;
  s.battle.enemyDodge = 0;
  s = G.combat(s, G.commandFor(s.battle.selected, 'attack'));
  assert.equal(s.battle, null);
  assert.equal(s.guild.inventory.length, 120);
  assert.equal(s.lastBattle.won, true);
  assert.deepEqual(reload(s), s);
});
test('boss rematches preserve first-clear rewards, guarantee another set and use a 180 game-second cooldown', () => {
  let s = town();
  s = action(s, (s) => G.startBattle(s, 0));
  s.battle.enemyHp = 1;
  s.battle.enemyDodge = 0;
  s = G.combat(s, G.commandFor(s.battle.selected, 'attack'));
  assert.equal(s.guild.bossHunts.wins[0], 1);
  assert.equal(s.guild.bossHunts.readyAt[0], 180);
  assert.equal(s.guild.inventory.length, 1);
  const paused = copy(s);
  paused.paused = true;
  assert.equal(G.advance(paused, 180).time, 0);
  assert.ok(G.bossReason(G.advance(s, 179), 0));
  s = G.advance(s, 180);
  assert.equal(G.bossReason(s, 0), '');
  const xp = s.heroes.map((h) => h.xp),
    cleared = copy(s.cleared),
    cost = G.battlePreparationCost(s),
    resources = copy(s.resources);
  s = G.startBattle(s, 0);
  s.battle.enemyHp = 1;
  s.battle.enemyDodge = 0;
  s = G.combat(s, G.commandFor(s.battle.selected, 'attack'));
  assert.equal(s.guild.bossHunts.wins[0], 2);
  assert.equal(s.guild.bossHunts.readyAt[0], 360);
  assert.equal(s.guild.inventory.length, 2);
  assert.deepEqual(s.cleared, cleared);
  assert.deepEqual(
    s.heroes.map((h) => h.xp),
    xp,
  );
  for (const key of keys)
    close(s.resources[key], resources[key] - (cost[key] || 0), key);
  assert.deepEqual(reload(s), s);
});
test('retreat awards no set item, no win counter and no boss cooldown', () => {
  let s = town();
  s = G.startBattle(s, 0);
  s = action(s, (s) => G.combat(s, 'retreat'));
  assert.equal(s.guild.inventory.length, 0);
  assert.equal(s.guild.bossHunts?.wins[0] || 0, 0);
  assert.equal(s.guild.bossHunts?.readyAt[0] || 0, 0);
});
test('new rarity, set, slots and talent version persist while malformed variants are rejected', () => {
  const s = town();
  wear(s, s.heroes[0], recipes, 'dawnbreak');
  for (const x of s.guild.inventory) x.rarity = 6;
  s.heroes[0].talentVersion = 2;
  s.heroes[0].talent = 'oracle';
  assert.deepEqual(reload(s), s);
  for (const mutate of [
    (x) => (x.guild.inventory[0].rarity = 7),
    (x) => (x.guild.inventory[0].rarity = 0),
    (x) => (x.guild.inventory[0].rarity = 3.5),
    (x) => (x.guild.inventory[0].setId = 'toString'),
    (x) => (x.guild.inventory[0].setId = []),
    (x) => (x.heroes[0].equipment.wings = x.guild.inventory[0].id),
    (x) => (x.heroes[0].talentVersion = 3),
    (x) => (x.heroes[0].talent = 'toString'),
    (x) => (x.heroes[1].equipment.weapon = x.guild.inventory[0].id),
  ]) {
    const bad = copy(s);
    mutate(bad);
    assert.throws(() => reload(bad));
  }
});
test('malformed boss hunt records cannot bypass cooldown validation', () => {
  const s = town();
  for (const value of [
    null,
    false,
    [],
    { wins: Array(6).fill(0), readyAt: Array(6).fill(0), extra: true },
    { wins: Array(6).fill(0), readyAt: [-1, 0, 0, 0, 0, 0] },
    { wins: [0, 0, 0, 0, 0], readyAt: Array(6).fill(0) },
  ]) {
    const bad = copy(s);
    bad.guild.bossHunts = value;
    assert.throws(() => reload(bad), JSON.stringify(value));
  }
});
test('merchant offered gear rejects unknown set metadata before it can become equipped inventory', () => {
  const s = merchant(town());
  s.civic.offer.gear.setId = 'not-a-real-set';
  assert.throws(() => reload(s));
});
test('recruiting a unified talent never describes an undefined separate flaw', () => {
  const s = town(),
    h = G.makeApplicant(s, 'rhea');
  s.guild.applicants = [h];
  const next = action(s, (s) => G.recruit(s, h.id));
  assert.ok(!next.log[0].text.includes('undefined'), next.log[0].text);
});
