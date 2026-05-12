import React from 'react';
import AnimatedPage from '../components/layout/AnimatedPage';
import SwingTable from '../components/swing/SwingTable';
import SwingTableV2 from '../components/swing/SwingTableV2';
import EventCalendar from '../components/swing/EventCalendar';
import TechnicalHighlights from '../components/swing/TechnicalHighlights';
import { useScreener } from '../hooks/useScreener';

// Feature flag — set VITE_USE_TABLE_V2=true in the environment (or .env)
// to swap the legacy tables for the redesigned Sprint 5 V2 layout. Defaults
// to false so production users keep the existing experience until we flip it.
const USE_V2 = String(import.meta.env.VITE_USE_TABLE_V2).toLowerCase() === 'true';

// NOTE (Sprint-7 hygiene pass): the previous revision rendered a
// <SwingFilterBar> with Timeframe / Indicator / Sector / Corp Action
// dropdowns that fed a client-side `.filter()` with an explicit
// "mock logic for others" comment. Only the `rsi_oversold` option
// actually did anything, and even that was a substring match against
// the free-form `signal` label rather than the real indicator field.
// The dropdowns have been removed rather than left as a UX lie — see
// the "Implement server-side screener filter parameters" backlog item
// in PLAN_V2.md for the proper fix.
const Swing = () => {
  const { data, loading } = useScreener('swing');

  return (
    <AnimatedPage>
      <div className="mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-on-surface mb-2">Swing Trading Screener</h2>
          <p className="text-on-surface-variant max-w-2xl">Precision analysis for swing traders. Filter high-probability setups across multiple timeframe signals and corporate event clusters.</p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2 bg-secondary-container/10 border border-secondary/20 px-3 py-1.5 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_rgba(74,225,118,0.6)] animate-pulse"></span>
            <span className="text-xs font-bold text-secondary uppercase tracking-widest">Market Open</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {USE_V2 ? (
          <SwingTableV2 data={data} loading={loading} />
        ) : (
          <SwingTable data={data} loading={loading} />
        )}
        <EventCalendar />
      </div>

      <TechnicalHighlights />
    </AnimatedPage>
  );
};

export default Swing;
