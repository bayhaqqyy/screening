import React from 'react';
import { useNews } from '../../hooks/useNews';

const formatTimeAgo = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  return `${Math.floor(diffInHours / 24)}d ago`;
};

const TopSentiment = () => {
  const { news, loading } = useNews();
  // Filter for news that has non-neutral sentiment if possible, or just slice
  const sentimentNews = news.filter(n => n.sentiment === 'bullish' || n.sentiment === 'bearish' || n.sentiment === 'positive' || n.sentiment === 'negative').slice(0, 4);
  const displayNews = sentimentNews.length > 0 ? sentimentNews : news.slice(0, 3);

  return (
    <div className="lg:col-span-4 space-y-6">
      <div className="flex items-center justify-between px-2">
        <h4 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">Top Sentiment</h4>
        <span className="material-symbols-outlined text-blue-400 text-sm">trending_up</span>
      </div>
      
      {loading ? (
        <div className="text-center text-sm text-on-surface-variant py-8">Loading sentiment...</div>
      ) : displayNews.length === 0 ? (
        <div className="text-center text-sm text-on-surface-variant py-8">No sentiment data.</div>
      ) : (
      <div className="space-y-4">
        {displayNews.map((item, idx) => {
          let sentimentLabel = "Neutral";
          let sentimentClass = "bg-surface-container-highest text-on-surface-variant";
          
          if (item.sentiment === "bullish" || item.sentiment === "positive") {
            sentimentLabel = "Bullish";
            sentimentClass = "bg-secondary-container text-on-secondary-container";
          } else if (item.sentiment === "bearish" || item.sentiment === "negative") {
            sentimentLabel = "Bearish";
            sentimentClass = "bg-error-container text-on-error-container";
          }

          const tags = item.related_tickers || [];
          const primaryTag = tags.length > 0 ? tags[0] : '#Market';

          return (
          <a key={idx} href={item.url || item.link || '#'} target="_blank" rel="noopener noreferrer" className="block p-4 rounded-xl bg-surface-container-high border border-outline-variant/10 hover:bg-surface-container-highest transition-all group cursor-pointer outline-none focus:ring-2 focus:ring-primary">
            <div className="flex justify-between items-start mb-2">
              <span className={`${sentimentClass} text-[9px] font-bold px-2 py-0.5 rounded-sm uppercase`}>{sentimentLabel}</span>
              <span className="text-[10px] text-on-surface-variant tabular-nums">{formatTimeAgo(item.published_at || new Date().toISOString())}</span>
            </div>
            <h5 className="font-semibold text-sm leading-snug group-hover:text-blue-400 transition-colors line-clamp-2">{item.title}</h5>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[11px] font-bold text-blue-400 truncate w-24">{item.source || 'Market News'}</span>
              <span className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 bg-surface-container-low rounded">{primaryTag}</span>
            </div>
          </a>
          );
        })}
      </div>
      )}
    </div>
  );
};

export default TopSentiment;
