import React, { useMemo } from 'react';
import StockIdentityCell from '../screener/StockIdentityCell';
import TradeInfoCell from '../screener/TradeInfoCell';
import PriceChangeCell from '../screener/PriceChangeCell';
import TradePlanCell from '../screener/TradePlanCell';
import VolumeStatsCell from '../screener/VolumeStatsCell';
import BandarMovementCell from '../screener/BandarMovementCell';
import AddToWatchlistButton from '../screener/AddToWatchlistButton';
import { useBandarBatch } from '../../hooks/useBandarBatch';

/**
 * SwingTableV2 — redesigned Swing screener table matching the Sprint 5
 * mockup. Columns:
 *   No | Stock | Trade Info | Last Price | Trade Plan | Volume | Bandar | Action
 *
 * Composed of the six reusable cell components in components/screener/ so
 * the Scalping + BSJP tables can share the layout without copy-paste.
 */
const SwingTableV2 = ({ data = [], loading = false }) => {
  const tickers = useMemo(() => data.map((row) => row.ticker), [data]);
  const bandarMap = useBandarBatch(tickers);

  return (
    <div className="xl:col-span-3">
      <div className="bg-surface-container-high rounded-xl overflow-hidden">
        <div className="px-6 py-4 flex justify-between items-center bg-surface-container-highest/30">
          <h3 className="font-bold text-lg">Swing Candidates</h3>
          <div className="flex items-center gap-3 text-xs font-medium text-on-surface-variant">
            <span>{loading ? 'Scanning...' : `${data.length} Results`}</span>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-tertiary-container/30 text-tertiary rounded">V2</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-on-surface-variant font-black border-b border-outline-variant/10">
                <th className="px-3 py-3 w-10">No</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Trade Info</th>
                <th className="px-4 py-3 text-right">Last Price</th>
                <th className="px-4 py-3">Trade Plan</th>
                <th className="px-4 py-3">Volume</th>
                <th className="px-4 py-3">Bandar</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            {loading ? (
              <tbody>
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-sm text-on-surface-variant">
                    Loading swing candidates...
                  </td>
                </tr>
              </tbody>
            ) : data.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-sm text-on-surface-variant">
                    No candidates matching the criteria.
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody className="divide-y divide-outline-variant/10">
                {data.map((row, idx) => {
                  const p = row.payload || {};
                  const entry = p.entry_price || p.price || 0;
                  const live = p.price || entry;
                  const pnlPct = entry > 0 ? ((live - entry) / entry) * 100 : 0;
                  const flow = bandarMap[row.ticker];
                  return (
                    <tr key={row.ticker} className="hover:bg-surface-container-low transition-colors group">
                      <td className="px-3 py-4 text-on-surface-variant tabular-nums">{idx + 1}</td>
                      <td className="px-4 py-4">
                        <StockIdentityCell
                          ticker={row.ticker}
                          name={p.name}
                          marketCap={p.market_cap}
                          exchange={p.exchange}
                          highlight={idx === 0}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <TradeInfoCell
                          ticker={row.ticker}
                          screenedAt={row.screened_at}
                          entryPrice={entry}
                          tags={p.tags}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <PriceChangeCell
                          lastPrice={live}
                          changePct={p.change_pct ?? pnlPct}
                          entryPrice={entry}
                          target={p.target}
                          stopLoss={p.stop_loss}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <TradePlanCell
                          entryPrice={entry}
                          entryLow={p.entry_low}
                          entryHigh={p.entry_high}
                          target={p.target}
                          targetLow={p.target_low}
                          targetHigh={p.target_high}
                          stopLoss={p.stop_loss}
                          support={p.support}
                          resistance={p.resistance}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <VolumeStatsCell
                          volume={p.volume}
                          value={p.value}
                          frequency={p.frequency}
                          trend={p.trend_3w}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <BandarMovementCell flow={flow} price={live} />
                      </td>
                      <td className="px-4 py-4 text-right">
                        <AddToWatchlistButton ticker={row.ticker} variant="pill" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default SwingTableV2;
