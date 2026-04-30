import React, { useState, useEffect } from 'react';
import ProfileSection from '../components/settings/ProfileSection';
import SecuritySection from '../components/settings/SecuritySection';
import TradingPreferences from '../components/settings/TradingPreferences';
import SmartNotifications from '../components/settings/SmartNotifications';
import InterfaceAppearance from '../components/settings/InterfaceAppearance';

import AnimatedPage from '../components/layout/AnimatedPage';
import { settingsService } from '../services/settingsService';

const Settings = () => {
  const [settings, setSettings] = useState({
    theme: 'dark',
    default_strategy: 'bsjp',
    notifications: {
      priceAlerts: true,
      volumeSpikes: true,
      newsSentiment: false
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await settingsService.getSettings();
        if (res.data) {
          // Merge with default struct in case backend json is empty
          setSettings(prev => ({
            ...prev,
            ...res.data,
            notifications: { ...prev.notifications, ...(res.data.notifications || {}) }
          }));
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsService.updateSettings(settings);
      
      // Global Theme Sync
      if (settings.theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }

      alert("Preferences saved successfully!");
    } catch (err) {
      console.error("Failed to save settings:", err);
      alert("Failed to save preferences.");
    } finally {
      setSaving(false);
    }
  };

  const handleNotificationChange = (key) => {
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: !prev.notifications[key]
      }
    }));
  };

  const handlePreferenceChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: value
      }
    }));
  };

  if (loading) {
    return (
      <AnimatedPage>
        <div className="flex justify-center items-center h-64">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <header className="mb-12">
        <h1 className="text-4xl font-extrabold tracking-tight text-on-surface mb-2">Settings</h1>
        <p className="text-on-surface-variant text-lg">Manage your trading account and platform preferences.</p>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <ProfileSection />
        <SecuritySection />
        <TradingPreferences 
          preferences={settings.notifications} 
          onChange={handlePreferenceChange} 
        />
        <SmartNotifications 
          notifications={settings.notifications} 
          onChange={handleNotificationChange} 
        />
        <InterfaceAppearance 
          theme={settings.theme}
          onChange={(val) => setSettings(p => ({ ...p, theme: val }))}
        />
      </div>
      
      <footer className="mt-12 pt-8 border-t border-outline-variant/10 flex justify-end gap-4">
        <button onClick={() => window.location.reload()} className="px-8 py-3 rounded-full text-sm font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors">Discard Changes</button>
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="px-8 py-3 rounded-full bg-gradient-to-br from-primary to-primary-container text-on-primary font-bold text-sm shadow-xl shadow-primary-container/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>}
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </footer>
    </AnimatedPage>
  );
};

export default Settings;
