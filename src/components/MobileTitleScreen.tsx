import { Button } from '@/components/ui/button';
import { Disc3, Heart, Play, User, LogOut, Radio, Loader2, Upload, FileText, X } from 'lucide-react';
import { SourceType } from './SourceFilters';
import { useRef } from 'react';

interface SourceToggleProps {
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onToggle: () => void;
}

function SourceToggle({ label, icon, isActive, onToggle }: SourceToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center justify-between px-4 py-3 rounded-xl font-medium transition-all text-sm w-full ${
        isActive
          ? 'bg-primary/10 border border-primary text-foreground'
          : 'bg-card border border-border text-muted-foreground'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={isActive ? 'text-primary' : ''}>{icon}</span>
        <span>{label}</span>
      </div>
      <div className={`relative w-10 h-6 rounded-full transition-colors ${isActive ? 'bg-primary' : 'bg-muted'}`}>
        <div
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200 ${
            isActive ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </div>
    </button>
  );
}

interface MobileTitleScreenProps {
  isDiscogsAuthenticated: boolean;
  isDiscogsAuthenticating: boolean;
  discogsUsername?: string;
  discogsError?: string | null;
  onConnectDiscogs: () => void;
  onDisconnectDiscogs: () => void;
  isUserLoggedIn: boolean;
  userEmail?: string;
  onSignOut: () => void;
  onNavigateAuth: () => void;
  activeSources: SourceType[];
  onToggleSource: (source: SourceType) => void;
  onStartListening: () => void;
  trackCount?: number;
  isVerifying?: boolean;
  verifyProgress?: { verified: number; total: number };
  hasCSVData?: boolean;
  csvCollectionCount?: number;
  csvWantlistCount?: number;
  onCollectionCSVUpload?: (file: File) => Promise<void>;
  onWantlistCSVUpload?: (file: File) => Promise<void>;
  onClearCollection?: () => void;
  onClearWantlist?: () => void;
  csvError?: string | null;
  isCSVLoading?: boolean;
}

export function MobileTitleScreen({
  isDiscogsAuthenticated,
  isDiscogsAuthenticating,
  discogsUsername,
  discogsError,
  onConnectDiscogs,
  onDisconnectDiscogs,
  isUserLoggedIn,
  userEmail,
  onSignOut,
  onNavigateAuth,
  activeSources,
  onToggleSource,
  onStartListening,
  trackCount = 0,
  isVerifying = false,
  verifyProgress,
  hasCSVData = false,
  csvCollectionCount = 0,
  csvWantlistCount = 0,
  onCollectionCSVUpload,
  onWantlistCSVUpload,
  onClearCollection,
  onClearWantlist,
  csvError,
  isCSVLoading = false,
}: MobileTitleScreenProps) {
  const collectionInputRef = useRef<HTMLInputElement>(null);
  const wantlistInputRef = useRef<HTMLInputElement>(null);

  // Show "Add to Home Screen" hint permanently whenever the app is running in
  // the browser (not installed). It auto-hides once launched standalone from
  // the home-screen icon, because the browser chrome is already gone then.
  const showInstallHint = (() => {
    if (typeof window === 'undefined') return false;
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    return !standalone;
  })();
  const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

  const handleCollectionChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onCollectionCSVUpload) {
      await onCollectionCSVUpload(file);
      if (collectionInputRef.current) collectionInputRef.current.value = '';
    }
  };

  const handleWantlistChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onWantlistCSVUpload) {
      await onWantlistCSVUpload(file);
      if (wantlistInputRef.current) wantlistInputRef.current.value = '';
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden safe-area max-w-md mx-auto w-full px-6 animate-fade-in relative">

      {/* ── Full-screen background disc — fills viewport height ── */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: '100svh',
          height: '100svh',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      >
        <div className="absolute inset-0 rounded-full bg-primary/3 animate-[pulse_3s_ease-in-out_infinite]" />
        <div className="absolute inset-[8%] rounded-full border border-primary/10 animate-[pulse_3s_ease-in-out_0.3s_infinite]" />
        <div className="absolute inset-[16%] rounded-full border border-primary/15 animate-[pulse_3s_ease-in-out_0.6s_infinite]" />
        <div className="absolute inset-[24%] rounded-full border border-primary/20 animate-[pulse_3s_ease-in-out_0.9s_infinite]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Radio className="w-1/3 h-1/3 text-primary/15" strokeWidth={0.4} />
        </div>
      </div>

      {/* ── Branding ── */}
      <div className="flex flex-col items-center pt-14 pb-2 relative">
        {/* Title — Discogs + Stream with slight overlap */}
        <div className="text-center mb-3">
          <h1 className="text-4xl font-sans font-bold text-foreground tracking-tight leading-none">
            Discogs
          </h1>
          <h2 className="text-3xl font-sans font-bold text-primary tracking-tight glow-text -mt-1">
            Stream
          </h2>
        </div>
        <p className="text-muted-foreground text-sm">
          Stream your Discogs collection
        </p>
      </div>

      {/* ── Main content — flows from top, spacer takes leftover space at bottom ── */}
      <div className="flex flex-col gap-3 mt-8 relative">

        {/* Discogs auth card — only when authenticating or connected */}
        {(isDiscogsAuthenticating || (isDiscogsAuthenticated && discogsUsername)) && (
          <div className="w-full bg-card/50 backdrop-blur-sm rounded-2xl border border-border p-4">
            {isDiscogsAuthenticating ? (
              <div className="flex flex-col items-center py-3">
                <Loader2 className="w-7 h-7 text-primary animate-spin mb-2" />
                <p className="text-sm text-muted-foreground">Connecting to Discogs...</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <Disc3 className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-foreground">{discogsUsername}</p>
                      <p className="text-xs text-muted-foreground">Connected to Discogs</p>
                    </div>
                  </div>
                  <button onClick={onDisconnectDiscogs} className="text-muted-foreground hover:text-foreground p-1.5">
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  <SourceToggle
                    label="Collection"
                    icon={<Disc3 className="w-4 h-4" />}
                    isActive={activeSources.includes('collection')}
                    onToggle={() => onToggleSource('collection')}
                  />
                  <SourceToggle
                    label="Wantlist"
                    icon={<Heart className="w-4 h-4" />}
                    isActive={activeSources.includes('wantlist')}
                    onToggle={() => onToggleSource('wantlist')}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Primary CTA — Connect to Discogs (OAuth) */}
        {!isDiscogsAuthenticated && (
          <div className="w-full bg-card/50 backdrop-blur-sm rounded-2xl border border-border p-4 space-y-3">
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Connect your Discogs account</p>
              <p className="text-xs text-muted-foreground mt-0.5">Auto-sync your collection &amp; wantlist</p>
            </div>

            {discogsError && (
              <p className="text-xs text-destructive text-center p-2 bg-destructive/10 rounded">{discogsError}</p>
            )}

            <Button
              onClick={onConnectDiscogs}
              className="w-full gap-2 py-[18px] text-[0.9rem] shadow-glow"
            >
              <Disc3 className="w-4 h-4" />
              Connect to Discogs
            </Button>

            {/* CSV fallback — subordinate, smaller typeface */}
            <input ref={collectionInputRef} type="file" accept=".csv" onChange={handleCollectionChange} className="hidden" disabled={isCSVLoading} />
            <input ref={wantlistInputRef} type="file" accept=".csv" onChange={handleWantlistChange} className="hidden" disabled={isCSVLoading} />

            <div className="pt-2 border-t border-border/40 space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 text-center">
                Or load CSV
              </p>

              {(csvCollectionCount > 0 || csvWantlistCount > 0) && (
                <div className="space-y-1">
                  {csvCollectionCount > 0 && (
                    <div className="flex items-center justify-between px-2 py-1 bg-primary/5 rounded">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3 h-3 text-primary" />
                        <span className="text-[11px] text-foreground/80">{csvCollectionCount} collection</span>
                      </div>
                      {onClearCollection && (
                        <button onClick={onClearCollection} disabled={isCSVLoading} className="text-muted-foreground hover:text-primary">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                  {csvWantlistCount > 0 && (
                    <div className="flex items-center justify-between px-2 py-1 bg-primary/5 rounded">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3 h-3 text-primary" />
                        <span className="text-[11px] text-foreground/80">{csvWantlistCount} wantlist</span>
                      </div>
                      {onClearWantlist && (
                        <button onClick={onClearWantlist} disabled={isCSVLoading} className="text-muted-foreground hover:text-primary">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {csvError && (
                <p className="text-[10px] text-destructive text-center p-1.5 bg-destructive/10 rounded">{csvError}</p>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-[11px] h-7 text-muted-foreground hover:text-foreground"
                  onClick={() => collectionInputRef.current?.click()}
                  disabled={isCSVLoading}
                >
                  {isCSVLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                  Collection
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-[11px] h-7 text-muted-foreground hover:text-foreground"
                  onClick={() => wantlistInputRef.current?.click()}
                  disabled={isCSVLoading}
                >
                  {isCSVLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                  Wantlist
                </Button>
              </div>

              <details className="text-[10px] text-muted-foreground/70">
                <summary className="cursor-pointer hover:text-foreground text-center">How to export CSVs from Discogs</summary>
                <ol className="list-decimal list-inside space-y-0.5 ml-2 mt-1">
                  <li>Go to your Discogs collection or wantlist</li>
                  <li>Click the "..." menu and select "Export"</li>
                  <li>Choose CSV format and download</li>
                  <li>Upload the file here</li>
                </ol>
              </details>
            </div>
          </div>
        )}

        {/* Start Listening — ~10% smaller than original py-6 text-base */}
        <Button
          onClick={onStartListening}
          className="w-full gap-2 py-[18px] text-[0.9rem] shadow-glow"
          disabled={isDiscogsAuthenticated && trackCount === 0 && !isVerifying}
        >
          <Play className="w-4 h-4" />
          {isVerifying && trackCount === 0
            ? `Finding tracks... ${verifyProgress?.verified || 0}/${verifyProgress?.total || 0}`
            : isVerifying && trackCount > 0
            ? `Start Listening (${trackCount}+ tracks)`
            : trackCount > 0
            ? `Start Listening (${trackCount} tracks)`
            : 'Start Listening'}
        </Button>

        {/* Permanent install hint — only shown when running in the browser; hidden
            automatically once the app is launched from the Home Screen. */}
        {showInstallHint && (
          <p className="text-[11px] text-muted-foreground/70 text-center leading-snug px-2">
            {isIOS
              ? 'Tap Share → "Add to Home Screen" for the full-screen app.'
              : 'Install via browser menu → "Install app" for the full-screen experience.'}
          </p>
        )}

        {/* User auth */}
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <User className="w-4 h-4" />
          {isUserLoggedIn ? (
            <>
              <span>Signed in as {userEmail?.split('@')[0]}</span>
              <button onClick={onSignOut} className="text-primary hover:underline ml-2">Sign out</button>
            </>
          ) : (
            <button onClick={onNavigateAuth} className="text-primary hover:underline">
              Sign in to save likes
            </button>
          )}
        </div>
      </div>

      {/* Flexible spacer — absorbs remaining screen height, ensures space at bottom */}
      <div className="flex-1 min-h-4" />
    </div>
  );
}
