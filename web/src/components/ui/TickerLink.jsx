/**
 * TickerLink — reusable component that wraps a ticker symbol in a
 * TradingView-deep-link anchor so every table in the app opens the
 * chart in a new tab consistently.
 *
 * Props:
 *   ticker   {string}  IDX ticker code, e.g. "BBCA" (required)
 *   exchange {string}  exchange prefix, default "IDX"
 *   className {string} extra CSS classes applied to the <a> element
 *   children {node}    override the label; defaults to the ticker itself
 */
import React from 'react';

const TV_BASE = 'https://www.tradingview.com/chart/?symbol=';

const TickerLink = ({ ticker, exchange = 'IDX', className = '', children }) => {
  if (!ticker) return null;

  const symbol = encodeURIComponent(`${exchange}:${ticker}`);
  const href = `${TV_BASE}${symbol}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open ${ticker} on TradingView`}
      onClick={(e) => e.stopPropagation()}
      className={[
        'font-bold tabular-nums text-blue-100',
        'hover:text-primary hover:underline',
        'transition-colors duration-150',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children ?? ticker}
    </a>
  );
};

export default TickerLink;
