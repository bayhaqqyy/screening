import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';

const AlertHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const data = await api.get('/alerts?triggered=true');
        if (Array.isArray(data)) {
          setHistory(data.slice(0, 6)); // Show last 6 triggered alerts
        }
      } catch (err) {
        console.error("Failed to fetch alert history:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  return (
    <div className="col-span-12 bg-surface-container-low rounded-2xl p-8 space-y-6 mt-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <span className="material-symbols-outlined text-primary">history</span>
          </div>
          <h3 className="font-bold text-blue-100 text-lg">Alert History Log</h3>
        </div>
      </div>
      
      {loading ? (
        <div className="text-center py-8 text-on-surface-variant text-sm">Loading alert history...</div>
      ) : history.length === 0 ? (
        <div className="text-center py-8 text-on-surface-variant text-sm flex flex-col items-center gap-2">
          <span className="material-symbols-outlined text-3xl opacity-40">notifications_none</span>
          <span>No triggered alerts yet. Set price alerts from your watchlist to get started.</span>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {history.map((item, idx) => {
          const isAbove = item.condition === 'above';
          const iconBg = isAbove ? 'bg-secondary/10 text-secondary' : 'bg-error/10 text-error';
          const priceColor = isAbove ? 'text-secondary' : 'text-error';

          return (
            <div key={item.id || idx} className="flex items-start space-x-4 p-4 rounded-xl bg-surface-container-highest/40 hover:bg-surface-container-highest transition-colors">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full ${iconBg} flex items-center justify-center`}>
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>notifications_active</span>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-blue-100 uppercase tracking-tighter">{item.ticker} Triggered</p>
                <p className="text-sm text-on-surface">
                  Price crossed {item.condition} <span className={`${priceColor} tabular-nums`}>Rp {item.target_price?.toLocaleString()}</span>
                </p>
                {item.triggered_at && (
                <p className="text-[10px] text-on-surface-variant tabular-nums flex items-center">
                  <span className="material-symbols-outlined text-[12px] mr-1">schedule</span>
                  {new Date(item.triggered_at).toLocaleString('id-ID')}
                </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};

export default AlertHistory;
