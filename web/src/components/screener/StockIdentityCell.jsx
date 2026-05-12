import React from 'react';
import TickerLink from '../ui/TickerLink';

/**
 * StockIdentityCell — first column of every V2 screener table.
 *
 * Renders a compact ticker identity block: 1-letter avatar, TradingView link,
 * company name, and optional market-cap tag. Kept deliberately narrow so it
 * can live inside horizontally-scrolling tables without pushing other cells
 * off screen on small viewports.
 *
 * Props:
 *   ticker    {string} IDX ticker symbol (required)
 *   name      {string} company short name
 *   marketCap {number|string} optional "7.5T" style tag
 *   exchange  {string} optional TV exchange prefix, default "IDX"
 *   highlight {boolean} colour the avatar in the secondary tone (used for
 *                      screener top-rank rows)
 */
const formatMarketCap = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'string') return v;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  return n.toLocaleString();
};

const StockIdentityCell = ({ ticker, name = '', marketCap, exchange = 'IDX', highlight = false }) => {
  if (!ticker) return null;

  const cap = formatMarketCap(marketCap);
  const avatarCls = highlight
    ? 'bg-secondary-container/30 text-secondary'
    : 'bg-surface-container-highest text-on-surface-variant';

  return (
    <div className="flex items-center gap-3 min-w-[140px]">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-black ${avatarCls}`}>
        {ticker.charAt(0)}
      </div>
      <div className="min-w-0">
        <TickerLink ticker={ticker} exchange={exchange} className="text-sm" />
        <p className="text-[10px] text-on-surface-variant truncate max-w-[140px]" title={name}>
          {name || '—'}
        </p>
        {cap && (
          <span className="inline-block mt-0.5 text-[9px] font-bold text-on-surface-variant bg-surface-container-highest px-1.5 py-0.5 rounded">
            MCap {cap}
          </span>
        )}
      </div>
    </div>
  );
};

export default StockIdentityCell;
