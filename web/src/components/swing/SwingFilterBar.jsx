import React from 'react';

const SwingFilterBar = ({ filters, onFilterChange }) => {
  const handleChange = (e) => {
    const { name, value } = e.target;
    onFilterChange({ ...filters, [name]: value });
  };

  return (
    <div className="flex flex-wrap items-center gap-4 mb-8 bg-surface-container-low p-4 rounded-xl">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold px-1">Timeframe</label>
        <select name="timeframe" value={filters.timeframe} onChange={handleChange} className="bg-surface-container border-none text-sm text-on-surface rounded-lg focus:ring-1 focus:ring-primary min-w-[120px] outline-none cursor-pointer">
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="4h">4H Chart</option>
        </select>
      </div>
      
      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold px-1">Indicator</label>
        <select name="indicator" value={filters.indicator} onChange={handleChange} className="bg-surface-container border-none text-sm text-on-surface rounded-lg focus:ring-1 focus:ring-primary min-w-[140px] outline-none cursor-pointer">
          <option value="all">All Indicators</option>
          <option value="ma_cross">MA Cross (20/50)</option>
          <option value="rsi_oversold">RSI Oversold</option>
          <option value="macd_div">MACD Divergence</option>
        </select>
      </div>
      
      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold px-1">Sektor</label>
        <select name="sector" value={filters.sector} onChange={handleChange} className="bg-surface-container border-none text-sm text-on-surface rounded-lg focus:ring-1 focus:ring-primary min-w-[140px] outline-none cursor-pointer">
          <option value="all">All Sectors</option>
          <option value="Banking">Banking</option>
          <option value="Energy">Energy</option>
          <option value="Consumer Goods">Consumer Goods</option>
          <option value="Technology">Technology</option>
        </select>
      </div>
      
      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold px-1">Corp Action</label>
        <select name="corpAction" value={filters.corpAction} onChange={handleChange} className="bg-surface-container border-none text-sm text-on-surface rounded-lg focus:ring-1 focus:ring-primary min-w-[140px] outline-none cursor-pointer">
          <option value="all">Any</option>
          <option value="rups">Upcoming RUPS</option>
          <option value="dividend">Dividend Cum</option>
          <option value="split">Stock Split</option>
        </select>
      </div>
      
      <div className="ml-auto flex gap-2">
        <button className="bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-sm font-semibold px-4 py-2 rounded-lg transition-all flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">tune</span>
          Advanced Filters
        </button>
      </div>
    </div>
  );
};

export default SwingFilterBar;
