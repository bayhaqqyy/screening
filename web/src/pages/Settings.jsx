import React from 'react';
import ProfileSection from '../components/settings/ProfileSection';
import SecuritySection from '../components/settings/SecuritySection';
import TradingPreferences from '../components/settings/TradingPreferences';
import SmartNotifications from '../components/settings/SmartNotifications';
import InterfaceAppearance from '../components/settings/InterfaceAppearance';

import AnimatedPage from '../components/layout/AnimatedPage';

const Settings = () => {
  return (
    <AnimatedPage>
      <header className="mb-12">
        <h1 className="text-4xl font-extrabold tracking-tight text-on-surface mb-2">Settings</h1>
        <p className="text-on-surface-variant text-lg">Manage your trading account and platform preferences.</p>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <ProfileSection />
        <SecuritySection />
        <TradingPreferences />
        <SmartNotifications />
        <InterfaceAppearance />
      </div>
      
      <footer className="mt-12 pt-8 border-t border-outline-variant/10 flex justify-end gap-4">
        <button className="px-8 py-3 rounded-full text-sm font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors">Discard Changes</button>
        <button className="px-8 py-3 rounded-full bg-gradient-to-br from-primary to-primary-container text-on-primary font-bold text-sm shadow-xl shadow-primary-container/20 hover:scale-[1.02] active:scale-95 transition-all">Save Preferences</button>
      </footer>
    </AnimatedPage>
  );
};

export default Settings;
