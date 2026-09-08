'use client';
import { useState } from 'react';
import { Trophy, Check, ArrowRight } from 'lucide-react';
import * as G from '@/lib/realm';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import type { Act, Destination } from './realm-panels';
import '../app/achievements.css';

export function AchievementButton({ s, act, go }: { s: G.State; act: Act; go: (d: Destination) => void }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<G.AchievementCategory>('town');
  const unlocked = s.guild.achievements?.unlocked || {};
  const unread = G.achievementUnread(s);
  const visible = G.ACHIEVEMENTS.filter((a) => unlocked[a.id] !== undefined || a.visible(s));
  const categories = (Object.keys(G.ACHIEVEMENT_CATEGORIES) as G.AchievementCategory[])
    .filter((c) => visible.some((a) => a.category === c));
  const current = categories.includes(category) ? category : categories[0];
  return <>
    <button className="achievement-entry" aria-label={`查看成就，已达成 ${G.achievementCount(s)} 项${unread ? `，${unread} 项新成就` : ''}`} onClick={() => {
      setOpen(true);
      if (unread) act(G.readAchievements, '已查看已达成的成就。');
    }}><Trophy /><span>成就 {G.achievementCount(s)}</span>{unread > 0 && <b>+{unread}</b>}</button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="life-dialog achievement-dialog">
        <DialogTitle>余烬成就 · 已达成 {G.achievementCount(s)} 项</DialogTitle>
        <DialogDescription>记录城镇与旅人的成长。达成后可佩戴称号；更多里程碑随新系统与地区出现。</DialogDescription>
        <div className="achievement-toolbar">
          <div role="tablist" aria-label="成就分类">{categories.map((c) => <button role="tab" aria-selected={c === current} key={c} onClick={() => setCategory(c)}>{G.ACHIEVEMENT_CATEGORIES[c]}<small>{visible.filter((a) => a.category === c && unlocked[a.id] !== undefined).length}/{visible.filter((a) => a.category === c).length}</small></button>)}</div>
          <span>称号：{G.achievementTitle(s) || '未佩戴'}{G.achievementTitle(s) && <button onClick={() => act((x) => G.selectAchievementTitle(x, null), '已收起称号。')}>收起</button>}</span>
        </div>
        <div className="achievement-list">
          {visible.filter((a) => a.category === current).map((a) => {
            const completed = unlocked[a.id] !== undefined;
            const progress = completed ? a.target : Math.min(a.target, Math.max(0, a.progress(s)));
            const equipped = s.guild.achievements?.title === a.id;
            return <article key={a.id} className={completed ? 'achievement-done' : ''}>
              <span className="achievement-mark">{completed ? <Check /> : <Trophy />}</span>
              <div className="achievement-copy"><h3>{a.name}<small>{completed ? `第 ${Math.floor(unlocked[a.id] / 300) + 1} 日记录` : `${progress} / ${a.target}`}</small></h3><p>{a.text}</p><progress max={a.target} value={progress} aria-label={a.name + '进度'} /><small>称号 · {a.title}</small></div>
              <div className="achievement-actions">{completed ? <button className="life-small-button" aria-pressed={equipped} disabled={equipped} onClick={() => act((x) => G.selectAchievementTitle(x, a.id), `已佩戴称号：${a.title}。`)}>{equipped ? '佩戴中' : '佩戴称号'}</button> : <button className="life-small-button" onClick={() => { setOpen(false); go(a.destination); }}>前往推进 <ArrowRight /></button>}</div>
            </article>;
          })}
        </div>
        <p className="achievement-footnote">按当前可确认的成果记录成就。已达成的记录会永久保留，不因换装或消费消失。</p>
      </DialogContent>
    </Dialog>
  </>;
}
