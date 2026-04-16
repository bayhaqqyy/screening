import React from 'react';

const mockBrokers = [
  { code: 'YP', name: 'Mirrae Asset', net: '24.5B', perf: '+12%' },
  { code: 'CC', name: 'Mandiri Sek.', net: '18.2B', perf: '+8%' },
  { code: 'MS', name: 'Morgan Stanley', net: '12.1B', perf: '+5%' }
];

const BrokerActivity = () => {
  return (
    <div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/5 shadow-xl">
      <div className="flex justify-between items-center mb-6">
        <h4 className="font-bold text-on-surface text-sm">Last 30m Brokers</h4>
        <span className="text-[10px] font-black text-secondary uppercase">Bullish Activity</span>
      </div>
      
      <div className="space-y-4">
        {mockBrokers.map((broker) => (
          <div key={broker.code} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-surface-container-highest flex items-center justify-center text-[10px] font-bold text-primary">
                {broker.code}
              </div>
              <div>
                <span className="text-xs font-bold text-on-surface block">{broker.name}</span>
                <span className="text-[10px] text-on-surface-variant">Net Buy: {broker.net}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-black tabular-nums text-secondary">{broker.perf}</span>
            </div>
          </div>
        ))}
      </div>
      
      <button className="w-full mt-6 py-2 rounded-lg border border-outline-variant/20 text-[10px] font-bold uppercase tracking-widest text-outline hover:bg-surface-container-highest transition-colors">
        View All Brokers
      </button>
    </div>
  );
};

export default BrokerActivity;
