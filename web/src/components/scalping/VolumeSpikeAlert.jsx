import React from 'react';
import { useScreener } from '../../hooks/useScreener';

const VolumeSpikeAlert = () => {
  const { data, loading } = useScreener('scalping');

  // Filter for high volume (e.g. > 1 million) and sort
  const alerts = data.filter(d => {
    const vol = (d.payload && d.payload.volume) || 0;
    return vol > 1000000;
  }).sort((a, b) => {
    const volA = (a.payload && a.payload.volume) || 0;
    const volB = (b.payload && b.payload.volume) || 0;
    return volB - volA; // highest volume first
  }).slice(0, 5);

  return (
    <div className="glass-panel p-6 rounded-xl flex flex-col h-[300px]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-tertiary">campaign</span>
          <h3 className="font-bold text-lg">Volume Spike Alert</h3>
        </div>
        <span className="text-[10px] font-bold text-outline uppercase tracking-widest">LIVE STREAM</span>
      </div>
      
      {loading ? (
        <div className="flex-grow flex items-center justify-center">
          <span className="text-sm text-on-surface-variant">Scanning volume...</span>
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex-grow flex items-center justify-center">
          <span className="text-sm text-on-surface-variant">No volume spikes detected.</span>
        </div>
      ) : (
      <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar">
        {alerts.map((alert, i) => {
          const vol = (alert.payload && alert.payload.volume) || 0;
          const isExtreme = vol > 10000000;
          
          const tag = isExtreme ? 'Extreme Vol' : 'High Vol';
          const tagCls = isExtreme ? 'bg-tertiary/20 text-tertiary' : 'bg-secondary/20 text-secondary';
          const borderCls = isExtreme ? 'border-l-2 border-tertiary' : 'border-l-2 border-secondary';
          const desc = `${(vol / 1000000).toFixed(1)}M Volume Traded`;
          
          return (
            <div key={alert.ticker} className={`flex items-center justify-between p-3 rounded-lg bg-surface-container-low ${borderCls}`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{alert.ticker}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${tagCls}`}>{tag}</span>
                </div>
                <div className="text-xs text-outline mt-1">{desc}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-on-surface">Live</div>
                <div className={`text-[10px] ${alert.score >= 50 ? 'text-secondary' : 'text-error'}`}>{alert.signal}</div>
              </div>
            </div>
          )
        })}
      </div>
      )}
    </div>
  );
};

export default VolumeSpikeAlert;
