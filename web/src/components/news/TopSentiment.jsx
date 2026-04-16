import React from 'react';

const mockSentiments = [
  {
    sentiment: 'Negatif', sentimentClass: 'bg-error-container text-on-error-container',
    time: '45m ago', title: 'Tekanan Jual Melanda Saham Teknologi Global, GOTO Ikut Terdampak',
    source: 'Bloomberg', tag: '#GOTO'
  },
  {
    sentiment: 'Netral', sentimentClass: 'bg-surface-container-highest text-on-surface-variant',
    time: '1h ago', title: 'BI Tahan Suku Bunga di 6%, Fokus pada Stabilitas Rupiah Selama Ketidakpastian',
    source: 'Reuters', tag: '#Macro'
  },
  {
    sentiment: 'Positif', sentimentClass: 'bg-secondary-container text-on-secondary-container',
    time: '2h ago', title: 'Ekspansi Luar Negeri, TLKM Resmi Gandeng Raksasa Cloud Silicon Valley',
    source: 'Kontan', tag: '#TLKM'
  }
];

const TopSentiment = () => {
  return (
    <div className="lg:col-span-4 space-y-6">
      <div className="flex items-center justify-between px-2">
        <h4 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">Top Sentiment</h4>
        <span className="material-symbols-outlined text-blue-400 text-sm">trending_up</span>
      </div>
      
      <div className="space-y-4">
        {mockSentiments.map((item, idx) => (
          <div key={idx} className="p-4 rounded-xl bg-surface-container-high border border-outline-variant/10 hover:bg-surface-container-highest transition-all group cursor-pointer">
            <div className="flex justify-between items-start mb-2">
              <span className={`${item.sentimentClass} text-[9px] font-bold px-2 py-0.5 rounded-sm uppercase`}>{item.sentiment}</span>
              <span className="text-[10px] text-on-surface-variant tabular-nums">{item.time}</span>
            </div>
            <h5 className="font-semibold text-sm leading-snug group-hover:text-blue-400 transition-colors">{item.title}</h5>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[11px] font-bold text-blue-400">{item.source}</span>
              <span className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 bg-surface-container-low rounded">{item.tag}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TopSentiment;
