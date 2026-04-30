import React, { useState } from 'react';
import NewsFilterBar from '../components/news/NewsFilterBar';
import FeaturedNews from '../components/news/FeaturedNews';
import TopSentiment from '../components/news/TopSentiment';
import MarketDeepDive from '../components/news/MarketDeepDive';
import AnimatedPage from '../components/layout/AnimatedPage';

const News = () => {
  const [activeFilter, setActiveFilter] = useState('Semua');

  return (
    <AnimatedPage>
      <NewsFilterBar activeFilter={activeFilter} onFilterChange={setActiveFilter} />
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        <FeaturedNews />
        <TopSentiment />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <MarketDeepDive activeFilter={activeFilter} />
        </div>
      </div>
    </AnimatedPage>
  );
};

export default News;
