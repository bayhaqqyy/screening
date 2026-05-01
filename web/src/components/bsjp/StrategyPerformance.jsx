import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';

const StrategyPerformance = () => {
  const [stats, setStats] = useState({ successRate: 0, avgGapUp: 0, totalHits: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await api.get('/screener/stats?strategy=bsjp');
        if (data) {
          setStats({
            successRate: data.success_rate || 0,
            avgGapUp: data.avg_gap_up || 0,
            totalHits: data.total_hits || 0
          });
        }
      } catch (err) {
        console.error("Failed to fetch strategy stats:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="bg-gradient-to-br from-surface-container-high to-surface-container rounded-xl p-6 border border-outline-variant/10 shadow-2xl">
      <h3 className="text-xs font-black uppercase tracking-widest text-outline mb-6">Strategy Performance</h3>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-sm font-medium text-on-surface-variant block">Success Rate</span>
            <span className="text-3xl font-black tabular-nums text-secondary tracking-tighter">
              {loading ? '—' : `${stats.successRate.toFixed(1)}%`}
            </span>
          </div>
          <div className="w-12 h-12 rounded-full border-4 border-surface-container-highest border-t-secondary rotate-45"></div>
        </div>
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-outline-variant/10">
          <div>
            <span className="text-[10px] uppercase font-bold text-outline block mb-1">Avg Gap-Up</span>
            <span className="text-lg font-black tabular-nums text-on-surface">
              {loading ? '—' : `+${stats.avgGapUp.toFixed(1)}%`}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-outline block mb-1">Total Hits</span>
            <span className="text-lg font-black tabular-nums text-on-surface">
              {loading ? '—' : stats.totalHits.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StrategyPerformance;
