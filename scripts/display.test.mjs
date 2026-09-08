import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/realm.ts';
import { optionLabel } from '../lib/display.ts';
import { HELP, affixHelp, talentHelp } from '../lib/glossary.ts';
import { TREE_SKILLS } from '../lib/skill-tree-data.ts';

test('equipment selectors cover all six wearable slots with Chinese names', () => {
  const expected = {
    weapon: '武器',
    armor: '护甲',
    charm: '饰品',
    head: '头部',
    hands: '手部',
    feet: '足部',
  };
  assert.deepEqual(
    Object.fromEntries(G.GEAR_SLOT_OPTIONS.map((o) => [o.value, o.label])),
    expected,
  );
  for (const recipe of G.RECIPES) {
    assert.equal(
      optionLabel(G.GEAR_SLOT_OPTIONS, recipe.slot),
      expected[recipe.slot],
      recipe.id,
    );
  }
});

test('selected captions resolve dynamic values and never expose missing internal IDs', () => {
  const options = [
    { value: '', label: '不携带' },
    { value: 'rhea.a1', label: '守家之誓' },
  ];
  assert.equal(optionLabel(options, ''), '不携带');
  assert.equal(optionLabel(options, 'rhea.a1'), '守家之誓');
  assert.equal(optionLabel(options, 'retired.skill.id'), '请选择');
  assert.equal(optionLabel([], 'hands'), '暂无可选项');
  assert.equal(
    optionLabel([{ value: 'hands', label: '手部' }], 'hands'),
    '手部',
  );
});

test('published talent, affix, origin, set and skill descriptions use percentage notation', () => {
  const state = G.freshState(73),
    hero = G.makeApplicant(state, 'rhea');
  const entries = [
    ...Object.values(HELP),
    ...G.TALENTS,
    ...G.AFFIXES,
    ...G.ORIGINS,
    ...G.EQUIPMENT_SETS,
    ...TREE_SKILLS,
    ...G.SKILL_TREE_NODES.map((node) => G.skillNodeHelp(hero, node)),
    ...G.TALENTS.map((t) => talentHelp(t.id)),
    ...G.TALENTS.map((t) =>
      G.characterTalentHelp({ ...hero, talent: t.id, talentVersion: 2 }),
    ),
  ];
  for (const entry of entries) {
    for (const key of ['name', 'title', 'text', 'description', 'body']) {
      if (typeof entry[key] !== 'string') continue;
      assert.doesNotMatch(
        entry[key],
        /百分点|\b(?:weapon|armor|charm|head|hands|feet|physical|shadow|radiant|undefined|NaN)\b/,
        `${key}: ${entry[key]}`,
      );
    }
  }
});

test('crit, dodge and critical-damage affix details show percentages instead of raw fractions', () => {
  const state = G.freshState(74);
  for (const [stat, percent] of [
    ['crit', 8],
    ['dodge', 6],
    ['critDamage', 20],
  ]) {
    const affix = G.AFFIXES.findIndex((a) => a.stat === stat);
    const gear = {
      id: 'display-check',
      recipe: 'blade',
      tier: 1,
      rarity: 1,
      affix,
      upgrade: 0,
    };
    assert.match(
      affixHelp(affix, state, gear).body,
      new RegExp(`原始贡献为 \\+${percent}%`),
    );
    assert.equal(
      G.itemStats(state, gear)[stat],
      percent / 100,
      'wording must not alter the numeric contribution',
    );
  }
});

test('diligent minus three percent remains an additive crit penalty', () => {
  const state = G.freshState(75),
    hero = G.makeApplicant(state, 'finn');
  Object.assign(hero, {
    talent: 'diligent',
    talentVersion: 2,
    flaw: 'overcome',
    equipment: {},
    learnedNodes: [],
  });
  const before = G.individualStats(state, { ...hero, talentVersion: 1 }).crit;
  const after = G.individualStats(state, hero).crit;
  assert.ok(Math.abs(after - Math.max(0, before - 0.03)) < 1e-10);
  assert.match(G.characterTalentHelp(hero).body, /暴击率 -3%/);
});
