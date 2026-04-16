import React from 'react';
import WatchlistNav from '../components/watchlist/WatchlistNav';
import WatchlistTable from '../components/watchlist/WatchlistTable';
import SectorStats from '../components/watchlist/SectorStats';
import PromoCard from '../components/watchlist/PromoCard';
import AlertHistory from '../components/watchlist/AlertHistory';

import AnimatedPage from '../components/layout/AnimatedPage';

const Watchlist = () => {
  return (
    <AnimatedPage>
      <WatchlistNav />
      
      <div className="grid grid-cols-12 gap-6">
        <WatchlistTable />
        
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <SectorStats />
          <PromoCard />
        </div>
      </div>
      
    </AnimatedPage>
  );
};

export default Watchlist;
