import React from 'react';
import FilterBar from '../components/scalping/FilterBar';
import ScalpingTable from '../components/scalping/ScalpingTable';
import VolumeSpikeAlert from '../components/scalping/VolumeSpikeAlert';
import OrderBookVelocity from '../components/scalping/OrderBookVelocity';

import AnimatedPage from '../components/layout/AnimatedPage';

const Scalping = () => {
  return (
    <AnimatedPage>
      <FilterBar />
      <ScalpingTable />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
        <VolumeSpikeAlert />
        <OrderBookVelocity />
      </div>
    </AnimatedPage>
  );
};

export default Scalping;
