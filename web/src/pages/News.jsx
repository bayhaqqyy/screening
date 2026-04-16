import React from 'react';
import NewsFilterBar from '../components/news/NewsFilterBar';
import FeaturedNews from '../components/news/FeaturedNews';
import TopSentiment from '../components/news/TopSentiment';
import MarketDeepDive from '../components/news/MarketDeepDive';

import AnimatedPage from '../components/layout/AnimatedPage';

const News = () => {
  return (
    <AnimatedPage>
      <NewsFilterBar />
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <FeaturedNews />
        <TopSentiment />
      </div>
      
    </AnimatedPage>
  );
};

export default News;
