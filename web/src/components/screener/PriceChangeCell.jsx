import React from 'react';

/**
 * PriceChangeCell — "Last Price / Change % / Trade Done" column.
 *
 * The V2 tables show three related numbers stacked in a single cell:
 *   1. last/live price (large, main focus)
 *   2. intraday % change (coloured green/red)
 *   3. a "Trade Done" / "Entry" / "Wait" state badge driven by where
 *      the live price sits relative to the entry/TP/SL levels
 *
 * Keeping that math here means the three tables share one implementation
 * and cannot drift in how they decide which badge to display.
 *
 * Props:
 *   lastPrice  {number} current / live price
 *   changePct  {number} intraday change %
 *   entryPrice {number} signal entry price (for badge math)
 *   target     {number} TP level
 *   stopLoss   {number} SL level
 */
const PriceChangeCell = ({ lastPrice = 0, changePct = 0, entryPrice = 0, target = 0, stopLoss = 0 }) => {
  const isGain = Number(changePct) >= 0;
  const chgColor = isGain ? 'text-secondary' : 'text-error';

  let status = 'WAIT';
  let statusCls = 'bg-surface-container-highest text-on-surface-variant';
  if (entryPrice > 0 && lastPrice > 0) {
    if (target > 0 && lastPrice >= target) {
      status = 'TP HIT';
      statusCls = 'bg-secondary-container text-secondary';
    } else if (stopLoss > 0 && lastPrice <= stopLoss) {
      status = 'SL HIT';
      statusCls = 'bg-error-container text-error';
    } else if (lastPrice >= entryPrice * 0.985 && lastPrice <= entryPrice * 1.015) {
      status = 'ENTRY';
      statusCls = 'bg-primary-container text-primary';
    } else if (lastPrice > entryPrice * 1.015) {
      status = 'IN TRADE';
      statusCls = 'bg-tertiary-container text-tertiary';
    }
  }

  return (
    <div className="flex flex-col items-end gap-1 tabular-nums min-w-[96px]">
      <span className="text-sm font-bold text-blue-100">
        {lastPrice > 0 ? Math.round(lastPrice).toLocaleString() : '—'}
      </span>
      <span className={`text-[11px] font-bold ${chgColor}`}>
        {isGain ? '+' : ''}
        {Number(changePct).toFixed(2)}%
      </span>
      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${statusCls}`}>
        {status}
      </span>
    </div>
  );
};

export default PriceChangeCell;
