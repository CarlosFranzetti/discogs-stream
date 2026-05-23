import { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTheme } from '@/hooks/useTheme';
import { useSettings } from '@/hooks/useSettings';
import { useCSVCollection } from '@/hooks/useCSVCollection';
import {
  Settings, Palette, RefreshCw, Radar, Upload, Download,
  Music, Disc3, LogIn, AlertTriangle, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Track } from '@/types/track';

interface SettingsDialogProps {
  onClearData: () => void;
  playlistTracks?: Track[];
  isDiscogsAuthenticated?: boolean;
  discogsUsername?: string;
  onConnectDiscogs?: () => void;
  onDisconnectDiscogs?: () => void;
  onCollectionCSVUpload?: (file: File) => Promise<void>;
  onWantlistCSVUpload?: (file: File) => Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // Phase 3 — Discogs sync surface (REQ-C6).
  isSyncing?: boolean;
  isRescanning?: boolean;
  lastSyncAt?: string | null;
  lastRescanAt?: string | null;
  syncError?: string | null;
  onSyncNow?: () => void;
  onRescanNow?: () => Promise<{ ok: boolean; tracksChecked?: number; linksUpdated?: number; error?: string }> | void;
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'never';
  const diff = Date.now() - t;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const day = Math.round(hr / 24);
  return `${day} d ago`;
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <p className="text-[10px] font-semibold text-primary/70 uppercase tracking-widest flex items-center gap-1.5">
      {icon} {label}
    </p>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <Label className="text-xs text-foreground/80">{label}</Label>
        {hint && <p className="text-[10px] text-muted-foreground/60 leading-tight">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-0.5 rounded-full text-[11px] border transition-colors ${
        active
          ? 'bg-primary/15 text-primary border-primary/40'
          : 'bg-muted/60 text-muted-foreground border-transparent hover:border-border'
      }`}
    >
      {children}
    </button>
  );
}

export function SettingsDialog({
  onClearData,
  playlistTracks = [],
  isDiscogsAuthenticated = false,
  discogsUsername,
  onConnectDiscogs,
  onDisconnectDiscogs,
  onCollectionCSVUpload,
  onWantlistCSVUpload,
  open,
  onOpenChange,
  isSyncing = false,
  isRescanning = false,
  lastSyncAt = null,
  lastRescanAt = null,
  syncError = null,
  onSyncNow,
  onRescanNow,
}: SettingsDialogProps) {
  const { theme, setTheme } = useTheme();
  const { settings, updateSetting } = useSettings();
  const {
    loadCollectionCSV,
    loadWantlistCSV,
    isLoading: isCSVLoading,
    collection,
    wantlist,
  } = useCSVCollection();

  const collectionInputRef = useRef<HTMLInputElement>(null);
  const wantlistInputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    if (confirm('Clear all local data (CSV, cache)? This cannot be undone.')) {
      onOpenChange?.(false);
      onClearData();
      toast.success('All data cleared.');
    }
  };

  const handleExportCSV = () => {
    if (playlistTracks.length === 0) {
      toast.error('Playlist is empty');
      return;
    }
    const headers = ['Artist', 'Title', 'Album', 'Year', 'Genre', 'YouTube ID'];
    const csvContent = [
      headers.join(','),
      ...playlistTracks.map((t) =>
        [`"${t.artist}"`, `"${t.title}"`, `"${t.album}"`, t.year, `"${t.genre}"`, t.youtubeId || ''].join(',')
      ),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `discogs_stream_playlist_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCollectionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        if (onCollectionCSVUpload) {
          await onCollectionCSVUpload(file);
        } else {
          const tracks = await loadCollectionCSV(file);
          toast.success(`Loaded ${tracks.length} collection items`);
        }
      } catch {
        toast.error('Failed to load CSV');
      }
      if (collectionInputRef.current) collectionInputRef.current.value = '';
    }
  };

  const handleWantlistUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        if (onWantlistCSVUpload) {
          await onWantlistCSVUpload(file);
        } else {
          const tracks = await loadWantlistCSV(file);
          toast.success(`Loaded ${tracks.length} wantlist items`);
        }
      } catch {
        toast.error('Failed to load CSV');
      }
      if (wantlistInputRef.current) wantlistInputRef.current.value = '';
    }
  };

  const handleRescan = async () => {
    if (!onRescanNow) return;
    const res = await onRescanNow();
    if (res && typeof res === 'object') {
      if (res.ok) toast.success(`Rescan complete — checked ${res.tracksChecked ?? 0}, updated ${res.linksUpdated ?? 0}`);
      else toast.error(`Rescan failed: ${res.error ?? 'unknown'}`);
    }
  };

  const THEMES = [
    { value: 'dark', label: 'Dark' },
    { value: 'theme-midnight', label: 'Midnight' },
    { value: 'theme-neon-orange', label: 'Orange' },
    { value: 'theme-cyberpunk', label: 'Cyberpunk' },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Settings className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px] bg-card border-border p-0 font-sans">
        <DialogHeader className="px-5 pt-3 pb-2 border-b border-border/50">
          <DialogTitle className="text-sm font-medium text-foreground">Settings</DialogTitle>
        </DialogHeader>

        <div className="px-5 pt-4 pb-4 space-y-4">

          {/* ─────────── Appearance ─────────── */}
          <section className="space-y-2.5">
            <SectionHeader icon={<Palette className="w-3 h-3" />} label="Appearance" />

            <Row label="Pulse animation">
              <Switch
                checked={settings.pulseEnabled}
                onCheckedChange={(val) => updateSetting('pulseEnabled', val)}
              />
            </Row>

            <Row label="Rainbow pulse" hint="Slow randomised colour cycle">
              <Switch
                checked={settings.rainbowPulse}
                disabled={!settings.pulseEnabled}
                onCheckedChange={(val) => updateSetting('rainbowPulse', val)}
              />
            </Row>

            <Row label="Activity messages" hint="Cover-art & expansion progress toasts">
              <Switch
                checked={settings.showActivityMessages}
                onCheckedChange={(val) => updateSetting('showActivityMessages', val)}
              />
            </Row>

            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs text-foreground/80 shrink-0">Theme</Label>
              <div className="flex gap-1 flex-wrap justify-end">
                {THEMES.map(({ value, label }) => (
                  <Pill key={value} active={theme === value} onClick={() => setTheme(value)}>{label}</Pill>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs text-foreground/80 shrink-0">Playlist size</Label>
              <div className="flex gap-1">
                {(['Tight', 'Loose'] as const).map((size) => (
                  <Pill
                    key={size}
                    active={settings.playlistSize === size.toLowerCase()}
                    onClick={() => updateSetting('playlistSize', size.toLowerCase() as 'tight' | 'loose')}
                  >
                    {size}
                  </Pill>
                ))}
              </div>
            </div>
          </section>

          <div className="border-t border-border/40" />

          {/* ─────────── Library ─────────── */}
          <section className="space-y-2">
            <SectionHeader icon={<Music className="w-3 h-3" />} label="Library" />
            <input ref={collectionInputRef} type="file" accept=".csv" onChange={handleCollectionUpload} className="hidden" />
            <input ref={wantlistInputRef} type="file" accept=".csv" onChange={handleWantlistUpload} className="hidden" />

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline" size="sm"
                className="justify-between text-xs h-8 px-3"
                onClick={() => collectionInputRef.current?.click()}
                disabled={isCSVLoading}
              >
                <span className="flex items-center gap-1.5"><Upload className="w-3 h-3" /> Collection</span>
                {collection.length > 0 && <span className="text-muted-foreground">{collection.length}</span>}
              </Button>
              <Button
                variant="outline" size="sm"
                className="justify-between text-xs h-8 px-3"
                onClick={() => wantlistInputRef.current?.click()}
                disabled={isCSVLoading}
              >
                <span className="flex items-center gap-1.5"><Upload className="w-3 h-3" /> Wantlist</span>
                {wantlist.length > 0 && <span className="text-muted-foreground">{wantlist.length}</span>}
              </Button>
            </div>

            <Button variant="outline" size="sm" onClick={handleExportCSV} className="w-full gap-2 text-xs h-8">
              <Download className="w-3 h-3" /> Export playlist CSV
            </Button>
          </section>

          <div className="border-t border-border/40" />

          {/* ─────────── Discogs Account ─────────── */}
          <section className="space-y-2">
            <SectionHeader icon={<Disc3 className="w-3 h-3" />} label="Discogs Account" />

            {!isDiscogsAuthenticated && (
              <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 flex items-center gap-2">
                <AlertTriangle className="w-3 h-3 text-amber-500/70 shrink-0" />
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Connect for auto-sync of collection &amp; wantlist + weekly link health checks.
                </p>
              </div>
            )}

            {isDiscogsAuthenticated && discogsUsername ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Disc3 className="w-3.5 h-3.5 text-primary" />
                    <span className="text-sm font-medium">{discogsUsername}</span>
                    <span className="text-xs text-muted-foreground">connected</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={onDisconnectDiscogs} className="text-[11px] h-6 px-2 text-muted-foreground hover:text-foreground">
                    Disconnect
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground/80 px-0.5">
                  <span>Last sync</span>
                  <span className="text-right text-foreground/70">{formatRelative(lastSyncAt)}</span>
                  <span>Last rescan</span>
                  <span className="text-right text-foreground/70">{formatRelative(lastRescanAt)}</span>
                </div>

                {syncError && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-[11px] text-destructive/90">
                    Sync error: {syncError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline" size="sm"
                    className="w-full gap-1.5 text-[11px] h-8"
                    onClick={onSyncNow}
                    disabled={isSyncing || !onSyncNow}
                  >
                    <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Syncing…' : 'Re-sync'}
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    className="w-full gap-1.5 text-[11px] h-8"
                    onClick={handleRescan}
                    disabled={isRescanning || !onRescanNow}
                  >
                    <Radar className={`w-3 h-3 ${isRescanning ? 'animate-spin' : ''}`} />
                    {isRescanning ? 'Rescanning…' : 'Rescan links'}
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="w-full gap-2 text-xs h-8" onClick={onConnectDiscogs}>
                <LogIn className="w-3 h-3" /> Connect Discogs Account
              </Button>
            )}
          </section>

          <div className="border-t border-border/40" />

          {/* ─────────── Danger zone — clear (30% smaller) ─────────── */}
          <section>
            <button
              onClick={handleClear}
              className="w-full flex items-center justify-center gap-1.5 text-[10px] h-6 rounded text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-2.5 h-2.5" /> Clear all data &amp; reset
            </button>
          </section>

        </div>
      </DialogContent>
    </Dialog>
  );
}
