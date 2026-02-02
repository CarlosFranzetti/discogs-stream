/// <reference types="youtube" />

declare namespace YT {
  class Player {
    constructor(elementId: string | HTMLElement, options: PlayerOptions);
    playVideo(): void;
    pauseVideo(): void;
    stopVideo(): void;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    loadVideoById(videoId: string): void;
    getCurrentTime(): number;
    getDuration(): number;
    getPlayerState(): number;
    getVolume(): number;
    setVolume(volume: number): void;
    isMuted(): boolean;
    mute(): void;
    unMute(): void;
    destroy(): void;
  }

  interface PlayerEvent {
    target: Player;
    data: number;
  }

  interface PlayerOptions {
    height?: string | number;
    width?: string | number;
    videoId?: string;
    playerVars?: {
      autoplay?: 0 | 1;
      controls?: 0 | 1;
      disablekb?: 0 | 1;
      modestbranding?: 0 | 1;
      rel?: 0 | 1;
      showinfo?: 0 | 1;
      iv_load_policy?: 1 | 3;
      playsinline?: 0 | 1;
    };
    events?: {
      onReady?: (event: PlayerEvent) => void;
      onStateChange?: (event: PlayerEvent) => void;
      onError?: (event: PlayerEvent) => void;
    };
  }

  const PlayerState: {
    UNSTARTED: -1;
    ENDED: 0;
    PLAYING: 1;
    PAUSED: 2;
    BUFFERING: 3;
    CUED: 5;
  };
}

interface Window {
  YT: typeof YT;
  onYouTubeIframeAPIReady: () => void;
}
