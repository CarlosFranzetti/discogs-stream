import { Button } from '@/components/ui/button';
import { Disc3, Heart, Play, User, LogOut } from 'lucide-react';
import { SourceType } from './SourceFilters';

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
          ? 'bg-primary text-primary-foreground'
          : 'bg-card border border-border text-muted-foreground'
      }`}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`w-10 h-6 rounded-full transition-colors ${isActive ? 'bg-primary-foreground/30' : 'bg-muted'}`}>
        <div className={`w-5 h-5 rounded-full bg-background shadow-sm transition-transform mt-0.5 ${isActive ? 'translate-x-4.5 ml-0.5' : 'translate-x-0.5'}`} />
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
}: MobileTitleScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background px-6 py-8 max-w-md mx-auto">
      {/* Logo and title */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-display font-bold text-foreground italic mb-2">
          Discogs Radio
        </h1>
        <p className="text-muted-foreground">
          Stream music from your Discogs collection
        </p>
      </div>

      {/* Discogs connection card */}
      {isDiscogsAuthenticated && discogsUsername ? (
        <div className="w-full bg-card rounded-xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Disc3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">{discogsUsername}</p>
              <p className="text-xs text-muted-foreground">Connected to Discogs</p>
            </div>
          </div>
          <button onClick={onDisconnectDiscogs} className="text-muted-foreground hover:text-foreground">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <div className="w-full mb-6">
          <Button
            onClick={onConnectDiscogs}
            disabled={isDiscogsAuthenticating}
            variant="outline"
            className="w-full gap-2 py-6"
          >
            <Disc3 className="w-5 h-5" />
            {isDiscogsAuthenticating ? 'Connecting...' : 'Connect to Discogs'}
          </Button>
          {discogsError && (
            <p className="text-xs text-destructive mt-2 text-center">{discogsError}</p>
          )}
        </div>
      )}

      {/* Source toggles - only show when connected */}
      {isDiscogsAuthenticated && (
        <div className="w-full mb-6">
          <p className="text-sm text-muted-foreground mb-3 text-center">Select sources to include:</p>
          <div className="space-y-3">
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
      )}

      {/* Start Listening button */}
      <Button
        onClick={onStartListening}
        size="lg"
        className="w-full gap-2 py-6 text-base"
      >
        <Play className="w-5 h-5" />
        Start Listening
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
