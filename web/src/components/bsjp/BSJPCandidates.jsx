import React from 'react';

const mockBSJP = [
  {
    ticker: 'BBCA', price: '10,250', dip: '-0.24%', accum: 'w-[88%]', broker: 'AK, BK, CC', 
    score: 94, scoreColor: 'bg-secondary-container text-on-secondary-container',
    dotColor: 'bg-secondary shadow-[0_0_8px_rgba(74,225,118,0.4)]', accumColor: 'bg-secondary'
  },
  {
    ticker: 'TLKM', price: '2,840', dip: '-1.10%', accum: 'w-[72%]', broker: 'YP, MS', 
    score: 81, scoreColor: 'bg-tertiary-container text-on-tertiary-container',
    dotColor: 'bg-secondary shadow-[0_0_8px_rgba(74,225,118,0.4)]', accumColor: 'bg-secondary'
  },
  {
    ticker: 'GOTO', price: '52', dip: '-0.00%', accum: 'w-[95%]', broker: 'CC, NI, YP', 
    score: 98, scoreColor: 'bg-secondary-container text-on-secondary-container',
    dotColor: 'bg-secondary shadow-[0_0_8px_rgba(74,225,118,0.4)]', accumColor: 'bg-secondary',
    rowClass: 'bg-surface-container-high border-l-2 border-primary'
  },
  {
    ticker: 'ASII', price: '5,125', dip: '-0.48%', accum: 'w-[54%]', broker: 'BK, KZ', 
    score: 64, scoreColor: 'bg-surface-container-highest text-outline',
    dotColor: 'bg-tertiary shadow-[0_0_8px_rgba(255,185,95,0.4)]', accumColor: 'bg-tertiary'
  }
];

const BSJPCandidates = () => {
  return (
    <div className="bg-surface-container-low rounded-xl overflow-hidden shadow-xl">
      <div className="px-6 py-4 flex justify-between items-center bg-surface-container/50">
        <h3 className="font-bold text-on-surface">BSJP Candidates</h3>
        <div className="flex gap-2">
          <button className="text-xs px-3 py-1 bg-surface-container-highest text-primary rounded-lg font-bold">Auto-Refresh</button>
          <button className="text-xs px-3 py-1 text-on-surface-variant hover:text-white transition-colors font-medium">Export CSV</button>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-separate border-spacing-0">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-outline border-b border-outline-variant/10">
              <th className="px-6 py-4 font-bold">Ticker</th>
              <th className="px-6 py-4 font-bold text-right">Last Price</th>
              <th className="px-6 py-4 font-bold text-right">Dip%</th>
              <th className="px-6 py-4 font-bold">Late Accum</th>
              <th className="px-6 py-4 font-bold">Top Broker</th>
              <th className="px-6 py-4 font-bold text-right">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/5">
            {mockBSJP.map((item) => (
              <tr key={item.ticker} className={`group hover:bg-surface-container-high transition-colors cursor-pointer ${item.rowClass || ''}`}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${item.dotColor}`}></div>
                    <span className="font-bold text-on-surface tracking-tight tabular-nums">{item.ticker}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right tabular-nums font-semibold">{item.price}</td>
                <td className={`px-6 py-4 text-right tabular-nums font-medium ${item.ticker === 'ASII' ? 'text-on-surface-variant' : 'text-secondary'}`}>
                  {item.dip}
                </td>
                <td className="px-6 py-4">
                  <div className="w-24 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                    <div className={`h-full ${item.accumColor} ${item.accum}`}></div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-xs bg-outline-variant/20 px-2 py-0.5 rounded tabular-nums">{item.broker}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className={`px-3 py-1 rounded font-black text-xs ${item.scoreColor}`}>
                    {item.score}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BSJPCandidates;
