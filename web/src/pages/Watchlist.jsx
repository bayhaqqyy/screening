import React, { useState } from 'react';
import WatchlistNav from '../components/watchlist/WatchlistNav';
import WatchlistTable from '../components/watchlist/WatchlistTable';
import SectorStats from '../components/watchlist/SectorStats';
import PromoCard from '../components/watchlist/PromoCard';
import AlertHistory from '../components/watchlist/AlertHistory';
import AlertsTab from '../components/watchlist/AlertsTab';

import AnimatedPage from '../components/layout/AnimatedPage';

const Watchlist = () => {
  const [activeTab, setActiveTab] = useState('watchlist');

  return (
    <AnimatedPage>
      <div className="flex space-x-1 p-1 bg-surface-container-low rounded-xl w-fit mb-6">
        <button 
          onClick={() => setActiveTab('watchlist')}
          className={`px-6 py-2 rounded-lg text-sm transition-all ${activeTab === 'watchlist' ? 'font-semibold bg-surface-container-highest text-primary shadow-sm' : 'font-medium text-on-surface-variant hover:text-on-surface'}`}
        >
          My Watchlist
        </button>
        <button 
          onClick={() => setActiveTab('alerts')}
          className={`px-6 py-2 rounded-lg text-sm transition-all ${activeTab === 'alerts' ? 'font-semibold bg-surface-container-highest text-primary shadow-sm' : 'font-medium text-on-surface-variant hover:text-on-surface'}`}
        >
          Price Alerts
        </button>
      </div>

      {activeTab === 'watchlist' ? (
        <>
          <WatchlistNav />
          <div className="grid grid-cols-12 gap-6">
            <WatchlistTable />
            
            <div className="col-span-12 lg:col-span-4 space-y-6">
              <SectorStats />
              <PromoCard />
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
