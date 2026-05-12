import React, { useState, useEffect } from 'react';
import { marketService } from '../../services/marketService';

const SectorHeatmap = () => {
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSectors = async () => {
      setLoading(true);
      try {
        const data = await marketService.getSectors();
        if (data && data.length > 0) {
          setSectors(data.slice(0, 6));
        }
      } catch (error) {
        console.error("Failed to fetch sectors:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSectors();

    // Re-fetch every 30s to stay in sync with backend aggregation
    const interval = setInterval(fetchSectors, 30000);
    return () => clearInterval(interval);
  }, []);

  const getSlotClasses = (index) => {
    if (index === 0) return "col-span-2 row-span-2";
    if (index === 3) return "col-span-2";
    return "";
  };

  const getCardStyle = (change_pct) => {
    if (change_pct >= 1) return { bg: "bg-secondary/20", border: "border-secondary/10", hover: "hover:bg-secondary/30", textCls: "text-secondary" };
    if (change_pct > 0) return { bg: "bg-secondary/10", border: "border-secondary/10", hover: "hover:bg-secondary/20", textCls: "text-secondary" };
    if (change_pct <= -1) return { bg: "bg-error/20", border: "border-error/10", hover: "hover:bg-error/30", textCls: "text-error" };
    if (change_pct < 0) return { bg: "bg-error/10", border: "border-error/10", hover: "hover:bg-error/20", textCls: "text-error" };
    return { bg: "bg-on-surface-variant/5", border: "border-outline-variant/10", hover: "hover:bg-on-surface-variant/10", textCls: "text-on-surface-variant" };
  };

  return (
    <div className="col-span-12 lg:col-span-7 bg-surface-container-low rounded-xl p-6 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold">Sector Heatmap</h3>
        <p className="text-xs text-on-surface-variant">Performance • 24h</p>
      </div>
      
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-on-surface-variant">Loading heatmap...</div>
      ) : (
      <div className="flex-1 grid grid-cols-4 grid-rows-3 gap-3">
        {sectors.map((sector, index) => {
          const style = getCardStyle(sector.change_pct);
          const isGain = sector.change_pct > 0;
          return (
            <div key={sector.sector} className={`${getSlotClasses(index)} ${style.bg} rounded-lg p-4 flex flex-col justify-between border ${style.border} ${style.hover} transition-colors cursor-pointer`}>
              <span className={`text-[10px] md:text-xs font-bold uppercase tracking-widest ${style.textCls} truncate`}>{sector.sector}</span>
              <span className={`${index === 0 ? 'text-2xl' : 'text-lg'} font-black tabular-nums`}>
                {isGain ? '+' : ''}{Number(sector.change_pct ?? 0).toFixed(2)}%
              </span>
            </div>
          )
        })}
        {/* Fill empty slots if < 6 sectors */}
        {Array.from({ length: Math.max(0, 6 - sectors.length) }).map((_, i) => (
           <div key={`empty-${i}`} className="bg-surface-container rounded-lg p-4 flex flex-col justify-between border border-outline-variant/10">
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">N/A</span>
           </div>
        ))}
      </div>
      )}
    </div>
  );
};

export default SectorHeatmap;
