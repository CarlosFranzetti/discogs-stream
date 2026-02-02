import { useState, useEffect } from 'react';

interface Settings {
  pulseEnabled: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  pulseEnabled: true,
};

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

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      localStorage.setItem('app_settings', JSON.stringify(next));
      return next;
    });
  };

  return {
    settings,
    updateSetting,
  };
}
