import React, { useEffect, useState } from 'react';
import { marketService } from '../../services/marketService';

const NewsFilterBar = ({ activeFilter = 'Semua', onFilterChange = () => {} }) => {
  const [liveTickers, setLiveTickers] = useState([]);

  useEffect(() => {
    const fetchMovers = async () => {
      try {
        const res = await marketService.getTopMovers('gainers');
        if (res.data) setLiveTickers(res.data.slice(0, 5));
      } catch { /* ignore */ }
    };
    fetchMovers();
  }, []);

  const filters = ['Semua', 'Positif', 'Negatif', 'Netral'];

  return (
    <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 mt-4">
      <div className="flex flex-wrap gap-2">
        {filters.map(filter => (
          <button 
            key={filter}
            onClick={() => onFilterChange(filter)}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors shadow-lg ${
              activeFilter === filter 
                ? 'signature-gradient text-on-primary shadow-primary/20' 
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high ghost-border'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>
      <div className="flex items-center space-x-4 overflow-x-auto pb-2 lg:pb-0 no-scrollbar">
        <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant whitespace-nowrap">Live Tickers:</span>
        <div className="flex items-center space-x-4">
          {liveTickers.length > 0 ? liveTickers.map((ticker) => (
            <div key={ticker.ticker} className="flex items-center space-x-1.5 bg-surface-container-low px-3 py-1 rounded-md border border-outline-variant/10 whitespace-nowrap">
              <span className="text-xs font-bold tabular-nums">{ticker.ticker}</span>
              <span className={`text-xs tabular-nums ${ticker.change_pct >= 0 ? 'text-secondary-fixed-dim' : 'text-error'}`}>
                {ticker.change_pct >= 0 ? '+' : ''}{ticker.change_pct.toFixed(1)}%
              </span>
            </div>
          )) : (
            <div className="text-xs text-on-surface-variant italic">Waiting for market data...</div>
          )}
        </div>
      </div>
    </section>
  );
};

export default NewsFilterBar;
