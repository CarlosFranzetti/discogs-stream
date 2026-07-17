import React, { useState } from 'react';
import { Disc3, Music, ListMusic, ExternalLink, RefreshCw } from 'lucide-react';
import { Track } from '@/types/track';
import { PitchSlider } from './PitchSlider';
import { PitchControl } from '@/hooks/usePitch';

interface NowPlayingViewProps {
  track: Track | null;
  playlist: Track[];
  currentIndex: number;
  isPlaying: boolean;
  showRainbow: boolean;
  showPitch: boolean;
  onSelectTrack: (index: number) => void;
  onPlay: () => void;
  pitchControl: PitchControl;
  audioRef?: React.RefObject<HTMLAudioElement | null>;
  ytPlayerRef?: React.RefObject<YT.Player | null>;
}

export function NowPlayingView({
  track,
  playlist,
  currentIndex,
  isPlaying,
  showRainbow,
  showPitch,
  onSelectTrack,
  onPlay,
  pitchControl,
  audioRef,
  ytPlayerRef,
}: NowPlayingViewProps) {
  const { pitch, setPitch, resetPitch, pitchColor, attachAudio, attachYouTube } = pitchControl;
  const [search, setSearch] = useState('');

  React.useEffect(() => {
    if (audioRef?.current) attachAudio(audioRef.current);
  }, [audioRef, attachAudio]);

  React.useEffect(() => {
    if (ytPlayerRef?.current) attachYouTube(ytPlayerRef.current);
  }, [ytPlayerRef, attachYouTube]);

  const filtered = playlist.filter(t =>
    !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.artist.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      {track ? (
        <>
          <div className="flex flex-col items-center px-4 py-4 gap-3">
            <div className={`relative w-28 h-28 rounded-lg shadow-2xl ${isPlaying && showRainbow ? 'ring-2 ring-primary animate-pulse' : ''}`}>
              <img
                src={track.coverUrl || '/placeholder.svg'}
                alt={track.album}
                className={`w-full h-full rounded-lg object-cover border border-border/20 ${isPlaying ? 'ring-1 ring-primary/40' : ''}`}
                onError={e => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
              />
              {isPlaying && (
                <div className="absolute bottom-1.5 right-1.5 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-primary-foreground rounded-full animate-pulse" />
                </div>
              )}
            </div>

            <div className="text-center min-w-0 w-full">
              <p className="text-sm font-bold truncate">{track.title}</p>
              <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
              <div className="flex items-center justify-center gap-2 mt-1">
                {track.album && <span className="text-[10px] text-muted-foreground/60">{track.album}</span>}
                {track.year > 0 && <span className="text-[10px] text-muted-foreground/40">• {track.year}</span>}
              </div>
              <div className="flex items-center justify-center gap-2 mt-0.5">
                {track.label && <span className="text-[9px] text-primary/60">{track.label}</span>}
                {track.genre && <span className="text-[9px] text-muted-foreground/40">· {track.genre}</span>}
              </div>
            </div>

            {showPitch && (
              <div className="w-full px-1">
                <PitchSlider pitch={pitch} onChange={setPitch} onReset={resetPitch} color={pitchColor} />
              </div>
            )}
          </div>

          <div className="px-3 py-2 border-t border-border/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Queue · {playlist.length} tracks</span>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filter…"
                className="text-[10px] bg-secondary/30 border border-border/30 rounded px-2 py-0.5 focus:outline-none focus:border-primary/50 w-24"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="divide-y divide-border/20">
              {filtered.map((t, displayIdx) => {
                const realIdx = playlist.findIndex(p => p.id === t.id);
                const isActive = realIdx === currentIndex;
                return (
                  <button
                    key={t.id}
                    onClick={() => onSelectTrack(realIdx)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-secondary/20 ${isActive ? 'bg-primary/5 border-l-2 border-primary' : ''}`}
                  >
                    <div className="w-5 shrink-0 text-center">
                      {isActive ? (
                        <div className="w-2 h-2 rounded-full bg-primary mx-auto animate-pulse" />
                      ) : (
                        <span className="text-[9px] text-muted-foreground/40">{realIdx + 1}</span>
                      )}
                    </div>
                    <img
                      src={t.coverUrl || '/placeholder.svg'}
                      alt={t.title}
                      className={`w-8 h-8 rounded object-cover shrink-0 border ${isActive ? 'border-primary/40' : 'border-border/20'}`}
                      onError={e => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium truncate ${isActive ? 'text-primary' : ''}`}>{t.title}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{t.artist}</p>
                    </div>
                    {t.workingStatus === 'pending' && <RefreshCw className="w-3 h-3 text-muted-foreground/40 animate-spin shrink-0" />}
                    {t.workingStatus === 'non_working' && <span className="text-[9px] text-destructive/60 shrink-0">⊘</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
          <Disc3 className="w-16 h-16 opacity-10" />
          <p className="text-sm">Nothing playing</p>
          <p className="text-xs opacity-60">Load your collection to start streaming</p>
        </div>
      )}
    </div>
  );
}
