import React, { useState, useMemo } from 'react';
import FilterBar from '../components/scalping/FilterBar';
import ScalpingTable from '../components/scalping/ScalpingTable';
import VolumeSpikeAlert from '../components/scalping/VolumeSpikeAlert';
import OrderBookVelocity from '../components/scalping/OrderBookVelocity';
import AnimatedPage from '../components/layout/AnimatedPage';
import { useScreener } from '../hooks/useScreener';

const Scalping = () => {
  const { data, loading } = useScreener('scalping');
  const [filters, setFilters] = useState({
    minVol: 0,        // Show all by default — user can raise threshold
    minFreq: 5000,
    maxSpread: 1.0
  });

  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (filters.minVol === 0) return data;
    return data.filter(item => {
      const vol = item.payload?.volume || item.volume || 0;
      const volThreshold = filters.minVol * 1000000;
      return vol >= volThreshold;
    });
  }, [data, filters]);

  return (
    <AnimatedPage>
      <FilterBar 
        filters={filters} 
        onFilterChange={setFilters} 
        activeCount={filteredData.length} 
      />
      <ScalpingTable data={filteredData} loading={loading} />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
        <VolumeSpikeAlert />
        <OrderBookVelocity />
      </div>
    </AnimatedPage>
  );
};

export default Scalping;
