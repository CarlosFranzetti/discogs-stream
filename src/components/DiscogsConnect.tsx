import { Button } from '@/components/ui/button';
import { Disc3, LogOut, Loader2 } from 'lucide-react';

interface DiscogsConnectProps {
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  username?: string;
  error?: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function DiscogsConnect({
  isAuthenticated,
  isAuthenticating,
  username,
  error,
  onConnect,
  onDisconnect,
}: DiscogsConnectProps) {
  if (isAuthenticating) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-muted/50 rounded-lg">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Connecting to Discogs...</span>
      </div>
    );
  }

  if (isAuthenticated && username) {
    return (
      <div className="flex items-center justify-between px-4 py-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-3">
          <Disc3 className="w-5 h-5 text-primary" />
          <div>
            <p className="text-sm font-medium">{username}</p>
            <p className="text-xs text-muted-foreground">Connected to Discogs</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onDisconnect}>
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      <Button 
        onClick={onConnect} 
        className="w-full gap-2"
        variant="outline"
      >
        <Disc3 className="w-4 h-4" />
        Connect to Discogs
      </Button>
      {error && (
        <p className="mt-2 text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
