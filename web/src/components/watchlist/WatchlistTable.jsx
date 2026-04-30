import React, { useState, useEffect } from 'react';
import { watchlistService } from '../../services/watchlistService';
import { searchService } from '../../services/searchService'; // to get details of watchlist tickers

const WatchlistTable = () => {
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWatchlist = async () => {
      try {
        setLoading(true);
        const data = await watchlistService.getWatchlist();
        if (data && data.length > 0) {
          // data is likely an array of { id, ticker, created_at }
          // We need to fetch details for each ticker
          const detailedList = await Promise.all(data.map(async (item) => {
            try {
              const detail = await searchService.getStockDetail(item.ticker);
              return { ...item, detail };
            } catch (err) {
              return { ...item, detail: null };
            }
          }));
          setWatchlist(detailedList);
        } else {
          setWatchlist([]);
        }
      } catch (error) {
        console.error("Failed to fetch watchlist:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchWatchlist();
  }, []);

  const handleRemove = async (ticker) => {
    try {
      await watchlistService.removeTicker(ticker);
      setWatchlist(prev => prev.filter(item => item.ticker !== ticker));
    } catch (err) {
      console.error("Failed to remove ticker:", err);
    }
  };

  return (
    <div className="col-span-12 lg:col-span-8 bg-surface-container-low rounded-2xl overflow-hidden shadow-sm">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-surface-container-high/30">
            <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Ticker</th>
            <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">Last</th>
            <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">Chg%</th>
            <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">Vol</th>
            <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Added At</th>
            <th className="px-6 py-4"></th>
          </tr>
        </thead>
        {loading ? (
           <tbody className="divide-y divide-outline-variant/10">
              <tr><td colSpan="6" className="px-6 py-8 text-center text-sm text-on-surface-variant">Loading watchlist...</td></tr>
           </tbody>
        ) : watchlist.length === 0 ? (
           <tbody className="divide-y divide-outline-variant/10">
              <tr><td colSpan="6" className="px-6 py-8 text-center text-sm text-on-surface-variant">Your watchlist is empty. Search for a stock to add it.</td></tr>
           </tbody>
        ) : (
        <tbody className="divide-y divide-outline-variant/10">
          {watchlist.map((row) => {
             const detail = row.detail || {};
             const price = detail.last_price || 0;
             const chg = detail.change_pct || 0;
             const isGain = chg >= 0;
             const chgColor = isGain ? 'text-secondary' : 'text-error';
             const vol = detail.volume ? `${(detail.volume / 1000000).toFixed(1)}M` : 'N/A';
             const addedAt = new Date(row.created_at).toLocaleDateString();

             return (
              <tr key={row.ticker} className="hover:bg-surface-container-high/40 transition-colors group">
                <td className="px-6 py-5">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded bg-surface-container-highest flex items-center justify-center text-[10px] font-bold ${isGain ? 'text-secondary' : 'text-error'}`}>{row.ticker.charAt(0)}</div>
                    <div>
                      <p className="font-bold text-blue-100 tabular-nums">{row.ticker}</p>
                      <p className="text-[10px] text-on-surface-variant w-32 truncate">{detail.name || 'Unknown'}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5 text-right font-medium tabular-nums text-on-surface">{price.toLocaleString()}</td>
                <td className={`px-6 py-5 text-right font-medium tabular-nums ${chgColor}`}>{isGain ? '+' : ''}{chg}%</td>
                <td className="px-6 py-5 text-right tabular-nums text-on-surface-variant text-sm">{vol}</td>
                <td className="px-6 py-5">
                  <span className="text-[10px] opacity-70 tabular-nums">{addedAt}</span>
                </td>
                <td className="px-6 py-5 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleRemove(row.ticker)} className="material-symbols-outlined text-error hover:text-error/80" title="Remove from Watchlist">delete</button>
                </td>
              </tr>
             );
          })}
        </tbody>
        )}
      </table>
    </div>
  );
};

export default WatchlistTable;
