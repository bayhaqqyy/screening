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

const MarketDeepDive = ({ activeFilter = 'Semua' }) => {
  const { news, loading } = useNews();

  const filteredNews = news.filter(item => {
    if (activeFilter === 'Semua') return true;
    
    let sentiment = 'Netral';
    if (item.sentiment === "bullish" || item.sentiment === "positive") sentiment = 'Positif';
    if (item.sentiment === "bearish" || item.sentiment === "negative") sentiment = 'Negatif';
    
    return sentiment === activeFilter;
  });

  return (
    <section className="space-y-6 pt-4">
      <div className="flex items-center justify-between border-b border-outline-variant/20 pb-4">
        <h3 className="text-xl font-bold tracking-tight">Market Deep Dive</h3>
        <button className="text-sm font-semibold text-blue-400 hover:underline">View All Archive</button>
      </div>
      
      {loading ? (
        <div className="text-center text-sm text-on-surface-variant py-8">Loading deep dive articles...</div>
      ) : filteredNews.length === 0 ? (
        <div className="text-center text-sm text-on-surface-variant py-8">No articles found.</div>
      ) : (
      <div className="space-y-3">
        {filteredNews.map((newsItem, idx) => {
          const title = newsItem.title;
          const link = newsItem.url;
          // Summary might not be available from our current backend
          const desc = newsItem.summary || ''; 
          const source = `${newsItem.source || 'Market'} • ${formatTimeAgo(newsItem.published_at || new Date().toISOString())}`;
          
          let sentimentLabel = "Neutral";
          let sentimentClass = "bg-on-surface-variant/10 text-on-surface-variant";
          
          if (newsItem.sentiment === "bullish" || newsItem.sentiment === "positive") {
            sentimentLabel = "Bullish";
            sentimentClass = "bg-secondary-container text-on-secondary-container";
          } else if (newsItem.sentiment === "bearish" || newsItem.sentiment === "negative") {
            sentimentLabel = "Bearish";
            sentimentClass = "bg-error-container text-on-error-container";
          }

          const tags = newsItem.related_tickers || [];
          // Use default image as backend currently doesn't scrape images
          const image = 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=500&auto=format&fit=crop&q=60';

          return (
          <a key={idx} href={link} target="_blank" rel="noopener noreferrer" className="block glass-panel p-5 rounded-xl border border-outline-variant/10 flex flex-col md:flex-row gap-6 items-center hover:bg-surface-container-high/40 transition-colors cursor-pointer group outline-none focus:ring-2 focus:ring-primary">
            <div className="w-full md:w-48 h-32 rounded-lg overflow-hidden shrink-0">
              <img className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="news thumbnail" src={image} />
            </div>
            
            <div className="flex-1 space-y-2">
              <div className="flex items-center space-x-3">
                <span className={`${sentimentClass} text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase`}>{sentimentLabel}</span>
                <span className="text-[11px] text-on-surface-variant font-medium">{source}</span>
              </div>
              <h4 className="text-lg font-bold group-hover:text-blue-400 transition-colors">{title}</h4>
              {desc && <p className="text-sm text-on-surface-variant line-clamp-2" dangerouslySetInnerHTML={{ __html: desc }}></p>}
              <div className="flex gap-2 pt-1">
                {tags.map(tag => (
                  <span key={tag} className="text-[10px] font-bold tabular-nums px-2 py-0.5 bg-surface-container-lowest rounded-full border border-outline-variant/30">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            
            <div className="hidden md:block shrink-0 px-4">
              <span className="material-symbols-outlined text-outline group-hover:translate-x-1 group-hover:text-blue-400 transition-all">arrow_forward_ios</span>
            </div>
          </a>
          );
        })}
      </div>
      )}
    </section>
  );
};

export default MarketDeepDive;
