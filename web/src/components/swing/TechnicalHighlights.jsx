import React from 'react';

const mockHighlights = [
  { ticker: 'BBCA', perf: '+1.2%', isGain: true, color: 'secondary', icon: 'trending_up', signal: 'Bullish MA 20', pathType: 'up' },
  { ticker: 'ADRO', perf: '+0.8%', isGain: true, color: 'secondary', icon: 'show_chart', signal: 'MACD Signal', pathType: 'curve' },
  { ticker: 'GOTO', perf: '-2.4%', isGain: false, color: 'error', icon: 'info', signal: 'RSI Oversold', pathType: 'down' },
  { ticker: 'TLKM', perf: '+0.5%', isGain: true, color: 'secondary', icon: 'analytics', signal: 'Volume Spike', pathType: 'jagged' },
  { ticker: 'AMRT', perf: '+3.1%', isGain: true, color: 'secondary', icon: 'bolt', signal: 'Breakout Ready', pathType: 'steep' },
  { ticker: 'MEDC', perf: '+0.1%', isGain: true, color: 'secondary', icon: 'equalizer', signal: 'Base Building', pathType: 'flat' }
];

const renderPath = (type, hex) => {
  switch (type) {
    case 'up': return <path d="M0 35 Q 20 10, 40 25 T 80 15 T 100 5" fill="none" stroke={hex} strokeWidth="2" />;
    case 'curve': return <path d="M0 25 Q 25 35, 50 15 T 100 10" fill="none" stroke={hex} strokeWidth="2" />;
    case 'down': return <path d="M0 5 Q 30 10, 60 30 T 100 38" fill="none" stroke={hex} strokeWidth="2" />;
    case 'jagged': return <path d="M0 30 L 20 25 L 40 28 L 60 20 L 80 22 L 100 12" fill="none" stroke={hex} strokeWidth="2" />;
    case 'steep': return <path d="M0 38 L 50 20 L 100 2" fill="none" stroke={hex} strokeWidth="2" />;
    case 'flat': return <path d="M0 20 L 25 18 L 50 22 L 75 19 L 100 15" fill="none" stroke={hex} strokeWidth="2" />;
    default: return null;
  }
};

const getCircyCy = (type) => {
    switch(type) {
        case 'up': return 5;
        case 'curve': return 10;
        case 'down': return 38;
        case 'jagged': return 12;
        case 'steep': return 2;
        case 'flat': return 15;
        default: return 20;
    }
}

const TechnicalHighlights = () => {
  return (
    <div className="mt-12">
      <h3 className="font-bold text-xl mb-6 flex items-center gap-2">
        Technical Highlights
        <span className="text-xs font-medium text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">Live Signals</span>
      </h3>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {mockHighlights.map((hl) => {
          const hex = hl.color === 'secondary' ? '#4ae176' : '#ffb4ab';
          return (
            <div key={hl.ticker} className="bg-surface-container rounded-xl p-4 border border-outline-variant/5">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-bold tabular-nums">{hl.ticker}</span>
                <span className={`text-[10px] font-bold text-${hl.color}`}>{hl.perf}</span>
              </div>
              
              <div className="h-16 w-full relative">
                <div className={`absolute inset-0 bg-gradient-to-t from-${hl.color}/5 to-transparent rounded`}></div>
                <svg className="w-full h-full overflow-visible" viewBox="0 0 100 40">
                  {renderPath(hl.pathType, hex)}
                  <circle cx="100" cy={getCircyCy(hl.pathType)} fill={hex} r="2"></circle>
                </svg>
              </div>
              
              <div className="mt-2 text-[10px] text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">{hl.icon}</span>
                {hl.signal}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TechnicalHighlights;
