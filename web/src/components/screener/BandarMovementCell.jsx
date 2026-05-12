import React from 'react';

/**
 * BandarMovementCell — accumulation/distribution summary from bandar_flow.
 *
 * Reads the per-ticker object returned by marketService.getBandarBatch() and
 * renders:
 *   • an accumulation-score meter (0..100, green/red tinted)
 *   • the current signal label (ACCUMULATING / DISTRIBUTION / NEUTRAL)
 *   • vol_ratio and MFI, the two numeric indicators already materialised
 *     into the bandar_flow schema
 *
 * Designed to be cheap to render for 50+ rows — purely markup, no charting.
 *
 * History (Sprint-7 hygiene pass): an earlier revision derived an
 * "indicative average buy/sell price" by splitting the current price via
 * `close_position × ±0.5%`. That value looked like a real bid/ask average
 * but was synthesised from a single scalar and had nothing to do with
 * broker aggregation. The display was removed to prevent traders from
 * acting on fabricated levels; see the "Implement broker summary
 * aggregation" backlog entry in `PLAN_V2.md`.
 *
 * Props:
 *   flow  {object|null} BandarFlowResult row for this ticker, or null
 *                       when no bandar data is available yet
 *   price {number}      current live price — kept in the prop signature
 *                       for binary compatibility with existing call sites,
 *                       but no longer used to fabricate prices. Will be
 *                       needed again when broker-aggregated avg_buy_price
 *                       / avg_sell_price land on the schema.
 */
// eslint-disable-next-line no-unused-vars
const BandarMovementCell = ({ flow, price = 0 }) => {
  if (!flow) {
    return (
      <div className="min-w-[120px] text-[10px] text-on-surface-variant/50">
        No bandar data
      </div>
    );
  }

  const score = Math.max(0, Math.min(100, Number(flow.accum_score) || 0));
  const signal = (flow.signal || 'NEUTRAL').toUpperCase();
  const netBuy = Boolean(flow.net_buy_proxy);
  const barCls = netBuy ? 'bg-secondary' : 'bg-error';
  const signalCls = netBuy
    ? 'text-secondary bg-secondary-container/30'
    : signal.includes('DISTRIB')
    ? 'text-error bg-error-container/30'
    : 'text-on-surface-variant bg-surface-container-highest';

  // Real indicator values — rendered verbatim from the bandar_flow row so
  // a trader can cross-check against the Python screener output.
  const volRatio = Number.isFinite(Number(flow.vol_ratio)) ? Number(flow.vol_ratio) : null;
  const mfi = Number.isFinite(Number(flow.mfi)) ? Number(flow.mfi) : null;

  // Tint MFI by overbought / oversold thresholds so the number is
  // glanceable without a legend. >=80 = distribution / overbought (error
  // tone), <=20 = accumulation / oversold (secondary tone).
  const mfiCls =
    mfi == null
      ? 'text-on-surface-variant'
      : mfi >= 80
      ? 'text-error'
      : mfi <= 20
      ? 'text-secondary'
      : 'text-on-surface';

  // vol_ratio > 1 means today's volume is above average → highlight.
  const volCls =
    volRatio == null
      ? 'text-on-surface-variant'
      : volRatio >= 1.5
      ? 'text-secondary'
      : volRatio <= 0.5
      ? 'text-error'
      : 'text-on-surface';

  return (
    <div className="flex flex-col gap-1 min-w-[120px] text-[11px] tabular-nums">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${barCls}`} style={{ width: `${score}%` }} />
        </div>
        <span className="text-[10px] font-bold text-on-surface">{Math.round(score)}</span>
      </div>
      <span className={`self-start px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${signalCls}`}>
        {signal}
      </span>
      <div className="flex items-center justify-between text-[10px] text-on-surface-variant">
        <span>
          Vol Ratio{' '}
          <span className={`font-medium ${volCls}`}>
            {volRatio != null ? `${volRatio.toFixed(2)}x` : '—'}
          </span>
        </span>
        <span>
          MFI <span className={`font-medium ${mfiCls}`}>{mfi != null ? mfi.toFixed(1) : '—'}</span>
        </span>
      </div>
    </div>
  );
};

export default BandarMovementCell;
