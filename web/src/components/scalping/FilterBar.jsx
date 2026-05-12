import React from 'react';

/**
 * FilterBar — scalping page header.
 *
 * Previously rendered Min Vol / Frequency / Max Spread dropdowns that were
 * either half-wired (only `minVol` actually filtered) or completely inert
 * (`minFreq`, `maxSpread` never consulted by the page's filter fn). The
 * Sprint-7 hygiene pass removed the non-functional inputs rather than ship
 * a UI that pretends to filter — the real fix is to plumb query parameters
 * through `/api/screener/scalping` and let the server filter. See the
 * "Implement server-side screener filter parameters" backlog entry in
 * PLAN_V2.md.
 *
 * What's left here is honest: the page title, a "Live Updates" pill, and
 * the active-ticker counter driven by the actual screener result count.
 */
const FilterBar = ({ activeCount = 0 }) => (
  <div className="space-y-6">
    <div className="flex justify-between items-end">
      <div>
        <h2 className="text-3xl font-extrabold tracking-tighter text-on-surface">Scalping Screener</h2>
        <p className="text-on-surface-variant text-sm mt-1">Real-time intra-day momentum tracking</p>
      </div>
      <div className="flex gap-2">
        <div className="bg-primary-container text-on-primary-container px-6 py-2 rounded-full font-semibold text-sm flex items-center gap-2 shadow-lg shadow-primary-container/20">
          <span className="material-symbols-outlined text-sm">play_arrow</span>
          Live Updates
        </div>
      </div>
    </div>

    <div className="glass-panel px-4 py-3 rounded-xl flex justify-end">
      <div className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-surface-container-highest text-xs font-medium text-primary">
        <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
        {activeCount} Tickers Active
      </div>
    </div>
  </div>
);

export default FilterBar;
