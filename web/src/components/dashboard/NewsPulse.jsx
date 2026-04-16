import React from 'react';

const mockNews = [
  {
    sentiment: 'Bullish Sentiment',
    sentimentCls: 'bg-secondary/10 text-secondary',
    time: '15m ago',
    title: 'BBCA Announces Dividend of Rp 225/share, Ex-date scheduled for next Friday',
    tags: 'Financials • Corporate Action',
    dotCls: 'bg-primary'
  },
  {
    sentiment: 'Neutral Sentiment',
    sentimentCls: 'bg-on-surface-variant/10 text-on-surface-variant',
    time: '42m ago',
    title: 'OJK Issues New Guidelines for Digital Banking Capital Adequacy Ratios',
    tags: 'Regulatory • Macro',
    dotCls: 'bg-on-surface-variant'
  },
  {
    sentiment: 'Bearish Sentiment',
    sentimentCls: 'bg-error/10 text-error',
    time: '1h ago',
    title: 'Commodity Slump: PTBA and ADRO See Selling Pressure as Coal Prices Dip',
    tags: 'Mining • Commodities',
    dotCls: 'bg-error'
  }
];

const NewsPulse = () => {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold tracking-tight">Market Pulse News</h3>
        <button className="text-sm text-primary font-semibold hover:underline">View All Feed</button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockNews.map((news, i) => (
          <div key={i} className="glass-panel inner-stroke rounded-xl p-5 hover:bg-surface-container-high transition-colors cursor-pointer">
            <div className="flex items-start justify-between mb-3">
              <span className={`${news.sentimentCls} text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider`}>
                {news.sentiment}
              </span>
              <span className="text-[10px] text-on-surface-variant">{news.time}</span>
            </div>
            
            <h4 className="font-bold text-base leading-tight mb-3">
              {news.title}
            </h4>
            
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${news.dotCls}`}></div>
              <span className="text-xs text-on-surface-variant">{news.tags}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default NewsPulse;
