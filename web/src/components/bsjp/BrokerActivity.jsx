import React, { useState, useEffect } from 'react';

const BrokerActivity = () => {
  const [brokers, setBrokers] = useState([]);

  useEffect(() => {
    const brokerMap = {};

    const handleFlow = (event) => {
      const msg = event.detail;
      const data = msg.data;
      if (!data || !data.top_buyers) return;

      // Accumulate buyer activity
      data.top_buyers.forEach(code => {
        if (!brokerMap[code]) {
          brokerMap[code] = { code, netBuy: 0, hits: 0 };
        }
        brokerMap[code].netBuy += Math.abs(data.net_volume || 0);
        brokerMap[code].hits += 1;
      });

      // Convert to sorted array (top 5 by netBuy)
      const sorted = Object.values(brokerMap)
        .sort((a, b) => b.netBuy - a.netBuy)
        .slice(0, 5);

      setBrokers(sorted);
    };

    window.addEventListener('ws_idx.bandar.flow', handleFlow);

    return () => {
      window.removeEventListener('ws_idx.bandar.flow', handleFlow);
    };
  }, []);

  const formatNet = (val) => {
    if (val >= 1e9) return `${(val / 1e9).toFixed(1)}B`;
    if (val >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
    if (val >= 1e3) return `${(val / 1e3).toFixed(0)}K`;
    return val.toString();
  };

  const brokerNames = {
    'YP': 'Mirae Asset', 'CC': 'Mandiri Sek.', 'PD': 'Kresna Sek.',
    'NI': 'BNI Sek.', 'AZ': 'Ajaib Sek.', 'MG': 'MNC Sek.',
    'DR': 'RHB Sek.', 'BK': 'BCA Sek.', 'AK': 'Panin Sek.',
    'ZP': 'Zurich Sek.', 'CS': 'Credit Suisse', 'RX': 'Macquarie',
    'YU': 'Philip Sek.', 'KZ': 'KGI Sek.'
  };

  return (
    <div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/5 shadow-xl">
      <div className="flex justify-between items-center mb-6">
        <h4 className="font-bold text-on-surface text-sm">Top Brokers (Live)</h4>
        <span className="flex items-center gap-1.5">
          {brokers.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>}
          <span className="text-[10px] font-black text-secondary uppercase">
            {brokers.length > 0 ? 'Active Flow' : 'Waiting...'}
          </span>
        </span>
      </div>
      
      <div className="space-y-4">
        {brokers.length === 0 ? (
          <div className="text-center text-sm text-on-surface-variant py-4">
            Waiting for broker flow data...
          </div>
        ) : (
          brokers.map((broker) => (
            <div key={broker.code} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-surface-container-highest flex items-center justify-center text-[10px] font-bold text-primary">
                  {broker.code}
                </div>
                <div>
                  <span className="text-xs font-bold text-on-surface block">{brokerNames[broker.code] || broker.code}</span>
                  <span className="text-[10px] text-on-surface-variant">Net Buy: {formatNet(broker.netBuy)}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-black tabular-nums text-secondary">{broker.hits} hits</span>
              </div>
            </div>
          ))
        )}
      </div>
      
      <button className="w-full mt-6 py-2 rounded-lg border border-outline-variant/20 text-[10px] font-bold uppercase tracking-widest text-outline hover:bg-surface-container-highest transition-colors">
        View All Brokers
      </button>
    </div>
  );
};

export default BrokerActivity;
