import { useState, useEffect } from 'react';
import { newsService } from '../services/newsService';

export const useNews = () => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        setLoading(true);
        const data = await newsService.getNews(10); // Fetch 10 latest news
        if (data) {
          setNews(data);
        }
      } catch (error) {
        console.error("Failed to fetch news:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();

    const handleWsUpdate = (event) => {
      const msg = event.detail;
      
      if (msg.topic === 'idx.news.updates') {
        setNews(prevNews => {
          let updated = [...prevNews];
          const newMsg = msg.data;
          
          if (!updated.some(n => n.url === newMsg.url)) {
            updated.unshift(newMsg);
          }
          
          return updated.slice(0, 20);
        });
      }
    };

    window.addEventListener(`ws_idx.news.updates`, handleWsUpdate);

    return () => {
      window.removeEventListener(`ws_idx.news.updates`, handleWsUpdate);
    };
  }, []);

  return { news, loading };
};
