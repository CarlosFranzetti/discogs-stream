import React from 'react';
import { Settings, RotateCcw } from 'lucide-react';
import { ExtensionSettings } from '@/types/extension';

interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function Toggle({ label, description, checked, onChange }: ToggleProps) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-border/20 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium">{label}</p>
        {description && <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors shrink-0 mt-0.5 ${checked ? 'bg-primary' : 'bg-secondary'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`}
        />
      </button>
    </div>
  );
}

interface SettingsViewProps {
  settings: ExtensionSettings;
  onUpdate: <K extends keyof ExtensionSettings>(key: K, value: ExtensionSettings[K]) => void;
  onReset: () => void;
}

export function SettingsView({ settings, onUpdate, onReset }: SettingsViewProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Settings</h2>
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3">
        <div className="pt-1">
          <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider py-2">Playback</p>

          <Toggle
            label="Auto-play on Discogs release pages"
            description="Starts playing when you visit a release page"
            checked={settings.autoPlayOnDiscogs}
            onChange={v => onUpdate('autoPlayOnDiscogs', v)}
          />

          <Toggle
            label="Auto-load current release"
            description="Loads the release you're browsing into the player"
            checked={settings.autoLoadRelease}
            onChange={v => onUpdate('autoLoadRelease', v)}
          />

          <Toggle
            label="Open release in browser when playing"
            description="Opens discogs.com when a wantlist track plays"
            checked={settings.openReleaseInBrowser}
            onChange={v => onUpdate('openReleaseInBrowser', v)}
          />

          <Toggle
            label="Hide YouTube videos"
            description="Audio only — hides the video player"
            checked={settings.hideYoutubeVideo}
            onChange={v => onUpdate('hideYoutubeVideo', v)}
          />

          <Toggle
            label="Enable pitch control"
            description="Shows the Technics SL-1200 style ±8% pitch slider"
            checked={settings.pitchEnabled}
            onChange={v => onUpdate('pitchEnabled', v)}
          />
        </div>

        <div className="pt-1">
          <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider py-2">Visuals</p>

          <Toggle
            label="Rainbow pulse effect"
            description="Animated rainbow glow around album art"
            checked={settings.showRainbowPulse}
            onChange={v => onUpdate('showRainbowPulse', v)}
          />

          <Toggle
            label="Activity toasts"
            description="Show background progress notifications"
            checked={settings.showActivityToasts}
            onChange={v => onUpdate('showActivityToasts', v)}
          />
        </div>

        <div className="pt-1">
          <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider py-2">Features</p>

          <Toggle
            label="Enable marketplace"
            description="Show prices and for-sale listings"
            checked={settings.enableMarketplace}
            onChange={v => onUpdate('enableMarketplace', v)}
          />

          <Toggle
            label="Enable suggestions"
            description="Find similar releases based on what's playing"
            checked={settings.enableSuggestions}
            onChange={v => onUpdate('enableSuggestions', v)}
          />
        </div>

        <div className="pt-1 pb-4">
          <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider py-2">Theme</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'dark', label: 'Dark (default)', colors: ['#0f172a', '#06b6d4'] },
              { id: 'midnight', label: 'Midnight', colors: ['#1a0b2e', '#a855f7'] },
              { id: 'neon-orange', label: 'Neon Orange', colors: ['#1a0a03', '#f97316'] },
              { id: 'cyberpunk', label: 'Cyberpunk', colors: ['#0a0d14', '#ef4444'] },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => onUpdate('theme', t.id)}
                className={`flex items-center gap-2 px-2.5 py-2 rounded border text-xs transition-all ${
                  settings.theme === t.id ? 'border-primary bg-primary/10 text-primary' : 'border-border/30 text-muted-foreground hover:border-border/60'
                }`}
              >
                <div className="flex gap-0.5">
                  {t.colors.map((c, i) => (
                    <div key={i} className="w-3 h-3 rounded-full" style={{ background: c }} />
                  ))}
                </div>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pb-4">
          <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider py-2">Currency</p>
          <select
            value={settings.defaultCurrency}
            onChange={e => onUpdate('defaultCurrency', e.target.value)}
            className="w-full bg-secondary/30 border border-border/30 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-primary/50"
          >
            {['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
