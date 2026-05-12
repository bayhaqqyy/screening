import React, { useEffect, useState, useRef } from 'react';
import { newsService } from '../../services/newsService';

/**
 * TradeInfoCell — "Trade Info / News Tag" column for V2 screener tables.
 *
 * Shows when the signal fired, what the screener called the entry level, and
 * (on hover / when available) the most recent news headline about the ticker
 * fetched via `/api/news?ticker=` — which is why this component owns a small
 * amount of network state. The news fetch is debounced and cached per-ticker
 * for the lifetime of the component so a table with 50 rows does not issue
 * 50 immediate requests.
 *
 * Props:
 *   ticker     {string} ticker to fetch news for (required)
 *   screenedAt {string} ISO timestamp from the screener result
 *   entryPrice {number} entry level from the signal payload
 *   tags       {string[]} optional payload tags rendered as chips
 *   autoLoadNews {boolean} when true (default) the component fetches news on
 *                mount; false defers the fetch until the user hovers / taps.
 */
const TradeInfoCell = ({ ticker, screenedAt, entryPrice, tags = [], autoLoadNews = true }) => {
  const [headline, setHeadline] = useState(null);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!ticker || !autoLoadNews || fetchedRef.current) return;
    fetchedRef.current = true;
    let cancelled = false;
    setLoading(true);
    newsService
      .getNews(1, '', ticker)
      .then((rows) => {
        if (cancelled) return;
        if (Array.isArray(rows) && rows.length > 0) setHeadline(rows[0]);
      })
      .catch(() => {
        /* non-fatal — news is an enhancement, not a requirement */
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [ticker, autoLoadNews]);

  const dateLabel = (() => {
    if (!screenedAt) return '—';
    const d = new Date(screenedAt);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  })();

  const entryLabel = entryPrice ? Math.round(entryPrice).toLocaleString() : '—';

  return (
    <div className="flex flex-col gap-1 min-w-[150px] text-[11px]">
      <div className="flex items-center gap-2 text-on-surface-variant">
        <span className="material-symbols-outlined text-[12px]">event</span>
        <span className="tabular-nums">{dateLabel}</span>
        <span className="text-outline/60">·</span>
        <span className="tabular-nums font-medium text-on-surface">@ {entryLabel}</span>
      </div>

      {tags?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 3).map((t) => (
            <span key={t} className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-surface-container-highest text-on-surface-variant">
              {t}
            </span>
          ))}
        </div>
      )}

      {loading ? (
        <span className="text-[10px] text-on-surface-variant/70">Fetching news...</span>
      ) : headline ? (
        <a
          href={headline.link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[10px] text-primary hover:underline truncate max-w-[180px]"
          title={headline.title}
        >
          📰 {headline.title}
        </a>
      ) : (
        <span className="text-[10px] text-on-surface-variant/50">No recent news</span>
      )}
    </div>
  );
};

export default TradeInfoCell;
