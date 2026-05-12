import React, { useState, useEffect } from 'react';
import { marketService } from '../../services/marketService';

const SectorStats = () => {
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSectors = async () => {
      try {
        setLoading(true);
        const data = await marketService.getSectors();
        if (data && data.length > 0) {
          setSectors(data.slice(0, 5)); // Show top 5
        }
      } catch (err) {
        console.error("Failed to fetch sector stats:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSectors();
  }, []);

  return (
    <div className="bg-surface-container-low p-6 rounded-2xl space-y-6">
      <h3 className="font-bold text-blue-100 flex items-center justify-between">
        <span>Sector Performance</span>
        <span className="material-symbols-outlined text-slate-500">analytics</span>
      </h3>
      
      {loading ? (
        <div className="text-sm text-on-surface-variant text-center py-4">Loading stats...</div>
      ) : sectors.length === 0 ? (
        <div className="text-sm text-on-surface-variant text-center py-4">No data available</div>
      ) : (
      <div className="space-y-4">
        {sectors.map((sector) => {
          const isGain = sector.change_pct > 0;
          const isNeutral = sector.change_pct === 0;
          const colorCls = isGain ? 'text-secondary' : isNeutral ? 'text-on-surface' : 'text-error';
          const bgCls = isGain ? 'bg-secondary' : isNeutral ? 'bg-on-surface' : 'bg-error';
          const shadowCls = isGain ? 'shadow-[0_0_8px_rgba(74,225,118,0.4)]' : isNeutral ? '' : 'shadow-[0_0_8px_rgba(255,180,171,0.4)]';
          
          // Rough progress mapping
          const absChange = Math.abs(sector.change_pct);
          const progress = Math.min(100, Math.max(10, absChange * 30)); // 3% = 90% bar width
          
          return (
            <div key={sector.sector} className="space-y-2">
              <div className="flex justify-between text-xs font-semibold uppercase tracking-wider">
                <span className="text-on-surface-variant truncate w-32">{sector.sector}</span>
                <span className={colorCls}>{isGain ? '+' : ''}{Number(sector.change_pct ?? 0).toFixed(2)}%</span>
              </div>
              <div className="h-1 w-full bg-surface-container-high rounded-full overflow-hidden">
                <div className={`h-full ${bgCls} rounded-full ${shadowCls}`} style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};

export default SectorStats;
