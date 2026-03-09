import { useState, useEffect } from 'react';

interface Settings {
  pulseEnabled: boolean;
  rainbowPulse: boolean;
  playlistSize: 'tight' | 'loose';
}

const DEFAULT_SETTINGS: Settings = {
  pulseEnabled: true,
  rainbowPulse: false,
  playlistSize: 'tight',
};

const SETTINGS_CHANGE_EVENT = 'app-settings-changed';

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => {
    const stored = localStorage.getItem('app_settings');
    if (!stored) return DEFAULT_SETTINGS;
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Listen for changes from other hook instances so all components stay in sync
  useEffect(() => {
    const handler = () => {
      const stored = localStorage.getItem('app_settings');
      if (stored) {
        try {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
        } catch { /* ignore */ }
      }
    };
    window.addEventListener(SETTINGS_CHANGE_EVENT, handler);
    return () => window.removeEventListener(SETTINGS_CHANGE_EVENT, handler);
  }, []);

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      localStorage.setItem('app_settings', JSON.stringify(next));
      window.dispatchEvent(new Event(SETTINGS_CHANGE_EVENT));
      return next;
    });
  };

  return {
    settings,
    updateSetting,
  };
}
