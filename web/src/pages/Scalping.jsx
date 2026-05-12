import React from 'react';
import FilterBar from '../components/scalping/FilterBar';
import ScalpingTable from '../components/scalping/ScalpingTable';
import ScalpingTableV2 from '../components/scalping/ScalpingTableV2';
import VolumeSpikeAlert from '../components/scalping/VolumeSpikeAlert';
import OrderBookVelocity from '../components/scalping/OrderBookVelocity';
import AnimatedPage from '../components/layout/AnimatedPage';
import { useScreener } from '../hooks/useScreener';

// Feature flag — set VITE_USE_TABLE_V2=true to enable the Sprint 5 V2 tables.
const USE_V2 = String(import.meta.env.VITE_USE_TABLE_V2).toLowerCase() === 'true';

// NOTE (Sprint-7 hygiene pass): the scalping page used to feed the table
// through a client-side `.filter()` that enforced a `minVol` threshold and
// also rendered `minFreq` / `maxSpread` dropdowns that the filter function
// never actually consulted. The partially-wired filter chain has been
// removed so the table shows what the server actually screens; the
// filtering semantics are tracked under "Implement server-side screener
// filter parameters" in PLAN_V2.md.
const Scalping = () => {
  const { data, loading } = useScreener('scalping');
  const activeCount = Array.isArray(data) ? data.length : 0;

  return (
    <AnimatedPage>
      <FilterBar activeCount={activeCount} />
      {USE_V2 ? (
        <ScalpingTableV2 data={data} loading={loading} />
      ) : (
        <ScalpingTable data={data} loading={loading} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
        <VolumeSpikeAlert />
        <OrderBookVelocity />
      </div>
    </AnimatedPage>
  );
};

export default Scalping;
