import React from 'react';
import { RotateCcw, ChevronUp, ChevronDown } from 'lucide-react';
import { PITCH_MIN, PITCH_MAX } from '@/hooks/usePitch';

interface PitchSliderProps {
  pitch: number;
  onChange: (value: number) => void;
  onReset: () => void;
  color: string;
  compact?: boolean;
}

export function PitchSlider({ pitch, onChange, onReset, color, compact = false }: PitchSliderProps) {
  const pct = ((pitch - PITCH_MIN) / (PITCH_MAX - PITCH_MIN)) * 100;
  const sign = pitch > 0 ? '+' : '';
  const label = `${sign}${pitch.toFixed(1)}%`;

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[9px] text-muted-foreground font-mono shrink-0">PITCH</span>
        <input
          type="range"
          min={PITCH_MIN}
          max={PITCH_MAX}
          step={0.1}
          value={pitch}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="flex-1 h-1 appearance-none bg-secondary rounded-full cursor-pointer accent-primary"
          style={{ accentColor: color }}
        />
        <button
          onClick={onReset}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Reset pitch"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
        <span className="text-[9px] font-mono shrink-0 min-w-[36px] text-right" style={{ color }}>
          {label}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div className="flex items-center justify-between w-full">
        <span className="text-xs font-mono text-muted-foreground tracking-widest">PITCH</span>
        <span className="text-sm font-mono font-bold" style={{ color }}>{label}</span>
        <button
          onClick={onReset}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>RESET</span>
        </button>
      </div>

      <div className="relative w-full h-3 group">
        <div className="absolute inset-y-0 left-0 right-0 rounded-full bg-secondary/60 border border-border/40" />
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, hsl(142 70% 45%), ${color})`,
            opacity: 0.7,
          }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-background shadow-lg transition-all"
          style={{
            left: `calc(${pct}% - 8px)`,
            background: color,
            boxShadow: `0 0 8px ${color}80`,
          }}
        />
        <input
          type="range"
          min={PITCH_MIN}
          max={PITCH_MAX}
          step={0.1}
          value={pitch}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
        />
      </div>

      <div className="flex justify-between w-full text-[9px] font-mono text-muted-foreground">
        <span>-8%</span>
        <div className="flex items-center gap-1">
          <button onClick={() => onChange(Math.max(PITCH_MIN, pitch - 0.1))} className="hover:text-foreground">
            <ChevronDown className="w-3 h-3" />
          </button>
          <span className="w-px h-3 bg-border/60" />
          <button onClick={() => onChange(Math.min(PITCH_MAX, pitch + 0.1))} className="hover:text-foreground">
            <ChevronUp className="w-3 h-3" />
          </button>
        </div>
        <span>+8%</span>
      </div>

      <div className="flex gap-2 w-full">
        {[-4, -2, -1, 0, 1, 2, 4].map(mark => (
          <button
            key={mark}
            onClick={() => onChange(mark)}
            className="flex-1 text-[9px] font-mono py-0.5 rounded border border-border/30 hover:border-primary/50 hover:text-primary transition-all"
            style={{ color: mark === 0 ? color : undefined }}
          >
            {mark === 0 ? '0' : `${mark > 0 ? '+' : ''}${mark}`}
          </button>
        ))}
      </div>
    </div>
  );
}
