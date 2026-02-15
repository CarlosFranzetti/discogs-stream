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
  // CSV upload props
  hasCSVData?: boolean;
  csvCollectionCount?: number;
  csvWantlistCount?: number;
  onCollectionCSVUpload?: (file: File) => Promise<void>;
  onWantlistCSVUpload?: (file: File) => Promise<void>;
  onClearCSV?: () => void;
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
  onClearCSV,
  csvError,
  isCSVLoading = false,
}: MobileTitleScreenProps) {
  const collectionInputRef = useRef<HTMLInputElement>(null);
  const wantlistInputRef = useRef<HTMLInputElement>(null);

  const handleCollectionChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onCollectionCSVUpload) {
      await onCollectionCSVUpload(file);
      if (collectionInputRef.current) {
        collectionInputRef.current.value = '';
      }
    }
  };

  const handleWantlistChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onWantlistCSVUpload) {
      await onWantlistCSVUpload(file);
      if (wantlistInputRef.current) {
        wantlistInputRef.current.value = '';
      }
    }
  };
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background px-6 py-8 max-w-md mx-auto animate-fade-in">
      {/* Radio icon with glow */}
      <div className="relative mb-6">
        {/* Outer glow rings with staggered pulse animations */}
        <div className="absolute inset-0 w-28 h-28 rounded-full bg-primary/5 animate-[pulse_2s_ease-in-out_infinite]" />
        <div className="absolute inset-2 w-24 h-24 rounded-full border border-primary/20 animate-[pulse_2s_ease-in-out_0.3s_infinite]" />
        <div className="absolute inset-4 w-20 h-20 rounded-full border border-primary/30 animate-[pulse_2s_ease-in-out_0.6s_infinite]" />
        
        {/* Icon container */}
        <div className="relative w-28 h-28 rounded-full bg-gradient-to-b from-card to-background border border-border flex items-center justify-center">
          <Radio className="w-10 h-10 text-primary" strokeWidth={1.5} />
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-6">
        <h1 className="text-5xl font-sans font-bold text-foreground tracking-tight">
          Discogs
        </h1>
        <h2 className="text-4xl font-sans font-bold text-primary tracking-tight glow-text">
          Radio
        </h2>
        <p className="text-muted-foreground mt-3">
          Stream music from your Discogs collection
        </p>
      </div>

      {/* Connection card */}
      <div className="w-full bg-card/50 backdrop-blur-sm rounded-2xl border border-border p-5 mb-6">
        {isDiscogsAuthenticating ? (
          /* Loading state */
          <div className="flex flex-col items-center py-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
            <p className="text-muted-foreground">Connecting to Discogs...</p>
          </div>
        ) : isDiscogsAuthenticated && discogsUsername ? (
          /* Connected state */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Disc3 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{discogsUsername}</p>
                  <p className="text-xs text-muted-foreground">Connected to Discogs</p>
                </div>
              </div>
              <button onClick={onDisconnectDiscogs} className="text-muted-foreground hover:text-foreground p-2">
                <LogOut className="w-5 h-5" />
              </button>
            </div>

            {/* Source toggles */}
            <div className="pt-2">
              <p className="text-sm text-muted-foreground mb-3 text-center">Select sources to include:</p>
              <div className="space-y-2">
                <SourceToggle
                  label="Collection"
                  icon={<Disc3 className="w-5 h-5" />}
                  isActive={activeSources.includes('collection')}
                  onToggle={() => onToggleSource('collection')}
                />
                <SourceToggle
                  label="Wantlist"
                  icon={<Heart className="w-5 h-5" />}
                  isActive={activeSources.includes('wantlist')}
                  onToggle={() => onToggleSource('wantlist')}
                />
              </div>
            </div>
          </div>
        ) : (
          /* Not connected state */
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center py-4">
              Connect via CSV files below or sign in
            </p>
          </div>
        )}
      </div>

      {/* CSV Upload Section */}
      {!isDiscogsAuthenticated && (
        <div className="w-full bg-card/50 backdrop-blur-sm rounded-2xl border border-border p-5 mb-6">
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Or load from CSV files</p>
              <p className="text-xs text-muted-foreground mt-1">No account needed</p>
            </div>

            {hasCSVData && (
              <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="text-sm text-foreground">
                    {csvCollectionCount > 0 && `${csvCollectionCount} collection`}
                    {csvCollectionCount > 0 && csvWantlistCount > 0 && ', '}
                    {csvWantlistCount > 0 && `${csvWantlistCount} wantlist`}
                  </span>
                </div>
                {onClearCSV && (
                  <button
                    onClick={onClearCSV}
                    className="text-muted-foreground hover:text-foreground"
                    disabled={isCSVLoading}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {csvError && (
              <p className="text-xs text-destructive text-center p-2 bg-destructive/10 rounded">{csvError}</p>
            )}

            <div className="space-y-2">
              <input
                ref={collectionInputRef}
                type="file"
                accept=".csv"
                onChange={handleCollectionChange}
                className="hidden"
                id="collection-csv-upload"
                disabled={isCSVLoading}
              />
              <Button
                variant="outline"
                className="w-full gap-2 border-border hover:border-primary hover:bg-primary/5"
                onClick={() => collectionInputRef.current?.click()}
                disabled={isCSVLoading}
              >
                {isCSVLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Upload Collection CSV
              </Button>

              <input
                ref={wantlistInputRef}
                type="file"
                accept=".csv"
                onChange={handleWantlistChange}
                className="hidden"
                id="wantlist-csv-upload"
                disabled={isCSVLoading}
              />
              <Button
                variant="outline"
                className="w-full gap-2 border-border hover:border-primary hover:bg-primary/5"
                onClick={() => wantlistInputRef.current?.click()}
                disabled={isCSVLoading}
              >
                {isCSVLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Upload Wantlist CSV
              </Button>
            </div>

            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground">How to export from Discogs</summary>
              <ol className="list-decimal list-inside space-y-1 ml-2 mt-2">
                <li>Go to your Discogs collection or wantlist</li>
                <li>Click the "..." menu and select "Export"</li>
                <li>Choose CSV format and download</li>
                <li>Upload the file here</li>
              </ol>
            </details>
          </div>
        </div>
      )}

      {/* Start Listening button */}
      <Button
        onClick={onStartListening}
        size="lg"
        className="w-full gap-2 py-6 text-base shadow-glow"
        disabled={isDiscogsAuthenticated && trackCount === 0 && !isVerifying}
      >
        <Play className="w-5 h-5" />
        {isVerifying && trackCount === 0 ? (
          `Finding tracks... ${verifyProgress?.verified || 0}/${verifyProgress?.total || 0}`
        ) : isVerifying && trackCount > 0 ? (
          `Start Listening (${trackCount}+ tracks)`
        ) : trackCount > 0 ? (
          `Start Listening (${trackCount} tracks)`
        ) : (
          'Start Listening'
        )}
      </Button>

      {/* User auth section */}
      <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
        <User className="w-4 h-4" />
        {isUserLoggedIn ? (
          <>
            <span>Signed in as {userEmail?.split('@')[0]}</span>
            <button onClick={onSignOut} className="text-primary hover:underline ml-2">
              Sign out
            </button>
          </>
        ) : (
          <button onClick={onNavigateAuth} className="text-primary hover:underline">
            Sign in to save likes
          </button>
        )}
      </div>
    </div>
  );
}
