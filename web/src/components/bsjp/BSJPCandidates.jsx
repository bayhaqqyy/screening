import React, { useState } from 'react';
import { useScreener } from '../../hooks/useScreener';
import { watchlistService } from '../../services/watchlistService';

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
              <th className="px-6 py-4 font-bold">Ticker</th>
              <th className="px-6 py-4 font-bold text-right">Last Price</th>
              <th className="px-6 py-4 font-bold text-right">Dip%</th>
              <th className="px-6 py-4 font-bold">Late Accum</th>
              <th className="px-6 py-4 font-bold">Top Broker</th>
              <th className="px-6 py-4 font-bold text-right">Score</th>
              <th className="px-6 py-4 font-bold text-center">Action</th>
            </tr>
          </thead>
          {loading ? (
             <tbody className="divide-y divide-outline-variant/5">
                <tr><td colSpan="7" className="px-6 py-8 text-center text-sm text-on-surface-variant">Scanning market...</td></tr>
             </tbody>
          ) : data.length === 0 ? (
             <tbody className="divide-y divide-outline-variant/5">
                <tr><td colSpan="7" className="px-6 py-8 text-center text-sm text-on-surface-variant">No candidates found currently.</td></tr>
             </tbody>
          ) : (
          <tbody className="divide-y divide-outline-variant/5">
            {data.map((item, index) => {
              const payload = item.payload || {};
              const price = payload.price || 0;
              const dip = payload.dip_pct || 0;
              const accumPct = payload.accum_pct || 0;
              const brokers = payload.top_brokers ? payload.top_brokers.join(', ') : 'N/A';
              
              const isHigh = item.score > 80;
              const scoreColor = isHigh ? 'bg-secondary-container text-on-secondary-container' : 'bg-tertiary-container text-on-tertiary-container';
              const dotColor = isHigh ? 'bg-secondary shadow-[0_0_8px_rgba(74,225,118,0.4)]' : 'bg-tertiary shadow-[0_0_8px_rgba(255,185,95,0.4)]';
              const accumColor = isHigh ? 'bg-secondary' : 'bg-tertiary';
              const rowClass = index === 0 ? 'bg-surface-container-high border-l-2 border-primary' : '';

              return (
                <tr key={item.ticker} className={`group hover:bg-surface-container-high transition-colors cursor-pointer ${rowClass}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${dotColor}`}></div>
                      <span className="font-bold text-on-surface tracking-tight tabular-nums">{item.ticker}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right tabular-nums font-semibold">{price.toLocaleString()}</td>
                  <td className={`px-6 py-4 text-right tabular-nums font-medium ${dip < 0 ? 'text-secondary' : 'text-on-surface-variant'}`}>
                    {dip}%
                  </td>
                  <td className="px-6 py-4">
                    <div className="w-24 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                      <div className={`h-full ${accumColor}`} style={{ width: `${Math.min(100, Math.max(0, accumPct))}%` }}></div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs bg-outline-variant/20 px-2 py-0.5 rounded tabular-nums">{brokers}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`px-3 py-1 rounded font-black text-xs ${scoreColor}`}>
                      {item.score || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
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
