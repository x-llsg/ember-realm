'use client';
import { useState } from 'react';
import * as G from '@/lib/realm';
import { GearStats } from './gear-presentation';
import { InfoHint, Term } from './info-hint';
import { affixHelp } from '@/lib/glossary';
import { Buy, Pick, type Act } from './realm-panels';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import '@/app/equipment.css';

export function SalvageYield({ dust, salvage, loss = false }: { dust: number; salvage: Partial<Record<number, number>>; loss?: boolean }) {
  return <div className="salvage-yield">
    {dust > 0 && <span>锻造尘 {loss ? '−' : '+'}{dust.toLocaleString('zh-CN')}</span>}
    {G.SALVAGE_MATERIALS.filter((m) => (salvage[m.rarity] || 0) > 0).map((m) =>
      <span key={m.rarity} className={'rarity-' + m.rarity}>{m.name} {loss ? '−' : '+'}{salvage[m.rarity]}</span>)}
  </div>;
}

export function GearWorkshop({ s, item, act, onRemoved }: {
  s: G.State; item: G.Gear; act: Act; onRemoved?: () => void;
}) {
  const [affix, setAffix] = useState(String(item.affix));
  const [confirm, setConfirm] = useState(false);
  const [allowOverflow, setAllowOverflow] = useState(false);
  const owner = G.gearOwner(s, item.id);
  const away = G.gearAway(s, item.id);
  const quote = G.reforgeQuote(s, item.id, Number(affix));
  const dismantle = G.dismantleQuote(s, [item.id], { includeSets: true, includeEnhanced: true, allowOverflow });
  return <div className="gear-workshop">
    <GearStats s={s} item={item} />
    <div className="gear-workshop-state">
      <span>{owner ? `${owner.name} · ${away ? '出征携带' : '已装备'}` : '闲置装备'}</span>
      <button className="secondary-button" aria-pressed={!!item.locked}
        onClick={() => act((x) => G.toggleGearLock(x, item.id))}>
        {item.locked ? '已收藏 · 取消收藏' : '收藏保护'}
      </button>
    </div>
    <section>
      <strong><Term name="enhancement">装备强化</Term> · 当前 +{item.upgrade}</strong>
      <Buy s={s} cost={G.enhancementCost(item)} materials={G.enhancementMaterials(s, item)}
        reason={away ? '该装备正由出征角色携带' : item.upgrade >= 8 ? '强化已达 +8' : ''}
        label={`强化至 +${Math.min(8, item.upgrade + 1)}`}
        onClick={() => act((x) => G.enhanceGear(x, item.id))} />
    </section>
    <section>
      <strong><Term name="affix">定向重铸</Term></strong>
      <Pick label="选择重铸词条" value={affix} onChange={setAffix}
        options={G.AFFIXES.map((a, i) => ({ value: String(i), label: `${a.name} · ${a.text}` }))} />
      <InfoHint {...affixHelp(Number(affix), s, { ...item, affix: Number(affix) })}>
        词条预览：{G.AFFIXES[Number(affix)].name}
      </InfoHint>
      <div className="reforge-cost">
        <span className={s.guild.dust < quote.dust ? 'shortage' : ''}>锻造尘 {s.guild.dust}/{quote.dust}</span>
        <span className={'rarity-' + quote.rarity}>{quote.materialName} {G.salvageCount(s, quote.rarity)}/{quote.material}</span>
      </div>
      <button className="secondary-button" disabled={!!quote.reason}
        onClick={() => act((x) => G.reforgeGear(x, item.id, Number(affix)))}>重铸为「{G.AFFIXES[Number(affix)].name}」</button>
      <small className="gear-action-reason">{quote.reason || '消耗对应品质材料，确定获得所选词条；保留强化与套装。'}</small>
    </section>
    <section className="gear-dismantle-actions">
      <strong>分解回收</strong>
      {owner && <button className="secondary-button" disabled={away} onClick={() => act((x) =>
        G.unequipGear(x, owner.id, G.RECIPES.find((r) => r.id === item.recipe)!.slot))}>卸下并归还装备仓库</button>}
      <SalvageYield dust={dismantle.dust} salvage={dismantle.salvage} />
      <button className="secondary-button" disabled={!dismantle.count}
        onClick={() => { setAllowOverflow(false); setConfirm(true); }}>分解这件装备…</button>
      <small className="gear-action-reason">{dismantle.skipped[0]?.reason || dismantle.reason || '分解会消耗装备；收藏或已穿戴的装备不可分解。'}</small>
    </section>
    <Dialog open={confirm} onOpenChange={setConfirm}>
      <DialogContent className="life-dialog salvage-confirm">
        <DialogTitle>确认分解这件装备</DialogTitle>
        <DialogDescription>分解后不能恢复装备，强化投入不返还。</DialogDescription>
        <strong className={'rarity-' + item.rarity}>{G.gearName(item)}</strong>
        {(item.setId || item.upgrade > 0) && <p>这件装备{item.setId ? '属于套装' : ''}{item.setId && item.upgrade > 0 ? '，并且' : ''}{item.upgrade > 0 ? `已强化至 +${item.upgrade}` : ''}。</p>}
        <SalvageYield dust={dismantle.dust} salvage={dismantle.salvage} />
        <label className="salvage-overflow-choice"><input type="checkbox" checked={allowOverflow} onChange={(e) => setAllowOverflow(e.target.checked)} />允许丢弃超出容量的材料</label>
        {(dismantle.lostDust > 0 || Object.values(dismantle.lostSalvage).some((n) => n > 0)) && <div className="salvage-overflow-warning">
          <strong>{allowOverflow ? '确认后将丢弃以下超额材料：' : '材料容量不足，以下数量无法入库：'}</strong>
          <SalvageYield dust={dismantle.lostDust} salvage={dismantle.lostSalvage} loss />
        </div>}
        {dismantle.reason && <p>{dismantle.reason}</p>}
        <div className="warehouse-confirm-actions">
          <button className="secondary-button" onClick={() => setConfirm(false)}>保留装备</button>
          <button className="primary-button" disabled={!!dismantle.reason || !dismantle.count} onClick={() => {
            act((x) => G.bulkDismantleGear(x, [item.id], { includeSets: true, includeEnhanced: true, allowOverflow }));
            setConfirm(false); onRemoved?.();
          }}>确认分解</button>
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}
