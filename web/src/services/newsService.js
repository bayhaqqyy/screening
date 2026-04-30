import { api } from './api';

export const newsService = {
  getNews: (limit = 20, sentiment = '') => {
    let url = `/news?limit=${limit}`;
    if (sentiment) url += `&sentiment=${sentiment}`;
    return api.get(url);
  },
  getFeaturedNews: () => api.get('/news/featured'),
};
