import React, { useState } from 'react';
import { watchlistService } from '../../services/watchlistService';

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
            <th className="px-4 py-4">Last Price</th>
            <th className="px-4 py-4 text-right">RSI</th>
            <th className="px-4 py-4 text-right">Vol</th>
            <th className="px-4 py-4 text-right">MACD</th>
            <th className="px-4 py-4">Spike Status</th>
            <th className="px-6 py-4 text-right">Signal</th>
            <th className="px-4 py-4 text-center">Action</th>
          </tr>
        </thead>
        {loading ? (
           <tbody className="text-sm tabular-nums">
              <tr><td colSpan="8" className="px-6 py-8 text-center text-sm text-on-surface-variant">Scanning market...</td></tr>
           </tbody>
        ) : data.length === 0 ? (
           <tbody className="text-sm tabular-nums">
              <tr><td colSpan="8" className="px-6 py-8 text-center text-sm text-on-surface-variant">No scalping candidates found.</td></tr>
           </tbody>
        ) : (
        <tbody className="text-sm tabular-nums">
          {data.map((row) => {
            const payload = row.payload || {};
            const price = payload.price || 0;
            const rsi = payload.rsi || 0;
            const vol = payload.volume || 0;
            const macd = payload.macd || 0;
            
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
                      <div className="font-bold text-on-surface">{row.ticker}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-5 font-semibold">
                  {price.toLocaleString()}
                </td>
                <td className="px-4 py-5 text-right">
                  <span className={`${rsi > 70 ? 'bg-error-container/20 text-error' : rsi < 30 ? 'bg-secondary-container/20 text-secondary' : 'bg-surface-container/20 text-on-surface'} px-2 py-0.5 rounded text-xs font-bold`}>
                    {rsi.toFixed(2)}
                  </span>
                </td>
                <td className="px-4 py-5 text-right text-on-surface-variant">{(vol / 1000000).toFixed(1)}M</td>
                <td className="px-4 py-5 text-right text-on-surface-variant">{macd.toFixed(3)}</td>
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
