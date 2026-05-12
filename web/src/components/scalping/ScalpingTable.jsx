import React, { useState } from 'react';
import { watchlistService } from '../../services/watchlistService';
import TickerLink from '../ui/TickerLink';

const ScalpingTable = ({ data = [], loading = false }) => {
  const [addingTicker, setAddingTicker] = useState(null);

  const handleAddToWatchlist = async (e, ticker) => {
    e.stopPropagation();
    setAddingTicker(ticker);
    try {
      await watchlistService.addTicker(ticker);
    } catch (err) {
      console.error("Failed to add to watchlist:", err);
    } finally {
      setAddingTicker(null);
    }
  };

  return (
    <div className="glass-panel rounded-xl overflow-hidden mt-6">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-surface-container-high/50 text-[10px] font-bold uppercase tracking-widest text-outline">
            <th className="px-6 py-4">Ticker</th>
            <th className="px-4 py-4 text-right">Entry</th>
            <th className="px-4 py-4 text-right">Live Price</th>
            <th className="px-4 py-4 text-right">P&L %</th>
            <th className="px-4 py-4 text-right">Target (TP)</th>
            <th className="px-4 py-4 text-right">Stop (SL)</th>
            <th className="px-4 py-4 text-right">RSI</th>
            <th className="px-4 py-4">Spike Status</th>
            <th className="px-6 py-4 text-right">Signal</th>
            <th className="px-4 py-4 text-center">Status</th>
            <th className="px-4 py-4 text-center">Action</th>
          </tr>
        </thead>
        {loading ? (
           <tbody className="text-sm tabular-nums">
              <tr><td colSpan="11" className="px-6 py-8 text-center text-sm text-on-surface-variant">Scanning market...</td></tr>
           </tbody>
        ) : data.length === 0 ? (
           <tbody className="text-sm tabular-nums">
              <tr><td colSpan="11" className="px-6 py-8 text-center text-sm text-on-surface-variant">No scalping candidates found.</td></tr>
           </tbody>
        ) : (
        <tbody className="text-sm tabular-nums">
          {data.map((row) => {
            const payload = row.payload || {};
            const entryPrice = payload.entry_price || payload.price || 0;
            const currentPrice = payload.price || entryPrice;
            const tp = payload.target || entryPrice * 1.02;
            const sl = payload.stop_loss || entryPrice * 0.985;
            
            const pnlPct = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;
            const pnlColor = pnlPct > 0 ? 'text-secondary' : pnlPct < 0 ? 'text-error' : 'text-on-surface-variant';

            let tradeStatus = 'WAIT';
            let statusColor = 'text-on-surface-variant bg-surface-container-highest';
            if (currentPrice >= tp || currentPrice <= sl) {
                tradeStatus = 'OUT';
                statusColor = currentPrice >= tp ? 'text-secondary bg-secondary-container' : 'text-error bg-error-container';
            } else if (currentPrice <= entryPrice * 1.015 && currentPrice >= entryPrice * 0.985) {
                tradeStatus = 'ENTRY';
                statusColor = 'text-primary bg-primary-container';
            }

            const rsi = payload.rsi || 0;
            const vol = payload.volume || 0;
            
            const isGain = row.score > 50;
            const initial = row.ticker.charAt(0);
            const bgCls = isGain ? 'bg-primary-container/20' : 'bg-error-container/20';
            const txtCls = isGain ? 'text-primary' : 'text-error';
            
            const spikeLvl = vol > 10000000 ? 3 : vol > 1000000 ? 2 : 0;
            const spikeText = spikeLvl === 3 ? 'VOL SHOCK' : spikeLvl === 2 ? 'HIGH VOL' : 'NORMAL';

            return (
              <tr key={row.ticker} className="group hover:bg-surface-container-high transition-colors cursor-pointer border-b border-outline-variant/10">
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${bgCls} ${txtCls}`}>
                      {initial}
                    </div>
                    <div>
                      <TickerLink ticker={row.ticker} exchange={payload.exchange} className="font-bold" />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-5 text-right font-medium text-on-surface-variant">
                  {Math.round(entryPrice).toLocaleString()}
                </td>
                <td className="px-4 py-5 text-right font-bold text-blue-100">
                  {Math.round(currentPrice).toLocaleString()}
                </td>
                <td className={`px-4 py-5 text-right font-bold ${pnlColor}`}>
                  {pnlPct > 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                </td>
                <td className="px-4 py-5 text-right font-medium text-secondary/80">
                  {Math.round(tp).toLocaleString()}
                </td>
                <td className="px-4 py-5 text-right font-medium text-error/80">
                  {Math.round(sl).toLocaleString()}
                </td>
                <td className="px-4 py-5 text-right">
                  <span className={`${rsi > 70 ? 'bg-error-container/20 text-error' : rsi < 30 ? 'bg-secondary-container/20 text-secondary' : 'bg-surface-container/20 text-on-surface'} px-2 py-0.5 rounded text-xs font-bold`}>
                    {rsi.toFixed(2)}
                  </span>
                </td>
                <td className="px-4 py-5">
                  <div className={`flex items-center gap-1 ${spikeLvl > 0 ? 'text-tertiary' : 'text-outline'}`}>
                    {spikeLvl === 0 && (
                       <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>local_fire_department</span>
                    )}
                    {spikeLvl > 0 && Array.from({ length: 3 }).map((_, i) => (
                        <span key={i} className={`material-symbols-outlined text-sm ${spikeLvl === 3 ? 'animate-pulse' : ''}`} style={{ fontVariationSettings: `'FILL' ${i < spikeLvl ? 1 : 0}` }}>
                          local_fire_department
                        </span>
                    ))}
                    <span className={`text-[10px] font-bold ml-1 ${spikeLvl === 3 ? 'animate-pulse' : ''}`}>{spikeText}</span>
                  </div>
                </td>
                <td className="px-6 py-5 text-right font-bold text-xs">
                  <span className={`${isGain ? 'text-secondary' : 'text-error'}`}>{row.signal || 'Neutral'}</span>
                </td>
                <td className="px-4 py-5 text-center">
                  <span className={`px-2 py-1 rounded font-black text-[10px] uppercase tracking-wider ${statusColor}`}>
                    {tradeStatus}
                  </span>
                </td>
                <td className="px-4 py-5 text-center">
                  <button 
                    onClick={(e) => handleAddToWatchlist(e, row.ticker)}
                    disabled={addingTicker === row.ticker}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded bg-surface-container-highest hover:bg-primary/20 hover:text-primary transition-all text-on-surface-variant disabled:opacity-50"
                    title="Add to Watchlist"
                  >
                    {addingTicker === row.ticker ? (
                      <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-sm">star_add</span>
                    )}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
        )}
      </table>
    </div>
  );
};

export default ScalpingTable;
