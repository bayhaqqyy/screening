import React from 'react';

const SectorHeatmap = () => {
  return (
    <div className="col-span-12 lg:col-span-7 bg-surface-container-low rounded-xl p-6 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold">Sector Heatmap</h3>
        <p className="text-xs text-on-surface-variant">Performance • 24h</p>
      </div>
      
      <div className="flex-1 grid grid-cols-4 grid-rows-3 gap-3">
        <div className="col-span-2 row-span-2 bg-secondary/20 rounded-lg p-4 flex flex-col justify-between border border-secondary/10 hover:bg-secondary/30 transition-colors cursor-pointer">
          <span className="text-xs font-bold uppercase tracking-widest text-secondary">Banking</span>
          <span className="text-2xl font-black tabular-nums">+1.2%</span>
        </div>
        
        <div className="bg-error/10 rounded-lg p-4 flex flex-col justify-between border border-error/10 hover:bg-error/20 transition-colors cursor-pointer">
          <span className="text-[10px] font-bold uppercase tracking-widest text-error">Mining</span>
          <span className="text-lg font-black tabular-nums">-2.0%</span>
        </div>
        
        <div className="bg-secondary/10 rounded-lg p-4 flex flex-col justify-between border border-secondary/10 hover:bg-secondary/20 transition-colors cursor-pointer">
          <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">Infra</span>
          <span className="text-lg font-black tabular-nums">+0.8%</span>
        </div>
        
        <div className="col-span-2 bg-on-surface-variant/5 rounded-lg p-4 flex flex-col justify-between border border-outline-variant/10 hover:bg-on-surface-variant/10 transition-colors cursor-pointer">
          <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Consumer</span>
          <span className="text-lg font-black tabular-nums">+0.2%</span>
        </div>
        
        <div className="bg-error/10 rounded-lg p-4 flex flex-col justify-between border border-error/10 hover:bg-error/20 transition-colors cursor-pointer">
          <span className="text-[10px] font-bold uppercase tracking-widest text-error">Energy</span>
          <span className="text-lg font-black tabular-nums">-1.1%</span>
        </div>
        
        <div className="bg-secondary/15 rounded-lg p-4 flex flex-col justify-between border border-secondary/10 hover:bg-secondary/20 transition-colors cursor-pointer">
          <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">Tech</span>
          <span className="text-lg font-black tabular-nums">+0.5%</span>
        </div>
      </div>
    </div>
  );
};

export default SectorHeatmap;
