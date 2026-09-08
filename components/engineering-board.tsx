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
    ({ project, region }) =>
      G.discoveryCount(s, region) > 0 || !!s.projects[project.id],
  );
}

function projectGate(s: G.State, region: number) {
  const project = G.PROJECTS[region];
  if (!project) return '尚未发现这项工程';
  if (s.projects[project.id]) return '这项工程已经完成';
  if (!G.projectReady(s, region)) return '需集齐当地两条线索';
  return '';
}

function projectBlocked(s: G.State, region: number) {
  const project = G.PROJECTS[region];
  return (
    !project ||
    !!projectGate(s, region) ||
    !G.canPay(s, project.cost) ||
    !G.canAffordMaterials(s, G.projectMaterialCost(s, region))
  );
}

function ProjectBill({ s, region }: { s: G.State; region: number }) {
  const project = G.PROJECTS[region],
    materials = G.projectMaterialCost(s, region);
  return (
    <div
      className="engineering-bill"
      aria-label="两种方案支付相同费用；不足处直接显示缺口"
    >
      {Object.entries(project.cost).map(([key, amount]) => {
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
            的发现带回了这项工程。两种方案花费相同，只能选择其中一种。
          </p>
          {found.map((text) => (
            <p key={text}>{text}</p>
          ))}
          {project.choices.map((choice) => (
            <p key={choice.id}>
              <strong>{choice.label}</strong>：{choice.text}
            </p>
          ))}
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
    ({ project }) => !!s.projects[project.id],
  ).length;

  return (
    <section className="engineering-board" aria-label="已发现城镇工程">
      <header className="engineering-heading">
        <strong>城镇工程</strong>
        <span>
          已发现 {rows.length} · 已完成 {completed}
        </span>
        <InfoHint
          title="工程费用与永久选择"
          body="每行是一项已经发现的工程。费用只支付一次，两种方案相同；数字后的“缺”表示尚缺数量。先集齐当地两条线索，再备齐物资。点击方案会打开确认，不会立即施工。"
        >
          费用与选择 ⓘ
        </InfoHint>
      </header>
      <div className="engineering-list" aria-label="工程清单">
        {rows.map(({ project, region }) => {
          const saved = project.choices.find(
            (item) => item.id === s.projects[project.id],
          );
          const clues = G.discoveryCount(s, region),
            gate = projectGate(s, region),
            blocked = projectBlocked(s, region);
          const rowClass = `engineering-row${focus?.region === region ? ' focused' : ''}`;
          if (saved)
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
                  <span className="engineering-saved">✓ {saved.label}</span>
                  <span className="engineering-expand">查看效果</span>
                </summary>
                <div className="engineering-completed-detail">
                  <strong>{saved.effect}</strong>
                  <p>{saved.text}</p>
                  <small>此方案已经永久生效。</small>
                </div>
              </details>
            );
          return (
            <article className={rowClass} key={project.id}>
              <div className="engineering-identity">
                <ProjectName s={s} region={region} />
                <span className="engineering-meta">
                  第 {region + 1} 章 · 线索 {clues}/2
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
                    {blocked ? '物资缺口见右侧' : '材料备齐 · 可以施工'}
                  </span>
                )}
              </div>
              <ProjectBill s={s} region={region} />
              {project.choices.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="engineering-choice"
                  disabled={blocked}
                  aria-label={`${project.name}：${item.label}。${item.effect}。选择后进入确认。`}
                  onClick={() => setPending({ region, choice: item.id })}
                >
                  <strong>
                    {item.label}
                    <span aria-hidden="true"> →</span>
                  </strong>
                  <span>{item.effect}</span>
                </button>
              ))}
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
            这项选择完成后永久生效，同一工程不能改选另一方案。
          </DialogDescription>
          {pending && target && choice && (
            <>
              <p>{choice.text}</p>
              <p className="engineering-confirm-effect">{choice.effect}</p>
              <Buy
                s={s}
                cost={target.cost}
                materials={G.projectMaterialCost(s, pending.region)}
                reason={projectGate(s, pending.region)}
                label={`确认施工 · ${choice.label}`}
                onClick={() => {
                  if (projectBlocked(s, pending.region)) return;
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
