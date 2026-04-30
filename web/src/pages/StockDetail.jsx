import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AnimatedPage from '../components/layout/AnimatedPage';
import { searchService } from '../services/searchService';
import { watchlistService } from '../services/watchlistService';

const StockDetail = () => {
  const { ticker } = useParams();
  const navigate = useNavigate();
  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addingWatchlist, setAddingWatchlist] = useState(false);

  useEffect(() => {
    const fetchStock = async () => {
      try {
        setLoading(true);
        // Fallback to searching if getStockDetail fails or isn't completely functional yet
        const res = await searchService.getStockDetail(ticker);
        if (res.data) {
          setStock(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch stock:", err);
      } finally {
        setLoading(false);
      }
    };
    if (ticker) fetchStock();
  }, [ticker]);

  const handleAddToWatchlist = async () => {
    setAddingWatchlist(true);
    try {
      await watchlistService.addTicker(ticker);
    } catch (err) {
      console.error(err);
    } finally {
      setAddingWatchlist(false);
    }
  };

  if (loading) {
    return (
      <AnimatedPage>
        <div className="flex items-center justify-center min-h-[50vh]">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
        </div>
      </AnimatedPage>
    );
  }

  if (!stock) {
    return (
      <AnimatedPage>
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
          <span className="material-symbols-outlined text-6xl text-on-surface-variant">search_off</span>
          <h2 className="text-2xl font-bold">Stock Not Found</h2>
          <p className="text-on-surface-variant">Could not find any data for {ticker}.</p>
          <button onClick={() => navigate(-1)} className="mt-4 bg-primary text-on-primary px-6 py-2 rounded-full font-bold">
            Go Back
          </button>
        </div>
      </AnimatedPage>
    );
  }

  const isUp = stock.change_pct >= 0;
  const colorCls = isUp ? 'text-secondary' : 'text-error';
  const bgCls = isUp ? 'bg-secondary-container text-on-secondary-container' : 'bg-error-container text-on-error-container';

  return (
    <AnimatedPage>
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-extrabold tracking-tight text-on-surface">{stock.ticker}</h1>
            <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${bgCls}`}>
              {stock.sector || 'Unknown Sector'}
            </span>
          </div>
          <p className="text-xl text-on-surface-variant font-medium">{stock.name}</p>
        </div>
        
        <div className="flex flex-col md:items-end">
          <div className="text-4xl font-black tabular-nums">
            Rp {stock.last_price?.toLocaleString()}
          </div>
          <div className={`text-lg font-bold tabular-nums ${colorCls}`}>
            {isUp ? '+' : ''}{stock.change_pct?.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex gap-4 mb-8">
        <button 
          onClick={handleAddToWatchlist}
          disabled={addingWatchlist}
          className="bg-surface-container-high hover:bg-surface-variant transition-colors text-on-surface px-6 py-2 rounded-full font-bold flex items-center gap-2 disabled:opacity-50"
        >
          {addingWatchlist ? (
            <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
          ) : (
            <span className="material-symbols-outlined text-sm">star</span>
          )}
          {addingWatchlist ? 'Adding...' : 'Add to Watchlist'}
        </button>
        <button className="bg-primary hover:brightness-110 transition-colors text-on-primary px-6 py-2 rounded-full font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">shopping_cart</span>
          Trade
        </button>
      </div>

      {/* Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart Area */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-xl min-h-[400px] flex flex-col items-center justify-center text-center">
          <span className="material-symbols-outlined text-6xl text-outline mb-4">candlestick_chart</span>
          <h3 className="text-xl font-bold text-on-surface mb-2">Advanced Chart</h3>
          <p className="text-on-surface-variant max-w-sm">
            Integration with lightweight-charts or TV lightweight-charts goes here. 
            Requires historical OHLCV endpoint.
          </p>
        </div>

        {/* Info Sidebar */}
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-xl">
            <h3 className="font-bold text-on-surface border-b border-outline-variant/20 pb-3 mb-4">Key Statistics</h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">Market Cap</span>
                <span className="font-semibold tabular-nums">Rp {(stock.market_cap / 1e12).toFixed(2)}T</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">Industry</span>
                <span className="font-semibold text-right">{stock.industry || '-'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">Volume</span>
                <span className="font-semibold tabular-nums">N/A</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">P/E Ratio</span>
                <span className="font-semibold tabular-nums">N/A</span>
              </div>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-xl">
            <h3 className="font-bold text-on-surface border-b border-outline-variant/20 pb-3 mb-4">Broker Summary</h3>
            <div className="flex items-center justify-center h-24 text-on-surface-variant text-sm text-center">
              Broker data integration pending premium provider connection.
            </div>
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
};

export default StockDetail;
