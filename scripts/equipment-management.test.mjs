import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/realm.ts';

const reload = (s) => G.decodeSave(JSON.stringify(s));
const fixture = () => G.freshState(1);
function gear(s, values = {}) {
  const item = { id: `gear-${++s.guild.serial}`, recipe: 'blade', tier: 1,
    rarity: 1, affix: 0, upgrade: 0, ...values };
  s.guild.inventory.push(item);
  return item;
}
function owner(s, item) {
  const h = G.makeApplicant(s, 'rhea');
  s.heroes.push(h);
  h.equipment[G.RECIPES.find((r) => r.id === item.recipe).slot] = item.id;
  return h;
}
function unchanged(s, fn) {
  const before = structuredClone(s);
  assert.equal(fn(s), s);
  assert.deepEqual(s, before);
}

test('older saves gain no salvage and preserve gear, dust and chosen affix', () => {
  const s = fixture();
  gear(s, { rarity: 6, tier: 6, affix: 7, upgrade: 8 });
  s.guild.dust = 987;
  delete s.guild.salvage;
  const next = reload(s);
  assert.deepEqual(next.guild.salvage, G.freshSalvage());
  assert.deepEqual(next.guild.inventory, s.guild.inventory);
  assert.equal(next.guild.dust, 987);
  assert.deepEqual(reload(next), next);
});

for (const invalid of [null, [], {}, { 1: 0 }, { ...G.freshSalvage(), extra: 0 },
  { ...G.freshSalvage(), 3: -1 }, { ...G.freshSalvage(), 3: 0.5 },
  { ...G.freshSalvage(), 3: 10000 }, { ...G.freshSalvage(), 3: '1' }]) {
  test(`save rejects malformed salvage ${JSON.stringify(invalid)}`, () => {
    const s = fixture();
    s.guild.salvage = invalid;
    assert.throws(() => reload(s), /残片库存/);
  });
}
test('present undefined salvage is rejected rather than treated as a legacy omission', () => {
  const s = fixture();
  s.guild.salvage = undefined;
  assert.throws(() => G.validateSalvage(s), /残片库存/);
});
test('gear protection accepts only boolean save values', () => {
  for (const invalid of [0, 1, null, 'true', {}, []]) {
    const s = fixture();
    gear(s, { locked: invalid });
    assert.throws(() => reload(s), /装备记录/);
  }
  const s = fixture();
  gear(s, { locked: true });
  assert.deepEqual(reload(s).guild.inventory, s.guild.inventory);
});

for (let rarity = 1; rarity <= 6; rarity++) {
  test(`quality ${rarity} salvages only its own material and pays its complete reforge quote`, () => {
    let s = fixture();
    const target = gear(s, { rarity, tier: 3 });
    const a = gear(s, { rarity, tier: 3 }), b = gear(s, { rarity, tier: 3 });
    const initial = structuredClone(s);
    s = G.bulkDismantleGear(s, [a.id, b.id, a.id]);
    assert.equal(s.guild.dust, 24 * rarity);
    assert.equal(s.guild.salvage[rarity], 6);
    for (let other = 1; other <= 6; other++) if (other !== rarity) assert.equal(s.guild.salvage[other], 0);
    assert.equal(initial.guild.inventory.length, 3, 'input was not mutated');
    unchanged(s, (x) => G.bulkDismantleGear(x, [a.id, b.id]));
    const quote = G.reforgeQuote(s, target.id, 7);
    assert.equal(quote.dust, 120 * rarity);
    assert.equal(quote.material, 6);
    assert.match(quote.reason, /锻造尘不足/);
    s.guild.dust = quote.dust;
    const before = structuredClone(s);
    s = G.reforgeGear(s, target.id, 7);
    assert.equal(s.guild.dust, 0);
    assert.equal(s.guild.salvage[rarity], 0);
    assert.equal(s.guild.inventory[0].affix, 7);
    assert.equal(s.rng, before.rng);
    assert.deepEqual(s.resources, before.resources);
    assert.deepEqual(reload(s), s);
    unchanged(s, (x) => G.reforgeGear(x, target.id, 7));
  });
}

test('lower or higher quality material cannot pay for another quality, even with unlimited dust', () => {
  for (let rarity = 1; rarity <= 6; rarity++) {
    const s = fixture(), item = gear(s, { rarity, tier: 2 });
    s.guild.dust = 9999;
    for (let other = 1; other <= 6; other++) s.guild.salvage[other] = other === rarity ? 3 : 9999;
    assert.match(G.reforgeReason(s, item.id, 1), /残片不足/);
    unchanged(s, (x) => G.reforgeGear(x, item.id, 1));
  }
});
test('reforge rejects invalid selection and charges nothing when the affix is already selected', () => {
  const s = fixture(), item = gear(s);
  s.guild.dust = 9999;
  s.guild.salvage[1] = 99;
  for (const affix of [-1, 1.5, 999, NaN, '1', 0])
    unchanged(s, (x) => G.reforgeGear(x, item.id, affix));
  unchanged(s, (x) => G.reforgeGear(x, 'missing', 1));
});
test('default batch protects equipped, locked, set and enhanced gear while processing ordinary items once', () => {
  const s = fixture();
  const worn = gear(s), locked = gear(s, { locked: true }),
    set = gear(s, { setId: 'wildwatch' }), enhanced = gear(s, { upgrade: 1 }), spare = gear(s);
  owner(s, worn);
  const ids = [worn.id, locked.id, set.id, enhanced.id, spare.id, spare.id, 'missing'];
  const quote = G.dismantleQuote(s, ids);
  assert.deepEqual(quote.ids, [spare.id]);
  assert.equal(quote.skipped.length, 5);
  const next = G.bulkDismantleGear(s, ids);
  assert.deepEqual(next.guild.inventory.map((g) => g.id), [worn.id, locked.id, set.id, enhanced.id]);
  assert.equal(next.guild.dust, 4);
  assert.equal(next.guild.salvage[1], 1);
  unchanged(next, (x) => G.bulkDismantleGear(x, ids));
});
test('explicit set/enhancement opt-in can never override wearing or collection protection', () => {
  const s = fixture();
  const worn = gear(s, { setId: 'wildwatch', upgrade: 8 }), locked = gear(s, { locked: true }),
    set = gear(s, { setId: 'wildwatch' }), enhanced = gear(s, { upgrade: 1 });
  owner(s, worn);
  const options = { includeSets: true, includeEnhanced: true };
  const next = G.bulkDismantleGear(s, s.guild.inventory.map((g) => g.id), options);
  assert.deepEqual(next.guild.inventory.map((g) => g.id), [worn.id, locked.id]);
  assert.equal(next.guild.salvage[1], 2);
  assert.equal(G.dismantleQuote(s, [set.id, enhanced.id]).count, 0);
});
test('batch confirmation rechecks newly equipped or collected selections', () => {
  let s = fixture();
  const a = gear(s), b = gear(s), c = gear(s);
  const selected = G.dismantleQuote(s, [a.id, b.id, c.id]).ids;
  s = G.toggleGearLock(s, a.id, true);
  owner(s, b);
  s = G.bulkDismantleGear(s, selected);
  assert.deepEqual(s.guild.inventory.map((g) => g.id), [a.id, b.id]);
  assert.equal(s.guild.salvage[1], 1);
});
test('either dust or one quality overflow aborts the entire batch without losing another item', () => {
  for (const resource of ['dust', 'salvage']) {
    const s = fixture();
    const a = gear(s, { rarity: 1 }), b = gear(s, { rarity: 6, tier: 6 });
    if (resource === 'dust') s.guild.dust = 9998;
    else s.guild.salvage[6] = 9998;
    assert.match(G.dismantleQuote(s, [a.id, b.id]).reason, /容量不足/);
    unchanged(s, (x) => G.bulkDismantleGear(x, [a.id, b.id]));
    unchanged(s, (x) => G.dismantleGear(x, b.id));
  }
});
test('exact capacity is allowed and old absent salvage is initialized by a paid dismantle', () => {
  const s = fixture(), item = gear(s, { tier: 2 });
  s.guild.dust = 9991;
  s.guild.salvage[1] = 9997;
  const full = G.dismantleGear(s, item.id);
  assert.equal(full.guild.dust, 9999);
  assert.equal(full.guild.salvage[1], 9999);
  const old = fixture(), spare = gear(old);
  delete old.guild.salvage;
  assert.equal(G.dismantleGear(old, spare.id).guild.salvage[1], 1);
});
test('explicit overflow consent lets full-dust old and new saves earn their first matching salvage', () => {
  for (const legacy of [false, true]) {
    let s = fixture();
    const target = gear(s, { rarity: 3, tier: 2 }),
      a = gear(s, { rarity: 3, tier: 2 }), b = gear(s, { rarity: 3, tier: 2 });
    s.guild.dust = 9999;
    if (legacy) { delete s.guild.salvage; s = reload(s); }
    const ids = [a.id, b.id], before = structuredClone(s);
    const quote = G.dismantleQuote(s, ids);
    assert.equal(quote.dust, 0);
    assert.equal(quote.lostDust, 48);
    assert.equal(quote.salvage[3], 4);
    assert.match(quote.reason, /容量不足/);
    unchanged(s, (x) => G.bulkDismantleGear(x, ids));
    unchanged(s, (x) => G.bulkDismantleGear(x, ids, { allowOverflow: 'true' }));
    const approved = G.dismantleQuote(s, ids, { allowOverflow: true });
    assert.equal(approved.reason, '');
    s = G.bulkDismantleGear(s, ids, { allowOverflow: true });
    assert.equal(s.guild.dust, 9999);
    assert.equal(s.guild.salvage[3], 4);
    assert.equal(before.guild.inventory.length, 3);
    assert.match(s.log[0].text, /丢弃超量材料：锻造尘 48/);
    assert.equal(G.reforgeReason(s, target.id, 7), '');
    s = G.reforgeGear(s, target.id, 7);
    assert.equal(s.guild.dust, 9759);
    assert.equal(s.guild.salvage[3], 0);
    assert.equal(s.guild.inventory[0].affix, 7);
    assert.deepEqual(reload(s), s);
  }
});
test('overflow quote and execution agree for each partially full material stock', () => {
  const s = fixture(), plain = gear(s), red = gear(s, { tier: 6, rarity: 6 });
  s.guild.dust = 9990;
  s.guild.salvage[6] = 9997;
  const options = { allowOverflow: true }, ids = [plain.id, red.id];
  const quote = G.dismantleQuote(s, ids, options);
  assert.equal(quote.dust, 9);
  assert.equal(quote.lostDust, 139);
  assert.equal(quote.salvage[1], 1);
  assert.equal(quote.salvage[6], 2);
  assert.equal(quote.lostSalvage[6], 4);
  const next = G.bulkDismantleGear(s, ids, options);
  assert.equal(next.guild.dust - s.guild.dust, quote.dust);
  for (const { rarity } of G.SALVAGE_MATERIALS)
    assert.equal(next.guild.salvage[rarity] - s.guild.salvage[rarity], quote.salvage[rarity]);
  assert.match(next.log[0].text, /神话残片 4/);
  unchanged(next, (x) => G.bulkDismantleGear(x, ids, options));
});
test('overflow consent never overrides collection, wearing, set or enhancement protection', () => {
  const s = fixture();
  const worn = gear(s), locked = gear(s, { locked: true }),
    set = gear(s, { setId: 'wildwatch' }), upgraded = gear(s, { upgrade: 8 });
  owner(s, worn);
  s.guild.dust = 9999;
  const ids = [worn.id, locked.id, set.id, upgraded.id];
  unchanged(s, (x) => G.bulkDismantleGear(x, ids, { allowOverflow: true }));
  const next = G.bulkDismantleGear(s, ids, { allowOverflow: true, includeSets: true, includeEnhanced: true });
  assert.deepEqual(next.guild.inventory.map((g) => g.id), [worn.id, locked.id]);
  assert.equal(next.guild.salvage[1], 2);
});
test('explicit disposal can free an inventory slot when every resulting material is full', () => {
  const s = fixture(), item = gear(s, { tier: 6, rarity: 6 });
  s.guild.dust = 9999;
  s.guild.salvage[6] = 9999;
  unchanged(s, (x) => G.dismantleGear(x, item.id));
  const next = G.dismantleGear(s, item.id, { allowOverflow: true });
  assert.equal(next.guild.inventory.length, 0);
  assert.equal(next.guild.dust, 9999);
  assert.equal(next.guild.salvage[6], 9999);
  assert.match(next.log[0].text, /锻造尘 144、神话残片 6/);
});
test('collection is idempotent and protects dismantling without blocking paid enhancement or reforge', () => {
  let s = fixture(), item = gear(s);
  s.resources.iron = 8;
  s.resources.gold = 15;
  s.guild.dust = 40;
  s.guild.salvage[1] = 2;
  s = G.toggleGearLock(s, item.id, true);
  unchanged(s, (x) => G.toggleGearLock(x, item.id, true));
  unchanged(s, (x) => G.dismantleGear(x, item.id, { includeEnhanced: true, includeSets: true }));
  s = G.enhanceGear(s, item.id);
  assert.equal(s.guild.inventory[0].upgrade, 1);
  assert.equal(s.resources.iron, 0);
  assert.equal(s.resources.gold, 0);
  s = G.reforgeGear(s, item.id, 1);
  assert.equal(s.guild.inventory[0].affix, 1);
  assert.equal(s.guild.inventory[0].locked, true);
  s = G.toggleGearLock(s, item.id);
  assert.equal(s.guild.inventory[0].locked, undefined);
  assert.notEqual(G.dismantleGear(s, item.id, { includeEnhanced: true }), s);
});
test('valid saved applicant equipment transfers uniquely to a hero in every slot and survives reload', () => {
  for (const slot of G.GEAR_SLOTS) {
    let s = fixture();
    const recipe = G.RECIPES.find((r) => r.slot === slot).id;
    const incoming = gear(s, { recipe, rarity: 4, locked: true });
    const candidate = G.makeApplicant(s, 'rhea');
    candidate.equipment[slot] = incoming.id;
    s.guild.applicants.push(candidate);
    const previous = gear(s, { recipe });
    const recipient = owner(s, previous);
    s = reload(s);
    assert.equal(G.gearOwner(s, incoming.id).id, candidate.id);
    unchanged(s, (x) => G.dismantleGear(x, incoming.id,
      { allowOverflow: true, includeSets: true, includeEnhanced: true }));
    const before = structuredClone(s);
    const next = G.equipGear(s, recipient.id, incoming.id);
    assert.notEqual(next, s);
    assert.deepEqual(s, before);
    assert.equal(next.guild.applicants.find((h) => h.id === candidate.id).equipment[slot], undefined);
    assert.equal(next.heroes.find((h) => h.id === recipient.id).equipment[slot], incoming.id);
    assert.equal(G.gearOwner(next, incoming.id).id, recipient.id);
    assert.equal(G.gearOwner(next, previous.id), undefined);
    assert.deepEqual(next.guild.inventory, before.guild.inventory);
    assert.deepEqual(reload(next), next, `${slot}: transferred equipment must retain a single owner`);
  }
});
test('saved applicants can unload a single slot or all slots without changing another owner or losing gear', () => {
  let s = fixture();
  const candidate = G.makeApplicant(s, 'rhea');
  s.guild.applicants.push(candidate);
  for (const slot of G.GEAR_SLOTS) {
    const item = gear(s, { recipe: G.RECIPES.find((r) => r.slot === slot).id });
    candidate.equipment[slot] = item.id;
  }
  const heroItem = gear(s);
  const recipient = owner(s, heroItem);
  s = reload(s);
  for (const slot of G.GEAR_SLOTS) {
    const next = G.unequipGear(s, candidate.id, slot);
    assert.notEqual(next, s);
    const expected = { ...candidate.equipment };
    delete expected[slot];
    assert.deepEqual(next.guild.applicants.find((h) => h.id === candidate.id).equipment, expected);
    assert.deepEqual(next.heroes.find((h) => h.id === recipient.id), s.heroes.find((h) => h.id === recipient.id));
    assert.deepEqual(next.guild.inventory, s.guild.inventory);
    assert.equal(G.gearOwner(next, candidate.equipment[slot]), undefined);
    assert.deepEqual(reload(next), next);
    unchanged(next, (x) => G.unequipGear(x, candidate.id, slot));
  }
  const all = G.unequipAllGear(s, candidate.id);
  assert.deepEqual(all.guild.applicants.find((h) => h.id === candidate.id).equipment, {});
  assert.deepEqual(all.guild.inventory, s.guild.inventory);
  assert.deepEqual(all.heroes, s.heroes);
  assert.deepEqual(reload(all), all);
  unchanged(all, (x) => G.unequipAllGear(x, candidate.id));
  unchanged(s, (x) => G.unequipGear(x, 'missing', 'weapon'));
});
test('filtering combines quality, slot, set, ownership, collection and Chinese search without changing inventory order', () => {
  const s = fixture();
  const plain = gear(s), set = gear(s, { rarity: 4, recipe: 'plate', setId: 'wildwatch', locked: true }),
    rare = gear(s, { rarity: 3, recipe: 'plate', tier: 3 }), newest = gear(s, { rarity: 2 });
  owner(s, set);
  const before = structuredClone(s);
  assert.deepEqual(G.filterGear(s, { rarities: [3, 4], slot: 'armor', set: 'wildwatch',
    equipped: 'equipped', locked: 'locked', search: '林间守望' }).map((g) => g.id), [set.id]);
  assert.deepEqual(G.filterGear(s, { set: 'none', equipped: 'unequipped', locked: 'unlocked',
    search: '长剑' }).map((g) => g.id), [newest.id, plain.id]);
  assert.deepEqual(G.filterGear(s, { sort: 'rarity' }).map((g) => g.id), [set.id, rare.id, newest.id, plain.id]);
  assert.equal(G.filterGear(s, { sort: 'tier' })[0].id, rare.id);
  assert.equal(G.filterGear(s, { sort: 'recent' })[0].id, newest.id);
  assert.deepEqual(G.filterGear(s, { sort: 'name' }).map(G.gearName),
    s.guild.inventory.map(G.gearName).sort((a, b) => a.localeCompare(b, 'zh-CN')));
  assert.deepEqual(s, before);
});
