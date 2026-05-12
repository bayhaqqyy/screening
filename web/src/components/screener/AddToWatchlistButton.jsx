import React, { useState } from 'react';
import { watchlistService } from '../../services/watchlistService';

/**
 * AddToWatchlistButton — the "Action" column of every V2 screener table.
 *
 * Centralises the add-to-watchlist flow (optimistic loading state, error
 * logging, and post-success callback) so the three tables do not each
 * reimplement the same useState/try/catch boilerplate. The button is
 * hidden until the row is hovered (group-hover) to keep the dense V2
 * tables visually quiet.
 *
 * Props:
 *   ticker   {string} ticker to add (required)
 *   onAdded  {function} optional callback invoked after a successful add
 *   variant  {'icon'|'pill'} visual style — 'icon' for compact scalping/BSJP
 *                            rows, 'pill' for the chunkier Swing table
 */
const AddToWatchlistButton = ({ ticker, onAdded, variant = 'icon' }) => {
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);

  const handleClick = async (e) => {
    e.stopPropagation();
    if (busy || added || !ticker) return;
    setBusy(true);
    try {
      await watchlistService.addTicker(ticker);
      setAdded(true);
      onAdded?.(ticker);
    } catch (err) {
      console.error(`Add to watchlist failed for ${ticker}:`, err);
    } finally {
      setBusy(false);
    }
  };

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || added}
        className="opacity-0 group-hover:opacity-100 bg-primary/10 text-primary hover:bg-primary hover:text-on-primary text-[10px] font-bold py-1 px-3 rounded-full transition-all uppercase disabled:opacity-50"
      >
        {added ? 'Added' : busy ? 'Adding...' : 'Watch'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy || added}
      title={added ? 'Already added' : 'Add to Watchlist'}
      className="opacity-0 group-hover:opacity-100 p-1.5 rounded bg-surface-container-highest hover:bg-primary/20 hover:text-primary transition-all text-on-surface-variant disabled:opacity-50"
    >
      {busy ? (
        <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
      ) : added ? (
        <span className="material-symbols-outlined text-sm text-secondary">check</span>
      ) : (
        <span className="material-symbols-outlined text-sm">star_add</span>
      )}
    </button>
  );
};

export default AddToWatchlistButton;
