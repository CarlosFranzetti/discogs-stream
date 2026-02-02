import { AlertTriangle, ExternalLink } from 'lucide-react';

interface QuotaBannerProps {
  onOpenYouTube?: () => void;
  showOpenButton?: boolean;
}

export function QuotaBanner({ onOpenYouTube, showOpenButton = true }: QuotaBannerProps) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-600 dark:text-amber-400">
      <div className="flex items-center gap-2 text-xs">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>Demo mode — YouTube quota exceeded</span>
      </div>
      {showOpenButton && onOpenYouTube && (
        <button
          onClick={onOpenYouTube}
          className="flex items-center gap-1 text-xs font-medium hover:underline shrink-0"
        >
          <ExternalLink className="w-3 h-3" />
          Open in YouTube
        </button>
      )}
    </div>
  );
}
