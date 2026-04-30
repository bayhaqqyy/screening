import { useState, useEffect } from 'react';
import { api } from '../services/api';

export const useScreener = (strategy) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fallback or dev mock logic here if needed, but normally:
        // const result = await api.get(`/screener/${strategy}`);
        // setData(result);
        
        // For now, to keep the UI from breaking while backend is empty:
        setData([]);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Listen to WS updates for this specific strategy
    const topicMap = {
      'bsjp': 'idx.bandar.flow', // depends on how engine maps it
      'scalping': 'idx.ohlcv.raw',
    };
    
    const targetTopic = topicMap[strategy];
    
    const handleWsUpdate = (event) => {
      const msg = event.detail;
      // In a real scenario, we merge this with `data`
      // For example, if it's a new screener result, we update the state:
      console.log(`Live update for ${strategy}:`, msg);
    };

    if (targetTopic) {
      window.addEventListener(`ws_${targetTopic}`, handleWsUpdate);
    }

    return () => {
      if (targetTopic) {
        window.removeEventListener(`ws_${targetTopic}`, handleWsUpdate);
      }
    };
  }, [strategy]);

  return { data, loading, error };
};
