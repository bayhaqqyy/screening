import React from 'react';

const mockScalpingData = [
  {
    ticker: 'ADRO', name: 'Adaro Energy', lastPrice: '3,640', chg: '+4.12%', vol: '142.5', freq: '12,402',
    isGain: true, initial: 'A', bgCls: 'bg-primary-container/20', txtCls: 'text-primary',
    spikeLvl: 2, spikeText: '3.2x RATIO', spikeCls: 'text-tertiary',
    trendConfig: [
      { width: 'w-1', bg: 'bg-secondary/20', h: 'h-1/2' },
      { width: 'w-1', bg: 'bg-secondary/30', h: 'h-3/4' },
      { width: 'w-1', bg: 'bg-secondary/40', h: 'h-2/3' },
      { width: 'w-1', bg: 'bg-secondary/60', h: 'h-full' },
      { width: 'w-1', bg: 'bg-secondary', h: 'h-5/6' },
    ]
  },
  {
    ticker: 'GOTO', name: 'GoTo Gojek Toko', lastPrice: '64', chg: '-2.35%', vol: '2,450.1', freq: '45,190',
    isGain: false, initial: 'G', bgCls: 'bg-error-container/20', txtCls: 'text-error', lastPriceBg: 'bg-error-container/10',
    spikeLvl: 0, spikeText: 'NORMAL', spikeCls: 'text-outline',
    trendConfig: [
      { width: 'w-1', bg: 'bg-error/20', h: 'h-full' },
      { width: 'w-1', bg: 'bg-error/40', h: 'h-3/4' },
      { width: 'w-1', bg: 'bg-error/60', h: 'h-2/3' },
      { width: 'w-1', bg: 'bg-error/80', h: 'h-1/2' },
      { width: 'w-1', bg: 'bg-error', h: 'h-1/4' },
    ]
  },
  {
    ticker: 'BBRI', name: 'Bank Rakyat Indonesia', lastPrice: '5,150', chg: '+1.85%', vol: '89.2', freq: '22,105',
    isGain: true, initial: 'B', bgCls: 'bg-primary-container/20', txtCls: 'text-primary', lastPriceBg: 'bg-secondary-container/10',
    spikeLvl: 3, spikeText: 'VOL SHOCK', spikeCls: 'text-tertiary animate-pulse',
    trendConfig: [
      { width: 'w-1', bg: 'bg-secondary/10', h: 'h-1/4' },
      { width: 'w-1', bg: 'bg-secondary/20', h: 'h-1/4' },
      { width: 'w-1', bg: 'bg-secondary/40', h: 'h-2/4' },
      { width: 'w-1', bg: 'bg-secondary/60', h: 'h-3/4' },
      { width: 'w-1', bg: 'bg-secondary', h: 'h-full' },
    ]
  }
];

const ScalpingTable = () => {
  return (
    <div className="glass-panel rounded-xl overflow-hidden mt-6">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-surface-container-high/50 text-[10px] font-bold uppercase tracking-widest text-outline">
            <th className="px-6 py-4">Ticker</th>
            <th className="px-4 py-4">Last Price</th>
            <th className="px-4 py-4 text-right">Chg%</th>
            <th className="px-4 py-4 text-right">Vol (M)</th>
            <th className="px-4 py-4 text-right">Freq</th>
            <th className="px-4 py-4">Spike Status</th>
            <th className="px-6 py-4 text-right">Trend</th>
          </tr>
        </thead>
        <tbody className="text-sm tabular-nums">
          {mockScalpingData.map((data) => (
            <tr key={data.ticker} className="group hover:bg-surface-container-high transition-colors cursor-pointer border-b border-outline-variant/10">
              <td className="px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${data.bgCls} ${data.txtCls}`}>
                    {data.initial}
                  </div>
                  <div>
                    <div className="font-bold text-on-surface">{data.ticker}</div>
                    <div className="text-[10px] text-outline">{data.name}</div>
                  </div>
                </div>
              </td>
              <td className={`px-4 py-5 font-semibold ${data.lastPriceBg ? data.txtCls : ''} ${data.lastPriceBg || ''}`}>
                {data.lastPrice}
              </td>
              <td className="px-4 py-5 text-right">
                <span className={`${data.isGain ? 'bg-secondary-container/20 text-secondary-fixed-dim' : 'bg-error-container/20 text-error'} px-2 py-0.5 rounded text-xs font-bold`}>
                  {data.chg}
                </span>
              </td>
              <td className="px-4 py-5 text-right text-on-surface-variant">{data.vol}</td>
              <td className="px-4 py-5 text-right text-on-surface-variant">{data.freq}</td>
              <td className="px-4 py-5">
                <div className={`flex items-center gap-1 ${data.spikeLvl > 0 ? 'text-tertiary' : 'text-outline'}`}>
                  {data.spikeLvl === 0 && (
                     <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>local_fire_department</span>
                  )}
                  {data.spikeLvl > 0 && Array.from({ length: 3 }).map((_, i) => (
                      <span key={i} className={`material-symbols-outlined text-sm ${data.spikeLvl === 3 ? 'animate-pulse' : ''}`} style={{ fontVariationSettings: `'FILL' ${i < data.spikeLvl ? 1 : 0}` }}>
                        local_fire_department
                      </span>
                  ))}
                  <span className={`text-[10px] font-bold ml-1 ${data.spikeLvl === 3 ? 'animate-pulse' : ''}`}>{data.spikeText}</span>
                </div>
              </td>
              <td className="px-6 py-5 text-right">
                <div className="flex justify-end">
                  <div className="w-24 h-6 flex items-end gap-[1px]">
                    {data.trendConfig.map((col, idx) => (
                       <div key={idx} className={`${col.width} ${col.bg} ${col.h}`}></div>
                    ))}
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ScalpingTable;
