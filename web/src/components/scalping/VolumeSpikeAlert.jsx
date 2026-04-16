import React from 'react';

const mockAlerts = [
  {
    ticker: 'TLKM', tag: '5min Spike', tagCls: 'bg-tertiary/20 text-tertiary',
    desc: 'Relative Volume 4.5x average', time: '14:22:05', perf: '+0.5% in 1m', perfCls: 'text-secondary', 
    borderCls: 'border-l-2 border-tertiary'
  },
  {
    ticker: 'ASII', tag: 'Breakout', tagCls: 'bg-secondary/20 text-secondary',
    desc: 'Large Buy Order (25,000 Lot)', time: '14:21:50', perf: '+1.2% in 2m', perfCls: 'text-secondary', 
    borderCls: 'border-l-2 border-secondary'
  },
  {
    ticker: 'BMRI', tag: 'Flow Alert', tagCls: 'bg-white/5 text-outline',
    desc: 'Institutional cross detected', time: '14:20:12', perf: 'No change', perfCls: 'text-outline', 
    borderCls: 'border-l-2 border-outline-variant'
  }
];

const VolumeSpikeAlert = () => {
  return (
    <div className="glass-panel p-6 rounded-xl flex flex-col h-[300px]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-tertiary">campaign</span>
          <h3 className="font-bold text-lg">Volume Spike Alert</h3>
        </div>
        <span className="text-[10px] font-bold text-outline uppercase tracking-widest">LIVE STREAM</span>
      </div>
      
      <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar">
        {mockAlerts.map((alert, i) => (
          <div key={i} className={`flex items-center justify-between p-3 rounded-lg bg-surface-container-low ${alert.borderCls}`}>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">{alert.ticker}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${alert.tagCls}`}>{alert.tag}</span>
              </div>
              <div className="text-xs text-outline mt-1">{alert.desc}</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold text-on-surface">{alert.time}</div>
              <div className={`text-[10px] ${alert.perfCls}`}>{alert.perf}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VolumeSpikeAlert;
