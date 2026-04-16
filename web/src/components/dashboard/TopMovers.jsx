import React, { useState } from 'react';
import { motion } from 'framer-motion';

const mockMovers = [
  { ticker: 'ADRO', name: 'Adaro Energy', price: '3,820', change: '+4.25%', isGain: true, initial: 'A', bgCls: 'bg-blue-500/10', txtCls: 'text-blue-400' },
  { ticker: 'BBCA', name: 'Bank Central Asia', price: '10,250', change: '+2.15%', isGain: true, initial: 'B', bgCls: 'bg-yellow-500/10', txtCls: 'text-yellow-400' },
  { ticker: 'GOTO', name: 'GoTo Gojek Tokopedia', price: '58', change: '+1.75%', isGain: true, initial: 'G', bgCls: 'bg-green-500/10', txtCls: 'text-green-400' },
  { ticker: 'TLKM', name: 'Telkom Indonesia', price: '2,840', change: '+1.43%', isGain: true, initial: 'T', bgCls: 'bg-red-500/10', txtCls: 'text-red-400' }
];

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
          <motion.tbody 
            className="block space-y-4 pt-4"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {mockMovers.map((stock) => (
              <motion.tr 
                key={stock.ticker} 
                variants={itemVariants}
                whileHover={{ scale: 1.02, backgroundColor: 'rgba(53, 57, 67, 0.4)' }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center p-2 rounded-lg transition-colors cursor-pointer"
              >
                <td className="flex-1 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded flex items-center justify-center font-bold text-xs ${stock.bgCls} ${stock.txtCls}`}>
                    {stock.initial}
                  </div>
                  <div>
                    <p className="font-bold tabular-nums">{stock.ticker}</p>
                    <p className="text-[10px] text-on-surface-variant">{stock.name}</p>
                  </div>
                </td>
                <td className="w-24 text-right tabular-nums font-semibold">{stock.price}</td>
                <td className={`w-24 text-right tabular-nums ${stock.isGain ? 'text-secondary' : 'text-error'}`}>
                  {stock.change}
                </td>
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
      </div>
    </div>
  );
};

export default TopMovers;
