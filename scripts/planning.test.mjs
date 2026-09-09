import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/realm.ts';
import { recommendedFixture } from './difficulty-fixtures.mjs';

test('旧存档默认无目标，规划与移除不扣资源或随机数',()=>{
  const s=G.freshState(12345);delete s.plans;
  const restored=G.decodeSave(JSON.stringify(s));assert.deepEqual(restored.plans,[]);
  const next=G.pinPlan(restored,G.makePlan(restored,'building','hut'));
  assert.equal(next.plans.length,1);assert.deepEqual(next.resources,restored.resources);assert.equal(next.rng,restored.rng);
  assert.equal(G.removePlan(next,G.planKey(next.plans[0])).plans.length,0);
});
test('最多三项目标，重复和非法目标不进入存档',()=>{
  let s=G.freshState(1);
  for(const id of ['hut','warehouse','lumber','farm'])s=G.pinPlan(s,G.makePlan(s,'building',id));
  assert.equal(s.plans.length,3);assert.equal(G.pinPlan(s,s.plans[0]),s);
  const bad=G.clone(s);bad.plans[0].tier=99;assert.throws(()=>G.decodeSave(JSON.stringify(bad)));
  const unknown=G.clone(s);unknown.plans[0].id='__proto__';assert.throws(()=>G.decodeSave(JSON.stringify(unknown)));
});
test('三个目标合计预算不重复使用同一库存',()=>{
  let s=G.freshState(1);s=G.pinPlan(s,G.makePlan(s,'building','hut'));s=G.pinPlan(s,G.makePlan(s,'building','warehouse'));
  const bill=G.planDemand(s);
  assert.equal(bill.cost.wood,G.buildingCost(s,'hut').wood+G.buildingCost(s,'warehouse').wood);
  s.buildings.hut=1;
  assert.equal(G.planQuote(s,s.plans[0]).done,true);
  assert.equal(G.planDemand(s).cost.wood,G.buildingCost(s,'warehouse').wood);
});
test('每章首领目标真实使用出战费用和缺药调配账单',()=>{
  for(let r=0;r<6;r++){
    const s=recommendedFixture(r,6),p=G.makePlan(s,'boss',String(r));
    const q=G.planQuote(s,p);assert.ok(q.title.includes(G.REGIONS[r].name));
    assert.deepEqual(q.cost,G.battlePreparationCost(s));
    const potion=G.POTIONS.find(x=>x.id===s.guild.preparation.element);
    if(potion){s.guild.potions[potion.id]=0;const b=G.planQuote(s,p);assert.equal(b.cost.food,G.battlePreparationCost(s).food+potion.cost.food);assert.deepEqual(b.materials,potion.materials);}
    assert.equal(q.checks.length>0,true);
  }
});
test('物资估算沿真实加工与运输支付，且不改真实存档、不消费随机数',()=>{
  const s=recommendedFixture(1,6);s.buildings.lumber=2;s.buildings.farm=2;s.buildings.market=1;s.jobs.wood=2;s.jobs.food=2;s.jobs.gold=1;
  s.resources.wood=100;s.resources.food=100;s.resources.gold=50;s.resources.stone=100;
  s.economy.reserve=0;s.world.work.boards=true;s.world.materials.timber=10;
  const raw=JSON.stringify(s),result=G.forecastPlan(s,[G.makePlan(s,'building','lumber')],60),control=G.clone(s);
  for(let i=0;i<60;i++)G.advancePlanningTown(control);
  for(const k of Object.keys(s.resources))assert.equal(result.net[k],(control.resources[k]-s.resources[k])/60);
  assert.equal(result.materialNet.boards,(control.world.materials.boards-s.world.materials.boards)/60);
  assert.equal(JSON.stringify(s),raw);assert.equal(control.rng,s.rng);
});
test('多个战斗目标共享药剂库存，不能把同一瓶药当成多瓶',()=>{
  const s=recommendedFixture(1,6),potion=G.POTIONS.find(x=>x.id===s.guild.preparation.element);
  assert.ok(potion);s.cleared=[];s.guild.depths[1]=3;
  const targets=[G.makePlan(s,'boss','1'),G.makePlan(s,'guardian','1')];
  for(const stock of [0,1,2]) {
    s.guild.potions[potion.id]=stock;
    const bill=G.planDemand(s,targets),battle=G.battlePreparationCost(s),missing=2-stock;
    for(const k of Object.keys(s.resources))assert.equal(bill.cost[k]||0,(battle[k]||0)*2+(potion.cost[k]||0)*missing);
    for(const k of G.MATERIAL_IDS)assert.equal(bill.materials[k]||0,(potion.materials[k]||0)*missing);
  }
});
test('无来源和仓储上限不足不会给出虚假有限完成时间',()=>{
  const s=G.freshState(1),p=G.makePlan(s,'building','warehouse');
  assert.equal(G.forecastPlan(s,[p],60).eta,null);
  s.resources.wood=1e4;s.resources.stone=1e4;
  assert.equal(G.forecastPlan(s,[p],60).eta,0);
});
test('暂停估算只推演恢复后的城镇，不推进外出战斗或扣出征药剂',()=>{
  const s=recommendedFixture(1,6);s.paused=true;
  const before=JSON.stringify(s);const estimate=G.forecastPlan(s,[G.makePlan(s,'boss','1')],60);
  assert.equal(estimate.paused,true);assert.equal(JSON.stringify(s),before);
});
