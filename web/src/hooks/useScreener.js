import { useState, useEffect } from 'react';
import { screenerService } from '../services/screenerService';

export const useScreener = (strategy) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await screenerService.getResults(strategy);
        setData(result || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Listen to WS updates for this specific strategy
    const topicMap = {
      'bsjp': 'idx.bandar.flow',
      'scalping': 'idx.ohlcv.enriched',
      'swing': 'idx.ohlcv.enriched'
    };
    
    const targetTopic = topicMap[strategy];
    
    const handleWsUpdate = (event) => {
      const msg = event.detail;
      // msg looks like { topic: "...", key: "BBCA", data: {...} }
      
      setData(prevData => {
        let newData = [...prevData];
        const existingIdx = newData.findIndex(d => d.ticker === msg.key);
        
        // This is a simplified merge, mapping WS data to the ScreenerResult format
        // In a real production app, the backend engine would compute the exact payload
        // and send it via Kafka -> WS -> UI.
        
        let mappedItem = null;
        
        if (strategy === 'bsjp') {
           const d = msg.data;
           const flowType = d.flow_type || 'Neutral';
           const netVol = Math.abs(d.net_volume || 0);
           // Score: higher net_volume accumulation = higher score
           const score = flowType === 'Accumulation' 
             ? Math.min(100, Math.round(netVol / 5000)) 
             : Math.round(Math.max(0, 50 - netVol / 10000));
           
           mappedItem = {
             ticker: d.ticker || msg.key,
             strategy: 'bsjp',
             signal: flowType,
             score: score,
             payload: {
               price: d.price || 0,
               dip_pct: flowType === 'Accumulation' ? 0.5 : -0.5,
               accum_pct: score,
               top_brokers: d.top_buyers || d.top_sellers || []
             },
             screened_at: new Date().toISOString()
           };
        } else if (strategy === 'swing' || strategy === 'scalping') {
           const d = msg.data.latest;
           if (!d) return prevData;
           mappedItem = {
             ticker: msg.key,
             strategy: strategy,
             signal: d.rsi_14 < 30 ? 'Oversold RSI' : (d.rsi_14 > 70 ? 'Overbought RSI' : 'Neutral'),
             score: d.rsi_14 ? Math.round(100 - d.rsi_14) : 50,
             payload: {
                price: d.Close || 0,
                target: d.Close ? d.Close * 1.05 : 0,
                stop_loss: d.Close ? d.Close * 0.95 : 0,
                volume: d.Volume || 0,
                rsi: d.rsi_14 || 0,
                macd: d.macd || 0
             },
             screened_at: new Date().toISOString()
           };
        }
        
        if (!mappedItem) return prevData;
        
        if (existingIdx >= 0) {
          // If we already had it from the API, merge/update
          newData[existingIdx] = { ...newData[existingIdx], ...mappedItem };
        } else {
          // If it's a new ticker not in the initial API load
          newData.push(mappedItem);
        }
        
        // Sort by score DESC
        newData.sort((a, b) => b.score - a.score);
        
        return newData.slice(0, 50); // Keep top 50
      });
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
