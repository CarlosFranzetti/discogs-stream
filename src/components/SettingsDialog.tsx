import { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTheme } from '@/hooks/useTheme';
import { useSettings } from '@/hooks/useSettings';
import { useCSVCollection } from '@/hooks/useCSVCollection';
import { Settings, Trash2, Palette, RefreshCw, Upload, Download, Music, Disc3, LogIn, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Track } from '@/types/track';

interface SettingsDialogProps {
  onClearData: () => void;
  playlistTracks?: Track[];
  isDiscogsAuthenticated?: boolean;
  discogsUsername?: string;
  onConnectDiscogs?: () => void;
  onDisconnectDiscogs?: () => void;
}

export function SettingsDialog({
  onClearData,
  playlistTracks = [],
  isDiscogsAuthenticated = false,
  discogsUsername,
  onConnectDiscogs,
  onDisconnectDiscogs,
}: SettingsDialogProps) {
  const { theme, setTheme } = useTheme();
  const { settings, updateSetting } = useSettings();
  const { 
    loadCollectionCSV, 
    loadWantlistCSV, 
    isLoading: isCSVLoading,
    collection,
    wantlist
  } = useCSVCollection();

  const collectionInputRef = useRef<HTMLInputElement>(null);
  const wantlistInputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    if (confirm('Are you sure you want to clear all local data (CSV, cache)? This cannot be undone.')) {
      onClearData();
      toast.success('All local data cleared. Please reload.');
      setTimeout(() => window.location.reload(), 1000);
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
      ...playlistTracks.map(t => 
        [
          `"${t.artist}"`,
          `"${t.title}"`,
          `"${t.album}"`,
          t.year,
          `"${t.genre}"`,
          t.youtubeId || ''
        ].join(',')
      )
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
        const tracks = await loadCollectionCSV(file);
        toast.success(`Loaded ${tracks.length} collection items`);
      } catch (err) {
        toast.error('Failed to load CSV');
      }
      if (collectionInputRef.current) collectionInputRef.current.value = '';
    }
  };

  const handleWantlistUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const tracks = await loadWantlistCSV(file);
        toast.success(`Loaded ${tracks.length} wantlist items`);
      } catch (err) {
        toast.error('Failed to load CSV');
      }
      if (wantlistInputRef.current) wantlistInputRef.current.value = '';
    }
  };

  const THEMES = [
    { value: 'dark', label: 'Dark' },
    { value: 'theme-midnight', label: 'Midnight' },
    { value: 'theme-vintage', label: 'Vintage' },
  ] as const;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Settings className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px] bg-card border-border p-0 font-sans">
        <DialogHeader className="px-5 pt-3 pb-2 border-b border-border/50">
          <DialogTitle className="text-sm font-medium text-foreground">Settings</DialogTitle>
        </DialogHeader>

        <div className="px-5 pt-3 pb-4 space-y-3.5">

          {/* Appearance */}
          <div className="space-y-2.5">
            <p className="text-[10px] font-semibold text-primary/70 uppercase tracking-widest flex items-center gap-1.5">
              <Palette className="w-3 h-3" /> Appearance
            </p>

            {/* Pulse + Theme + Playlist size in one compact block */}
            <div className="flex items-center justify-between">
              <Label className="text-xs text-foreground/80">Pulse animation</Label>
              <Switch
                id="pulse-mode"
                checked={settings.pulseEnabled}
                onCheckedChange={(val) => updateSetting('pulseEnabled', val)}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs text-foreground/80 shrink-0">Theme</Label>
              <div className="flex gap-1">
                {THEMES.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={`px-2.5 py-0.5 rounded-full text-[11px] border transition-colors ${
                      theme === value
                        ? 'bg-primary/15 text-primary border-primary/40'
                        : 'bg-muted/60 text-muted-foreground border-transparent hover:border-border'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs text-foreground/80 shrink-0">Playlist size</Label>
              <div className="flex gap-1">
                {(['Tight', 'Loose'] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => updateSetting('playlistSize', size.toLowerCase() as 'tight' | 'loose')}
                    className={`px-2.5 py-0.5 rounded-full text-[11px] border transition-colors ${
                      settings.playlistSize === size.toLowerCase()
                        ? 'bg-primary/15 text-primary border-primary/40'
                        : 'bg-muted/60 text-muted-foreground border-transparent hover:border-border'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-border/40" />

          {/* Library */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-primary/70 uppercase tracking-widest flex items-center gap-1.5">
              <Music className="w-3 h-3" /> Library
            </p>
            <input ref={collectionInputRef} type="file" accept=".csv" onChange={handleCollectionUpload} className="hidden" />
            <input ref={wantlistInputRef} type="file" accept=".csv" onChange={handleWantlistUpload} className="hidden" />

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="justify-between text-xs h-8 px-3" onClick={() => collectionInputRef.current?.click()} disabled={isCSVLoading}>
                <span className="flex items-center gap-1.5"><Upload className="w-3 h-3" /> Collection</span>
                {collection.length > 0 && <span className="text-muted-foreground">{collection.length}</span>}
              </Button>
              <Button variant="outline" size="sm" className="justify-between text-xs h-8 px-3" onClick={() => wantlistInputRef.current?.click()} disabled={isCSVLoading}>
                <span className="flex items-center gap-1.5"><Upload className="w-3 h-3" /> Wantlist</span>
                {wantlist.length > 0 && <span className="text-muted-foreground">{wantlist.length}</span>}
              </Button>
            </div>

            <Button variant="outline" size="sm" onClick={handleExportCSV} className="w-full gap-2 text-xs h-8">
              <Download className="w-3 h-3" /> Export Playlist CSV
            </Button>
          </div>

          <div className="border-t border-border/40" />

          {/* Discogs */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-primary/70 uppercase tracking-widest flex items-center gap-1.5">
              <Disc3 className="w-3 h-3" /> Discogs Account
            </p>
            <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 flex items-center gap-2">
              <AlertTriangle className="w-3 h-3 text-amber-500/70 shrink-0" />
              <p className="text-[11px] text-muted-foreground leading-snug">CSV import is recommended. OAuth is experimental.</p>
            </div>
            {isDiscogsAuthenticated && discogsUsername ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Disc3 className="w-3.5 h-3.5 text-primary" />
                  <span className="text-sm font-medium">{discogsUsername}</span>
                  <span className="text-xs text-muted-foreground">connected</span>
                </div>
                <Button variant="outline" size="sm" onClick={onDisconnectDiscogs} className="text-xs h-7">Disconnect</Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="w-full gap-2 text-xs h-8" onClick={onConnectDiscogs}>
                <LogIn className="w-3 h-3" /> Connect Discogs Account
              </Button>
            )}
          </div>

          <div className="border-t border-border/40" />

          {/* Danger zone */}
          <Button variant="destructive" size="sm" onClick={handleClear} className="w-full gap-2 text-xs h-8">
            <RefreshCw className="w-3 h-3" /> Clear All Data & Reset
          </Button>

        </div>
      </DialogContent>
    </Dialog>
  );
}
