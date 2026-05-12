import React from 'react';

/**
 * VolumeStatsCell — "Volume (Lot) / Value / Frequency / 3-Week Trend" column.
 *
 * IDX trades in lots of 100 shares, so the raw Kafka volume (in shares) is
 * divided by 100 for the headline number. Value is the raw rupiah notional,
 * and frequency is the number of trades when available.
 *
 * A tiny sparkline (CSS-only) renders the 3-week close history if the
 * payload includes it, giving traders a rough shape of the recent trend
 * without pulling in a charting library.
 *
 * Props:
 *   volume    {number} raw share volume (converted to lots internally)
 *   value     {number} rupiah notional
 *   frequency {number} trade frequency (count)
 *   trend     {number[]} optional 3-week closing price history (oldest first)
 */
const formatNumber = (n) => {
  if (n == null || !Number.isFinite(Number(n)) || n <= 0) return '—';
  const num = Number(n);
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toLocaleString();
};

const Sparkline = ({ data }) => {
  if (!Array.isArray(data) || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 60;
  const h = 18;
  const step = w / (data.length - 1);
  const pts = data
    .map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(' ');
  const trendUp = data[data.length - 1] >= data[0];
  return (
    <svg width={w} height={h} className="overflow-visible" aria-label="3-week trend">
      <polyline
        fill="none"
        stroke={trendUp ? 'rgb(74 222 128)' : 'rgb(248 113 113)'}
        strokeWidth="1.5"
        points={pts}
      />
    </svg>
  );
};

const VolumeStatsCell = ({ volume = 0, value = 0, frequency = 0, trend = [] }) => {
  const lots = volume > 0 ? Math.round(volume / 100) : 0;
  return (
    <div className="flex flex-col gap-0.5 min-w-[110px] text-[11px] tabular-nums">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">Vol</span>
        <span className="text-on-surface font-medium">{lots > 0 ? `${formatNumber(lots)} lot` : '—'}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">Val</span>
        <span className="text-on-surface-variant">Rp {formatNumber(value)}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">Freq</span>
        <span className="text-on-surface-variant">{formatNumber(frequency)}</span>
      </div>
      {trend?.length > 1 && (
        <div className="pt-1 border-t border-outline-variant/10 mt-1">
          <Sparkline data={trend} />
        </div>
      )}
    </div>
  );
};

export default VolumeStatsCell;
