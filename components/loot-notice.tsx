'use client';
import { useState } from 'react';
import { PackageOpen, ArrowRight } from 'lucide-react';
import * as G from '@/lib/realm';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { InfoHint } from './info-hint';
import type { Act, Destination } from './realm-panels';
import '../app/loot.css';

function LootName({ receipt }: { receipt: G.LootReceipt }) {
  return <span className={'loot-item-name rarity-' + receipt.item.rarity}>
    {G.gearName(receipt.item)}
  </span>;
}
export function BattleLoot({ receipt, go }: {
  receipt: G.LootReceipt | null | undefined;
  go: (d: Destination) => void;
}) {
  if (!receipt) return <p className="battle-loot-empty">{receipt === null ? '本场未掉落装备。' : '这份旧战报未记录装备掉落。'}</p>;
  return <div className="battle-loot-result">
    <strong>本场装备掉落</strong><LootName receipt={receipt} />
    <span>{G.lootOutcomeText(receipt)}</span>
    <button className="life-text-button" onClick={() => go({ view: 'heroes', tab: 'inventory', gear: receipt.item.id })}>前往装备库 →</button>
  </div>;
}
export function LootNotice({ s, act, go }: { s: G.State; act: Act; go: (d: Destination) => void }) {
  const [open, setOpen] = useState(false);
  const history = s.guild.lootHistory || [];
  const latest = G.latestBattleLoot(s) || history[0];
  const unread = G.lootUnread(s);
  if (!latest) return null;
  function showHistory() {
    setOpen(true);
    if (unread) act(G.readLoot, '已查看近期装备收获。');
  }
  return <>
    <div className="loot-notice" aria-label="装备掉落提示">
      <PackageOpen />
      <button className="loot-summary" onClick={showHistory}>
        <span>{latest.source === 'guardian' || latest.source === 'boss' ? '最近刷怪掉落' : '最近装备收获'}</span>
        <LootName receipt={latest} />
        {latest.outcome === 'converted' && <small>库满已转化</small>}
      </button>
      <button className="loot-history-button" onClick={showHistory}>近期收获 {unread > 0 && <b>{unread} 新</b>}</button>
      <button onClick={() => go({ view: 'heroes', tab: 'inventory' })}>整理装备 <ArrowRight /></button>
    </div>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="life-dialog loot-history-dialog">
        <DialogTitle>近期装备收获</DialogTitle>
        <DialogDescription>保留最近 {G.MAX_LOOT_HISTORY} 件的获得记录。装备分解或重铸后，原始掉落记录仍会保留。</DialogDescription>
        <div className="loot-history-list">
          {history.map((receipt) => {
            const present = s.guild.inventory.some((i) => i.id === receipt.item.id);
            return <article key={receipt.serial}>
              <div><small>第 {Math.floor(receipt.time / 300) + 1} 日 · {receipt.sourceName}</small>
                <InfoHint title={G.gearName(receipt.item)} body={`${G.AFFIXES[receipt.item.affix].text}\n${G.gearSetHelp(receipt.item)}`}>
                  <LootName receipt={receipt} />
                </InfoHint>
                <p>{G.lootOutcomeText(receipt)}{receipt.outcome === 'stored' && !present ? ' · 现已不在装备库' : ''}</p>
              </div>
              <button className="life-small-button" disabled={!present} onClick={() => { setOpen(false); go({ view: 'heroes', tab: 'inventory', gear: receipt.item.id }); }}>
                {present ? '查看装备' : receipt.outcome === 'converted' ? '已转化' : '已离库'}
              </button>
            </article>;
          })}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
