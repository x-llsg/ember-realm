'use client';
import { useState } from 'react';
import * as G from '@/lib/realm';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { Pick, type Act, type Destination, short } from './realm-panels';
type Props={s:G.State;act:Act;go:(d:Destination)=>void};
const GROUPS=[{value:'building',label:'城镇建设'},{value:'technology',label:'城镇工艺'},{value:'research',label:'研究'},{value:'development',label:'产线改良'},{value:'gear',label:'装备打造'},{value:'guardian',label:'守敌准备'},{value:'boss',label:'首领准备'}];
export function PinPlan({s,act,kind,id,tier}:{s:G.State;act:Act;kind:G.PlanKind;id:string;tier?:number}) {
  const p=G.makePlan(s,kind,id,tier),pinned=s.plans?.some(x=>G.planKey(x)===G.planKey(p));
  return <button className="plan-pin" title={pinned?'已加入发展目标':'加入发展目标'} aria-label={(pinned?'已追踪 ':'追踪 ')+G.planQuote(s,p).title} disabled={pinned || (s.plans?.length || 0)>=3} onClick={()=>act(x=>G.pinPlan(x,p))}>{pinned?'已追踪':'+ 目标'}</button>;
}
export function PlanningBoard({s,act,go}:Props) {
  const [open,setOpen]=useState(false),[group,setGroup]=useState('technology'),[selection,setSelection]=useState('');
  const [forecast,setForecast]=useState<ReturnType<typeof G.forecastPlan>|null>(null);
  if(!s.buildings.market)return null;
  const plans=(s.plans || []).map(p=>G.planQuote(s,p));
  const candidates=G.availablePlans(s).filter(p=>p.kind===group);
  const selected=candidates.find(p=>G.planKey(p)===selection)||candidates[0];
  const bill=G.planDemand(s);
  const rows=[...Object.entries(bill.cost).map(([id,need])=>({id,name:G.RESOURCE_NAMES[id as G.Resource],need:need!,have:s.resources[id as G.Resource],net:forecast?.net[id as G.Resource]})),...Object.entries(bill.materials).map(([id,need])=>({id,name:G.MATERIAL_NAMES[id as G.MaterialId],need:need!,have:s.world.materials[id as G.MaterialId],net:forecast?.materialNet[id as G.MaterialId]}))];
  const missing=rows.filter(r=>r.have<r.need);
  const suggestions=missing.slice(0,2).map(r=>{
    const work=G.WORK_IDS.find(w=>w===r.id),region=G.REGION_MATERIALS.indexOf(r.id as G.MaterialId);
    return {label:work?r.name+'：选择配方或安排加工':region>=0?r.name+'：安排后勤或远征补给':r.name+'：调整分工、扩产或交易',destination:{view:'town' as const,tab:work || region>=0?'workshop':'workers'}};
  });
  function visit(d:Destination){setOpen(false);go(d);}
  return <>
    <div className="planning-strip" aria-label="发展目标">
      <button className="planning-manage" onClick={()=>{setOpen(true);setForecast(null);}}>发展目标 {plans.length}/3</button>
      {plans.length?plans.map(q=><button key={G.planKey(q.target)} className={q.done?'complete':''} onClick={()=>{setOpen(true);setForecast(null);}}><strong>{q.title}</strong><span>{q.done?'已完成':q.prerequisite || '筹备中'}</span></button>):<span>选定建设、研究或装备，把下一次出发的准备一起安排好。</span>}
    </div>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="planning-dialog">
        <DialogTitle>发展目标与需求单</DialogTitle>
        <DialogDescription>最多追踪三项。合计需求会计入各项目争用的材料；追踪不会自动花费资源或购买升级。</DialogDescription>
        <div className="planning-add"><Pick label="目标类型" value={group} options={GROUPS} onChange={v=>{setGroup(v);setSelection('');}}/><Pick label="选择发展目标" value={selected?G.planKey(selected):''} options={candidates.length?candidates.map(p=>({value:G.planKey(p),label:G.planQuote(s,p).title})):[{value:'',label:'此类暂时没有新目标'}]} onChange={setSelection}/><button className="primary-button" disabled={!selected || plans.length>=3 || plans.some(q=>G.planKey(q.target)===G.planKey(selected))} onClick={()=>{if(selected)act(x=>G.pinPlan(x,selected));setForecast(null);}}>加入追踪</button></div>
        <div className="planning-body">
          <div className="planning-targets">{plans.map(q=><article key={G.planKey(q.target)}>
            <div><strong>{q.title}</strong><button onClick={()=>{act(x=>G.removePlan(x,G.planKey(q.target)));setForecast(null);}} aria-label={'移除目标 '+q.title}>移除</button></div>
            <p>{q.done?'已完成，可移除并追踪下一个目标。':q.prerequisite || '备齐资源后，前往对应页面亲自执行。'}</p>
            {q.checks.map(c=><p key={c.text} className={c.ready?'ready':'pending'}>{c.ready?'✓':'○'} {c.text}</p>)}
            <button className="secondary-button" onClick={()=>visit(q.destination)}>前往安排 →</button>
          </article>)}
          {!plans.length&&<p>先选择一个你想完成的目标。</p>}</div>
          <div className="planning-demand"><strong>合计物资需求</strong><small>战斗目标列出出战费用；建议练度供比较，不会自动将所有装备采购加入账单。</small>
            <div className="planning-ledger">{rows.map(r=><div key={r.id} className={r.have>=r.need?'ready':'pending'}><span>{r.name}</span><b>{short(r.have)} / {short(r.need)}</b><span>{r.net===undefined?'缺 '+short(Math.max(0,r.need-r.have)):(r.net>=0?'+':'')+r.net.toFixed(2)+'/秒'}</span></div>)}</div>
            {suggestions.map(o=><button key={o.label} className="plan-suggestion" onClick={()=>visit(o.destination)}>{o.label} →</button>)}
            <button className="secondary-button" disabled={!plans.length} onClick={()=>setForecast(G.forecastPlan(s))}>按当前安排估算</button>
            {forecast&&<div className="plan-forecast"><strong>{forecast.eta===0?'物资已备齐':forecast.eta===null?'当前安排在30分钟内无法备齐':'预计约 '+Math.ceil(forecast.eta/60)+' 分钟备齐物资'}</strong><p>{forecast.scope}</p><small>收支取未来60秒平均值；改变分工、配方或花费后请重新估算。条件与战斗胜负不由物资估算保证。</small></div>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
