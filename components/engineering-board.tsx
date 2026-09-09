'use client';

import { useState } from 'react';
import * as G from '@/lib/realm';
import { Buy, type Act, type Destination } from '@/components/realm-panels';
import { InfoHint, ResourceName, MaterialName } from '@/components/info-hint';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

type Props = {
  s: G.State;
  act: Act;
  go: (destination: Destination) => void;
  focus?: Destination;
};
type Pending = { region: number; choice: string };

// A local project follows the first actual discovery, not merely an open map tile.
// Keep completed projects visible for migrated saves, even if their old clues differ.
export function discoveredProjects(s: G.State) {
  return G.PROJECTS.map((project, region) => ({ project, region })).filter(
    ({ region }) => G.chapterProjectDiscovered(s, region),
  );
}

function nextChoice(s: G.State, region: number) {
  const project = G.PROJECTS[region];
  return (
    project?.choices.find((c) => !G.hasProjectChoice(s, project.id, c.id))
      ?.id || ''
  );
}

function projectGate(
  s: G.State,
  region: number,
  choice = nextChoice(s, region),
) {
  return G.chapterProjectGate(s, region, choice);
}

function projectBlocked(
  s: G.State,
  region: number,
  choice = nextChoice(s, region),
) {
  return !!G.chapterProjectReason(s, region, choice);
}

function ProjectBill({ s, region }: { s: G.State; region: number }) {
  const { cost, materials } = G.chapterProjectCost(
    s,
    region,
    nextChoice(s, region),
  );
  return (
    <div
      className="engineering-bill"
      aria-label="下一项工程的实际费用；不足处直接显示缺口"
    >
      {Object.entries(cost).map(([key, amount]) => {
        const id = key as G.Resource,
          need = amount!,
          short = Math.max(0, Math.ceil(need - s.resources[id] - 1e-8));
        const over = need > G.capacity(s, id);
        return (
          <span
            className={`engineering-price${short ? ' is-short' : ''}`}
            key={id}
          >
            <ResourceName s={s} id={id} />
            <b>{need}</b>
            {short > 0 && <em>缺{short}</em>}
            {over && <span className="engineering-cap">需扩仓</span>}
          </span>
        );
      })}
      {Object.entries(materials).map(([key, amount]) => {
        const id = key as G.MaterialId,
          need = amount!,
          short = Math.max(0, Math.ceil(need - s.world.materials[id] - 1e-8));
        const over = need > G.materialCapacity(s, id);
        return (
          <span
            className={`engineering-price material${short ? ' is-short' : ''}`}
            key={id}
          >
            <MaterialName s={s} id={id} />
            <b>{need}</b>
            {short > 0 && <em>缺{short}</em>}
            {over && <span className="engineering-cap">需进阶</span>}
          </span>
        );
      })}
    </div>
  );
}

function ProjectName({
  s,
  region,
  withinControl = false,
}: {
  s: G.State;
  region: number;
  withinControl?: boolean;
}) {
  const project = G.PROJECTS[region],
    place = G.REGIONS[region];
  const found = place.discoveries.filter(
    (_, i) => s.survey[region] >= place.thresholds[i],
  );
  return (
    <InfoHint
      className="engineering-project-name"
      withinControl={withinControl}
      title={project.name}
      body={
        <>
          <p>
            {place.name}
            的发现带回了这项工程。先选择当前更需要的一项；占领第四据点或击败首领后，可另付物资补建另一项。已有方案始终保留。
          </p>
          {found.map((text) => (
            <p key={text}>{text}</p>
          ))}
          {project.choices.map((choice) => (
            <p key={choice.id}>
              <strong>{choice.label}</strong>：{choice.text}
            </p>
          ))}
          <p>
            <strong>工坊线索 · {G.CHAPTER_WORKS[region].recipe}</strong>：
            {G.CHAPTER_WORKS[region].clue}
          </p>
          <p>
            两项都完成后，本地区替代配方获得联合供货：普通资源费用减少10%，专用原料不变。默认配方不受影响。
          </p>
        </>
      }
    >
      {project.name}
    </InfoHint>
  );
}

/** Replace TownPanel's projects Pane body with this board; remove its project selector state. */
export function EngineeringBoard({ s, act, go, focus }: Props) {
  const rows = discoveredProjects(s);
  const [pending, setPending] = useState<Pending | null>(null);
  const [expanded, setExpanded] = useState<number[]>(() => {
    const region = focus?.region;
    return region !== undefined &&
      G.PROJECTS[region] &&
      s.projects[G.PROJECTS[region].id]
      ? [region]
      : [];
  });
  const target = pending ? G.PROJECTS[pending.region] : undefined;
  const choice = target?.choices.find((item) => item.id === pending?.choice);
  const completed = rows.filter(
    ({ region }) => G.chapterProjectCount(s, region) === 2,
  ).length;
  const pendingBill = pending
    ? G.chapterProjectCost(s, pending.region, pending.choice)
    : undefined;

  return (
    <section className="engineering-board" aria-label="已发现城镇工程">
      <header className="engineering-heading">
        <strong>城镇工程</strong>
        <span>
          已发现 {rows.length} · 两项竣工 {completed}
        </span>
        <InfoHint
          title="工程先后与补建"
          body="每行是一项已经发现的工程，两种方案可以先后完成。首项沿用原施工费；占领当地第四据点或击败首领后，可以支付更高费用补建另一项，两项效果共同生效。每项只支付一次，不重复发放旧奖励。两项竣工还会降低本地替代配方的普通资源费用10%。数字后的“缺”是尚缺数量。点击方案先比较并确认。"
        >
          费用与选择 ⓘ
        </InfoHint>
      </header>
      <div className="engineering-list" aria-label="工程清单">
        {rows.map(({ project, region }) => {
          const saved = project.choices.find(
            (item) => item.id === s.projects[project.id],
          );
          const count = G.chapterProjectCount(s, region);
          const clues = G.discoveryCount(s, region),
            gate = projectGate(s, region),
            blocked = projectBlocked(s, region);
          const rowClass = `engineering-row${focus?.region === region ? ' focused' : ''}`;
          if (count === 2)
            return (
              <details
                key={project.id}
                className={`${rowClass} completed`}
                open={expanded.includes(region)}
                onToggle={(event) => {
                  const open = event.currentTarget.open;
                  setExpanded((previous) =>
                    previous.includes(region) === open
                      ? previous
                      : open
                        ? [...previous, region]
                        : previous.filter((item) => item !== region),
                  );
                }}
              >
                <summary className="engineering-completed-summary">
                  <ProjectName s={s} region={region} withinControl />
                  <span className="engineering-saved">
                    ✓ 两项竣工 · 联合供货
                  </span>
                  <span className="engineering-expand">查看效果</span>
                </summary>
                <div className="engineering-completed-detail">
                  {project.choices.map((item) => (
                    <p key={item.id}>
                      <strong>{item.label}</strong>：{item.effect}
                    </p>
                  ))}
                  <p>{G.CHAPTER_WORKS[region].complete}</p>
                  <small>
                    {G.CHAPTER_WORKS[region].recipe}普通资源费用
                    −10%；专用原料不变。
                  </small>
                </div>
              </details>
            );
          return (
            <article className={rowClass} key={project.id}>
              <div className="engineering-identity">
                <ProjectName s={s} region={region} />
                <span className="engineering-meta">
                  第 {region + 1} 章 · 线索 {clues}/2 · 工程 {count}/2
                </span>
                {clues < 2 ? (
                  <button
                    type="button"
                    className="engineering-link"
                    onClick={() =>
                      go({ view: 'explore', region, route: 'survey' })
                    }
                  >
                    调查补全 →
                  </button>
                ) : gate ? (
                  <span className="engineering-gate">{gate}</span>
                ) : (
                  <span className="engineering-meta">
                    {blocked
                      ? '物资缺口见右侧'
                      : saved
                        ? '可以补建 · 原效果保留'
                        : '材料备齐 · 可以施工'}
                  </span>
                )}
              </div>
              <ProjectBill s={s} region={region} />
              {project.choices.map((item) => {
                const done = G.hasProjectChoice(s, project.id, item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="engineering-choice"
                    disabled={done || blocked}
                    aria-label={`${project.name}：${item.label}。${item.effect}。选择后进入确认。`}
                    onClick={() => setPending({ region, choice: item.id })}
                  >
                    <strong>
                      {done ? '✓ ' : ''}
                      {item.label}
                      <span aria-hidden="true">
                        {done ? ' · 已生效' : saved ? ' · 补建 →' : ' →'}
                      </span>
                    </strong>
                    <span>{item.effect}</span>
                  </button>
                );
              })}
            </article>
          );
        })}
        {!rows.length && (
          <div className="engineering-empty">
            <p>小队还没有带回工程线索。</p>
            <button
              type="button"
              className="secondary-button"
              onClick={() => go({ view: 'explore', route: 'survey' })}
            >
              安排第一次调查
            </button>
          </div>
        )}
      </div>
      <Dialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <DialogContent className="life-dialog engineering-confirm">
          <DialogTitle>
            {target?.name} · {choice?.label}
          </DialogTitle>
          <DialogDescription>
            {pending && G.chapterProjectCount(s, pending.region) > 0
              ? '补建需要重新支付下面的物资，原有方案保留，两项效果共同生效。'
              : '选择先完成哪一项；占领当地第四据点或击败首领后，可以另付物资补建另一项。'}
          </DialogDescription>
          {pending && target && choice && (
            <>
              <p>{choice.text}</p>
              <p className="engineering-confirm-effect">{choice.effect}</p>
              <Buy
                s={s}
                cost={pendingBill!.cost}
                materials={pendingBill!.materials}
                reason={projectGate(s, pending.region, pending.choice)}
                label={`确认施工 · ${choice.label}`}
                onClick={() => {
                  if (projectBlocked(s, pending.region, pending.choice)) return;
                  const selected = pending;
                  act((current) =>
                    G.completeProject(
                      current,
                      selected.region,
                      selected.choice,
                    ),
                  );
                  setPending(null);
                }}
              />
              <button
                type="button"
                className="secondary-button"
                onClick={() => setPending(null)}
              >
                返回比较方案
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
