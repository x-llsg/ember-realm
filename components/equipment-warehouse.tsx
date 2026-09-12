'use client';
import { useEffect, useState } from 'react';
import * as G from '@/lib/realm';
import { GearLabel, GearWearer } from './gear-presentation';
import { DEFAULT_GEAR_SORT, GearSortControl } from './gear-sort-control';
import { GearWorkshop, SalvageYield } from './gear-workshop';
import { InfoHint, Term } from './info-hint';
import { Pick, type Act, type Destination } from './realm-panels';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import '@/app/equipment.css';

type Filters = Parameters<typeof G.filterGear>[1];
type Batch = {
  ids: string[];
  includeSets: boolean;
  includeEnhanced: boolean;
  allowOverflow?: boolean;
};
export function EquipmentWarehouse({
  s,
  act,
  go,
  focus,
}: {
  s: G.State;
  act: Act;
  go: (d: Destination) => void;
  focus: Destination;
}) {
  const [filters, setFilters] = useState<Filters>({ ...DEFAULT_GEAR_SORT });
  const [selected, setSelected] = useState<string[]>([]);
  const [inspected, setInspected] = useState(
    focus.gear || G.filterGear(s)[0]?.id || '',
  );
  const [includeSets, setIncludeSets] = useState(false);
  const [includeEnhanced, setIncludeEnhanced] = useState(false);
  const [confirm, setConfirm] = useState<Batch | null>(null);
  const [recipient, setRecipient] = useState(
    focus.hero || s.heroes[0]?.id || '',
  );
  const items = G.filterGear(s, filters);
  useEffect(() => {
    if (!items.some((g) => g.id === inspected))
      setInspected(items[0]?.id || '');
  }, [items, inspected]);
  const item = items.find((g) => g.id === inspected) || items[0];
  const owner = item ? G.gearOwner(s, item.id) : undefined;
  const options = { includeSets, includeEnhanced };
  const eligible = G.dismantleQuote(
    s,
    items.map((g) => g.id),
    options,
  );
  const chosen = G.dismantleQuote(s, selected, options);
  const pending = G.dismantleQuote(s, confirm?.ids || [], confirm || options);
  const setIds = new Set(s.guild.inventory.map((g) => g.setId).filter(Boolean));
  const changeFilters = (next: Filters) => {
    setFilters({ ...filters, ...next });
    setSelected([]);
  };
  const protectionChanged = (kind: 'sets' | 'enhanced', checked: boolean) => {
    if (kind === 'sets') setIncludeSets(checked);
    else setIncludeEnhanced(checked);
    setSelected([]);
  };
  const selectOne = (id: string, enabled: boolean) =>
    setSelected((ids) =>
      enabled ? [...new Set([...ids, id])] : ids.filter((x) => x !== id),
    );
  return (
    <div className="equipment-warehouse">
      <header className="warehouse-heading">
        <div>
          <strong>装备仓库</strong>
          <span>
            <b>{s.guild.inventory.length}</b> / {G.INVENTORY_CAP} 件 <i>·</i>{' '}
            已穿戴{' '}
            <b>
              {s.guild.inventory.filter((g) => G.gearOwner(s, g.id)).length}
            </b>{' '}
            件
          </span>
        </div>
        <button
          className="secondary-button"
          onClick={() => go({ view: 'heroes', hero: recipient })}
        >
          ← 返回角色与锻造
        </button>
      </header>
      <div className="warehouse-content">
        <div className="warehouse-wallet" aria-label="分解材料库存">
          <Term name="dust">锻造尘 {s.guild.dust}/9999</Term>
          {G.SALVAGE_MATERIALS.map((m) => (
            <InfoHint
              key={m.rarity}
              title={m.name}
              body={`分解${G.QUALITY_NAMES[m.rarity - 1]}装备获得，每件产出等于装备阶级。定向重铸同品质装备消耗两倍装备阶级的${m.name}，其他品质不能代付。库存上限${G.SALVAGE_CAP}。`}
              className={'rarity-' + m.rarity}
            >
              {m.name} {G.salvageCount(s, m.rarity)}
            </InfoHint>
          ))}
        </div>
        <div className="warehouse-filters">
          <input
            aria-label="搜索装备"
            placeholder="搜索名称、词条、套装…"
            value={filters?.search || ''}
            onChange={(e) => changeFilters({ search: e.target.value })}
          />
          <Pick
            label="仓库装备部位"
            value={filters?.slot || 'all'}
            onChange={(slot) =>
              changeFilters({ slot: slot as G.GearSlot | 'all' })
            }
            options={[
              { value: 'all', label: '全部部位' },
              ...G.GEAR_SLOT_OPTIONS,
            ]}
          />
          <Pick
            label="仓库装备状态"
            value={
              filters?.locked === 'locked'
                ? 'locked'
                : filters?.equipped || 'all'
            }
            onChange={(status) =>
              changeFilters(
                status === 'locked'
                  ? { locked: 'locked', equipped: 'all' }
                  : {
                      locked: 'all',
                      equipped: status as 'all' | 'equipped' | 'unequipped',
                    },
              )
            }
            options={[
              { value: 'all', label: '全部状态' },
              { value: 'unequipped', label: '闲置装备' },
              { value: 'equipped', label: '已穿戴' },
              { value: 'locked', label: '已收藏' },
            ]}
          />
          <Pick
            label="仓库套装筛选"
            value={filters?.set || 'all'}
            onChange={(set) => changeFilters({ set })}
            options={[
              { value: 'all', label: '全部套装与散件' },
              { value: 'none', label: '只看散件' },
              ...G.EQUIPMENT_SETS.filter((set) => setIds.has(set.id)).map(
                (set) => ({ value: set.id, label: set.name }),
              ),
            ]}
          />
          <GearSortControl
            label="仓库装备"
            sort={filters?.sort}
            order={filters?.order}
            onChange={changeFilters}
          />
        </div>
        <div
          className="warehouse-quality"
          role="group"
          aria-label="筛选装备品质"
        >
          <button
            aria-pressed={!filters?.rarities?.length}
            onClick={() => changeFilters({ rarities: [] })}
          >
            全部品质
          </button>
          {G.QUALITY_NAMES.map((name, i) => (
            <button
              key={name}
              className={'rarity-' + (i + 1)}
              aria-pressed={!!filters?.rarities?.includes(i + 1)}
              onClick={() => {
                const rarities = filters?.rarities || [];
                changeFilters({
                  rarities: rarities.includes(i + 1)
                    ? rarities.filter((r) => r !== i + 1)
                    : [...rarities, i + 1],
                });
              }}
            >
              {name}
            </button>
          ))}
          <span>找到 {items.length} 件</span>
          <button
            onClick={() => {
              setFilters({ ...DEFAULT_GEAR_SORT });
              setSelected([]);
            }}
          >
            清除筛选
          </button>
        </div>
        <div className="warehouse-body">
          <section className="warehouse-list-area" aria-label="装备整理清单">
            <div className="warehouse-selection">
              <button
                className="secondary-button"
                disabled={!eligible.count}
                onClick={() => setSelected(eligible.ids)}
              >
                全选可分解项
              </button>
              <button
                className="secondary-button"
                disabled={!selected.length}
                onClick={() => setSelected([])}
              >
                清空选择
              </button>
              <span>已选 {chosen.count} 件</span>
              <label>
                <input
                  type="checkbox"
                  checked={includeSets}
                  onChange={(e) => protectionChanged('sets', e.target.checked)}
                />
                包含套装
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={includeEnhanced}
                  onChange={(e) =>
                    protectionChanged('enhanced', e.target.checked)
                  }
                />
                包含强化装备
              </label>
            </div>
            <div className="warehouse-items">
              {items.map((gear) => {
                const single = G.dismantleQuote(s, [gear.id], options);
                const blocked = single.skipped[0]?.reason || '';
                return (
                  <article
                    key={gear.id}
                    className={
                      'warehouse-row' + (item?.id === gear.id ? ' active' : '')
                    }
                  >
                    <input
                      type="checkbox"
                      aria-label={'选择分解 ' + G.gearName(gear)}
                      disabled={!!blocked}
                      checked={selected.includes(gear.id) && !blocked}
                      onChange={(e) => selectOne(gear.id, e.target.checked)}
                    />
                    <button
                      className="warehouse-item-open"
                      aria-pressed={item?.id === gear.id}
                      onClick={() => setInspected(gear.id)}
                    >
                      <GearLabel s={s} item={gear} withinControl />
                      <span>
                        {
                          G.SLOT_NAMES[
                            G.RECIPES.find((r) => r.id === gear.recipe)!.slot
                          ]
                        }{' '}
                        · <GearWearer s={s} item={gear} />
                        {gear.locked ? ' · 已收藏' : ''}
                      </span>
                    </button>
                    <button
                      className="warehouse-lock"
                      aria-label={
                        (gear.locked ? '取消收藏 ' : '收藏 ') + G.gearName(gear)
                      }
                      aria-pressed={!!gear.locked}
                      onClick={() => act((x) => G.toggleGearLock(x, gear.id))}
                    >
                      {gear.locked ? '◆' : '◇'}
                    </button>
                  </article>
                );
              })}
              {!items.length && (
                <div className="warehouse-empty">
                  <strong>暂无符合条件的装备</strong>
                  <p>
                    {s.guild.inventory.length
                      ? '试试清除筛选，或换一个部位。'
                      : '锻造、探索和挑战守敌都能获得装备。'}
                  </p>
                </div>
              )}
            </div>
          </section>
          <aside className="warehouse-detail" aria-label="仓库装备详情">
            {item ? (
              <>
                <div className="warehouse-detail-heading">
                  <small>选中装备</small>
                  <h3>
                    <GearLabel s={s} item={item} />
                  </h3>
                </div>
                {item.setId && (
                  <p className="warehouse-set-help">{G.gearSetHelp(item)}</p>
                )}
                {s.heroes.length > 0 && (
                  <div className="warehouse-equip">
                    <Pick
                      label="装备接收角色"
                      value={recipient}
                      onChange={setRecipient}
                      options={s.heroes.map((h) => ({
                        value: h.id,
                        label: `${h.name}${G.heroAway(s, h.id) ? ' · 出征中' : ''}`,
                      }))}
                    />
                    <button
                      className="secondary-button"
                      disabled={
                        !recipient ||
                        G.heroAway(s, recipient) ||
                        G.gearAway(s, item.id) ||
                        owner?.id === recipient
                      }
                      onClick={() =>
                        act((x) => G.equipGear(x, recipient, item.id))
                      }
                    >
                      {owner?.id === recipient
                        ? '已装备'
                        : owner
                          ? '转交并装备'
                          : '装备'}
                    </button>
                  </div>
                )}
                <GearWorkshop key={item.id} s={s} item={item} act={act} />
              </>
            ) : (
              <div className="warehouse-empty">
                选择装备即可查看属性、换装、强化和重铸。
              </div>
            )}
            {focus.gear &&
              !s.guild.inventory.some((g) => g.id === focus.gear) && (
                <p className="gear-action-reason">
                  这条收获记录对应的装备已不在仓库，可能已经分解；历史记录仍保留。
                </p>
              )}
          </aside>
        </div>
      </div>
      <footer className="warehouse-batch-bar">
        <div className="warehouse-batch-summary">
          <strong>分解选中 {chosen.count} 件</strong>
          <SalvageYield dust={chosen.dust} salvage={chosen.salvage} />
          <small
            title={
              chosen.reason ||
              '默认保护收藏、已穿戴、套装与强化装备；确认前可查看明细。'
            }
          >
            {chosen.reason ||
              '默认保护收藏、已穿戴、套装与强化装备；确认前可查看明细。'}
          </small>
        </div>
        <button
          className="primary-button"
          disabled={!chosen.count}
          onClick={() => setConfirm({ ids: [...chosen.ids], ...options })}
        >
          预览分解…
        </button>
      </footer>
      <Dialog
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <DialogContent className="life-dialog salvage-confirm">
          <DialogTitle>确认批量分解 · {pending.count} 件</DialogTitle>
          <div className="salvage-confirm-body">
            <DialogDescription>
              只处理本次选中的装备，新掉落不会被加入。分解后装备与强化投入无法恢复。
            </DialogDescription>
            <div className="salvage-confirm-list">
              {pending.items.map((gear) => (
                <div key={gear.id} className={'rarity-' + gear.rarity}>
                  {G.gearName(gear)}
                </div>
              ))}
            </div>
            <SalvageYield dust={pending.dust} salvage={pending.salvage} />
            <label className="salvage-overflow-choice">
              <input
                type="checkbox"
                checked={!!confirm?.allowOverflow}
                onChange={(e) =>
                  setConfirm((batch) =>
                    batch
                      ? { ...batch, allowOverflow: e.target.checked }
                      : null,
                  )
                }
              />
              允许丢弃超出容量的材料
            </label>
            {(pending.lostDust > 0 ||
              Object.values(pending.lostSalvage).some((n) => n > 0)) && (
              <div className="salvage-overflow-warning">
                <strong>
                  {confirm?.allowOverflow
                    ? '确认后将丢弃以下超额材料：'
                    : '材料容量不足，以下数量无法入库：'}
                </strong>
                <SalvageYield
                  dust={pending.lostDust}
                  salvage={pending.lostSalvage}
                  loss
                />
              </div>
            )}
            {pending.skipped.length > 0 && (
              <p>
                状态已变化，自动跳过 {pending.skipped.length}{' '}
                件受保护或已不存在的装备。
              </p>
            )}
            {pending.reason && <p>{pending.reason}</p>}
          </div>
          <div className="warehouse-confirm-actions">
            <button
              className="secondary-button"
              onClick={() => setConfirm(null)}
            >
              返回整理
            </button>
            <button
              className="primary-button"
              disabled={!pending.count || !!pending.reason}
              onClick={() => {
                if (confirm)
                  act((x) => G.bulkDismantleGear(x, confirm.ids, confirm));
                setConfirm(null);
                setSelected([]);
              }}
            >
              确认分解 {pending.count} 件
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
