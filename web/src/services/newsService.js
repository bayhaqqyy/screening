import { api } from './api';

export const newsService = {
  // Fetch recent news. Optional filters:
  //   limit     — max rows to return (default 20)
  //   sentiment — 'Positive' | 'Negative' | 'Neutral'
  //   ticker    — IDX ticker to filter by (word-boundary match on title/description/tags)
  getNews: (limit = 20, sentiment = '', ticker = '') => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (sentiment) params.set('sentiment', sentiment);
    if (ticker) params.set('ticker', ticker);
    return api.get(`/news?${params.toString()}`);
  },
  getFeaturedNews: () => api.get('/news/featured'),
};
