import { useState, useEffect } from 'react';
import { screenerService } from '../services/screenerService';

export const useScreener = (strategy) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const parsePayload = (item) => {
      let payload = item.payload;
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch { payload = {}; }
      }
      return { ...item, payload: payload || {} };
    };

    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await screenerService.getResults(strategy);
        setData((result || []).map(parsePayload));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Now all strategies listen to the unified screener updates topic
    const targetTopic = 'idx.screener.updates';
    
    const handleWsUpdate = (event) => {
      const msg = event.detail;
      // msg data should exactly match ScreenerResult from backend
      const mappedItem = msg.data;
      
      // Filter out updates for other strategies
      if (!mappedItem || mappedItem.strategy !== strategy) return;
      
      setData(prevData => {
        let newData = [...prevData];
        const existingIdx = newData.findIndex(d => d.ticker === mappedItem.ticker);
        
        if (existingIdx >= 0) {
          newData[existingIdx] = { ...newData[existingIdx], ...mappedItem };
        } else {
          newData.push(mappedItem);
        }
        
        // Sort by score DESC
        newData.sort((a, b) => b.score - a.score);
        return newData.slice(0, 50); // Keep top 50
      });
    };

    window.addEventListener(`ws_${targetTopic}`, handleWsUpdate);

    return () => {
      window.removeEventListener(`ws_${targetTopic}`, handleWsUpdate);
    };
  }, [strategy]);

  return { data, loading, error };
};
