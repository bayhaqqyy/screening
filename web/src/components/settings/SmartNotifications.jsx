import React from 'react';

const SmartNotifications = ({ notifications = {}, onChange }) => {
  return (
    <section className="lg:col-span-6 bg-surface-container-low border border-outline-variant/10 rounded-xl p-8 backdrop-blur-xl">
      <h3 className="text-xl font-bold mb-6">Smart Notifications</h3>
      
      <div className="space-y-6">
        <div className="flex items-center justify-between group" onClick={() => onChange('priceAlerts')}>
          <div>
            <p className="font-semibold text-on-surface">Price Alerts</p>
            <p className="text-xs text-on-surface-variant">Notify when ticker hits target levels</p>
          </div>
          <div className={`w-12 h-6 rounded-full relative cursor-pointer flex items-center px-1 transition-colors ${notifications.priceAlerts ? 'bg-secondary-container' : 'bg-surface-container-high'}`}>
            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${notifications.priceAlerts ? 'ml-auto translate-x-0' : 'mr-auto translate-x-0'}`}></div>
          </div>
        </div>
        
        <div className="flex items-center justify-between group" onClick={() => onChange('volumeSpikes')}>
          <div>
            <p className="font-semibold text-on-surface">Volume Spikes</p>
            <p className="text-xs text-on-surface-variant">Unusual volume relative to 30d avg</p>
          </div>
          <div className={`w-12 h-6 rounded-full relative cursor-pointer flex items-center px-1 transition-colors ${notifications.volumeSpikes ? 'bg-secondary-container' : 'bg-surface-container-high'}`}>
            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${notifications.volumeSpikes ? 'ml-auto translate-x-0' : 'mr-auto translate-x-0'}`}></div>
          </div>
        </div>
        
        <div className="flex items-center justify-between group" onClick={() => onChange('newsSentiment')}>
          <div>
            <p className="font-semibold text-on-surface">News Sentiment</p>
            <p className="text-xs text-on-surface-variant">AI-driven summary of major press releases</p>
          </div>
          <div className={`w-12 h-6 rounded-full relative cursor-pointer flex items-center px-1 transition-colors ${notifications.newsSentiment ? 'bg-secondary-container' : 'bg-surface-container-high'}`}>
            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${notifications.newsSentiment ? 'ml-auto translate-x-0' : 'mr-auto translate-x-0'}`}></div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SmartNotifications;
