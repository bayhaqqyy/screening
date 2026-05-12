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
 * ScalpingTableV2 — mirrors the Swing V2 layout but prioritises the real-time
 * velocity cues scalpers lean on (RSI, spike level). The structural columns
 * are identical so users can flip between strategies without relearning
 * where each piece of data lives.
 */
const ScalpingTableV2 = ({ data = [], loading = false }) => {
  const tickers = useMemo(() => data.map((row) => row.ticker), [data]);
  const bandarMap = useBandarBatch(tickers);

  return (
    <div className="glass-panel rounded-xl overflow-hidden mt-6">
      <div className="px-6 py-4 flex justify-between items-center bg-surface-container-highest/30">
        <h3 className="font-bold text-lg">Scalping Candidates</h3>
        <div className="flex items-center gap-3 text-xs font-medium text-on-surface-variant">
          <span>{loading ? 'Scanning market...' : `${data.length} Results`}</span>
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-tertiary-container/30 text-tertiary rounded">V2</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-high/50 text-[10px] font-bold uppercase tracking-widest text-outline">
              <th className="px-3 py-4 w-10">No</th>
              <th className="px-4 py-4">Stock</th>
              <th className="px-4 py-4">Trade Info</th>
              <th className="px-4 py-4 text-right">Live</th>
              <th className="px-4 py-4">Plan</th>
              <th className="px-4 py-4">Volume</th>
              <th className="px-4 py-4">RSI / Spike</th>
              <th className="px-4 py-4">Bandar</th>
              <th className="px-4 py-4 text-center">Action</th>
            </tr>
          </thead>
          {loading ? (
            <tbody>
              <tr>
                <td colSpan="9" className="px-6 py-8 text-center text-sm text-on-surface-variant">Scanning market...</td>
              </tr>
            </tbody>
          ) : data.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan="9" className="px-6 py-8 text-center text-sm text-on-surface-variant">No scalping candidates found.</td>
              </tr>
            </tbody>
          ) : (
            <tbody className="divide-y divide-outline-variant/10">
              {data.map((row, idx) => {
                const p = row.payload || {};
                const entry = p.entry_price || p.price || 0;
                const live = p.price || entry;
                const rsi = Number(p.rsi) || 0;
                const vol = Number(p.volume) || 0;
                const flow = bandarMap[row.ticker];

                // Scalping cares about intraday volume shocks — classify them
                // into three buckets to drive the icon count in the UI.
                const spikeLvl = vol > 10_000_000 ? 3 : vol > 1_000_000 ? 2 : 0;
                const spikeText = spikeLvl === 3 ? 'VOL SHOCK' : spikeLvl === 2 ? 'HIGH VOL' : 'NORMAL';
                const rsiCls = rsi > 70
                  ? 'bg-error-container/20 text-error'
                  : rsi < 30
                  ? 'bg-secondary-container/20 text-secondary'
                  : 'bg-surface-container/20 text-on-surface';

                return (
                  <tr key={row.ticker} className="group hover:bg-surface-container-high transition-colors cursor-pointer">
                    <td className="px-3 py-4 text-on-surface-variant tabular-nums">{idx + 1}</td>
                    <td className="px-4 py-4">
                      <StockIdentityCell
                        ticker={row.ticker}
                        name={p.name}
                        marketCap={p.market_cap}
                        exchange={p.exchange}
                        highlight={row.score > 70}
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
                        changePct={p.change_pct}
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
                    <td className="px-4 py-4 min-w-[120px]">
                      <div className="flex flex-col gap-1">
                        <span className={`${rsiCls} px-2 py-0.5 rounded text-[10px] font-bold w-fit`}>
                          RSI {rsi.toFixed(1)}
                        </span>
                        <div className={`flex items-center gap-1 text-[10px] font-bold ${spikeLvl > 0 ? 'text-tertiary' : 'text-outline'}`}>
                          {spikeLvl === 0 && (
                            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>local_fire_department</span>
                          )}
                          {spikeLvl > 0 && Array.from({ length: 3 }).map((_, i) => (
                            <span
                              key={i}
                              className={`material-symbols-outlined text-sm ${spikeLvl === 3 ? 'animate-pulse' : ''}`}
                              style={{ fontVariationSettings: `'FILL' ${i < spikeLvl ? 1 : 0}` }}
                            >
                              local_fire_department
                            </span>
                          ))}
                          <span className="ml-1">{spikeText}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <BandarMovementCell flow={flow} price={live} />
                    </td>
                    <td className="px-4 py-4 text-center">
                      <AddToWatchlistButton ticker={row.ticker} variant="icon" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
};

export default ScalpingTableV2;
