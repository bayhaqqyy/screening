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
    minVol: 10,       // 10M
    minFreq: 5000,    // not directly available in standard payload but we can mock
    maxSpread: 1.0    // not directly available either but let's prep the structure
  });

  const filteredData = useMemo(() => {
    if (!data) return [];
    return data.filter(item => {
      const vol = item.payload?.volume || 0;
      // Convert minVol (M) to actual number for comparison
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
