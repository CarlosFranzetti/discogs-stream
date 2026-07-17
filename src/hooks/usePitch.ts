import { useState, useCallback, useRef, useEffect } from 'react';

// Technics SL-1200 MK2: ±8% pitch range
export const PITCH_MIN = -8;
export const PITCH_MAX = 8;
export const PITCH_STEP = 0.1;

export function usePitch() {
  const [pitch, setPitch] = useState(0);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<YT.Player | null>(null);

  const applyPitch = useCallback((value: number, audio?: HTMLAudioElement | null, ytPlayer?: YT.Player | null) => {
    const rate = 1 + value / 100;

    const el = audio ?? audioElRef.current;
    if (el) {
      el.playbackRate = rate;
    }

    const yt = ytPlayer ?? ytPlayerRef.current;
    if (yt && typeof yt.setPlaybackRate === 'function') {
      const nearest = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].reduce((prev, cur) =>
        Math.abs(cur - rate) < Math.abs(prev - rate) ? cur : prev
      );
      try { yt.setPlaybackRate(nearest); } catch { /* setPlaybackRate unsupported */ }
    }
  }, []);

  const setPitchValue = useCallback((value: number) => {
    const clamped = Math.max(PITCH_MIN, Math.min(PITCH_MAX, Math.round(value * 10) / 10));
    setPitch(clamped);
    applyPitch(clamped);
  }, [applyPitch]);

  const resetPitch = useCallback(() => {
    setPitchValue(0);
  }, [setPitchValue]);

  const nudgeUp = useCallback(() => {
    setPitch(prev => {
      const next = Math.min(PITCH_MAX, Math.round((prev + PITCH_STEP) * 10) / 10);
      applyPitch(next);
      return next;
    });
  }, [applyPitch]);

  const nudgeDown = useCallback(() => {
    setPitch(prev => {
      const next = Math.max(PITCH_MIN, Math.round((prev - PITCH_STEP) * 10) / 10);
      applyPitch(next);
      return next;
    });
  }, [applyPitch]);

  const attachAudio = useCallback((el: HTMLAudioElement | null) => {
    audioElRef.current = el;
    if (el) applyPitch(pitch, el, null);
  }, [pitch, applyPitch]);

  const attachYouTube = useCallback((player: YT.Player | null) => {
    ytPlayerRef.current = player;
    if (player) applyPitch(pitch, null, player);
  }, [pitch, applyPitch]);

  useEffect(() => {
    applyPitch(pitch);
  }, [pitch, applyPitch]);

  const pitchColor = pitch === 0
    ? '#22c55e'
    : Math.abs(pitch) <= 4
    ? '#eab308'
    : '#ef4444';

  return {
    pitch,
    setPitch: setPitchValue,
    resetPitch,
    nudgeUp,
    nudgeDown,
    attachAudio,
    attachYouTube,
    pitchColor,
    playbackRate: 1 + pitch / 100,
  };
}

export type PitchControl = ReturnType<typeof usePitch>;
