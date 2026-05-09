import React from 'react';
import { Link } from 'react-router-dom';
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

const NewsPulse = () => {
  const { news, loading } = useNews();
  const displayNews = news.slice(0, 3);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold tracking-tight">Market Pulse News</h3>
        <Link to="/news" className="text-sm text-primary font-semibold hover:underline">View All Feed</Link>
      </div>
      
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="block glass-panel inner-stroke rounded-xl p-5 animate-pulse">
              <div className="flex items-start justify-between mb-3">
                <div className="h-4 w-24 bg-surface-container-highest rounded"></div>
                <div className="h-3 w-16 bg-surface-container-highest rounded"></div>
              </div>
              <div className="h-5 w-full bg-surface-container-highest rounded mb-2"></div>
              <div className="h-5 w-3/4 bg-surface-container-highest rounded mb-3"></div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-surface-container-highest"></div>
                <div className="h-3 w-20 bg-surface-container-highest rounded"></div>
              </div>
            </div>
          ))}
        </div>
      ) : displayNews.length === 0 ? (
        <div className="text-center text-sm text-on-surface-variant py-8">No recent news available.</div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayNews.map((newsItem, i) => {
          let sentimentLabel = "Neutral Sentiment";
          let sentimentCls = "bg-on-surface-variant/10 text-on-surface-variant";
          let dotCls = "bg-on-surface-variant";
          
          if (newsItem.sentiment === "bullish" || newsItem.sentiment === "positive") {
            sentimentLabel = "Bullish Sentiment";
            sentimentCls = "bg-secondary/10 text-secondary";
            dotCls = "bg-secondary";
          } else if (newsItem.sentiment === "bearish" || newsItem.sentiment === "negative") {
            sentimentLabel = "Bearish Sentiment";
            sentimentCls = "bg-error/10 text-error";
            dotCls = "bg-error";
          }

          return (
            <a key={i} href={newsItem.url} target="_blank" rel="noopener noreferrer" className="block glass-panel inner-stroke rounded-xl p-5 hover:bg-surface-container-high transition-colors cursor-pointer outline-none focus:ring-2 focus:ring-primary">
              <div className="flex items-start justify-between mb-3">
                <span className={`${sentimentCls} text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider`}>
                  {sentimentLabel}
                </span>
                <span className="text-[10px] text-on-surface-variant">{formatTimeAgo(newsItem.published_at || new Date().toISOString())}</span>
              </div>
              
              <h4 className="font-bold text-base leading-tight mb-3 line-clamp-3">
                {newsItem.title}
              </h4>
              
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${dotCls}`}></div>
                <span className="text-xs text-on-surface-variant">{newsItem.source || 'Market News'} • {(newsItem.related_tickers || []).join(', ')}</span>
              </div>
            </a>
          );
        })}
      </div>
      )}
    </section>
  );
};

export default NewsPulse;
