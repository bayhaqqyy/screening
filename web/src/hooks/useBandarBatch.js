import { useEffect, useState } from 'react';
import { marketService } from '../services/marketService';

/**
 * useBandarBatch — fetch bandar_flow rows for a set of tickers in a single
 * request. Used by the V2 screener tables to populate the BandarMovementCell
 * without issuing one HTTP call per ticker.
 *
 * Re-runs whenever the serialised ticker list changes. Returns a map keyed
 * by ticker; missing tickers are simply absent.
 */
export const useBandarBatch = (tickers) => {
  const [data, setData] = useState({});

  const key = Array.isArray(tickers)
    ? Array.from(new Set(tickers.filter(Boolean).map((t) => String(t).toUpperCase()))).sort().join(',')
    : '';

  useEffect(() => {
    if (!key) {
      setData({});
      return;
    }
    let cancelled = false;
    marketService
      .getBandarBatch(key.split(','))
      .then((res) => {
        if (!cancelled) setData(res || {});
      })
      .catch((err) => {
        console.warn('Bandar batch fetch failed:', err);
        if (!cancelled) setData({});
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return data;
};
