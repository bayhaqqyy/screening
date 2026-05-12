import React, { useState, useEffect, useCallback } from 'react';
import { watchlistService } from '../../services/watchlistService';
import TickerLink from '../ui/TickerLink';

/**
 * WatchlistTable V2 — trade journal view.
 *
 * Columns (aligned with the Sprint 4 mockup):
 *   No | Stock | Date | Price | Trading Setup | H+1..H+7 | Harga Jual | Gain %
 *
 * The server returns the full journal shape including a `daily_prices`
 * array (day_offset 1..7) populated by workers.SnapshotWatchlistDaily. Each
 * H+N cell compares to entry_price so gains/losses are obvious at a glance.
 *
 * Live prices from `ws_idx.ohlcv.enriched` keep the top-line Price column
 * moving during market hours; the H+N cells are append-only day snapshots
 * and are never overwritten by ticks.
 */
const WatchlistTable = () => {
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingSell, setEditingSell] = useState(null);
  const [sellInput, setSellInput] = useState('');

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await watchlistService.getWatchlist();
      setWatchlist(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch watchlist:', err);
      setWatchlist([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    const handleOhlcvUpdate = (event) => {
      const msg = event.detail;
      const tick = msg?.data;
      if (!tick?.ticker) return;

      // Mutate only last_price/change_pct/volume for the matching row; H+N
      // snapshots are written by the daily worker, not live ticks.
      setWatchlist((prev) =>
        prev.map((item) =>
          item.ticker === tick.ticker
            ? {
                ...item,
                last_price: tick.last_price ?? item.last_price,
                change_pct: tick.change_pct ?? item.change_pct,
                volume: tick.volume ?? item.volume,
              }
            : item,
        ),
      );
    };

    window.addEventListener('ws_idx.ohlcv.enriched', handleOhlcvUpdate);
    return () => {
      window.removeEventListener('ws_idx.ohlcv.enriched', handleOhlcvUpdate);
    };
  }, [refresh]);

  const handleRemove = async (ticker) => {
    try {
      await watchlistService.removeTicker(ticker);
      setWatchlist((prev) => prev.filter((item) => item.ticker !== ticker));
    } catch (err) {
      console.error('Failed to remove ticker:', err);
    }
  };

  const startEditSell = (row) => {
    setEditingSell(row.ticker);
    setSellInput(row.sell_price ? String(row.sell_price) : '');
  };

  const submitSell = async (row) => {
    const num = parseFloat(sellInput);
    if (Number.isNaN(num) || num < 0) {
      setEditingSell(null);
      return;
    }
    try {
      await watchlistService.updateSellPrice(row.ticker, num);
      await refresh();
    } catch (err) {
      console.error('Failed to update sell price:', err);
    } finally {
      setEditingSell(null);
      setSellInput('');
    }
  };

  // Render a single H+N cell: shows the recorded snapshot price (if any) and
  // colours against the entry price so you can scan the row horizontally for
  // momentum direction.
  const renderDayCell = (entryPrice, offset, dailyPrices) => {
    const sample = dailyPrices?.find((d) => d.day_offset === offset);
    if (!sample || !sample.price) {
      return <span className="text-on-surface-variant/40">—</span>;
    }
    const price = sample.price;
    let cls = 'text-on-surface-variant';
    if (entryPrice > 0) {
      if (price > entryPrice) cls = 'text-secondary';
      else if (price < entryPrice) cls = 'text-error';
    }
    return <span className={`tabular-nums font-medium ${cls}`}>{Math.round(price).toLocaleString()}</span>;
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' });
  };

  return (
    <div className="col-span-12 lg:col-span-8 bg-surface-container-low rounded-2xl overflow-hidden shadow-sm">
<<<<<<< Updated upstream
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
             const dateObj = new Date(row.created_at);
             const addedAt = isNaN(dateObj) ? 'Just now' : dateObj.toLocaleDateString();

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
=======
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-surface-container-high/30 text-[10px] uppercase tracking-widest text-on-surface-variant">
              <th className="px-3 py-3 font-bold">No</th>
              <th className="px-4 py-3 font-bold">Stock</th>
              <th className="px-4 py-3 font-bold">Date</th>
              <th className="px-4 py-3 font-bold text-right">Price</th>
              <th className="px-4 py-3 font-bold">Trading Setup</th>
              <th className="px-3 py-3 font-bold text-right">H+1</th>
              <th className="px-3 py-3 font-bold text-right">H+2</th>
              <th className="px-3 py-3 font-bold text-right">H+3</th>
              <th className="px-3 py-3 font-bold text-right">H+4</th>
              <th className="px-3 py-3 font-bold text-right">H+5</th>
              <th className="px-3 py-3 font-bold text-right">H+6</th>
              <th className="px-3 py-3 font-bold text-right">H+7</th>
              <th className="px-4 py-3 font-bold text-right">Harga Jual</th>
              <th className="px-4 py-3 font-bold text-right">Gain %</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          {loading ? (
            <tbody>
              <tr>
                <td colSpan="15" className="px-6 py-8 text-center text-sm text-on-surface-variant">
                  Loading watchlist...
>>>>>>> Stashed changes
                </td>
              </tr>
            </tbody>
          ) : watchlist.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan="15" className="px-6 py-8 text-center text-sm text-on-surface-variant">
                  Your watchlist is empty. Search for a stock to add it.
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody className="divide-y divide-outline-variant/10">
              {watchlist.map((row, idx) => {
                const entryPrice = row.entry_price || 0;
                const livePrice = row.last_price || row.live_price || entryPrice;
                const chg = row.change_pct || 0;
                const isGain = chg >= 0;
                const chgColor = isGain ? 'text-secondary' : 'text-error';
                const gainPct = row.gain_pct ?? 0;
                const gainColor = gainPct > 0 ? 'text-secondary' : gainPct < 0 ? 'text-error' : 'text-on-surface-variant';
                const category = (row.category || 'WATCHLIST').toUpperCase();
                const isStrongBuy = category === 'STRONG BUY';

                return (
                  <tr key={row.id || row.ticker} className="hover:bg-surface-container-high/40 transition-colors group">
                    <td className="px-3 py-4 text-on-surface-variant tabular-nums">{idx + 1}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded bg-surface-container-highest flex items-center justify-center text-[10px] font-bold ${isGain ? 'text-secondary' : 'text-error'}`}>
                          {row.ticker.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <TickerLink ticker={row.ticker} />
                          <p className="text-[10px] text-on-surface-variant w-32 truncate">{row.name || '—'}</p>
                          <span
                            className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                              isStrongBuy ? 'bg-secondary-container/30 text-secondary' : 'bg-surface-container-highest text-on-surface-variant'
                            }`}
                          >
                            {category}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-on-surface-variant text-[11px] tabular-nums">{formatDate(row.entry_date || row.added_at)}</td>
                    <td className="px-4 py-4 text-right">
                      <div className="tabular-nums font-medium text-on-surface">{Math.round(livePrice).toLocaleString()}</div>
                      <div className={`text-[10px] tabular-nums ${chgColor}`}>
                        {isGain ? '+' : ''}
                        {Number(chg).toFixed(2)}%
                      </div>
                    </td>
                    <td className="px-4 py-4 text-[11px] text-on-surface-variant max-w-[160px]">
                      <span className="line-clamp-2">{row.trading_setup || '—'}</span>
                    </td>
                    <td className="px-3 py-4 text-right">{renderDayCell(entryPrice, 1, row.daily_prices)}</td>
                    <td className="px-3 py-4 text-right">{renderDayCell(entryPrice, 2, row.daily_prices)}</td>
                    <td className="px-3 py-4 text-right">{renderDayCell(entryPrice, 3, row.daily_prices)}</td>
                    <td className="px-3 py-4 text-right">{renderDayCell(entryPrice, 4, row.daily_prices)}</td>
                    <td className="px-3 py-4 text-right">{renderDayCell(entryPrice, 5, row.daily_prices)}</td>
                    <td className="px-3 py-4 text-right">{renderDayCell(entryPrice, 6, row.daily_prices)}</td>
                    <td className="px-3 py-4 text-right">{renderDayCell(entryPrice, 7, row.daily_prices)}</td>
                    <td className="px-4 py-4 text-right">
                      {editingSell === row.ticker ? (
                        <input
                          autoFocus
                          type="number"
                          inputMode="decimal"
                          value={sellInput}
                          onChange={(e) => setSellInput(e.target.value)}
                          onBlur={() => submitSell(row)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') submitSell(row);
                            if (e.key === 'Escape') {
                              setEditingSell(null);
                              setSellInput('');
                            }
                          }}
                          className="w-24 bg-surface-container-highest rounded px-2 py-1 text-right text-sm tabular-nums outline-none focus:ring-1 focus:ring-primary"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditSell(row)}
                          className="tabular-nums font-medium text-on-surface hover:text-primary"
                          title="Click to edit sell price"
                        >
                          {row.sell_price > 0 ? Math.round(row.sell_price).toLocaleString() : '—'}
                        </button>
                      )}
                    </td>
                    <td className={`px-4 py-4 text-right font-bold tabular-nums ${gainColor}`}>
                      {gainPct > 0 ? '+' : ''}
                      {Number(gainPct).toFixed(2)}%
                    </td>
                    <td className="px-3 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleRemove(row.ticker)}
                        className="material-symbols-outlined text-error hover:text-error/80"
                        title="Remove from Watchlist"
                      >
                        delete
                      </button>
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

export default WatchlistTable;
