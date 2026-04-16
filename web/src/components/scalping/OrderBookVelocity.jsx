import React from 'react';

const OrderBookVelocity = () => {
  return (
    <div className="glass-panel p-6 rounded-xl flex flex-col h-[300px]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">speed</span>
          <h3 className="font-bold text-lg">Order Book Velocity</h3>
        </div>
        <div className="text-[10px] font-bold text-outline uppercase tracking-widest">Global Aggregate</div>
      </div>
      
      <div className="flex-1 flex flex-col justify-center gap-8">
        {/* Bid Speed */}
        <div className="space-y-2">
          <div className="flex justify-between items-end">
            <span className="text-xs font-bold text-secondary uppercase tracking-tighter">Bid Velocity (Buy Pressure)</span>
            <span className="text-2xl font-black text-secondary tabular-nums">85%</span>
          </div>
          <div className="w-full h-4 bg-surface-container-low rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-secondary/40 to-secondary w-[85%] shadow-[0_0_15px_rgba(74,225,118,0.4)]"></div>
          </div>
          <div className="text-[10px] text-outline italic">Execution speed: 0.12s / avg fill</div>
        </div>
        
        {/* Ask Speed */}
        <div className="space-y-2">
          <div className="flex justify-between items-end">
            <span className="text-xs font-bold text-error uppercase tracking-tighter">Ask Velocity (Sell Pressure)</span>
            <span className="text-2xl font-black text-error tabular-nums">32%</span>
          </div>
          <div className="w-full h-4 bg-surface-container-low rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-error/40 to-error w-[32%] shadow-[0_0_15px_rgba(255,180,171,0.2)]"></div>
          </div>
          <div className="text-[10px] text-outline italic">Execution speed: 0.45s / avg fill</div>
        </div>
      </div>
    </div>
  );
};

export default OrderBookVelocity;
