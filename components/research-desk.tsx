'use client';

import { InfoHint } from './info-hint';
import { GameIcon } from './game-art';
import { PinPlan } from './planning-board';
import { useId, useState } from 'react';
import * as G from '@/lib/realm';
import { Buy, type Act, type Destination } from './realm-panels';

type Props = { s: G.State; act: Act; focus: Destination };
type GroupId = 'town' | 'technology' | 'adventure' | 'doctrine' | 'development';
type DoctrineId = keyof G.State['guild']['doctrine'];
type Entry = {
  key: string;
  id: string;
  group: GroupId;
  name: string;
  description: string;
  done: boolean;
  cost: G.Cost;
  materials: G.MaterialCost;
  reason: string;
  note: string;
  label: string;
  level?: number;
  apply: (s: G.State) => G.State;
};

const GROUPS: { id: GroupId; name: string }[] = [
  { id: 'development', name: '产线改良' },
  { id: 'town', name: '生活生产' },
  { id: 'technology', name: '城镇工艺' },
  { id: 'adventure', name: '冒险魔法' },
  { id: 'doctrine', name: '长线学派' },
];
const DOCTRINES: { id: DoctrineId; name: string; description: string }[] = [
  {
    id: 'logistics',
    name: '运输与后勤',
    description: '远征耗时除以 1 + 等级 × 6%，更快把据点物资运回城镇。',
  },
  {
    id: 'smithing',
    name: '工匠传承',
    description:
      '装备生命、攻击和防御的加成系数每级增加 5%；同时加快木板与精钢加工。',
  },
  {
    id: 'scholarship',
    name: '野外学术',
    description: '每级使调查额外获得 2 点敌情，同时加快符文加工。',
  },
];

function entriesFor(s: G.State): Entry[] {
  const entries: Entry[] = G.RESEARCH.filter((r) =>
    G.researchDiscovered(s, r.id),
  ).map((r) => ({
    key: `research:${r.id}`,
    id: r.id,
    group: r.category,
    name: r.name,
    description: r.desc,
    done: s.research.includes(r.id),
    cost: r.cost,
    materials: r.materials || {},
    reason: G.researchReason(s, r.id),
    note: `所需设施：${G.BUILDINGS.find((b) => b.id === (r.need || 'shrine'))?.name || '无名者学馆'}`,
    label: '研究并应用',
    apply: (x) => G.research(x, r.id),
  }));
  for (const t of G.TECHNOLOGIES.filter((t) =>
    G.technologyDiscovered(s, t.id),
  )) {
    entries.push({
      key: `technology:${t.id}`,
      id: t.id,
      group: 'technology',
      name: t.name,
      description: t.desc,
      done: s.world.tech.includes(t.id),
      cost: t.cost,
      materials: t.materials,
      reason: G.technologyReason(s, t.id),
      note:
        G.technologyPrerequisiteReason(s, t.id) ||
        '探索前置已满足，备齐材料即可掌握这项工艺。',
      label: '掌握这项工艺',
      apply: (x) => G.studyTechnology(x, t.id),
    });
  }
  if (G.townRank(s) >= 2) {
    const cap = Math.min(10, 2 + G.townRank(s) * 2);
    for (const d of DOCTRINES) {
      const level = s.guild.doctrine[d.id];
      entries.push({
        key: `doctrine:${d.id}`,
        id: d.id,
        group: 'doctrine',
        name: d.name,
        description: d.description,
        done: level >= 10,
        level,
        cost: level >= 10 ? {} : G.doctrineCost(s, d.id),
        materials: {},
        reason: !s.buildings.tavern
          ? '先建造酒馆'
          : level >= cap
            ? '已到本阶段上限，城镇进阶后可继续提升'
            : '',
        note: `当前 ${level}/10 级 · 本阶段上限 ${cap} 级。`,
        label: `提升至 ${Math.min(10, level + 1)} 级`,
        apply: (x) => G.studyDoctrine(x, d.id),
      });
    }
  }
  for (const d of G.DEVELOPMENTS.filter((d) =>
    G.developmentDiscovered(s, d.id),
  ).reverse()) {
    const level = G.developmentLevel(s, d.id),
      cost = G.developmentCost(s, d.id);
    entries.unshift({
      key: 'development:' + d.id,
      id: d.id,
      group: 'development',
      name: d.name,
      description: d.desc,
      done: level >= G.DEVELOPMENT_MAX,
      cost,
      materials: {},
      reason: G.developmentReason(s, d.id),
      note: G.developmentPreview(s, d.id),
      label: '投入改良 · ' + (level + 1) + '级',
      level,
      apply: (x) => G.improveDevelopment(x, d.id),
    });
  }
  return entries;
}

function initialEntry(entries: Entry[], focus: Destination): Entry | undefined {
  const requested = entries.find(
    (e) => e.id === focus.research || e.key === focus.research,
  );
  if (requested) return requested;
  const group = GROUPS.find((g) => g.id === focus.tab)?.id;
  return (
    entries.find((e) => e.group === group && !e.done) ||
    entries.find((e) => e.group === group) ||
    entries.find((e) => !e.done) ||
    entries[0]
  );
}

function missingReason(s: G.State, entry: Entry): string {
  if (entry.done) return '';
  const blocked =
    entry.reason ||
    G.capacityReason(s, entry.cost) ||
    G.materialReason(s, entry.materials);
  if (blocked) return blocked;
  const missing = Object.entries(entry.cost)
    .filter(([k, amount]) => s.resources[k as G.Resource] + 1e-8 < amount!)
    .map(
      ([k, amount]) =>
        `${G.RESOURCE_NAMES[k as G.Resource]} ${Math.ceil(amount! - s.resources[k as G.Resource])}`,
    );
  return missing.length ? `还缺 ${missing.join('、')}` : '';
}

// A new deep link resets the selection without hiding any research group.
export function ResearchBoard(props: Props) {
  return (
    <ResearchDesk
      key={`${props.focus.tab || ''}:${props.focus.research || ''}`}
      {...props}
    />
  );
}

function ResearchDesk({ s, act, focus }: Props) {
  const entries = entriesFor(s);
  const [selected, setSelected] = useState(
    () => initialEntry(entries, focus)?.key || '',
  );
  const [expanded, setExpanded] = useState<GroupId[]>(() => {
    const entry = initialEntry(entries, focus);
    return entry?.done ? [entry.group] : [];
  });
  const id = useId();
  const current =
    entries.find((e) => e.key === selected) || initialEntry(entries, focus);
  const completed = entries.filter((e) => e.done).length;
  const currentReason = current ? missingReason(s, current) : '';

  function renderRow(entry: Entry) {
    const reason = missingReason(s, entry);
    return (
      <button
        key={entry.key}
        type="button"
        className={`research-row${current?.key === entry.key ? ' selected' : ''}${entry.done ? ' complete' : ''}${reason ? ' blocked' : ''}`}
        aria-pressed={current?.key === entry.key}
        aria-controls={`${id}-detail`}
        title={
          entry.done ? '已掌握，查看效果' : reason || '材料已备齐，可以研究'
        }
        onClick={() => setSelected(entry.key)}
      >
        <GameIcon kind="research" id={entry.id} size={24} />
        <span className="research-row-copy">
          <strong>
            <InfoHint withinControl title={entry.name} body={entry.description}>
              {entry.name}
            </InfoHint>
          </strong>
          {entry.level !== undefined && (
            <small>
              {entry.group === 'development' ? '改良' : '学派'} {entry.level}/
              {entry.group === 'development' ? G.DEVELOPMENT_MAX : 10} 级
            </small>
          )}
        </span>
        <span className="research-row-state">
          {entry.done ? '已掌握' : reason ? '待准备' : '可研究'}
        </span>
      </button>
    );
  }

  return (
    <section className="econ-board research-desk" aria-label="研究升级">
      <header className="econ-board-head research-header">
        <strong>研究与工艺</strong>
        <span>
          已发现 {entries.length} 项 · 完成 {completed} 项
        </span>
      </header>
      <div className="research-layout">
        <nav className="research-list" aria-label="已发现研究清单">
          {GROUPS.map((group) => {
            const items = entries.filter((e) => e.group === group.id);
            if (!items.length) return null;
            const active = items.filter((e) => !e.done),
              done = items.filter((e) => e.done);
            return (
              <section
                className="research-group"
                key={group.id}
                aria-labelledby={`${id}-${group.id}`}
              >
                <h3 className="research-group-title" id={`${id}-${group.id}`}>
                  <span>{group.name}</span>
                  <small>
                    {active.length} 待研 · {done.length} 完成
                  </small>
                </h3>
                {active.map(renderRow)}
                {!!done.length && (
                  <details
                    className="research-completed"
                    open={expanded.includes(group.id)}
                    onToggle={(event) => {
                      const open = event.currentTarget.open;
                      setExpanded((previous) =>
                        previous.includes(group.id) === open
                          ? previous
                          : open
                            ? [...previous, group.id]
                            : previous.filter((g) => g !== group.id),
                      );
                    }}
                  >
                    <summary>已掌握 {done.length} 项</summary>
                    {done.map(renderRow)}
                  </details>
                )}
              </section>
            );
          })}
          {!entries.length && (
            <p className="life-hint">新的见闻和城镇建设会带来研究草图。</p>
          )}
        </nav>
        <article
          className="research-detail"
          id={`${id}-detail`}
          aria-label={current ? `${current.name}详情` : '研究详情'}
        >
          {current ? (
            <>
              <span className="life-kicker">
                {GROUPS.find((g) => g.id === current.group)?.name}
              </span>
              <h2 className="illustrated-research-heading">
                <GameIcon kind="research" id={current.id} size={36} />
                <span>
                  {current.name}
                  {current.level !== undefined && (
                    <small>
                      {' '}
                      · {current.level}/
                      {current.group === 'development' ? G.DEVELOPMENT_MAX : 10}{' '}
                      级
                    </small>
                  )}
                </span>
              </h2>
              <p className="research-description">{current.description}</p>
              {current.done ? (
                <output className="research-status complete">
                  已掌握，效果持续生效。
                </output>
              ) : (
                <>
                  <p className="research-note">{current.note}</p>
                  {current.group !== 'doctrine' && (
                    <PinPlan
                      s={s}
                      act={act}
                      kind={
                        current.group === 'technology'
                          ? 'technology'
                          : current.group === 'development'
                            ? 'development'
                            : 'research'
                      }
                      id={current.id}
                    />
                  )}
                  <output
                    className={`research-status${currentReason ? ' blocked' : ' ready'}`}
                  >
                    {currentReason
                      ? '尚有条件需要准备，缺口见下方。'
                      : '材料与前置均已满足，可以开始研究。'}
                  </output>
                  <Buy
                    s={s}
                    cost={current.cost}
                    materials={current.materials}
                    reason={current.reason}
                    label={current.label}
                    onClick={() => act(current.apply)}
                  />
                </>
              )}
              {current.group === 'technology' && (
                <p className="research-current">
                  当前：{G.TOWN_RANK_NAMES[G.townRank(s)]} · 生产建筑上限{' '}
                  {G.buildingLimit(s, 'lumber')} 级 · 训练上限 {G.levelCap(s)}{' '}
                  级 · 装备 T{G.gearTier(s)}
                </p>
              )}
            </>
          ) : (
            <p className="life-hint">
              从左侧选择一项研究，查看它的效果与所需材料。
            </p>
          )}
        </article>
      </div>
    </section>
  );
}
