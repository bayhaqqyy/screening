import React from 'react';

const FilterBar = ({ filters, onFilterChange, activeCount }) => {
  const handleChange = (e) => {
    const { name, value } = e.target;
    onFilterChange({ ...filters, [name]: parseFloat(value) });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tighter text-on-surface">Scalping Screener</h2>
          <p className="text-on-surface-variant text-sm mt-1">Real-time intra-day momentum tracking</p>
        </div>
        <div className="flex gap-2">
          <button className="bg-primary-container text-on-primary-container px-6 py-2 rounded-full font-semibold text-sm flex items-center gap-2 shadow-lg shadow-primary-container/20 hover:scale-105 active:scale-95 transition-transform">
            <span className="material-symbols-outlined text-sm">play_arrow</span>
            Live Updates
          </button>
        </div>
      </div>
      
      <div className="glass-panel p-4 rounded-xl flex flex-wrap items-center gap-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold text-outline tracking-wider uppercase">Min Vol (M)</label>
          <select 
            name="minVol"
            value={filters.minVol}
            onChange={handleChange}
            className="bg-surface-container-low border-none text-sm rounded-lg focus:ring-1 focus:ring-primary/50 py-1.5 px-3 min-w-[120px] outline-none cursor-pointer"
          >
            <option value="10">10.0M</option>
            <option value="50">50.0M</option>
            <option value="100">100.0M</option>
          </select>
        </div>
        
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold text-outline tracking-wider uppercase">Frequency</label>
          <select 
            name="minFreq"
            value={filters.minFreq}
            onChange={handleChange}
            className="bg-surface-container-low border-none text-sm rounded-lg focus:ring-1 focus:ring-primary/50 py-1.5 px-3 min-w-[120px] outline-none cursor-pointer"
          >
            <option value="5000">&gt; 5k txns</option>
            <option value="10000">&gt; 10k txns</option>
            <option value="25000">&gt; 25k txns</option>
          </select>
        </div>
        
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold text-outline tracking-wider uppercase">Max Spread</label>
          <select 
            name="maxSpread"
            value={filters.maxSpread}
            onChange={handleChange}
            className="bg-surface-container-low border-none text-sm rounded-lg focus:ring-1 focus:ring-primary/50 py-1.5 px-3 min-w-[120px] outline-none cursor-pointer"
          >
            <option value="1.0">&lt; 1%</option>
            <option value="0.5">&lt; 0.5%</option>
            <option value="100">Any</option>
          </select>
        </div>
        
        <div className="ml-auto flex gap-3">
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-surface-container-highest text-xs font-medium text-primary">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            {activeCount} Tickers Active
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
