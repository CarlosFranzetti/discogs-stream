import { Button } from '@/components/ui/button';
import { Disc, Heart, Store } from 'lucide-react';
import { Track } from '@/types/track';

export type SourceType = 'collection' | 'wantlist' | 'similar';

interface SourceFiltersProps {
  activeSources: SourceType[];
  onToggleSource: (source: SourceType) => void;
  trackCounts?: Record<SourceType, number>;
}

export function SourceFilters({ activeSources, onToggleSource, trackCounts }: SourceFiltersProps) {
  const sources: { type: SourceType; label: string; icon: React.ReactNode }[] = [
    { type: 'collection', label: 'Collection', icon: <Disc className="w-4 h-4" /> },
    { type: 'wantlist', label: 'Wantlist', icon: <Heart className="w-4 h-4" /> },
    { type: 'similar', label: 'Similar', icon: <Store className="w-4 h-4" /> },
  ];

  return (
    <div className="flex gap-2 flex-wrap">
      {sources.map((source) => {
        const isActive = activeSources.includes(source.type);
        const count = trackCounts?.[source.type] ?? 0;
        
        return (
          <Button
            key={source.type}
            variant={isActive ? 'default' : 'outline'}
            size="sm"
            onClick={() => onToggleSource(source.type)}
            className="gap-1.5"
            disabled={source.type === 'similar'} // Similar not implemented yet
          >
            {source.icon}
            <span>{source.label}</span>
            {count > 0 && (
              <span className="ml-1 text-xs opacity-70">({count})</span>
            )}
          </Button>
        );
      })}
    </div>
  );
}
