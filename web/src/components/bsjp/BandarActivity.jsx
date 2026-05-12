import React, { useEffect, useState } from 'react';
import { marketService } from '../../services/marketService';
import TickerLink from '../ui/TickerLink';

/**
 * BandarActivity — "Top Bandar (Accumulation)" widget on the BSJP page.
 *
 * Replaces the old BrokerActivity component, which subscribed to a
 * `top_buyers` field that `engine/screeners/bandar_analysis.py` never
 * actually emits and then decorated the empty result with a hardcoded
 * `brokerNames` lookup table. Because both the data source and the
 * display name mapping were fabricated, the widget could only ever
 * render a "Waiting..." spinner — see the Sprint-7 hygiene pass notes in
 * PLAN_V2.md.
 *
 * This replacement uses the real bandar pipeline:
 *   • `marketService.getBandarFlow()` → `/api/bandar` → the full
 *     `bandar_flow` table, already sorted by `accum_score DESC` on the
 *     backend.
 *   • Live `ws_idx.bandar.flow` messages patch individual tickers so the
 *     ranking stays fresh during market hours.
 *
 * Note: this surfaces ticker-level accumulation, not broker-level flow.
 * The original BrokerActivity naming is gone on purpose: per-broker
 * aggregation requires an IDX broker-summary licence and is tracked in
 * the "Integrate IDX broker summary" backlog item.
 */

const TOP_N = 5;

const signalTone = (signal) => {
  const s = String(signal || '').toUpperCase();
  if (s.includes('STRONG') || s.includes('ACCUM')) return 'text-secondary';
  if (s.includes('DISTRIB')) return 'text-error';
  return 'text-on-surface-variant';
};

const formatNumber = (n) => {
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0) return '—';
  if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(0)}K`;
  return num.toLocaleString();
};

const BandarActivity = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await marketService.getBandarFlow();
        if (cancelled) return;
        const list = Array.isArray(res) ? res : [];
        list.sort((a, b) => (b.accum_score || 0) - (a.accum_score || 0));
        setRows(list.slice(0, TOP_N));
      } catch (err) {
        console.error('BandarActivity: initial fetch failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();

    // Live patch: a bandar_flow tick on a ticker we already show should
    // refresh that row in place; a tick on a ticker we don't show only
    // enters the top-N if its accum_score beats the current last row.
    const handleFlow = (event) => {
      const msg = event.detail;
      const d = msg?.data;
      if (!d || !d.ticker) return;

      setRows((prev) => {
        const next = prev.slice();
        const idx = next.findIndex((r) => r.ticker === d.ticker);
        if (idx >= 0) {
          next[idx] = { ...next[idx], ...d };
        } else {
          const lowest = next.length > 0 ? next[next.length - 1].accum_score || 0 : 0;
          if ((d.accum_score || 0) <= lowest && next.length >= TOP_N) return prev;
          next.push(d);
        }
        next.sort((a, b) => (b.accum_score || 0) - (a.accum_score || 0));
        return next.slice(0, TOP_N);
      });
    };

    window.addEventListener('ws_idx.bandar.flow', handleFlow);
    return () => {
      cancelled = true;
      window.removeEventListener('ws_idx.bandar.flow', handleFlow);
    };
  }, []);

  const hasData = rows.length > 0;

  return (
    <div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/5 shadow-xl">
      <div className="flex justify-between items-center mb-6">
        <h4 className="font-bold text-on-surface text-sm">Top Bandar (Accumulation)</h4>
        <span className="flex items-center gap-1.5">
          {hasData && <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />}
          <span className={`text-[10px] font-black uppercase ${hasData ? 'text-secondary' : 'text-on-surface-variant'}`}>
            {hasData ? 'Active Flow' : loading ? 'Loading' : 'Unavailable'}
          </span>
        </span>
      </div>

      <div className="space-y-3">
        {loading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between animate-pulse">
              <div className="h-8 w-24 bg-surface-container-highest rounded" />
              <div className="h-4 w-16 bg-surface-container-highest rounded" />
            </div>
          ))
        ) : !hasData ? (
          <div className="text-center py-4 space-y-1">
            <p className="text-sm font-medium text-on-surface-variant">No accumulation data</p>
            <p className="text-[10px] text-on-surface-variant/70">
              Bandar pipeline has no rows yet — check <code>idx.bandar.flow</code>.
            </p>
          </div>
        ) : (
          rows.map((row) => {
            const score = Math.max(0, Math.min(100, Number(row.accum_score) || 0));
            const volRatio = Number(row.vol_ratio);
            const netBuy = Boolean(row.net_buy_proxy);
            const barCls = netBuy ? 'bg-secondary' : 'bg-error';
            return (
              <div key={row.ticker} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded bg-surface-container-highest flex items-center justify-center text-[10px] font-bold text-primary">
                    {(row.ticker || '?').charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <TickerLink ticker={row.ticker} className="text-xs" />
                    <span className={`block text-[10px] font-black uppercase tracking-wider ${signalTone(row.signal)}`}>
                      {row.signal || 'NEUTRAL'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 tabular-nums shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barCls}`} style={{ width: `${score}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-on-surface">{Math.round(score)}</span>
                  </div>
                  <span className="text-[10px] text-on-surface-variant">
                    Vol {Number.isFinite(volRatio) && volRatio > 0 ? `${volRatio.toFixed(2)}x` : '—'} · {formatNumber(row.volume)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default BandarActivity;
