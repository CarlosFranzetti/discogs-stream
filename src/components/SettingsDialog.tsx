import { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { useTheme } from '@/hooks/useTheme';
import { useSettings } from '@/hooks/useSettings';
import { useCSVCollection } from '@/hooks/useCSVCollection';
import { Settings, Trash2, Palette, RefreshCw, Upload, Download, FileText, Music, Disc3, LogIn, AlertTriangle } from 'lucide-react';
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

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Settings className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-card border-border max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          
          {/* Appearance Section */}
          <div className="space-y-4">
            <h4 className="font-medium leading-none flex items-center gap-2 text-primary">
              <Palette className="w-4 h-4" /> Appearance
            </h4>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="pulse-mode">Pulse Animation</Label>
                <p className="text-xs text-muted-foreground">Enable record pulse effect</p>
              </div>
              <Switch
                id="pulse-mode"
                checked={settings.pulseEnabled}
                onCheckedChange={(val) => updateSetting('pulseEnabled', val)}
              />
            </div>

            <RadioGroup
              defaultValue={theme}
              onValueChange={(val) => setTheme(val as 'dark' | 'theme-midnight' | 'theme-vintage')}
              className="grid gap-3 pt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dark" id="theme-dark" />
                <Label htmlFor="theme-dark">Default Dark (Blue)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="theme-midnight" id="theme-midnight" />
                <Label htmlFor="theme-midnight">Midnight (Purple)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="theme-vintage" id="theme-vintage" />
                <Label htmlFor="theme-vintage">Vintage (Green/Amber)</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="border-t border-border" />

          {/* Library Section */}
          <div className="space-y-4">
            <h4 className="font-medium leading-none flex items-center gap-2 text-primary">
              <Music className="w-4 h-4" /> Library Management
            </h4>
            
            <div className="grid gap-3">
              <input
                ref={collectionInputRef}
                type="file"
                accept=".csv"
                onChange={handleCollectionUpload}
                className="hidden"
              />
              <Button variant="outline" className="w-full justify-between" onClick={() => collectionInputRef.current?.click()} disabled={isCSVLoading}>
                <span className="flex items-center gap-2"><Upload className="w-4 h-4" /> Import Collection CSV</span>
                {collection.length > 0 && <span className="text-xs text-muted-foreground">{collection.length} items</span>}
              </Button>

              <input
                ref={wantlistInputRef}
                type="file"
                accept=".csv"
                onChange={handleWantlistUpload}
                className="hidden"
              />
              <Button variant="outline" className="w-full justify-between" onClick={() => wantlistInputRef.current?.click()} disabled={isCSVLoading}>
                <span className="flex items-center gap-2"><Upload className="w-4 h-4" /> Import Wantlist CSV</span>
                {wantlist.length > 0 && <span className="text-xs text-muted-foreground">{wantlist.length} items</span>}
              </Button>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Export Section */}
          <div className="space-y-4">
            <h4 className="font-medium leading-none flex items-center gap-2 text-primary">
              <FileText className="w-4 h-4" /> Export
            </h4>
            <div className="grid gap-2">
              <Button variant="outline" onClick={handleExportCSV} className="w-full gap-2">
                <Download className="w-4 h-4" /> Export Current Playlist (CSV)
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Use the CSV export to import your playlist into Spotify or Apple Music via third-party tools like Soundiiz or Tunemymusic.
              </p>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Discogs Account */}
          <div className="space-y-4">
            <h4 className="font-medium leading-none flex items-center gap-2 text-primary">
              <Disc3 className="w-4 h-4" /> Discogs Account
            </h4>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Discogs login is experimental and may have issues. CSV import is recommended for a stable experience.
              </p>
            </div>
            {isDiscogsAuthenticated && discogsUsername ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Disc3 className="w-4 h-4 text-primary" />
                  <span className="text-foreground font-medium">{discogsUsername}</span>
                  <span className="text-muted-foreground text-xs">connected</span>
                </div>
                <Button variant="outline" size="sm" onClick={onDisconnectDiscogs} className="text-xs">
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button variant="outline" className="w-full gap-2" onClick={onConnectDiscogs}>
                <LogIn className="w-4 h-4" /> Connect Discogs Account
              </Button>
            )}
          </div>

          <div className="border-t border-border" />

          {/* Danger Zone */}
          <div className="space-y-4">
            <h4 className="font-medium leading-none flex items-center gap-2 text-destructive">
              <Trash2 className="w-4 h-4" /> Danger Zone
            </h4>
            <Button variant="destructive" onClick={handleClear} className="w-full gap-2">
              <RefreshCw className="w-4 h-4" /> Clear All Data & Reset
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
