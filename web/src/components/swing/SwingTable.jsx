import React, { useState } from 'react';
import { watchlistService } from '../../services/watchlistService';

const SwingTable = ({ data = [], loading = false }) => {
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
    <div className="xl:col-span-3">
      <div className="bg-surface-container-high rounded-xl overflow-hidden">
        <div className="px-6 py-4 flex justify-between items-center bg-surface-container-highest/30">
          <h3 className="font-bold text-lg">Swing Candidates</h3>
          <div className="flex gap-4 text-xs font-medium text-on-surface-variant">
            <span>{loading ? 'Scanning...' : `Showing ${data.length} Results`}</span>
            <span className="material-symbols-outlined text-sm cursor-pointer hover:text-on-surface transition-colors" title="Export">download</span>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-on-surface-variant font-black border-b border-outline-variant/10">
                <th className="px-6 py-4">Ticker</th>
                <th className="px-6 py-4">Signal</th>
                <th className="px-6 py-4">Current Price</th>
                <th className="px-6 py-4">Target</th>
                <th className="px-6 py-4">R/R Ratio</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            {loading ? (
               <tbody className="divide-y divide-outline-variant/10">
                  <tr><td colSpan="6" className="px-6 py-8 text-center text-sm text-on-surface-variant">Loading swing candidates...</td></tr>
               </tbody>
            ) : data.length === 0 ? (
               <tbody className="divide-y divide-outline-variant/10">
                  <tr><td colSpan="6" className="px-6 py-8 text-center text-sm text-on-surface-variant">No candidates matching the criteria.</td></tr>
               </tbody>
            ) : (
            <tbody className="divide-y divide-outline-variant/10">
              {data.map((row) => {
                const payload = row.payload || {};
                const price = payload.price || 0;
                const target = payload.target || 0;
                const stopLoss = payload.stop_loss || 0;
                
                // Calc rough R/R ratio (Price - StopLoss) vs (Target - Price)
                let rr = "N/A";
                if (price > 0 && target > price && stopLoss > 0 && price > stopLoss) {
                  const risk = price - stopLoss;
                  const reward = target - price;
                  rr = `1:${(reward / risk).toFixed(1)}`;
                }

                return (
                  <tr key={row.ticker} className="hover:bg-surface-container-low transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-blue-100 tabular-nums">{row.ticker}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-secondary-container/20 text-secondary text-[10px] font-bold rounded-sm uppercase tracking-tighter">
                        {row.signal || 'Neutral'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium tabular-nums">{price.toLocaleString()}</td>
                    <td className="px-6 py-4 font-medium tabular-nums text-secondary">{target.toLocaleString()}</td>
                    <td className="px-6 py-4 tabular-nums">{rr}</td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={(e) => handleAddToWatchlist(e, row.ticker)}
                        disabled={addingTicker === row.ticker}
                        className="opacity-0 group-hover:opacity-100 bg-primary/10 text-primary hover:bg-primary hover:text-on-primary text-[10px] font-bold py-1 px-3 rounded-full transition-all uppercase disabled:opacity-50"
                      >
                        {addingTicker === row.ticker ? 'Adding...' : 'Watch'}
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
    </div>
  );
};

export default SwingTable;
