import React from 'react';
import AnimatedPage from '../components/layout/AnimatedPage';
import MarketStatus from '../components/bsjp/MarketStatus';
import BSJPCandidates from '../components/bsjp/BSJPCandidates';
import AccumulationChart from '../components/bsjp/AccumulationChart';
import StrategyPerformance from '../components/bsjp/StrategyPerformance';
import BrokerActivity from '../components/bsjp/BrokerActivity';
import BSJPPromo from '../components/bsjp/BSJPPromo';

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
          <BSJPCandidates />
          <AccumulationChart />
        </section>

        <section className="lg:col-span-4 flex flex-col gap-6">
          <StrategyPerformance />
          <BrokerActivity />
          <BSJPPromo />
        </section>
      </div>
    </AnimatedPage>
  );
};

export default BSJP;
