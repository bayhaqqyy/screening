import React from 'react';

const NewsFilterBar = () => {
  return (
    <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 mt-4">
      <div className="flex flex-wrap gap-2">
        <button className="px-5 py-2 rounded-full text-sm font-semibold signature-gradient text-on-primary shadow-lg shadow-primary/20">Semua</button>
        <button className="px-5 py-2 rounded-full text-sm font-medium bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high transition-colors ghost-border">Positif</button>
        <button className="px-5 py-2 rounded-full text-sm font-medium bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high transition-colors ghost-border">Negatif</button>
        <button className="px-5 py-2 rounded-full text-sm font-medium bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high transition-colors ghost-border">Netral</button>
      </div>
      <div className="flex items-center space-x-4 overflow-x-auto pb-2 lg:pb-0 no-scrollbar">
        <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant whitespace-nowrap">Live Tickers:</span>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5 bg-surface-container-low px-3 py-1 rounded-md border border-outline-variant/10">
            <span className="text-xs font-bold tabular-nums">BBCA</span>
            <span className="text-xs text-secondary-fixed-dim tabular-nums">+1.2%</span>
          </div>
          <div className="flex items-center space-x-1.5 bg-surface-container-low px-3 py-1 rounded-md border border-outline-variant/10">
            <span className="text-xs font-bold tabular-nums">TLKM</span>
            <span className="text-xs text-error tabular-nums">-0.5%</span>
          </div>
          <div className="flex items-center space-x-1.5 bg-surface-container-low px-3 py-1 rounded-md border border-outline-variant/10">
            <span className="text-xs font-bold tabular-nums">GOTO</span>
            <span className="text-xs text-secondary-fixed-dim tabular-nums">+4.8%</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NewsFilterBar;
