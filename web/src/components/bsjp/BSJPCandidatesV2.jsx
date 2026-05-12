import React, { useMemo } from 'react';
import { useScreener } from '../../hooks/useScreener';
import { useBandarBatch } from '../../hooks/useBandarBatch';
import StockIdentityCell from '../screener/StockIdentityCell';
import TradeInfoCell from '../screener/TradeInfoCell';
import PriceChangeCell from '../screener/PriceChangeCell';
import TradePlanCell from '../screener/TradePlanCell';
import VolumeStatsCell from '../screener/VolumeStatsCell';
import BandarMovementCell from '../screener/BandarMovementCell';
import AddToWatchlistButton from '../screener/AddToWatchlistButton';

/**
 * BSJPCandidatesV2 — BSJP screener table redesigned to match Swing/Scalping
 * V2. Keeps BSJP's "Score" column (unique to this screener) but otherwise
 * uses the exact same column grid so users can move between the three
 * strategies without remapping where data lives.
 */
const BSJPCandidatesV2 = () => {
  const { data, loading } = useScreener('bsjp');
  const tickers = useMemo(() => data.map((row) => row.ticker), [data]);
  const bandarMap = useBandarBatch(tickers);

  const handleExportCSV = () => {
    if (!data || data.length === 0) return;
    const headers = ['Ticker', 'Signal', 'Score', 'Date'];
    const csv = [
      headers.join(','),
      ...data.map((row) => `${row.ticker},${row.signal || ''},${row.score || 0},${row.screened_at || ''}`),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'bsjp_candidates_v2.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-surface-container-low rounded-xl overflow-hidden shadow-xl">
      <div className="px-6 py-4 flex justify-between items-center bg-surface-container/50">
        <h3 className="font-bold text-on-surface">BSJP Candidates</h3>
        <div className="flex items-center gap-2">
          <div className="text-xs px-3 py-1 bg-surface-container-highest text-primary rounded-lg font-bold flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Live
          </div>
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-tertiary-container/30 text-tertiary rounded">V2</span>
          <button onClick={handleExportCSV} className="text-xs px-3 py-1 text-on-surface-variant hover:text-white transition-colors font-medium">
            Export CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-separate border-spacing-0">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-outline border-b border-outline-variant/10">
              <th className="px-3 py-4 font-bold w-10">No</th>
              <th className="px-4 py-4 font-bold">Stock</th>
              <th className="px-4 py-4 font-bold">Trade Info</th>
              <th className="px-4 py-4 font-bold text-right">Last Price</th>
              <th className="px-4 py-4 font-bold">Trade Plan</th>
              <th className="px-4 py-4 font-bold">Volume</th>
              <th className="px-4 py-4 font-bold text-right">Score</th>
              <th className="px-4 py-4 font-bold">Bandar</th>
              <th className="px-4 py-4 font-bold text-center">Action</th>
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
                <td colSpan="9" className="px-6 py-8 text-center text-sm text-on-surface-variant">No candidates found currently.</td>
              </tr>
            </tbody>
          ) : (
            <tbody className="divide-y divide-outline-variant/5">
              {data.map((item, index) => {
                const p = item.payload || {};
                const entry = p.entry_price || p.price || 0;
                const live = p.price || entry;
                const score = Number(item.score) || 0;
                const isHigh = score >= 80;
                const scoreCls = isHigh
                  ? 'bg-secondary-container text-on-secondary-container'
                  : 'bg-tertiary-container text-on-tertiary-container';
                const rowCls = index === 0 ? 'bg-surface-container-high border-l-2 border-primary' : '';
                const flow = bandarMap[item.ticker];

                return (
                  <tr key={item.ticker} className={`group hover:bg-surface-container-high transition-colors cursor-pointer ${rowCls}`}>
                    <td className="px-3 py-4 text-on-surface-variant tabular-nums">{index + 1}</td>
                    <td className="px-4 py-4">
                      <StockIdentityCell
                        ticker={item.ticker}
                        name={p.name}
                        marketCap={p.market_cap}
                        exchange={p.exchange}
                        highlight={isHigh}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <TradeInfoCell
                        ticker={item.ticker}
                        screenedAt={item.screened_at}
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
                    <td className="px-4 py-4 text-right">
                      <span className={`px-2 py-1 rounded font-black text-xs ${scoreCls}`}>{score}</span>
                    </td>
                    <td className="px-4 py-4">
                      <BandarMovementCell flow={flow} price={live} />
                    </td>
                    <td className="px-4 py-4 text-center">
                      <AddToWatchlistButton ticker={item.ticker} variant="icon" />
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

export default BSJPCandidatesV2;
