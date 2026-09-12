import * as G from './realm.ts';
import { combatRecommendation } from './combat-recommendation.ts';

export type PlanKind = 'building' | 'technology' | 'research' | 'development' | 'gear' | 'guardian' | 'boss' | 'relic' | 'facility' | 'site';
export interface PlanTarget {
  kind: PlanKind;
  id: string;
  level: number;
  tier: number;
  serial: number;
}
export interface PlanQuote {
  target: PlanTarget;
  title: string;
  cost: G.Cost;
  materials: G.MaterialCost;
  done: boolean;
  prerequisite: string;
  checks: { text: string; ready: boolean }[];
  destination: G.Objective & {tier?:number;guardian?:number};
}
const kinds: PlanKind[] = ['building','technology','research','development','gear','guardian','boss','relic','facility','site'];
export const planKey = (p: PlanTarget) => [p.kind,p.id,p.level,p.tier,p.serial].join(':');
export function makePlan(s: G.State, kind: PlanKind, id: string, tier = G.gearTier(s)): PlanTarget {
  return { kind, id, level: kind === 'building' ? (s.buildings[id as G.BuildingId] || 0) + 1 : kind === 'development' ? G.developmentLevel(s,id as G.DevelopmentId) + 1 : kind === 'guardian' ? Math.min(5,(s.guild.depths[Number(id)] || 0)+1) : 1, tier: kind === 'gear' ? tier : 1, serial: kind === 'gear' ? s.guild.serial : 0 };
}
function known(p: PlanTarget): boolean {
  if (!p || typeof p !== 'object' || Array.isArray(p) || Object.keys(p).length !== 5 || !kinds.includes(p.kind) || typeof p.id !== 'string') return false;
  if (![p.level,p.tier,p.serial].every(Number.isInteger) || p.level < 1 || p.level > 60 || p.tier < 1 || p.tier > 6 || p.serial < 0 || p.serial > 1e8) return false;
  if (p.kind !== 'gear' && (p.tier !== 1 || p.serial !== 0)) return false;
  if (['technology','research','gear','boss'].includes(p.kind) && p.level !== 1) return false;
  if (p.kind === 'building') return G.BUILDINGS.some(b=>b.id===p.id && p.level <= b.max);
  if (p.kind === 'technology') return G.TECHNOLOGIES.some(t=>t.id===p.id);
  if (p.kind === 'research') return G.RESEARCH.some(t=>t.id===p.id);
  if (p.kind === 'development') return G.DEVELOPMENTS.some(t=>t.id===p.id) && p.level <= G.DEVELOPMENT_MAX;
  if (p.kind === 'gear') return G.RECIPES.some(t=>t.id===p.id);
  if (p.kind === 'relic') return p.level===1&&G.RELICS.some(t=>t.id===p.id);
  if (p.kind === 'facility') return p.level===1&&!!G.siteDefinition(p.id);
  if (p.kind === 'site') return p.level===1&&/^S(0[1-9]|1[0-2]):(assault|clever)$/.test(p.id);
  return /^[0-5]$/.test(p.id) && (p.kind !== 'guardian' || p.level <= 5);
}
export function validatePlans(s: G.State): void {
  if (s.plans === undefined) s.plans = [];
  if (!Array.isArray(s.plans) || s.plans.length > 3 || !s.plans.every(known) || new Set(s.plans.map(planKey)).size !== s.plans.length) throw Error('发展目标记录无效');
}
export function planQuote(s: G.State, p: PlanTarget): PlanQuote {
  if (!known(p)) throw Error('未知发展目标');
  let title = '', cost: G.Cost = {}, materials: G.MaterialCost = {}, done = false, prerequisite = '';
  let destination: PlanQuote['destination'] = {title:'',detail:'',view:'town'};
  const checks: PlanQuote['checks'] = [];
  if (p.kind === 'building') {
    const id = p.id as G.BuildingId, b=G.BUILDINGS.find(b=>b.id===id)!;
    title = b.name+' · '+p.level+'级'; done=s.buildings[id]>=p.level;
    cost=G.buildingCost(s,id); materials=G.buildingMaterialCost(s,id); prerequisite=done?'':G.buildingReason(s,id);
    destination={title,detail:'',view:'town',tab:'build',building:id};
  } else if (p.kind === 'technology' || p.kind === 'research') {
    const t = p.kind==='technology' ? G.TECHNOLOGIES.find(t=>t.id===p.id)! : G.RESEARCH.find(t=>t.id===p.id)!;
    title=t.name; cost=t.cost; materials=t.materials || {};
    done=(p.kind==='technology'?s.world.tech:s.research).includes(p.id);
    prerequisite=done?'':p.kind==='technology'?G.technologyPrerequisiteReason(s,p.id):G.researchDiscovered(s,p.id)?'':'先获得对应见闻与前置研究';
    destination={title,detail:'',view:'research',research:p.id};
  } else if (p.kind==='development') {
    const id=p.id as G.DevelopmentId;
    title=G.DEVELOPMENTS.find(d=>d.id===id)!.name+' · '+p.level+'级';
    done=G.developmentLevel(s,id)>=p.level; cost=G.developmentCost(s,id);
    prerequisite=G.developmentDiscovered(s,id)?'':'先建成对应产线';
    destination={title,detail:'',view:'research',research:id};
  } else if (p.kind==='gear') {
    title=G.RECIPES.find(r=>r.id===p.id)!.name+' · T'+p.tier;
    cost=G.recipeCost(s,p.id,p.tier); materials=G.recipeMaterialCost(s,p.id,p.tier);
    prerequisite=G.recipeUnlockReason(s,p.id,p.tier);
    done=s.guild.inventory.some(g=>g.recipe===p.id && g.tier>=p.tier && Number(g.id.replace('gear-',''))>p.serial);
    destination={title,detail:'',view:'heroes',tab:'forge',recipe:p.id,tier:p.tier};
  } else if(p.kind==='relic'||p.kind==='facility') {
    const relic=p.kind==='relic'?G.RELICS.find(r=>r.id===p.id):undefined;
    const siteId=relic?.siteId||p.id,site=G.siteDefinition(siteId)!;
    const owned=relic?s.worldExploration.relics.owned[p.id]:s.worldExploration.facilities[p.id];
    const q=relic?G.relicRepairQuote(s,p.id):G.facilityRepairQuote(s,p.id);
    title='修复'+(relic?.name||site.name);done=!!owned?.repaired;
    if(owned?.operation){checks.push({text:`修复中 · 还需 ${Math.ceil(owned.operation.remainingSeconds)} 秒`,ready:false});prerequisite='后方正在修复，费用已付';}
    else{cost=q.cost;materials=q.materials;prerequisite=relic?!owned?'先从对应地点取得遗物':'':!s.worldExploration.sites[siteId]?.firstCompleted?'先完成这处地点':'';}
    destination={title,detail:'',view:relic?(relic.kind==='town'?'town':'heroes'):'town',tab:relic?.kind==='combat'?undefined:'workshop',site:relic?undefined:siteId,relic:relic?.id,region:site.region};
  } else if(p.kind==='site') {
    const [id,rawMethod]=p.id.split(':'),method=rawMethod as G.SiteMethod,site=G.siteDefinition(id)!;
    const travel=G.siteTravelQuote(s,id),extra=G.siteRouteQuote(s,id,method);
    cost={...travel.cost};for(const[k,n]of Object.entries(extra.cost))cost[k as G.Resource]=(cost[k as G.Resource]||0)+n!;
    materials={...extra.materials};title=site.name+' · '+(method==='assault'?'强攻备料':'巧解备料');
    prerequisite=s.worldExploration.sites[id]?'':'先发现这处地点';
    let potionsReady=true;
    if(method==='assault'&&s.guild.preparation.element!=='physical'){
      const potion=G.POTIONS.find(p=>p.id===s.guild.preparation.element)!;potionsReady=G.potionCount(s,potion.id)>0;
      checks.push({text:potion.name+' · '+G.potionCount(s,potion.id)+'份',ready:potionsReady});
      if(!potionsReady){for(const[k,n]of Object.entries(potion.cost))cost[k as G.Resource]=(cost[k as G.Resource]||0)+n!;for(const[k,n]of Object.entries(potion.materials))materials[k as G.MaterialId]=(materials[k as G.MaterialId]||0)+n!;}
    }
    done=!prerequisite&&potionsReady&&G.canPay(s,cost)&&!G.materialReason(s,materials);
    destination={title,detail:'备齐只作提示，不会自动出发或扣费。',view:'explore',region:site.region,site:id};
  } else {
    const r=Number(p.id), rec=combatRecommendation(r,p.kind==='boss'?6:p.level);
    title=G.REGIONS[r].name+' · '+(p.kind==='boss'?'首领决战':'第'+p.level+'处守敌');
    done=p.kind==='boss'?s.cleared.includes(r):s.guild.depths[r]>=p.level;
    prerequisite=G.regionReason(s,r);
    cost=G.battlePreparationCost(s);
    const potion=G.POTIONS.find(x=>x.id===s.guild.preparation.element);
    if(potion) {
      const stocked=G.potionCount(s,potion.id)>0;
      checks.push({text:potion.name+' · '+G.potionCount(s,potion.id)+'份',ready:stocked});
      if(!stocked) { for(const [k,n] of Object.entries(potion.cost))cost[k as G.Resource]=(cost[k as G.Resource]||0)+n!;materials={...potion.materials}; }
    }
    const party=s.heroes.filter(h=>s.party.includes(h.id));
    checks.push({text:'同行者 '+party.length+'/'+rec.count,ready:party.length>=rec.count});
    checks.push({text:'建议等级 '+rec.level+'（可自行挑战）',ready:party.length>=rec.count && party.every(h=>h.level>=rec.level)});
    const slots=party.flatMap(h=>rec.slots.map(slot=>s.guild.inventory.find(g=>g.id===h.equipment[slot])));
    const ready=slots.filter(g=>g && g.tier>=rec.tier && g.rarity>=rec.rarity && g.upgrade>=rec.upgrade).length;
    checks.push({text:'建议行装 T'+rec.tier+' / '+G.QUALITY_NAMES[rec.rarity-1]+' / 强化+'+rec.upgrade+'：'+ready+'/'+(rec.count*rec.slots.length)+'部位',ready:ready>=rec.count*rec.slots.length});
    checks.push({text:'技能点已安排',ready:party.length>0 && party.every(h=>G.skillPoints(h)===0)});
    destination={title,detail:'',view:'explore',region:r,tab:p.kind==='boss'?'boss':'frontier',guardian:p.kind==='guardian'?p.level-1:undefined};
  }
  if(done && p.kind!=='site') {cost={}; materials={}; prerequisite='';}
  return {target:p,title,cost,materials,done,prerequisite,checks,destination};
}
export function pinPlan(s0:G.State,p:PlanTarget):G.State {
  if (!known(p) || (s0.plans?.length || 0)>=3 || s0.plans?.some(x=>planKey(x)===planKey(p))) return s0;
  const s=G.clone(s0);s.plans=[...(s.plans || []),p];return s;
}
export function removePlan(s0:G.State,key:string):G.State {
  const s=G.clone(s0);s.plans=(s.plans || []).filter(p=>planKey(p)!==key);return s;
}
export function availablePlans(s:G.State):PlanTarget[] {
  return [
    ...G.BUILDINGS.filter(b=>G.buildingDiscovered(s,b.id) && s.buildings[b.id]<G.buildingLimit(s,b.id)).map(b=>makePlan(s,'building',b.id)),
    ...G.TECHNOLOGIES.filter(t=>G.technologyDiscovered(s,t.id) && !s.world.tech.includes(t.id)).map(t=>makePlan(s,'technology',t.id)),
    ...G.RESEARCH.filter(t=>G.researchDiscovered(s,t.id) && !s.research.includes(t.id)).map(t=>makePlan(s,'research',t.id)),
    ...G.DEVELOPMENTS.filter(d=>G.developmentDiscovered(s,d.id) && G.developmentLevel(s,d.id)<G.DEVELOPMENT_MAX).map(d=>makePlan(s,'development',d.id)),
    ...G.RECIPES.filter(r=>G.recipeDiscovered(s,r.id)).map(r=>makePlan(s,'gear',r.id)),
    ...G.REGIONS.flatMap((_,r)=>!G.regionOpen(s,r)?[]:[...(s.guild.depths[r]<5?[makePlan(s,'guardian',String(r))]:[]),...(!s.cleared.includes(r)?[makePlan(s,'boss',String(r))]:[])]),
    ...G.RELICS.filter(r=>s.worldExploration.relics.owned[r.id]&&!s.worldExploration.relics.owned[r.id].repaired).map(r=>makePlan(s,'relic',r.id)),
    ...G.SITES.filter(d=>s.worldExploration.sites[d.id]?.firstCompleted&&!s.worldExploration.facilities[d.id].repaired).map(d=>makePlan(s,'facility',d.id)),
    ...G.SITES.filter(d=>s.worldExploration.sites[d.id]).flatMap(d=>[makePlan(s,'site',d.id+':clever'),makePlan(s,'site',d.id+':assault')]),
  ];
}
export function planDemand(s:G.State,targets=s.plans || []) {
  const cost:G.Cost={},materials:G.MaterialCost={};
  const potion=G.POTIONS.find(x=>x.id===s.guild.preparation.element);
  let doses=0;
  for(const p of targets) {
    const q=planQuote(s,p);
    for(const [k,n] of Object.entries(q.cost))cost[k as G.Resource]=(cost[k as G.Resource]||0)+n!;
    for(const [k,n] of Object.entries(q.materials))materials[k as G.MaterialId]=(materials[k as G.MaterialId]||0)+n!;
    if(potion && ((!q.done && (p.kind==='guardian' || p.kind==='boss')) || (p.kind==='site' && p.id.endsWith(':assault')))) {
      doses++;
      // Replace per-target potion quotes with one shared inventory allocation.
      if(!G.potionCount(s,potion.id)) {
        for(const [k,n] of Object.entries(potion.cost))cost[k as G.Resource]=(cost[k as G.Resource]||0)-n!;
        for(const [k,n] of Object.entries(potion.materials))materials[k as G.MaterialId]=(materials[k as G.MaterialId]||0)-n!;
      }
    }
  }
  if(potion) {
    const missing=Math.max(0,doses-G.potionCount(s,potion.id));
    for(const [k,n] of Object.entries(potion.cost))if(missing)cost[k as G.Resource]=(cost[k as G.Resource]||0)+n!*missing;
    for(const [k,n] of Object.entries(potion.materials))if(missing)materials[k as G.MaterialId]=(materials[k as G.MaterialId]||0)+n!*missing;
  }
  return {cost,materials};
}
/** No RNG, purchase, combat or expeditions are forecast. Existing production arrangements only. */
export function forecastPlan(s0:G.State,targets=s0.plans || [],horizon=1800) {
  const bill=planDemand(s0,targets),s=G.clone(s0), seconds=Math.max(60,Math.min(1800,Math.floor(horizon)));
  const ready=()=>Object.entries(bill.cost).every(([k,n])=>s.resources[k as G.Resource]>=n!) && Object.entries(bill.materials).every(([k,n])=>s.world.materials[k as G.MaterialId]>=n!);
  let eta:number|null=ready()?0:null;
  let sampled:G.State|undefined;
  for(let i=1;i<=seconds;i++){G.advancePlanningTown(s);if(i===60)sampled=G.clone(s);if(eta===null && ready())eta=i;if(i>=60 && eta!==null)break;}
  const sample=sampled!;
  const net=Object.fromEntries(Object.keys(s0.resources).map(k=>[k,(sample.resources[k as G.Resource]-s0.resources[k as G.Resource])/60])) as Record<G.Resource,number>;
  const materialNet=Object.fromEntries(G.MATERIAL_IDS.map(k=>[k,(sample.world.materials[k]-s0.world.materials[k])/60])) as Record<G.MaterialId,number>;
  return {eta,net,materialNet,horizon:seconds,at:s0.time,paused:s0.paused,scope:'仅估算现有城镇生产、加工和后勤；含实际用料、保留线和仓储限制，不计随机掉落与未来购买。暂停时按恢复后估算。'};
}
