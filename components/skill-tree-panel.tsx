'use client';
import { useState } from 'react';
import * as G from '@/lib/realm';
import { InfoHint } from './info-hint';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import type { Act } from './realm-panels';

export function SkillTreePanel({
  s,
  h,
  act,
}: {
  s: G.State;
  h: G.Hero;
  act: Act;
}) {
  const [open, setOpen] = useState(false),
    tree = G.roleTree(h.role),
    role = G.TREE_ROLES.find((r) => r.id === h.role)!,
    root = tree.find((n) => n.branch === 'root')!;
  return (
    <>
      <button className="skill-tree-open" onClick={() => setOpen(true)}>
        技能树{' '}
        <span>
          {G.skillPoints(h)} 可用点 · 已用 {G.spentSkillPoints(h)}
        </span>{' '}
        →
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="life-dialog skill-tree-dialog roster-dialog">
          <DialogTitle>
            <span className={'potential-' + h.quality}>{h.name}</span> ·{' '}
            {role.name}
          </DialogTitle>
          <DialogDescription>
            Lv.5起每5级获得1点，至Lv.40共8点。
            三条路线，点数有限；根技能常备，Lv.20可携带两项分支技能。
          </DialogDescription>
          <div className="skill-tree-root">
            <InfoHint {...G.skillNodeHelp(h, root)}>{root.name}</InfoHint>
            <span>根技能 · 已掌握</span>
            <strong>{G.skillPoints(h)} 可用点</strong>
          </div>
          <div className="skill-tree-branches">
            {(['a', 'b', 'c'] as const).map((branch, index) => (
              <section
                key={branch}
                aria-label={
                  index < 2
                    ? role.branches[index]
                    : G.V14_THIRD_BRANCH_NAMES[h.role]
                }
              >
                <h3>
                  {index < 2
                    ? role.branches[index]
                    : G.V14_THIRD_BRANCH_NAMES[h.role]}
                </h3>
                {tree
                  .filter((node) => node.branch === branch)
                  .sort((a, b) => a.depth - b.depth)
                  .map((node) => {
                    const known = G.nodeKnown(h, node),
                      reason = G.learnSkillReason(s, h.id, node.id);
                    return (
                      <article
                        className={`skill-tree-node${known ? ' learned' : ''}`}
                        key={node.id}
                      >
                        <InfoHint {...G.skillNodeHelp(h, node)}>
                          {node.name}
                        </InfoHint>
                        <p className="skill-node-effect">
                          {G.skillNodeHelp(h, node).body.split('\n')[0]}
                        </p>
                        <small>
                          {node.type === 'active' ? '主动技能' : '被动强化'} ·
                          Lv.{node.minLevel} · {node.pointCost} 点
                        </small>
                        <button
                          disabled={!!reason}
                          onClick={() =>
                            act((x) => G.learnSkill(x, h.id, node.id))
                          }
                        >
                          {known ? '✓ 已掌握' : reason || '学习技能'}
                        </button>
                      </article>
                    );
                  })}
              </section>
            ))}
          </div>
          <div className="skill-tree-footer">
            <span>
              {h.legacySkill
                ? '旧档携带技能已保留，不占技能点。'
                : '学习分支技能后自动携带，可在培养区切换。'}
            </span>
            <button
              disabled={G.heroAway(s, h.id) || !h.learnedNodes?.length}
              onClick={() => act((x) => G.resetSkills(x, h.id))}
            >
              免费重置
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
