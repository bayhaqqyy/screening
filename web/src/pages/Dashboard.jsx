import React from 'react';
import MarketOverview from '../components/dashboard/MarketOverview';
import TopMovers from '../components/dashboard/TopMovers';
import SectorHeatmap from '../components/dashboard/SectorHeatmap';
import NewsPulse from '../components/dashboard/NewsPulse';

import AnimatedPage from '../components/layout/AnimatedPage';

const Dashboard = () => {
  return (
    <AnimatedPage>
      <MarketOverview />
      
      <section className="grid grid-cols-12 gap-8 h-[500px]">
        <TopMovers />
        <SectorHeatmap />
      </section>
      
    </AnimatedPage>
  );
};

export default Dashboard;
