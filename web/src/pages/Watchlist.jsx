import React, { useState } from 'react';
import WatchlistNav from '../components/watchlist/WatchlistNav';
import WatchlistTable from '../components/watchlist/WatchlistTable';
import SectorStats from '../components/watchlist/SectorStats';
import AlertsTab from '../components/watchlist/AlertsTab';

import AnimatedPage from '../components/layout/AnimatedPage';

// Sprint 7 feature flag — VITE_USE_WATCHLIST_V2 gates the H+1..H+7 trade
// journal layout. Kept in sync with web/.env.example so flipping the flag
// in .env is all it takes to roll forward or back. When false we still
// render WatchlistTable; the component itself falls back to the legacy
// column set if backend fields are missing, but we still respect the flag
// so QA can A/B the two end to end.
const USE_WATCHLIST_V2 =
  String(import.meta.env.VITE_USE_WATCHLIST_V2).toLowerCase() === 'true';

const Watchlist = () => {
  const [activeTab, setActiveTab] = useState('watchlist');

  return (
    <AnimatedPage>
      <div className="flex items-center gap-3 mb-6">
        <div className="flex space-x-1 p-1 bg-surface-container-low rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('watchlist')}
            className={`px-6 py-2 rounded-lg text-sm transition-all ${
              activeTab === 'watchlist'
                ? 'font-semibold bg-surface-container-highest text-primary shadow-sm'
                : 'font-medium text-on-surface-variant hover:text-on-surface'
            }`}
          >
            My Watchlist
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-6 py-2 rounded-lg text-sm transition-all ${
              activeTab === 'alerts'
                ? 'font-semibold bg-surface-container-highest text-primary shadow-sm'
                : 'font-medium text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Price Alerts
          </button>
        </div>
        {USE_WATCHLIST_V2 && (
          <span
            className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-tertiary-container/30 text-tertiary rounded"
            title="Watchlist V2 (H+1..H+7 trade journal) is active"
          >
            V2
          </span>
        )}
      </div>

      {activeTab === 'watchlist' ? (
        <>
          <WatchlistNav />
          <div className="grid grid-cols-12 gap-6">
            <WatchlistTable />

            <div className="col-span-12 lg:col-span-4 space-y-6">
              <SectorStats />
            </div>
          </div>
        </>
      ) : (
        <div className="mt-4">
          <AlertsTab />
        </div>
      )}
    </AnimatedPage>
  );
};

export default Watchlist;
