'use client';

import { useState } from 'react';
import * as G from '@/lib/realm';
import { InfoHint, MaterialName } from './info-hint';
import type { Destination } from './realm-panels';

export function DiscoveryJournal({
  s,
  go,
}: {
  s: G.State;
  go: (destination: Destination) => void;
}) {
  const [selected, setSelected] = useState(s.lastMap);
  const regions = G.REGIONS.map((r, id) => ({ ...r, id })).filter((r) =>
    G.regionVisited(s, r.id),
  );
  const region = regions.find((r) => r.id === selected) || regions[0];
  if (!region)
    return (
      <div className="life-empty">
        第一次调查归来后，这里会记录发现的材料、套装和线索。
      </div>
    );
  const id = region.id;
  const material = G.REGION_MATERIALS[id];
  const equipmentSet = G.EQUIPMENT_SETS.find((set) => set.region === id)!;
  const owned = s.guild.inventory.filter(
    (item) => item.setId === equipmentSet.id,
  );
  const slots = new Set(
    owned.map((item) => G.RECIPES.find((r) => r.id === item.recipe)!.slot),
  );
  const setKnown =
    s.guild.depths[id] > 0 || owned.length > 0 || s.cleared.includes(id);
  const technologies = G.TECHNOLOGIES.filter(
    (t) => t.requires.depth?.region === id && G.technologyDiscovered(s, t.id),
  );
  const found = G.discoveryCount(s, id);
  return (
    <section className="discovery-journal" aria-label="冒险手册">
      <nav className="journal-regions" aria-label="已发现地区资料">
        <strong>冒险手册</strong>
        {regions.map((r) => (
          <button
            type="button"
            key={r.id}
            aria-pressed={r.id === id}
            onClick={() => setSelected(r.id)}
          >
            <span>{r.name}</span>
            <small>
              {s.guild.depths[r.id]}/5据点
              {s.cleared.includes(r.id) ? ' · 首领已败' : ''}
            </small>
          </button>
        ))}
      </nav>
      <div className="journal-detail">
        <header>
          <InfoHint
            title={region.name}
            body={s.cleared.includes(id) ? region.story : region.desc}
          >
            <h2>{region.name}</h2>
          </InfoHint>
          <span>材料来源 · 套装部位 · 调查线索</span>
        </header>
        <div className="journal-grid">
          <section>
            <h3>地区材料</h3>
            <p>
              <MaterialName s={s} id={material} /> ·{' '}
              {Math.floor(s.world.materials[material])}/
              {G.materialCapacity(s, material)}
            </p>
            <p>{G.MATERIAL_SOURCES[material]}</p>
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                go({ view: 'explore', region: id, route: 'supply' })
              }
            >
              前往收集材料 →
            </button>
          </section>
          <section>
            <h3>相关工艺</h3>
            {technologies.length ? (
              technologies.map((t) => (
                <button
                  type="button"
                  className="journal-technology"
                  key={t.id}
                  onClick={() =>
                    go({ view: 'research', tab: 'technology', research: t.id })
                  }
                >
                  <span>{t.name}</span>
                  <small>
                    {s.world.tech.includes(t.id) ? '已掌握' : '前往研究 →'}
                  </small>
                </button>
              ))
            ) : (
              <p>继续调查与夺取据点，会发现新的工艺线索。</p>
            )}
          </section>
          <section>
            <h3>{setKnown ? equipmentSet.name : '尚未发现的套装'}</h3>
            {setKnown ? (
              <>
                <p>{equipmentSet.text}</p>
                <div
                  className="journal-set-slots"
                  aria-label="当前持有的套装部位"
                >
                  {G.GEAR_SLOTS.map((slot) => (
                    <span key={slot} className={slots.has(slot) ? 'owned' : ''}>
                      {G.SLOT_NAMES[slot]}
                      {slots.has(slot) ? ' ✓' : ' · 缺'}
                    </span>
                  ))}
                </div>
                <small>
                  当前持有 {slots.size}/6 部位；同一角色穿戴2/4件激活效果。
                </small>
                <p>反复挑战已击败的守敌可刷取套装；首领战胜利必掉当地套装。</p>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    go({ view: 'explore', region: id, guardian: 0 })
                  }
                >
                  选择守敌刷取 →
                </button>
              </>
            ) : (
              <p>击败这里的第一位守敌后记录套装来源。</p>
            )}
          </section>
          <section>
            <h3>调查线索 · {found}/2</h3>
            {region.discoveries.map((text, index) => (
              <p key={index} className={index < found ? '' : 'desk-muted'}>
                {index < found ? text : `第${index + 1}条线索尚未发现`}
              </p>
            ))}
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                go({ view: 'explore', region: id, route: 'survey' })
              }
            >
              {found < 2 ? '前往调查 →' : '回到这片地区 →'}
            </button>
          </section>
        </div>
      </div>
    </section>
  );
}
