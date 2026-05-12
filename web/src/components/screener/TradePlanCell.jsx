import React from 'react';

/**
 * TradePlanCell — "Support / Resistance / Trade Plan / RR Ratio" column.
 *
 * Renders the four levels most traders scan first — BID range (entry),
 * Target Profit, Stop Loss, plus an automatically-computed risk/reward
 * ratio so the row reveals whether the setup is worth taking at a glance.
 *
 * All levels are optional; missing values degrade gracefully to "—". The
 * RR is only rendered when we have both a TP and an SL relative to entry,
 * and is clamped to one decimal place.
 */
const TradePlanCell = ({
  entryPrice = 0,
  entryLow,
  entryHigh,
  target = 0,
  targetLow,
  targetHigh,
  stopLoss = 0,
  support = 0,
  resistance = 0,
}) => {
  const bidRange = (() => {
    if (entryLow && entryHigh) return `${Math.round(entryLow).toLocaleString()} – ${Math.round(entryHigh).toLocaleString()}`;
    if (entryPrice) return Math.round(entryPrice).toLocaleString();
    return '—';
  })();

  const tpRange = (() => {
    if (targetLow && targetHigh) return `${Math.round(targetLow).toLocaleString()} – ${Math.round(targetHigh).toLocaleString()}`;
    if (target) return Math.round(target).toLocaleString();
    return '—';
  })();

  const slLabel = stopLoss ? Math.round(stopLoss).toLocaleString() : '—';

  const rr = (() => {
    if (!entryPrice || !target || !stopLoss) return null;
    const reward = Math.abs(target - entryPrice);
    const risk = Math.abs(entryPrice - stopLoss);
    if (risk <= 0) return null;
    const ratio = reward / risk;
    return ratio.toFixed(1);
  })();

  const rrCls = (() => {
    if (!rr) return 'text-on-surface-variant';
    const n = Number(rr);
    if (n >= 2) return 'text-secondary';
    if (n >= 1.5) return 'text-tertiary';
    return 'text-error';
  })();

  return (
    <div className="flex flex-col gap-0.5 text-[11px] min-w-[140px] tabular-nums">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">BID</span>
        <span className="text-on-surface font-medium">{bidRange}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-bold uppercase tracking-wider text-secondary">TP</span>
        <span className="text-secondary font-medium">{tpRange}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-bold uppercase tracking-wider text-error">SL</span>
        <span className="text-error font-medium">{slLabel}</span>
      </div>
      {(support > 0 || resistance > 0) && (
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-outline-variant/10 mt-1">
          <span className="text-[9px] text-on-surface-variant">
            S {support ? Math.round(support).toLocaleString() : '—'} · R {resistance ? Math.round(resistance).toLocaleString() : '—'}
          </span>
          {rr && (
            <span className={`text-[10px] font-bold ${rrCls}`} title="Risk/Reward ratio">
              RR 1:{rr}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default TradePlanCell;
