import React, { useState, useEffect } from 'react';

const AccumulationChart = () => {
  const [topTicker, setTopTicker] = useState(null);
  const [dataPoints, setDataPoints] = useState([]);

  useEffect(() => {
    const handleFlow = (event) => {
      const msg = event.detail;
      const data = msg.data;
      if (!data || !data.ticker) return;

      // Track accumulation data points over time
      setDataPoints(prev => {
        const newPoint = {
          ticker: data.ticker,
          timestamp: Date.now(),
          netVolume: data.net_volume || 0,
          flowType: data.flow_type || 'Neutral'
        };
        const updated = [...prev, newPoint].slice(-30); // Keep last 30 data points
        return updated;
      });

      // Track the most frequently accumulated ticker
      if (data.flow_type === 'Accumulation') {
        setTopTicker(prev => {
          if (!prev || prev.ticker !== data.ticker) {
            return { ticker: data.ticker, score: 1 };
          }
          return { ...prev, score: prev.score + 1 };
        });
      }
    };

    window.addEventListener('ws_idx.bandar.flow', handleFlow);
    return () => window.removeEventListener('ws_idx.bandar.flow', handleFlow);
  }, []);

  // Generate SVG path from data points
  const generatePath = () => {
    if (dataPoints.length < 2) return '';
    
    const maxAbsVol = Math.max(...dataPoints.map(d => Math.abs(d.netVolume)), 1);
    const points = dataPoints.map((d, i) => {
      const x = (i / (dataPoints.length - 1)) * 100;
      // Normalize: accumulation pushes up, distribution pushes down
      const y = 20 - (d.netVolume / maxAbsVol) * 15;
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  };

  const path = generatePath();
  const displayTicker = topTicker?.ticker || 'Scanning...';
  const gapEstimate = dataPoints.length > 0
    ? (dataPoints.filter(d => d.netVolume > 0).length / Math.max(dataPoints.length, 1) * 5).toFixed(1)
    : '0.0';

  return (
    <div className="bg-surface-container-low rounded-xl p-6 shadow-xl border border-outline-variant/5">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <span className="material-symbols-outlined text-primary">monitoring</span>
          </div>
          <div>
            <h4 className="font-bold text-on-surface">
              Intraday Accumulation: {displayTicker}
            </h4>
            <p className="text-xs text-on-surface-variant">
              {dataPoints.length > 0 ? 'Real-time volume surge vs price action' : 'Waiting for flow data...'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-outline font-bold uppercase tracking-wider block">Est. Gap-up</span>
          <span className="text-secondary font-black tabular-nums">+{gapEstimate}%</span>
        </div>
      </div>
      
      {/* Dynamic Chart Area */}
      <div className="relative h-48 w-full mt-4">
        <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 40">
          {/* Grid */}
          <line stroke="rgba(66, 71, 84, 0.2)" strokeWidth="0.2" x1="0" x2="100" y1="10" y2="10"></line>
          <line stroke="rgba(66, 71, 84, 0.2)" strokeWidth="0.2" x1="0" x2="100" y1="20" y2="20"></line>
          <line stroke="rgba(66, 71, 84, 0.2)" strokeWidth="0.2" x1="0" x2="100" y1="30" y2="30"></line>
          
          {path && (
            <>
              <path className="drop-shadow-[0_0_4px_rgba(74,225,118,0.6)]" d={path} fill="none" stroke="#4ae176" strokeWidth="1.5" />
              <path d={`${path} V 40 H 0 Z`} fill="url(#chartGradientLive)" />
            </>
          )}
          
          {!path && (
            <text x="50" y="22" textAnchor="middle" fill="#8c909f" fontSize="3">
              Collecting data points...
            </text>
          )}
          
          <defs>
            <linearGradient id="chartGradientLive" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#4ae176" stopOpacity="0.2"></stop>
              <stop offset="100%" stopColor="#4ae176" stopOpacity="0"></stop>
            </linearGradient>
          </defs>
        </svg>
        
        {dataPoints.length > 5 && (
          <div className="absolute right-0 bottom-0 top-0 w-24 bg-primary/5 border-l border-primary/20 flex flex-col justify-center items-center text-center">
            <span className="text-[10px] text-primary font-black uppercase tracking-tighter">
              {parseFloat(gapEstimate) > 2 ? 'Golden Window' : 'Monitoring'}
            </span>
            <span className="material-symbols-outlined text-primary text-lg">
              {parseFloat(gapEstimate) > 2 ? 'trending_up' : 'show_chart'}
            </span>
          </div>
        )}
      </div>
      
      <div className="flex justify-between mt-4 text-[10px] font-bold text-outline">
        <span>{dataPoints.length} data points</span>
        <span className="text-primary">Live Stream</span>
      </div>
    </div>
  );
};

export default AccumulationChart;
