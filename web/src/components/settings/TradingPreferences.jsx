import React from 'react';

const TradingPreferences = ({ preferences = {}, onChange }) => {
  const activeTimeframe = preferences.chartTimeframe || '1D';
  const defaultLotSize = preferences.defaultLotSize || '100';

  const timeframes = ['1M', '5M', '15M', '1H', '1D'];

  return (
    <section className="lg:col-span-12 bg-surface-container-low border border-outline-variant/10 rounded-xl p-8 backdrop-blur-xl">
      <h3 className="text-xl font-bold mb-8">Trading Preferences</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        <div className="space-y-4">
          <label className="text-[10px] uppercase tracking-[0.1em] text-on-surface-variant font-bold">Chart Timeframe</label>
          <div className="flex flex-wrap gap-2">
            {timeframes.map(tf => (
              <button 
                key={tf}
                onClick={() => onChange('chartTimeframe', tf)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold tabular-nums transition-colors ${
                  activeTimeframe === tf 
                    ? 'bg-primary-container text-on-primary-container' 
                    : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-variant'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
        
        <div className="space-y-4">
          <label className="text-[10px] uppercase tracking-[0.1em] text-on-surface-variant font-bold">Default Lot Size</label>
          <div className="relative">
            <input 
              className="w-full bg-transparent border-b border-outline-variant/30 py-2 tabular-nums text-lg font-semibold focus:border-primary-container focus:ring-0 outline-none" 
              type="text" 
              value={defaultLotSize}
              onChange={(e) => onChange('defaultLotSize', e.target.value)}
            />
            <span className="absolute right-0 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant">UNITS</span>
          </div>
        </div>
        
        <div className="space-y-4">
          <label className="text-[10px] uppercase tracking-[0.1em] text-on-surface-variant font-bold">Broker Integration</label>
          <div className="flex items-center gap-4 bg-surface-container-low p-3 rounded-xl border border-outline-variant/10">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-sm">link</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold">Interactive Brokers</p>
              <p className="text-[10px] text-secondary">Connected</p>
            </div>
            <button className="text-xs text-on-surface-variant hover:text-on-surface">Manage</button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TradingPreferences;
