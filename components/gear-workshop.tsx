'use client';
import { useState, type ComponentProps } from 'react';
import * as G from '@/lib/realm';
import { GearStats, GearWearer } from './gear-presentation';
import { GameIcon } from './game-art';
import { InfoHint, Term } from './info-hint';
import { affixHelp } from '@/lib/glossary';
import { Buy, Pick, type Act } from './realm-panels';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import '@/app/equipment.css';

/** A complete bill on hover, with the same payment guard as Buy. */
export function RosterBuy({
  s,
  cost,
  reason = '',
  label,
  onClick,
  materials = {},
}: ComponentProps<typeof Buy>) {
  const blocked =
    reason || G.capacityReason(s, cost) || G.materialReason(s, materials);
  const missing = Object.entries(cost)
    .filter(([key, amount]) => s.resources[key as G.Resource] < amount!)
    .map(
      ([key, amount]) =>
        `${G.RESOURCE_NAMES[key as G.Resource]} ${Math.ceil(amount! - s.resources[key as G.Resource])}`,
    );
  const hint =
    blocked || (missing.length ? `还缺 ${missing.join('、')}` : '资源充足');
  const bill = [
    ...Object.entries(cost).map(
      ([key, amount]) =>
        `${G.RESOURCE_NAMES[key as G.Resource]} ${amount}（持有 ${Math.floor(s.resources[key as G.Resource])}）`,
    ),
    ...Object.entries(materials).map(
      ([key, amount]) =>
        `${G.MATERIAL_NAMES[key as G.MaterialId]} ${amount}（持有 ${Math.floor(s.world.materials[key as G.MaterialId])}）`,
    ),
  ];
  const summary =
    G.costText(cost) +
    (Object.keys(materials).length
      ? ` · ${Object.keys(materials).length}种材料`
      : '');
  return (
    <div className="roster-buy">
      <InfoHint
        title={`${label} · 费用与条件`}
        body={[...bill, hint].join('\n')}
        className={
          blocked || missing.length ? 'roster-bill shortage' : 'roster-bill'
        }
      >
        {blocked || (missing.length ? hint : summary) || '无需资源'}
      </InfoHint>
      <button
        className="primary-button"
        disabled={!!blocked || !G.canPay(s, cost)}
        onClick={onClick}
      >
        {label}
      </button>
    </div>
  );
}

export function SalvageYield({
  dust,
  salvage,
  loss = false,
}: {
  dust: number;
  salvage: Partial<Record<number, number>>;
  loss?: boolean;
}) {
  return (
    <div className="salvage-yield">
      {dust > 0 && (
        <span>
          锻造尘 {loss ? '−' : '+'}
          {dust.toLocaleString('zh-CN')}
        </span>
      )}
      {G.SALVAGE_MATERIALS.filter((m) => (salvage[m.rarity] || 0) > 0).map(
        (m) => (
          <span key={m.rarity} className={'rarity-' + m.rarity}>
            {m.name} {loss ? '−' : '+'}
            {salvage[m.rarity]}
          </span>
        ),
      )}
    </div>
  );
}

export function GearWorkshop({
  s,
  item,
  act,
  onRemoved,
  compact = false,
}: {
  s: G.State;
  item: G.Gear;
  act: Act;
  onRemoved?: () => void;
  compact?: boolean;
}) {
  const [affix, setAffix] = useState(String(item.affix));
  const [operation, setOperation] = useState('enhance');
  const [confirm, setConfirm] = useState(false);
  const [allowOverflow, setAllowOverflow] = useState(false);
  const [setChoice, setSetChoice] = useState(
    item.setId ||
      G.EQUIPMENT_SETS.find((set) => s.guild.depths[set.region] > 0)?.id ||
      G.EQUIPMENT_SETS[0].id,
  );
  const setQuote = G.setReforgePreview(s, item.id, setChoice);
  const chosenSet = G.EQUIPMENT_SETS.find((set) => set.id === setChoice)!;
  const owner = G.gearOwner(s, item.id);
  const away = G.gearAway(s, item.id);
  const quote = G.reforgeQuote(s, item.id, Number(affix));
  const dismantle = G.dismantleQuote(s, [item.id], {
    includeSets: true,
    includeEnhanced: true,
    allowOverflow,
  });
  return (
    <div
      className={
        'gear-workshop roster-workshop' +
        (compact ? ' roster-workshop-compact' : '')
      }
    >
      <div className={'workshop-item-preview rarity-' + item.rarity}>
        {!compact && <GameIcon kind="equipment" id={item.recipe} size={46} />}
        <div>
          {!compact && (
            <strong>
              {G.QUALITY_NAMES[item.rarity - 1]} · {item.tier}阶 · 强化 +
              {item.upgrade}
            </strong>
          )}
          <GearStats s={s} item={item} />
        </div>
      </div>
      <div className="gear-workshop-state">
        <GearWearer s={s} item={item} />
        <button
          className="secondary-button"
          aria-pressed={!!item.locked}
          onClick={() => act((x) => G.toggleGearLock(x, item.id))}
        >
          {item.locked ? '已收藏 · 取消收藏' : '收藏保护'}
        </button>
      </div>
      <nav className="roster-workshop-operations" aria-label="装备整备项目">
        {[
          { id: 'enhance', label: '强化' },
          { id: 'affix', label: '词条' },
          ...(G.EQUIPMENT_SETS.some((set) => s.guild.depths[set.region] > 0)
            ? [{ id: 'set', label: '套装' }]
            : []),
          { id: 'salvage', label: '分解' },
        ].map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={operation === entry.id}
            onClick={() => setOperation(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </nav>
      <section hidden={operation !== 'enhance'}>
        <div className="roster-operation-body">
          <strong>
            <Term name="enhancement">装备强化</Term> · 当前 +{item.upgrade}
          </strong>
        </div>
        <div className="roster-operation-actions">
          <RosterBuy
            s={s}
            cost={G.enhancementCost(item)}
            materials={G.enhancementMaterials(s, item)}
            reason={
              away
                ? '该装备正由出征角色携带'
                : item.upgrade >= 8
                  ? '强化已达 +8'
                  : ''
            }
            label={`强化至 +${Math.min(8, item.upgrade + 1)}`}
            onClick={() => act((x) => G.enhanceGear(x, item.id))}
          />
        </div>{' '}
      </section>
      <section hidden={operation !== 'affix'}>
        <div className="roster-operation-body">
          <strong>
            <Term name="affix">定向重铸</Term>
          </strong>
          <Pick
            label="选择重铸词条"
            value={affix}
            onChange={setAffix}
            options={G.AFFIXES.map((a, i) => ({
              value: String(i),
              label: `${a.name} · ${a.text}`,
            }))}
          />
          <InfoHint
            {...affixHelp(Number(affix), s, { ...item, affix: Number(affix) })}
          >
            词条预览：{G.AFFIXES[Number(affix)].name}
          </InfoHint>
          <div className="reforge-cost">
            <span className={s.guild.dust < quote.dust ? 'shortage' : ''}>
              锻造尘 {s.guild.dust}/{quote.dust}
            </span>
            <span className={'rarity-' + quote.rarity}>
              {quote.materialName} {G.salvageCount(s, quote.rarity)}/
              {quote.material}
            </span>
          </div>
          <small className="gear-action-reason">
            {quote.reason ||
              '消耗对应品质材料，确定获得所选词条；保留强化与套装。'}
          </small>
        </div>
        <div className="roster-operation-actions">
          <button
            className="secondary-button"
            disabled={!!quote.reason}
            onClick={() => act((x) => G.reforgeGear(x, item.id, Number(affix)))}
          >
            重铸为「{G.AFFIXES[Number(affix)].name}」
          </button>
        </div>{' '}
      </section>
      {G.EQUIPMENT_SETS.some((set) => s.guild.depths[set.region] > 0) && (
        <section hidden={operation !== 'set'}>
          <div className="roster-operation-body">
            <strong>定向套装改制</strong>
            <Pick
              label="选择改制套装"
              value={setChoice}
              onChange={setSetChoice}
              options={G.EQUIPMENT_SETS.filter(
                (set) =>
                  s.guild.depths[set.region] > 0 || set.id === item.setId,
              ).map((set) => ({
                value: set.id,
                label: set.name + ' · ' + G.REGIONS[set.region].name,
              }))}
            />
            <InfoHint title={chosenSet.name} body={chosenSet.text}>
              {chosenSet.name} · 套装效果
            </InfoHint>
            <div className="reforge-cost">
              <span className={'rarity-' + setQuote.essences.rarity}>
                {setQuote.essences.name}{' '}
                {G.salvageCount(s, setQuote.essences.rarity)}/
                {setQuote.essences.amount}
              </span>
            </div>
            <small className="gear-action-reason">
              保留品质、阶级、词条和强化。使用当地材料及同品质分解产物，确定获得套装归属；四件即可使用独特战斗效果。
            </small>
          </div>
          <div className="roster-operation-actions">
            <RosterBuy
              s={s}
              cost={setQuote.cost}
              materials={setQuote.materials}
              reason={setQuote.reason}
              label="改制为所选套装"
              onClick={() =>
                act((x) => G.reforgeGearSet(x, item.id, setChoice))
              }
            />
          </div>{' '}
        </section>
      )}
      <section
        className="gear-dismantle-actions"
        hidden={operation !== 'salvage'}
      >
        <div className="roster-operation-body">
          <strong>分解回收</strong>
          {owner && (
            <button
              className="secondary-button"
              disabled={away}
              onClick={() =>
                act((x) =>
                  G.unequipGear(
                    x,
                    owner.id,
                    G.RECIPES.find((r) => r.id === item.recipe)!.slot,
                  ),
                )
              }
            >
              卸下并归还装备仓库
            </button>
          )}
          <SalvageYield dust={dismantle.dust} salvage={dismantle.salvage} />
          <small className="gear-action-reason">
            {dismantle.skipped[0]?.reason ||
              dismantle.reason ||
              '分解会消耗装备；收藏或已穿戴的装备不可分解。'}
          </small>
        </div>
        <div className="roster-operation-actions">
          <button
            className="secondary-button"
            disabled={!dismantle.count}
            onClick={() => {
              setAllowOverflow(false);
              setConfirm(true);
            }}
          >
            分解这件装备…
          </button>
        </div>{' '}
      </section>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent className="life-dialog salvage-confirm roster-dialog">
          <DialogTitle>确认分解这件装备</DialogTitle>
          <div className="salvage-confirm-body">
            <DialogDescription>
              分解后不能恢复装备，强化投入不返还。
            </DialogDescription>
            <strong className={'rarity-' + item.rarity}>
              {G.gearName(item)}
            </strong>
            {(item.setId || item.upgrade > 0) && (
              <p>
                这件装备{item.setId ? '属于套装' : ''}
                {item.setId && item.upgrade > 0 ? '，并且' : ''}
                {item.upgrade > 0 ? `已强化至 +${item.upgrade}` : ''}。
              </p>
            )}
            <SalvageYield dust={dismantle.dust} salvage={dismantle.salvage} />
            <label className="salvage-overflow-choice">
              <input
                type="checkbox"
                checked={allowOverflow}
                onChange={(e) => setAllowOverflow(e.target.checked)}
              />
              允许丢弃超出容量的材料
            </label>
            {(dismantle.lostDust > 0 ||
              Object.values(dismantle.lostSalvage).some((n) => n > 0)) && (
              <div className="salvage-overflow-warning">
                <strong>
                  {allowOverflow
                    ? '确认后将丢弃以下超额材料：'
                    : '材料容量不足，以下数量无法入库：'}
                </strong>
                <SalvageYield
                  dust={dismantle.lostDust}
                  salvage={dismantle.lostSalvage}
                  loss
                />
              </div>
            )}
            {dismantle.reason && <p>{dismantle.reason}</p>}
          </div>
          <div className="warehouse-confirm-actions">
            <button
              className="secondary-button"
              onClick={() => setConfirm(false)}
            >
              保留装备
            </button>
            <button
              className="primary-button"
              disabled={!!dismantle.reason || !dismantle.count}
              onClick={() => {
                act((x) =>
                  G.bulkDismantleGear(x, [item.id], {
                    includeSets: true,
                    includeEnhanced: true,
                    allowOverflow,
                  }),
                );
                setConfirm(false);
                onRemoved?.();
              }}
            >
              确认分解
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
