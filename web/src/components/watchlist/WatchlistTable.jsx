import React from 'react';

const mockWatchlist = [
  {
    ticker: 'JPM', name: 'JPMorgan Chase & Co.', price: '198.42',
    chg: '+1.42%', chgColor: 'text-secondary', vol: '8.2M',
    alertType: 'triggered', alertBg: 'bg-error-container/20 text-error', alertDot: 'bg-error animate-pulse', alertPrice: '@ 195.00'
  },
  {
    ticker: 'BAC', name: 'Bank of America Corp.', price: '39.14',
    chg: '-0.85%', chgColor: 'text-error', vol: '12.4M',
    alertType: 'active', alertBg: 'bg-secondary-container/10 text-secondary-fixed-dim', alertDot: 'bg-secondary', alertPrice: '> 42.50'
  },
  {
    ticker: 'GS', name: 'Goldman Sachs Group', price: '452.18',
    chg: '+2.11%', chgColor: 'text-secondary', vol: '2.1M',
    alertType: 'active', alertBg: 'bg-secondary-container/10 text-secondary-fixed-dim', alertDot: 'bg-secondary', alertPrice: '< 440.00'
  }
];

const WatchlistTable = () => {
  return (
    <div className="col-span-12 lg:col-span-8 bg-surface-container-low rounded-2xl overflow-hidden shadow-sm">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-surface-container-high/30">
            <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Ticker</th>
            <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">Last</th>
            <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">Chg%</th>
            <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">Vol</th>
            <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Alert Status</th>
            <th className="px-6 py-4"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/10">
          {mockWatchlist.map((row) => (
            <tr key={row.ticker} className="hover:bg-surface-container-high/40 transition-colors group">
              <td className="px-6 py-5">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded bg-surface-container-highest flex items-center justify-center text-[10px] font-bold text-primary">{row.ticker}</div>
                  <div>
                    <p className="font-bold text-blue-100 tabular-nums">{row.ticker}</p>
                    <p className="text-[10px] text-on-surface-variant">{row.name}</p>
                  </div>
                </div>
              </td>
              <td className="px-6 py-5 text-right font-medium tabular-nums text-on-surface">{row.price}</td>
              <td className={`px-6 py-5 text-right font-medium tabular-nums ${row.chgColor}`}>{row.chg}</td>
              <td className="px-6 py-5 text-right tabular-nums text-on-surface-variant text-sm">{row.vol}</td>
              <td className="px-6 py-5">
                <div className={`flex items-center space-x-2 px-3 py-1 rounded-sm ${row.alertBg} w-fit`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${row.alertDot}`}></span>
                  <span className="text-[10px] font-bold uppercase tracking-wider">{row.alertType}</span>
                  <span className="text-[10px] opacity-70 tabular-nums">{row.alertPrice}</span>
                </div>
              </td>
              <td className="px-6 py-5 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="material-symbols-outlined text-on-surface-variant hover:text-primary">more_vert</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default WatchlistTable;
