import React, { useState, useEffect } from 'react';
import { marketService } from '../../services/marketService';

const MarketOverview = () => {
  const [data, setData] = useState({
    index_value: 0,
    change_pct: 0,
    volume: 0,
    valuation: 0,
    foreign_flow: 0
  });

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const res = await marketService.getOverview();
        if (res) setData(res);
      } catch (err) {
        console.error("Failed to fetch market overview:", err);
      }
    };
    fetchOverview();
  }, []);

  const isGain = data.change_pct >= 0;
  
  // formatting helpers
  const formatValuation = (val) => {
    if (val > 1000000000000) return `Rp ${(val/1000000000000).toFixed(1)}T`;
    if (val > 1000000000) return `Rp ${(val/1000000000).toFixed(1)}B`;
    return `Rp ${val}`;
  };

  const formatVolume = (vol) => {
    if (vol > 1000000000) return `${(vol/1000000000).toFixed(1)}B`;
    if (vol > 1000000) return `${(vol/1000000).toFixed(1)}M`;
    return vol;
  };

  return (
    <section className="glass-panel inner-stroke rounded-xl p-6 relative overflow-hidden flex flex-col md:flex-row items-center gap-12">
      <div className="absolute top-0 right-0 w-96 h-full opacity-10 pointer-events-none">
        <div className={`w-full h-full bg-gradient-to-l ${isGain ? 'from-secondary' : 'from-error'} to-transparent`}></div>
      </div>
      
      <div className="flex-shrink-0 z-10">
        <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest mb-2">Market Overview</h2>
        <div className="flex items-baseline gap-3">
          <span className="text-5xl font-extrabold tabular-nums tracking-tighter">{data.index_value.toLocaleString()}</span>
          <span className={`px-2 py-1 ${isGain ? 'bg-secondary-container text-on-secondary-container' : 'bg-error-container text-on-error-container'} rounded text-sm font-bold flex items-center gap-1`}>
            <span className="material-symbols-outlined text-sm">{isGain ? 'trending_up' : 'trending_down'}</span>
            {isGain ? '+' : ''}{data.change_pct}%
          </span>
        </div>
        <p className="text-on-surface-variant mt-2 text-sm">IHSG Composite Index • Live</p>
      </div>
      
      <div className="flex flex-1 justify-around w-full gap-8 border-l border-outline-variant/20 pl-12 z-10">
        <div className="text-center">
          <p className="text-xs uppercase tracking-wider text-on-surface-variant mb-1">Valuation</p>
          <p className="text-xl font-bold tabular-nums">{formatValuation(data.valuation)}</p>
          <p className="text-[10px] text-secondary mt-1">Daily Total</p>
        </div>
        
        <div className="text-center">
          <p className="text-xs uppercase tracking-wider text-on-surface-variant mb-1">Foreign Flow</p>
          <p className={`text-xl font-bold tabular-nums ${data.foreign_flow > 0 ? 'text-secondary' : 'text-error'}`}>
            {data.foreign_flow > 0 ? '+' : ''}{formatValuation(data.foreign_flow)}
          </p>
          <p className="text-[10px] text-on-surface-variant mt-1">{data.foreign_flow > 0 ? 'Net Buy' : 'Net Sell'}</p>
        </div>
        
        <div className="text-center">
          <p className="text-xs uppercase tracking-wider text-on-surface-variant mb-1">Volume</p>
          <p className="text-xl font-bold tabular-nums">{formatVolume(data.volume)}</p>
          <p className="text-[10px] text-on-surface-variant mt-1">Shares Traded</p>
        </div>
      </div>
      
      <div className="w-48 h-16 flex items-end gap-1 z-10">
        <div className={`w-2 h-4 ${isGain ? 'bg-secondary/30' : 'bg-error/30'} rounded-t-sm`}></div>
        <div className={`w-2 h-6 ${isGain ? 'bg-secondary/30' : 'bg-error/30'} rounded-t-sm`}></div>
        <div className={`w-2 h-8 ${isGain ? 'bg-secondary/30' : 'bg-error/30'} rounded-t-sm`}></div>
        <div className={`w-2 h-5 ${isGain ? 'bg-secondary/30' : 'bg-error/30'} rounded-t-sm`}></div>
        <div className={`w-2 h-10 ${isGain ? 'bg-secondary/30' : 'bg-error/30'} rounded-t-sm`}></div>
        <div className={`w-2 h-12 ${isGain ? 'bg-secondary/50' : 'bg-error/50'} rounded-t-sm`}></div>
        <div className={`w-2 h-14 ${isGain ? 'bg-secondary' : 'bg-error'} rounded-t-sm`}></div>
      </div>
    </section>
  );
};

export default MarketOverview;
