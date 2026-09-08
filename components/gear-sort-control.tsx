'use client';
import type { GearSort, GearSortOrder } from '@/lib/equipment-management';
import { Pick } from './realm-panels';
import '@/app/gear-presentation.css';

export type GearSortSelection = { sort: GearSort; order: GearSortOrder };
export const DEFAULT_GEAR_SORT: GearSortSelection = { sort: 'rarity', order: 'desc' };

/** The same visible sort and direction controls are used in every equipment list. */
export function GearSortControl({ sort = 'rarity', order = sort === 'name' ? 'asc' : 'desc', onChange, label = '装备' }: {
  sort?: GearSort;
  order?: GearSortOrder;
  onChange: (selection: GearSortSelection) => void;
  label?: string;
}) {
  const direction = sort === 'recent'
    ? [{ value: 'desc', label: '新 → 旧' }, { value: 'asc', label: '旧 → 新' }]
    : sort === 'name'
      ? [{ value: 'asc', label: '名称正序' }, { value: 'desc', label: '名称逆序' }]
      : [{ value: 'desc', label: '高 → 低' }, { value: 'asc', label: '低 → 高' }];
  return <div className="gear-sort-control" role="group" aria-label={label + '排序设置'}>
    <Pick label={label + '排序依据'} value={sort} onChange={(value) => {
      const next = value as GearSort;
      onChange({ sort: next, order: next === 'name' ? 'asc' : 'desc' });
    }} options={[
      { value: 'rarity', label: '按稀有度' },
      { value: 'recent', label: '按获取时间' },
      { value: 'tier', label: '按装备阶级' },
      { value: 'name', label: '按装备名称' },
    ]} />
    <Pick label={label + '排序方向'} value={order}
      onChange={(value) => onChange({ sort, order: value as GearSortOrder })} options={direction} />
  </div>;
}
