import React, { useEffect, useState } from 'react';
import { newsService } from '../../services/newsService';

const FeaturedNews = () => {
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [healthInfo, setHealthInfo] = useState(null);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const res = await newsService.getFeatured();
        if (res.data) {
          setArticle(res.data);
        } else {
          const healthRes = await fetch('/api/news/health').then(r => r.json());
          setHealthInfo(healthRes);
        }
      } catch {
        try {
          const healthRes = await fetch('/api/news/health').then(r => r.json());
          setHealthInfo(healthRes);
        } catch (e) {
          setHealthInfo({ status: 'Error', message: 'Could not fetch health.' });
        }
      }
      finally { setLoading(false); }
    };
    fetchFeatured();
  }, []);

  if (loading) {
    return (
      <article className="lg:col-span-8 group relative rounded-xl overflow-hidden aspect-[16/9] lg:aspect-auto lg:h-[500px] bg-surface-container animate-pulse">
        <div className="absolute bottom-0 left-0 p-8 space-y-4 max-w-2xl">
          <div className="h-4 bg-surface-container-highest rounded w-24"></div>
          <div className="h-8 bg-surface-container-highest rounded w-96"></div>
          <div className="h-4 bg-surface-container-highest rounded w-64"></div>
        </div>
      </article>
    );
  }

  if (!article) {
    return (
      <article className="lg:col-span-8 group relative rounded-xl overflow-hidden aspect-[16/9] lg:aspect-auto lg:h-[500px] bg-surface-container flex flex-col items-center justify-center p-6 text-center border border-dashed border-outline-variant">
        <span className="text-on-surface-variant text-sm mb-4">No featured news available</span>
        {healthInfo && (
          <div className="text-xs text-on-surface-variant/80 bg-surface-container-highest p-4 rounded-lg text-left max-w-sm space-y-1">
            <p className="font-bold text-on-surface">Pipeline Diagnosis</p>
            <p>Status: {healthInfo.status}</p>
            <p>Message: {healthInfo.message}</p>
            {healthInfo.diagnosis && <p>Action: {healthInfo.diagnosis}</p>}
            {healthInfo.total_news !== undefined && <p>Total DB Records: {healthInfo.total_news}</p>}
          </div>
        )}
      </article>
    );
  }

  const sentimentLabel = article.sentiment || 'Netral';
  const sentimentCls = sentimentLabel.toLowerCase() === 'positif' || sentimentLabel.toLowerCase() === 'positive' 
    ? 'bg-secondary-container text-on-secondary-container' 
    : sentimentLabel.toLowerCase() === 'negatif' || sentimentLabel.toLowerCase() === 'negative'
    ? 'bg-error-container text-on-error-container'
    : 'bg-surface-container-highest text-on-surface-variant';

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  };

  const tags = article.related_tickers 
    ? (typeof article.related_tickers === 'string' ? article.related_tickers.split(',') : article.related_tickers)
    : [];

  return (
    <a href={article.link || article.url || '#'} target="_blank" rel="noopener noreferrer" className="lg:col-span-8 group relative rounded-xl overflow-hidden aspect-[16/9] lg:aspect-auto lg:h-[500px] block">
      {article.image_url ? (
        <img className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="featured news" src={article.image_url} />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-surface-container"></div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent"></div>
      <div className="absolute bottom-0 left-0 p-8 space-y-4 max-w-2xl">
        <div className="flex items-center space-x-3">
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-sm uppercase tracking-wider ${sentimentCls}`}>{sentimentLabel}</span>
          <span className="text-blue-400 text-sm font-semibold">{article.source || 'Market News'} • {formatTimeAgo(article.published_at)}</span>
        </div>
        <h3 className="text-3xl lg:text-4xl font-bold leading-tight tracking-tight">{article.title}</h3>
        <p className="text-on-surface-variant line-clamp-2">{article.description || article.summary || ''}</p>
        {tags.length > 0 && (
          <div className="flex gap-2">
            {tags.slice(0, 4).map((tag) => (
              <span key={tag} className="px-2 py-1 bg-white/10 backdrop-blur-md rounded text-[11px] font-bold tabular-nums tracking-wider uppercase">#{tag.trim()}</span>
            ))}
          </div>
        )}
      </div>
    </a>
  );
};

export default FeaturedNews;
