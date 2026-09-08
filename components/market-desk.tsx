'use client';

import { useState } from 'react';
import * as G from '@/lib/realm';
import { ResourceName } from './info-hint';
import type { Act } from './realm-panels';

const count = (value: number) => Math.floor(value).toLocaleString('zh-CN');

export function MarketDesk({ s, act }: { s: G.State; act: Act }) {
  const [batch, setBatch] = useState<G.TradeBatch>(1);
  const goods = (Object.keys(G.RESOURCE_NAMES) as G.Resource[]).filter((k) =>
    G.tradeUnlocked(s, k),
  );
  return (
    <div className="life-card market-desk">
      <div className="life-title">
        <h2>边境集市</h2>
        <span>
          金币 {count(s.resources.gold)} / {count(G.capacity(s, 'gold'))}
        </span>
      </div>
      <div className="market-batches" role="group" aria-label="交易份数">
        <span>交易份数</span>
        {[...G.TRADE_BATCH_CHOICES, 'max' as const].map((choice) => (
          <button
            key={choice}
            className="secondary-button"
            aria-pressed={batch === choice}
            onClick={() => setBatch(choice)}
          >
            {choice === 'max' ? '最大' : `×${count(choice)}`}
          </button>
        ))}
      </div>
      <p className="life-hint market-quantity-hint">
        1份 = {G.TRADE_BATCH_SIZE}
        单位。按金币、库存和仓位自动限制数量，按钮显示本次成交总量。
      </p>
      <div className="life-card-body life-market">
        {goods.map((k) => {
          const buy = G.tradeQuote(s, k, true, batch),
            sell = G.tradeQuote(s, k, false, batch);
          return (
            <div key={k} className="market-goods-row">
              <strong>
                <ResourceName s={s} id={k} />
                <small>
                  持有 {count(s.resources[k])} / {count(G.capacity(s, k))}
                </small>
                <small>
                  每份买价 {G.tradePrice(s, k)} 金 · 卖价{' '}
                  {G.tradePrice(s, k, false)} 金
                </small>
              </strong>
              <button
                className="secondary-button"
                disabled={!!buy.reason}
                onClick={() => act((x) => G.trade(x, k, true, batch))}
              >
                <span>{buy.reason || `买入 ${count(buy.amount)} 单位`}</span>
                <small>
                  {buy.reason
                    ? '买入暂不可用'
                    : `支付 ${count(buy.gold)} 金币${buy.limited ? ' · 已达上限' : ''}`}
                </small>
              </button>
              <button
                className="secondary-button"
                disabled={!!sell.reason}
                onClick={() => act((x) => G.trade(x, k, false, batch))}
              >
                <span>{sell.reason || `卖出 ${count(sell.amount)} 单位`}</span>
                <small>
                  {sell.reason
                    ? '卖出暂不可用'
                    : `获得 ${count(sell.gold)} 金币${sell.limited ? ' · 已达上限' : ''}`}
                </small>
              </button>
            </div>
          );
        })}
      </div>
      <p className="life-hint">
        常用物资随城镇发展上架；地区材料由远征获得，精制材料由工坊加工。
      </p>
    </div>
  );
}
