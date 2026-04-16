import React from 'react';

const SwingFilterBar = () => {
  return (
    <div className="flex flex-wrap items-center gap-4 mb-8 bg-surface-container-low p-4 rounded-xl">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold px-1">Timeframe</label>
        <select className="bg-surface-container border-none text-sm text-on-surface rounded-lg focus:ring-1 focus:ring-primary min-w-[120px] outline-none cursor-pointer">
          <option>Daily</option>
          <option>Weekly</option>
          <option>4H Chart</option>
        </select>
      </div>
      
      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold px-1">Indicator</label>
        <select className="bg-surface-container border-none text-sm text-on-surface rounded-lg focus:ring-1 focus:ring-primary min-w-[140px] outline-none cursor-pointer">
          <option>MA Cross (20/50)</option>
          <option>RSI Oversold</option>
          <option>MACD Divergence</option>
        </select>
      </div>
      
      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold px-1">Sektor</label>
        <select className="bg-surface-container border-none text-sm text-on-surface rounded-lg focus:ring-1 focus:ring-primary min-w-[140px] outline-none cursor-pointer">
          <option>Banking</option>
          <option>Energy</option>
          <option>Consumer Goods</option>
          <option>Technology</option>
        </select>
      </div>
      
      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold px-1">Corp Action</label>
        <select className="bg-surface-container border-none text-sm text-on-surface rounded-lg focus:ring-1 focus:ring-primary min-w-[140px] outline-none cursor-pointer">
          <option>Upcoming RUPS</option>
          <option>Dividend Cum</option>
          <option>Stock Split</option>
        </select>
      </div>
      
      <div className="ml-auto flex gap-2">
        <button className="bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-sm font-semibold px-4 py-2 rounded-lg transition-all flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">tune</span>
          Advanced Filters
        </button>
        <button className="bg-gradient-to-br from-primary to-primary-container text-on-primary text-sm font-bold px-6 py-2 rounded-lg shadow-lg hover:brightness-110 transition-all">
          Apply Filter
        </button>
      </div>
    </div>
  );
};

export default SwingFilterBar;
