import { Button } from '@/components/ui/button';
import { Disc3, LogOut, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

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

  if (error) {
    return (
      <div className="px-4 py-3 bg-destructive/10 rounded-lg border border-destructive/20">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-destructive">Connection Failed</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </div>
        </div>
        <Button 
          onClick={onConnect} 
          variant="outline"
          size="sm"
          className="w-full mt-3 gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Retry Connection
        </Button>
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
    </div>
  );
}
