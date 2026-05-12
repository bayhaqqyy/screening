import React, { useState } from 'react';
import { useScreener } from '../../hooks/useScreener';
import { watchlistService } from '../../services/watchlistService';
import TickerLink from '../ui/TickerLink';

const BSJPCandidates = () => {
  const { data, loading } = useScreener('bsjp');
  const [addingTicker, setAddingTicker] = useState(null);

  const handleExportCSV = () => {
    if (!data || data.length === 0) return;
    const headers = ['Ticker', 'Signal', 'Score', 'Date'];
    const csvContent = [
      headers.join(','),
      ...data.map(row => `${row.ticker},${row.signal || ''},${row.score || 0},${row.screened_at || ''}`)
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'bsjp_candidates.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddToWatchlist = async (e, ticker) => {
    e.stopPropagation();
    setAddingTicker(ticker);
    try {
      await watchlistService.addTicker(ticker);
      // Optional: Add a toast notification here if you have a toast context
    } catch (err) {
      console.error("Failed to add to watchlist:", err);
    } finally {
      setAddingTicker(null);
    }
  };

  return (
    <div className="bg-surface-container-low rounded-xl overflow-hidden shadow-xl">
      <div className="px-6 py-4 flex justify-between items-center bg-surface-container/50">
        <h3 className="font-bold text-on-surface">BSJP Candidates</h3>
        <div className="flex gap-2">
          <div className="text-xs px-3 py-1 bg-surface-container-highest text-primary rounded-lg font-bold flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
            Live
          </div>
          <button onClick={handleExportCSV} className="text-xs px-3 py-1 text-on-surface-variant hover:text-white transition-colors font-medium">Export CSV</button>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-separate border-spacing-0">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-outline border-b border-outline-variant/10">
              <th className="px-4 py-4 font-bold">Ticker</th>
              <th className="px-4 py-4 font-bold text-right">Entry</th>
              <th className="px-4 py-4 font-bold text-right">Live Price</th>
              <th className="px-4 py-4 font-bold text-right">P&L %</th>
              <th className="px-4 py-4 font-bold text-right">Target (TP)</th>
              <th className="px-4 py-4 font-bold text-right">Stop (SL)</th>
              <th className="px-4 py-4 font-bold text-right">Score</th>
              <th className="px-4 py-4 font-bold text-center">Status</th>
              <th className="px-4 py-4 font-bold text-center">Action</th>
            </tr>
          </thead>
          {loading ? (
             <tbody className="divide-y divide-outline-variant/5">
                <tr><td colSpan="9" className="px-6 py-8 text-center text-sm text-on-surface-variant">Scanning market...</td></tr>
             </tbody>
          ) : data.length === 0 ? (
             <tbody className="divide-y divide-outline-variant/5">
                <tr><td colSpan="9" className="px-6 py-8 text-center text-sm text-on-surface-variant">No candidates found currently.</td></tr>
             </tbody>
          ) : (
          <tbody className="divide-y divide-outline-variant/5">
            {data.map((item, index) => {
              const payload = item.payload || {};
              const entryPrice = payload.entry_price || payload.price || 0;
              const currentPrice = payload.price || entryPrice;
              const tp = payload.target || entryPrice * 1.05;
              const sl = payload.stop_loss || entryPrice * 0.95;
              
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

              const isHigh = item.score >= 80;
              const scoreColor = isHigh ? 'bg-secondary-container text-on-secondary-container' : 'bg-tertiary-container text-on-tertiary-container';
              const dotColor = isHigh ? 'bg-secondary shadow-[0_0_8px_rgba(74,225,118,0.4)]' : 'bg-tertiary shadow-[0_0_8px_rgba(255,185,95,0.4)]';
              const rowClass = index === 0 ? 'bg-surface-container-high border-l-2 border-primary' : '';

              return (
                <tr key={item.ticker} className={`group hover:bg-surface-container-high transition-colors cursor-pointer ${rowClass}`}>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${dotColor}`}></div>
                      <TickerLink ticker={item.ticker} exchange={payload.exchange} className="tracking-tight" />
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right tabular-nums text-on-surface-variant font-medium">{Math.round(entryPrice).toLocaleString()}</td>
                  <td className="px-4 py-4 text-right tabular-nums font-bold text-blue-100">{Math.round(currentPrice).toLocaleString()}</td>
                  <td className={`px-4 py-4 text-right tabular-nums font-bold ${pnlColor}`}>
                    {pnlPct > 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                  </td>
                  <td className="px-4 py-4 text-right tabular-nums text-secondary/80 font-medium">{Math.round(tp).toLocaleString()}</td>
                  <td className="px-4 py-4 text-right tabular-nums text-error/80 font-medium">{Math.round(sl).toLocaleString()}</td>
                  <td className="px-4 py-4 text-right">
                    <span className={`px-2 py-1 rounded font-black text-xs ${scoreColor}`}>
                      {item.score || 0}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`px-2 py-1 rounded font-black text-[10px] uppercase tracking-wider ${statusColor}`}>
                      {tradeStatus}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <button 
                      onClick={(e) => handleAddToWatchlist(e, item.ticker)}
                      disabled={addingTicker === item.ticker}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded bg-surface-container-highest hover:bg-primary/20 hover:text-primary transition-all text-on-surface-variant disabled:opacity-50"
                      title="Add to Watchlist"
                    >
                      {addingTicker === item.ticker ? (
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
    </div>
  );
};

export default BSJPCandidates;
