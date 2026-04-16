import React from 'react';

const AccumulationChart = () => {
  return (
    <div className="bg-surface-container-low rounded-xl p-6 shadow-xl border border-outline-variant/5">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <span className="material-symbols-outlined text-primary">monitoring</span>
          </div>
          <div>
            <h4 className="font-bold text-on-surface">Intraday Accumulation: GOTO</h4>
            <p className="text-xs text-on-surface-variant">Real-time volume surge vs price action</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-outline font-bold uppercase tracking-wider block">Est. Gap-up</span>
          <span className="text-secondary font-black tabular-nums">+3.8%</span>
        </div>
      </div>
      
      {/* Mock Chart Area */}
      <div className="relative h-48 w-full mt-4">
        <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 40">
          {/* Grid */}
          <line stroke="rgba(66, 71, 84, 0.2)" strokeWidth="0.2" x1="0" x2="100" y1="10" y2="10"></line>
          <line stroke="rgba(66, 71, 84, 0.2)" strokeWidth="0.2" x1="0" x2="100" y1="20" y2="20"></line>
          <line stroke="rgba(66, 71, 84, 0.2)" strokeWidth="0.2" x1="0" x2="100" y1="30" y2="30"></line>
          {/* Trace */}
          <path className="drop-shadow-[0_0_4px_rgba(74,225,118,0.6)]" d="M 0 35 Q 20 32, 40 34 T 60 30 T 80 15 T 100 5" fill="none" stroke="#4ae176" strokeWidth="1.5"></path>
          <path d="M 0 35 Q 20 32, 40 34 T 60 30 T 80 15 T 100 5 V 40 H 0 Z" fill="url(#chartGradient)"></path>
          <defs>
            <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#4ae176" stopOpacity="0.2"></stop>
              <stop offset="100%" stopColor="#4ae176" stopOpacity="0"></stop>
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute right-0 bottom-0 top-0 w-24 bg-primary/5 border-l border-primary/20 flex flex-col justify-center items-center text-center">
          <span className="text-[10px] text-primary font-black uppercase tracking-tighter">Golden Window</span>
          <span className="material-symbols-outlined text-primary text-lg">trending_up</span>
        </div>
      </div>
      <div className="flex justify-between mt-4 text-[10px] font-bold text-outline">
        <span>09:00</span>
        <span>12:00</span>
        <span>14:00</span>
        <span className="text-primary">15:50 (Closing)</span>
      </div>
    </div>
  );
};

export default AccumulationChart;
