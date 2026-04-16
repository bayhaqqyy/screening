import React from 'react';

const MarketStatus = () => {
  return (
    <div className="bg-surface-container-high rounded-xl p-5 w-full md:w-80 shadow-2xl shadow-black/20 border border-outline-variant/5">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-bold text-on-surface-variant tracking-wider uppercase">Sesi 2 — Market Closing</span>
        <span className="text-xs font-black tabular-nums text-primary">Closing in 47:12</span>
      </div>
      <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
        <div className="h-full bg-primary w-[75%] shadow-[0_0_12px_rgba(173,198,255,0.4)]"></div>
      </div>
      <p className="text-[10px] mt-2 text-outline text-right font-medium">Accumulation window peaks in 15 mins</p>
    </div>
  );
};

export default MarketStatus;
