import React from 'react';
import AnimatedPage from '../components/layout/AnimatedPage';
import SwingFilterBar from '../components/swing/SwingFilterBar';
import SwingTable from '../components/swing/SwingTable';
import EventCalendar from '../components/swing/EventCalendar';
import TechnicalHighlights from '../components/swing/TechnicalHighlights';

const Swing = () => {
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
      
      <SwingFilterBar />
      
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <SwingTable />
        <EventCalendar />
      </div>
      
      <TechnicalHighlights />
    </AnimatedPage>
  );
};

export default Swing;
