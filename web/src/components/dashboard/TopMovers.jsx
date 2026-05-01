import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { marketService } from '../../services/marketService';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0 }
};

const TopMovers = () => {
  const [tab, setTab] = useState('gainers');
  const [movers, setMovers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMovers = async () => {
      setLoading(true);
      try {
        const data = await marketService.getTopMovers(tab);
        setMovers(data);
      } catch (error) {
        console.error("Failed to fetch top movers:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMovers();

    // Live update prices from WS ticks
    const handleTick = (event) => {
      const msg = event.detail;
      const d = msg.data;
      if (!d || !d.ticker) return;

      setMovers(prev => {
        let updated = [...prev];
        const idx = updated.findIndex(m => m.ticker === d.ticker);
        if (idx >= 0) {
          updated[idx] = { ...updated[idx], price: d.last_price, change_pct: d.change_pct };
          // Re-sort based on current tab
          updated.sort((a, b) => tab === 'gainers' 
            ? b.change_pct - a.change_pct 
            : a.change_pct - b.change_pct
          );
        }
        return updated;
      });
    };

    window.addEventListener('ws_idx.ohlcv.enriched', handleTick);
    return () => window.removeEventListener('ws_idx.ohlcv.enriched', handleTick);
  }, [tab]);
  
  return (
    <div className="col-span-12 lg:col-span-5 bg-surface-container-low rounded-xl flex flex-col overflow-hidden">
      <div className="p-6 pb-2 flex items-center justify-between">
        <h3 className="text-lg font-bold">Top Movers</h3>
        <div className="flex bg-surface-container-highest rounded-full p-1">
          <button 
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${tab === 'gainers' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
            onClick={() => setTab('gainers')}
          >
            Gainers
          </button>
          <button 
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${tab === 'losers' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
            onClick={() => setTab('losers')}
          >
            Losers
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <table className="w-full text-sm">
          <thead className="text-on-surface-variant text-[11px] uppercase tracking-widest text-left sticky top-0 bg-surface-container-low py-4 block border-b border-outline-variant/10">
            <tr className="flex w-full">
              <th className="flex-1 py-3 font-normal">Ticker</th>
              <th className="w-24 py-3 text-right font-normal">Price</th>
              <th className="w-24 py-3 text-right font-normal">Change</th>
            </tr>
          </thead>
          {loading ? (
             <tbody className="block pt-8 text-center text-on-surface-variant text-sm">
               <tr><td>Loading...</td></tr>
             </tbody>
          ) : (
          <motion.tbody 
            className="block space-y-4 pt-4"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {movers.map((stock) => {
              const isGain = stock.change_pct > 0;
              const initial = stock.ticker.charAt(0);
              const bgCls = isGain ? 'bg-secondary/10' : 'bg-error/10';
              const txtCls = isGain ? 'text-secondary' : 'text-error';
              
              return (
                <motion.tr 
                  key={stock.ticker} 
                  variants={itemVariants}
                  whileHover={{ scale: 1.02, backgroundColor: 'rgba(53, 57, 67, 0.4)' }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center p-2 rounded-lg transition-colors cursor-pointer"
                >
                  <td className="flex-1 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded flex items-center justify-center font-bold text-xs ${bgCls} ${txtCls}`}>
                      {initial}
                    </div>
                    <div>
                      <p className="font-bold tabular-nums">{stock.ticker}</p>
                      <p className="text-[10px] text-on-surface-variant truncate w-32">{stock.name}</p>
                    </div>
                  </td>
                  <td className="w-24 text-right tabular-nums font-semibold">{stock.price}</td>
                  <td className={`w-24 text-right tabular-nums ${isGain ? 'text-secondary' : 'text-error'}`}>
                    {isGain ? '+' : ''}{stock.change_pct}%
                  </td>
                </motion.tr>
              )
            })}
          </motion.tbody>
          )}
        </table>
      </div>
    </div>
  );
};

export default TopMovers;
