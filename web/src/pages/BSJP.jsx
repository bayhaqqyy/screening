import React from 'react';
import AnimatedPage from '../components/layout/AnimatedPage';
import MarketStatus from '../components/bsjp/MarketStatus';
import BSJPCandidates from '../components/bsjp/BSJPCandidates';
import BSJPCandidatesV2 from '../components/bsjp/BSJPCandidatesV2';
import AccumulationChart from '../components/bsjp/AccumulationChart';
import StrategyPerformance from '../components/bsjp/StrategyPerformance';
import BandarActivity from '../components/bsjp/BandarActivity';
import BSJPPromo from '../components/bsjp/BSJPPromo';

// Feature flag — set VITE_USE_TABLE_V2=true to render the Sprint 5 V2 layout.
const USE_V2 = String(import.meta.env.VITE_USE_TABLE_V2).toLowerCase() === 'true';

const BSJP = () => {
  return (
    <AnimatedPage>
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tighter text-on-surface mb-2">BSJP — Beli Sore Jual Pagi</h1>
          <p className="text-on-surface-variant max-w-2xl leading-relaxed">Systematic momentum screener identifying stocks with late-day accumulation and high gap-up probability for next day market open.</p>
        </div>
        <MarketStatus />
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-8 flex flex-col gap-6">
          {USE_V2 ? <BSJPCandidatesV2 /> : <BSJPCandidates />}
          <AccumulationChart />
        </section>

        <section className="lg:col-span-4 flex flex-col gap-6">
          <StrategyPerformance />
          <BandarActivity />
          <BSJPPromo />
        </section>
      </div>
    </AnimatedPage>
  );
};

export default BSJP;
