import React, { useState, useEffect } from 'react';

const OrderBookVelocity = () => {
  const [bidPressure, setBidPressure] = useState(50);
  const [askPressure, setAskPressure] = useState(50);
  const [tickCount, setTickCount] = useState(0);

  useEffect(() => {
    let buyTicks = 0;
    let sellTicks = 0;

    const handleTick = (event) => {
      const msg = event.detail;
      const data = msg.data;
      if (!data || !data.change_pct) return;

      if (data.change_pct > 0) {
        buyTicks++;
      } else if (data.change_pct < 0) {
        sellTicks++;
      }

      const total = buyTicks + sellTicks;
      if (total > 0) {
        setBidPressure(Math.round((buyTicks / total) * 100));
        setAskPressure(Math.round((sellTicks / total) * 100));
      }
      setTickCount(total);
    };

    window.addEventListener('ws_idx.ohlcv.enriched', handleTick);

    // Reset counters every 60 seconds for fresh readings
    const resetInterval = setInterval(() => {
      buyTicks = 0;
      sellTicks = 0;
      setTickCount(0);
    }, 60000);

    return () => {
      window.removeEventListener('ws_idx.ohlcv.enriched', handleTick);
      clearInterval(resetInterval);
    };
  }, []);

  return (
    <div className="glass-panel p-6 rounded-xl flex flex-col h-[300px]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">speed</span>
          <h3 className="font-bold text-lg">Order Book Velocity</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-outline uppercase tracking-widest">
            {tickCount > 0 ? `${tickCount} Ticks` : 'Waiting...'}
          </span>
          {tickCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>}
        </div>
      </div>
      
      <div className="flex-1 flex flex-col justify-center gap-8">
        {/* Bid Speed */}
        <div className="space-y-2">
          <div className="flex justify-between items-end">
            <span className="text-xs font-bold text-secondary uppercase tracking-tighter">Bid Velocity (Buy Pressure)</span>
            <span className="text-2xl font-black text-secondary tabular-nums">{bidPressure}%</span>
          </div>
          <div className="w-full h-4 bg-surface-container-low rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-secondary/40 to-secondary shadow-[0_0_15px_rgba(74,225,118,0.4)] transition-all duration-500" 
              style={{ width: `${bidPressure}%` }}
            ></div>
          </div>
          <div className="text-[10px] text-outline italic">
            {bidPressure > 60 ? 'Strong buying momentum' : bidPressure > 40 ? 'Balanced market flow' : 'Weak buying pressure'}
          </div>
        </div>
        
        {/* Ask Speed */}
        <div className="space-y-2">
          <div className="flex justify-between items-end">
            <span className="text-xs font-bold text-error uppercase tracking-tighter">Ask Velocity (Sell Pressure)</span>
            <span className="text-2xl font-black text-error tabular-nums">{askPressure}%</span>
          </div>
          <div className="w-full h-4 bg-surface-container-low rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-error/40 to-error shadow-[0_0_15px_rgba(255,180,171,0.2)] transition-all duration-500" 
              style={{ width: `${askPressure}%` }}
            ></div>
          </div>
          <div className="text-[10px] text-outline italic">
            {askPressure > 60 ? 'Heavy distribution detected' : askPressure > 40 ? 'Normal selling activity' : 'Minimal selling pressure'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderBookVelocity;
