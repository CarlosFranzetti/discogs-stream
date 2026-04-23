import { useRef, useState, useCallback } from 'react';

export interface AudioController {
  volume: number;
  isMuted: boolean;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  attachYTPlayer: (player: YT.Player | null) => void;
  attachAudioElement: (el: HTMLAudioElement | null) => void;
}

export function useAudioController(): AudioController {
  const [volume, setVolumeState] = useState(100);
  const [isMuted, setIsMuted] = useState(false);

  const ytPlayerRef = useRef<YT.Player | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const volumeRef = useRef(100);
  const isMutedRef = useRef(false);

  const syncPlayers = useCallback((vol: number, muted: boolean) => {
    if (ytPlayerRef.current) {
      if (muted) {
        ytPlayerRef.current.mute();
      } else {
        ytPlayerRef.current.unMute();
        ytPlayerRef.current.setVolume(vol);
      }
    }
    if (audioElRef.current) {
      audioElRef.current.muted = muted;
      audioElRef.current.volume = muted ? 0 : vol / 100;
    }
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(v)));
    volumeRef.current = clamped;
    isMutedRef.current = false;
    setVolumeState(clamped);
    setIsMuted(false);
    syncPlayers(clamped, false);
  }, [syncPlayers]);

  const toggleMute = useCallback(() => {
    const next = !isMutedRef.current;
    isMutedRef.current = next;
    setIsMuted(next);
    syncPlayers(volumeRef.current, next);
  }, [syncPlayers]);

  const attachYTPlayer = useCallback((player: YT.Player | null) => {
    ytPlayerRef.current = player;
    if (player) syncPlayers(volumeRef.current, isMutedRef.current);
  }, [syncPlayers]);

  const attachAudioElement = useCallback((el: HTMLAudioElement | null) => {
    audioElRef.current = el;
    if (el) syncPlayers(volumeRef.current, isMutedRef.current);
  }, [syncPlayers]);

  return { volume, isMuted, setVolume, toggleMute, attachYTPlayer, attachAudioElement };
}
