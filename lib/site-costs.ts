import * as G from './realm.ts';
import { siteDefinition } from './sites-data.ts';
import type { SiteBillKind, SiteBundle, SiteQuote, SiteRewardKind, SiteVariant } from './world-types.ts';

// Fixed regional prices. Character strength, wealth and elapsed play time never raise them.
export const SITE_TRAVEL = [
  {food:18,gold:10,seconds:90,construction:[20,10],supply:[12,6],sample:[12,1],basic:24,material:2},
  {food:30,gold:20,seconds:105,construction:[35,20],supply:[20,10],sample:[20,2],basic:40,material:3},
  {food:45,gold:35,seconds:120,construction:[55,35],supply:[30,18],sample:[35,3],basic:60,material:4},
  {food:65,gold:55,seconds:135,construction:[85,50],supply:[45,25],sample:[55,4],basic:90,material:6},
  {food:90,gold:80,seconds:150,construction:[120,75],supply:[60,40],sample:[80,5],basic:130,material:8},
  {food:120,gold:110,seconds:165,construction:[160,100],supply:[80,55],sample:[110,6],basic:180,material:10},
] as const;
export const SITE_REVISIT_SECONDS = 30;
export function siteTravelQuote(s:G.State,id:string):SiteQuote {
  const d=siteDefinition(id);
  if(!d) return {cost:{},materials:{},seconds:0,reason:'未知地点'};
  const c=SITE_TRAVEL[d.region],cost={food:c.food,gold:c.gold};
  return {cost,materials:{},seconds:c.seconds+(d.depth===3?15:0),reason:G.canPay(s,cost)?'':`出行物资不足：${G.costText(cost)}`};
}
export function siteBillKind(s:G.State,id:string,variant:SiteVariant):SiteBillKind {
  const d=siteDefinition(id)!; const kind=d.variants[variant].bill;
  if(kind!=='sample'||G.materialDiscovered(s,G.REGION_MATERIALS[d.region])) return kind;
  return ['S04','S08','S12'].includes(id)?'supply':'construction';
}
export function siteHelped(s:G.State,id:string):boolean {
  const d=siteDefinition(id); if(!d) return false;
  return s.heroes.filter(h=>s.party.includes(h.id)).some(h=>{
    if(h.origin===d.origin) return true;
    const carried=[G.DEFAULT_SKILL[h.role],h.activeSkill,h.secondarySkill];
    return G.unlockedSkills(h).filter(skill=>carried.includes(skill.id)).some(skill=>{
      if(d.help==='heal') return !!skill.heal || !!skill.healing;
      if(d.help==='shield') return !!skill.shield || !!skill.wardHits || !!skill.incomingMultiplier;
      if(d.help==='ranged') return !!skill.projectile;
      if(d.help==='cleanse') return !!skill.cleanseBurn;
      if(d.help==='interrupt') return !!skill.interrupt;
      return !!skill.shatter;
    });
  });
}
export function siteExtraQuote(s:G.State,id:string,kind:SiteBillKind,helped:boolean):SiteQuote {
  const d=siteDefinition(id); if(!d) return {cost:{},materials:{},seconds:0,reason:'未知地点'};
  const c=SITE_TRAVEL[d.region]; let cost:G.Cost={},materials:G.MaterialCost={};
  if(kind==='construction') cost={wood:c.construction[0],stone:c.construction[1]};
  if(kind==='supply') cost={food:c.supply[0],gold:c.supply[1]};
  if(kind==='sample') {cost={gold:c.sample[0]};materials={[G.REGION_MATERIALS[d.region]]:c.sample[1]};}
  if(helped) cost=Object.fromEntries(Object.entries(cost).map(([k,n])=>[k,Math.max(1,Math.ceil(n!*0.9))]));
  return {cost,materials,seconds:Math.floor(siteTravelQuote(s,id).seconds*0.2),reason:sitePayReason(s,{cost,materials})};
}
export function sitePayReason(s:G.State,bill:SiteBundle):string {
  if(!G.canPay(s,bill.cost)) return `物资不足：${G.costText(bill.cost)}`;
  return G.materialReason(s,bill.materials);
}
export function siteReward(s:G.State,id:string,kind:SiteRewardKind,variant?:SiteVariant):SiteBundle {
  const d=siteDefinition(id); if(!d) return {cost:{},materials:{}};
  const c=SITE_TRAVEL[d.region],material=G.REGION_MATERIALS[d.region];
  if(kind==='material'&&G.materialDiscovered(s,material)) return {cost:{},materials:{[material]:c.material}};
  const v=variant || s.worldExploration.sites[id]?.preview.variant || 'A';
  const weights:Record<G.Resource,number>={wood:1,food:1,stone:1.2,iron:3,crystal:5,gold:Infinity};
  const known=d.variants[v].resources.filter(k=>G.resourceDiscovered(s,k));
  const resources=known.length?known:['wood' as const],cost:G.Cost={};
  for(const k of resources) cost[k]=(cost[k]||0)+Math.floor(c.basic/resources.length/weights[k]);
  return {cost,materials:{}};
}
