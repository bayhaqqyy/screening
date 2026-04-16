import React from 'react';

const MarketOverview = () => {
  return (
    <section className="glass-panel inner-stroke rounded-xl p-6 relative overflow-hidden flex flex-col md:flex-row items-center gap-12">
      <div className="absolute top-0 right-0 w-96 h-full opacity-10 pointer-events-none">
        <div className="w-full h-full bg-gradient-to-l from-primary to-transparent"></div>
      </div>
      
      <div className="flex-shrink-0 z-10">
        <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest mb-2">Market Overview</h2>
        <div className="flex items-baseline gap-3">
          <span className="text-5xl font-extrabold tabular-nums tracking-tighter">7,234.12</span>
          <span className="px-2 py-1 bg-secondary-container text-on-secondary-container rounded text-sm font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">trending_up</span>
            +0.82%
          </span>
        </div>
        <p className="text-on-surface-variant mt-2 text-sm">IHSG Composite Index • Live</p>
      </div>
      
      <div className="flex flex-1 justify-around w-full gap-8 border-l border-outline-variant/20 pl-12 z-10">
        <div className="text-center">
          <p className="text-xs uppercase tracking-wider text-on-surface-variant mb-1">Valuation</p>
          <p className="text-xl font-bold tabular-nums">Rp 12.3T</p>
          <p className="text-[10px] text-secondary mt-1">Daily High</p>
        </div>
        
        <div className="text-center">
          <p className="text-xs uppercase tracking-wider text-on-surface-variant mb-1">Foreign Flow</p>
          <p className="text-xl font-bold tabular-nums text-secondary">+Rp 452B</p>
          <p className="text-[10px] text-on-surface-variant mt-1">Net Buy</p>
        </div>
        
        <div className="text-center">
          <p className="text-xs uppercase tracking-wider text-on-surface-variant mb-1">Volume</p>
          <p className="text-xl font-bold tabular-nums">18.4B</p>
          <p className="text-[10px] text-on-surface-variant mt-1">Shares Traded</p>
        </div>
      </div>
      
      <div className="w-48 h-16 flex items-end gap-1 z-10">
        <div className="w-2 h-4 bg-secondary/30 rounded-t-sm"></div>
        <div className="w-2 h-6 bg-secondary/30 rounded-t-sm"></div>
        <div className="w-2 h-8 bg-secondary/30 rounded-t-sm"></div>
        <div className="w-2 h-5 bg-secondary/30 rounded-t-sm"></div>
        <div className="w-2 h-10 bg-secondary/30 rounded-t-sm"></div>
        <div className="w-2 h-12 bg-secondary/50 rounded-t-sm"></div>
        <div className="w-2 h-14 bg-secondary rounded-t-sm"></div>
      </div>
    </section>
  );
};

export default MarketOverview;
