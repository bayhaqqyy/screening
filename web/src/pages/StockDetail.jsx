import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AnimatedPage from '../components/layout/AnimatedPage';
import { searchService } from '../services/searchService';
import { watchlistService } from '../services/watchlistService';
import AdvancedChart from '../components/stock/AdvancedChart';

// Inline broker summary card that listens to live WS for this specific ticker
const BrokerSummaryCard = ({ ticker }) => {
  const [buyers, setBuyers] = useState([]);
  const [sellers, setSellers] = useState([]);

  useEffect(() => {
    const buyerMap = {};
    const sellerMap = {};

    const handleFlow = (event) => {
      const msg = event.detail;
      const data = msg.data;
      if (!data || data.ticker !== ticker) return;

      (data.top_buyers || []).forEach(code => {
        buyerMap[code] = (buyerMap[code] || 0) + 1;
      });
      (data.top_sellers || []).forEach(code => {
        sellerMap[code] = (sellerMap[code] || 0) + 1;
      });

      setBuyers(Object.entries(buyerMap).sort((a, b) => b[1] - a[1]).slice(0, 3));
      setSellers(Object.entries(sellerMap).sort((a, b) => b[1] - a[1]).slice(0, 3));
    };

    window.addEventListener('ws_idx.bandar.flow', handleFlow);
    return () => window.removeEventListener('ws_idx.bandar.flow', handleFlow);
  }, [ticker]);

  const hasBrokerData = buyers.length > 0 || sellers.length > 0;

  return (
    <div className="glass-panel p-6 rounded-xl">
      <h3 className="font-bold text-on-surface border-b border-outline-variant/20 pb-3 mb-4">Broker Summary</h3>
      {!hasBrokerData ? (
        <div className="flex items-center justify-center h-24 text-on-surface-variant text-sm text-center">
          <div className="flex flex-col items-center gap-1 px-4">
            <span className="font-medium">Broker data unavailable</span>
            <span className="text-[10px] text-on-surface-variant/70">
              IDX broker summary feed is not integrated yet.
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <div>
            <span className="text-[10px] uppercase font-bold text-secondary tracking-wider block mb-2">Top Buyers</span>
            <div className="space-y-1.5">
              {buyers.map(([code, count]) => (
                <div key={code} className="flex justify-between items-center">
                  <span className="bg-secondary/10 text-secondary px-2 py-0.5 rounded text-xs font-bold">{code}</span>
                  <span className="text-on-surface-variant text-xs tabular-nums">{count} hits</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-error tracking-wider block mb-2">Top Sellers</span>
            <div className="space-y-1.5">
              {sellers.map(([code, count]) => (
                <div key={code} className="flex justify-between items-center">
                  <span className="bg-error/10 text-error px-2 py-0.5 rounded text-xs font-bold">{code}</span>
                  <span className="text-on-surface-variant text-xs tabular-nums">{count} hits</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StockDetail = () => {
  const { ticker } = useParams();
  const navigate = useNavigate();
  const [stock, setStock] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingWatchlist, setAddingWatchlist] = useState(false);

  useEffect(() => {
    const fetchStock = async () => {
      try {
        setLoading(true);
        const res = await searchService.getStockDetail(ticker);
        if (res.data) {
          setStock(res.data);
        }
        const chartRes = await searchService.getStockChart(ticker);
        if (chartRes.data) {
          setChartData(chartRes.data);
        }
      } catch (err) {
        console.error("Failed to fetch stock or chart:", err);
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
        <div className="lg:col-span-2">
          <AdvancedChart data={chartData} theme="dark" />
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
                <span className="font-semibold tabular-nums">
                  {chartData.length > 0 
                    ? `${(chartData[chartData.length - 1].volume / 1e6).toFixed(1)}M` 
                    : (stock.volume ? `${(stock.volume / 1e6).toFixed(1)}M` : '-')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">Prev Close</span>
                <span className="font-semibold tabular-nums">
                  {stock.prev_close ? `Rp ${stock.prev_close.toLocaleString()}` : '-'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">Sector</span>
                <span className="font-semibold text-right">{stock.sector || '-'}</span>
              </div>
            </div>
          </div>

          <BrokerSummaryCard ticker={ticker} />
        </div>
      </div>
    </AnimatedPage>
  );
};

export default StockDetail;
