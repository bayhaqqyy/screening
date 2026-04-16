import React from 'react';

const SectorStats = () => {
  return (
    <div className="bg-surface-container-low p-6 rounded-2xl space-y-6">
      <h3 className="font-bold text-blue-100 flex items-center justify-between">
        <span>Sector Performance</span>
        <span className="material-symbols-outlined text-slate-500">analytics</span>
      </h3>
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-semibold uppercase tracking-wider">
            <span className="text-on-surface-variant">Banking</span>
            <span className="text-secondary">+1.8%</span>
          </div>
          <div className="h-1 w-full bg-surface-container-high rounded-full overflow-hidden">
            <div className="h-full bg-secondary w-[75%] rounded-full shadow-[0_0_8px_rgba(74,225,118,0.4)]"></div>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-semibold uppercase tracking-wider">
            <span className="text-on-surface-variant">Technology</span>
            <span className="text-error">-0.4%</span>
          </div>
          <div className="h-1 w-full bg-surface-container-high rounded-full overflow-hidden">
            <div className="h-full bg-error w-[40%] rounded-full shadow-[0_0_8px_rgba(255,180,171,0.4)]"></div>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-semibold uppercase tracking-wider">
            <span className="text-on-surface-variant">Energy</span>
            <span className="text-on-surface">+0.1%</span>
          </div>
          <div className="h-1 w-full bg-surface-container-high rounded-full overflow-hidden">
            <div className="h-full bg-on-surface w-[55%] rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SectorStats;
