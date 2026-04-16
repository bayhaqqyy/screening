import React from 'react';

const mockCandidates = [
  { ticker: 'BBCA', name: 'Bank Central Asia', signal: 'MA 20 CROSS 50', price: '9,850.00', target: '10,400.00', rr: '1:3.4' },
  { ticker: 'ADRO', name: 'Adaro Energy Indonesia', signal: 'Bullish Divergence', price: '2,640.00', target: '2,850.00', rr: '1:2.8' },
  { ticker: 'GOTO', name: 'GoTo Gojek Tokopedia', signal: 'Oversold RSI', price: '68.00', target: '82.00', rr: '1:4.1' },
  { ticker: 'TLKM', name: 'Telkom Indonesia', signal: 'Cup & Handle Breakout', price: '3,980.00', target: '4,350.00', rr: '1:2.2' }
];

const SwingTable = () => {
  return (
    <div className="xl:col-span-3">
      <div className="bg-surface-container-high rounded-xl overflow-hidden">
        <div className="px-6 py-4 flex justify-between items-center bg-surface-container-highest/30">
          <h3 className="font-bold text-lg">Swing Candidates</h3>
          <div className="flex gap-4 text-xs font-medium text-on-surface-variant">
            <span>Showing 24 Results</span>
            <span className="material-symbols-outlined text-sm cursor-pointer hover:text-on-surface transition-colors">download</span>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-on-surface-variant font-black border-b border-outline-variant/10">
                <th className="px-6 py-4">Ticker</th>
                <th className="px-6 py-4">Signal</th>
                <th className="px-6 py-4">Current Price</th>
                <th className="px-6 py-4">Target</th>
                <th className="px-6 py-4">R/R Ratio</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {mockCandidates.map((row) => (
                <tr key={row.ticker} className="hover:bg-surface-container-low transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-blue-100 tabular-nums">{row.ticker}</span>
                      <span className="text-[10px] text-on-surface-variant">{row.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-secondary-container/20 text-secondary text-[10px] font-bold rounded-sm uppercase tracking-tighter">
                      {row.signal}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium tabular-nums">{row.price}</td>
                  <td className="px-6 py-4 font-medium tabular-nums text-secondary">{row.target}</td>
                  <td className="px-6 py-4 tabular-nums">{row.rr}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="opacity-0 group-hover:opacity-100 bg-primary/10 text-primary hover:bg-primary hover:text-on-primary text-[10px] font-bold py-1 px-3 rounded-full transition-all uppercase">
                      Watch
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SwingTable;
