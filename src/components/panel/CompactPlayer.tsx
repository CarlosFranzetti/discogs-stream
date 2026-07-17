import React, { useRef, useEffect, useState } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Shuffle, ListMusic, Plus, Heart, Disc3,
} from 'lucide-react';
import { Track } from '@/types/track';
import { PitchSlider } from './PitchSlider';
import { PitchControl } from '@/hooks/usePitch';

interface CompactPlayerProps {
  track: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isShuffle: boolean;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (t: number) => void;
  onToggleShuffle: () => void;
  onAddToCrate?: () => void;
  onAddToPlaylist?: () => void;
  showPitch?: boolean;
  pitchControl: PitchControl;
  audioRef?: React.RefObject<HTMLAudioElement | null>;
  ytPlayerRef?: React.RefObject<YT.Player | null>;
}

function fmt(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function CompactPlayer({
  track,
  isPlaying,
  currentTime,
  duration,
  isShuffle,
  onPlay,
  onPause,
  onNext,
  onPrev,
  onSeek,
  onToggleShuffle,
  onAddToCrate,
  onAddToPlaylist,
  showPitch = true,
  pitchControl,
  audioRef,
  ytPlayerRef,
}: CompactPlayerProps) {
  const { pitch, setPitch, resetPitch, pitchColor, attachAudio, attachYouTube } = pitchControl;
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    if (audioRef?.current) attachAudio(audioRef.current);
  }, [audioRef, attachAudio]);

  useEffect(() => {
    if (ytPlayerRef?.current) attachYouTube(ytPlayerRef.current);
  }, [ytPlayerRef, attachYouTube]);

  useEffect(() => {
    // Direct-audio path (future): HTML5 <audio> uses 0..1 volume.
    if (audioRef?.current) {
      audioRef.current.volume = muted ? 0 : volume;
    }
    // YouTube IFrame player: setVolume expects 0..100, plus mute/unMute.
    const yt = ytPlayerRef?.current;
    if (yt) {
      if (typeof yt.setVolume === 'function') yt.setVolume(Math.round((muted ? 0 : volume) * 100));
      if (muted) {
        if (typeof yt.mute === 'function') yt.mute();
      } else {
        if (typeof yt.unMute === 'function') yt.unMute();
      }
    }
  }, [volume, muted, audioRef, ytPlayerRef]);

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!track) {
    return (
      <div className="flex items-center gap-3 p-3 border-b border-border/40">
        <div className="w-10 h-10 rounded bg-secondary/50 flex items-center justify-center shrink-0">
          <Disc3 className="w-5 h-5 text-muted-foreground animate-spin-slow" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">No track loaded</p>
          <p className="text-[10px] text-muted-foreground/50">Browse your collection to start</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border/40 bg-card/80 backdrop-blur-sm">
      <div className="flex items-center gap-2.5 px-3 pt-3 pb-1">
        <div className="relative shrink-0">
          <img
            src={track.coverUrl || '/placeholder.svg'}
            alt={track.album}
            className={`w-12 h-12 rounded object-cover shadow-lg border border-border/20 ${isPlaying ? 'ring-1 ring-primary/60' : ''}`}
            onError={e => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
          />
          {isPlaying && (
            <div className="absolute inset-0 rounded border border-primary/40 animate-pulse" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground truncate leading-tight">{track.title}</p>
          <p className="text-[10px] text-muted-foreground truncate">{track.artist}</p>
          <div className="flex items-center gap-1 mt-0.5">
            {track.label && <span className="text-[9px] text-muted-foreground/60 truncate max-w-[80px]">{track.label}</span>}
            {track.year > 0 && <span className="text-[9px] text-muted-foreground/40">• {track.year}</span>}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setLiked(l => !l)}
            className={`p-1 rounded transition-colors ${liked ? 'text-pink-500' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Heart className="w-3.5 h-3.5" fill={liked ? 'currentColor' : 'none'} />
          </button>
          {onAddToCrate && (
            <button onClick={onAddToCrate} className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors" title="Add to crate">
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
          {onAddToPlaylist && (
            <button onClick={onAddToPlaylist} className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors" title="Add to playlist">
              <ListMusic className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="px-3 pb-1">
        <div className="relative h-1.5 group cursor-pointer" onClick={e => {
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = (e.clientX - rect.left) / rect.width;
          onSeek(pct * duration);
        }}>
          <div className="absolute inset-0 bg-secondary/40 rounded-full" />
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-[9px] font-mono text-muted-foreground">{fmt(currentTime)}</span>
          <span className="text-[9px] font-mono text-muted-foreground">{fmt(duration)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between px-3 pb-2 gap-2">
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleShuffle}
            className={`p-1.5 rounded transition-colors ${isShuffle ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <Shuffle className="w-3.5 h-3.5" />
          </button>
          <button onClick={onPrev} className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors">
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={isPlaying ? onPause : onPlay}
            className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
          >
            {isPlaying ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4" fill="currentColor" />}
          </button>
          <button onClick={onNext} className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors">
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 flex-1 min-w-0 ml-2">
          <button
            onClick={() => setMuted(m => !m)}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={e => { setVolume(parseFloat(e.target.value)); setMuted(false); }}
            className="w-14 h-1 appearance-none bg-secondary rounded-full cursor-pointer accent-primary"
          />
        </div>
      </div>

      {showPitch && (
        <div className="px-3 pb-2.5 pt-0.5 border-t border-border/20">
          <PitchSlider
            pitch={pitch}
            onChange={setPitch}
            onReset={resetPitch}
            color={pitchColor}
            compact
          />
        </div>
      )}
    </div>
  );
}
