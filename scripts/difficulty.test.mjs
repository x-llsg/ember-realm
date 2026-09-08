import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/realm.ts';
import { GUARDIANS, BOSSES } from '../lib/guardian-candidates.ts';
import { combatRecommendation } from '../lib/combat-recommendation.ts';
import { recommendedFixture, difficultyBattle, difficultySeeds, nakedDifficultyVariants } from './difficulty-fixtures.mjs';

const count = Number(process.env.DIFFICULTY_SEEDS || 32);
const seeds = difficultySeeds(count);
const encounters = GUARDIANS.concat(BOSSES).sort((a,b) => a.region-b.region || a.node-b.node);

test('fixed encounters rise within each route, independently of the player', () => {
  const s=G.freshState(1);
  for(let region=0;region<6;region++) {
    const rows=encounters.filter(e=>e.region===region);
    for(let i=1;i<rows.length;i++) {
      assert.ok(rows[i].hp>rows[i-1].hp, `route ${region+1} health grows`);
      assert.ok(rows[i].attack>rows[i-1].attack, `route ${region+1} attack grows`);
    }
    const before=G.clone(G.enemyDefinition(s,region,'guardian',2));
    s.kit=5; s.research=['steel','wards','memory','godslayer'];
    assert.deepEqual(G.enemyDefinition(s,region,'guardian',2),before);
  }
});

for(const {region,node,name} of encounters) {
  test(`${region+1}-${node} ${name}: published ordinary equipment recommendation is viable`, () => {
    const q=combatRecommendation(region,node), s=recommendedFixture(region,node);
    assert.equal(s.party.length,q.count);
    assert.equal(q.count,4);
    assert.ok(q.quality<=3, 'never recommends a five-star recruitment wall');
    assert.ok(q.rarity<=3,'no purple, gold, red, set or lucky affix requirement');
    for(const h of s.heroes) {
      assert.equal(h.level,q.level);
      assert.equal(h.quality,q.quality);
      assert.equal(h.mastery,q.mastery);
      assert.deepEqual(Object.keys(h.equipment).sort(),[...q.slots].sort());
      for(const id of Object.values(h.equipment)) {
        const item=s.guild.inventory.find(g=>g.id===id);
        assert.equal(G.recipeUnlockReason(s,item.recipe,item.tier),'');
        assert.equal(item.tier,q.tier);
        assert.equal(item.rarity,q.rarity);
        assert.equal(item.upgrade,q.upgrade);
        assert.equal(item.setId,undefined);
        const withAffix=G.itemStats(s,item), withoutAffix=G.itemStats(s,item,false);
        for(const key of ['hp','attack','defense','pierce','ranged','crit','dodge','critDamage',...(q.element==='physical'?[]:[q.element])]) assert.equal(withAffix[key],withoutAffix[key],`reference affix contributes no ${key}`);
      }
    }
    assert.equal(s.kit,q.kit);
    assert.deepEqual(s.research,q.research);
    const wins=seeds.filter(seed=>difficultyBattle(s,region,node,seed).won).length;
    assert.ok(wins>=Math.ceil(count*.9),`recommended squad ${wins}/${count}`);
  });
  test(`${region+1}-${node} ${name}: no recommended-level naked squad clears`, () => {
    const variants=nakedDifficultyVariants(region,node);
    for(const config of variants) {
      const s=recommendedFixture(region,node,config);
      assert.ok(s.heroes.every(h=>Object.keys(h.equipment).length===0));
      assert.equal(s.guild.inventory.length,0);
      const wins=seeds.filter(seed=>difficultyBattle(s,region,node,seed).won).length;
      assert.equal(wins,0,`${JSON.stringify(config)} won ${wins}/${count}; naked means zero, not a low allowance`);
    }
  });
}

test('reported level-10 naked midpoint regression has no lucky-seed allowance', () => {
  for(const region of [1,2]) for(const quality of [3,5]) {
    const s=recommendedFixture(region,3,{bare:true,quality,aptitude:quality===5?130:100});
    assert.equal(s.heroes[0].level,10);
    for(const seed of difficultySeeds(512)) assert.equal(difficultyBattle(s,region,3,seed).won,false,`${region+1}-3 quality ${quality}, seed ${seed}`);
  }
});

test('opening naked burst regressions remain closed on the previously winning seeds', () => {
  const cases=[
    {node:1,role:'kael',branches:['a','b','c'],seeds:[3332467657,3601641187]},
    {node:4,role:'sylva',branches:['a','c'],seeds:[2528090685,1901463376,4246706327,3493733942,3980676415,455164882,1159876298,2173780524]},
  ];
  for(const c of cases) for(const branch of c.branches) {
    const s=recommendedFixture(0,c.node,{bare:true,quality:5,aptitude:130,roles:Array(4).fill(c.role),branch});
    for(const seed of c.seeds) assert.equal(difficultyBattle(s,0,c.node,seed).won,false,`1-${c.node} ${c.role}/${branch} formerly won at ${seed}`);
  }
});
