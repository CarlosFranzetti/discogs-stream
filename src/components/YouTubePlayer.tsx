/// <reference path="../types/youtube.d.ts" />
import { useEffect, useRef, MutableRefObject } from 'react';

interface YouTubePlayerProps {
  videoId: string;
  isPlaying: boolean;
  showVideo: boolean;
  playerRef: MutableRefObject<YT.Player | null>;
  onStateChange: (state: number) => void;
  onReady: () => void;
}

export function YouTubePlayer({
  videoId,
  isPlaying,
  showVideo,
  playerRef,
  onStateChange,
  onReady,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    // Load YouTube IFrame API
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        initPlayer();
      };
    } else if (window.YT.Player) {
      initPlayer();
    }

    function initPlayer() {
      if (isInitialized.current || !containerRef.current) return;
      isInitialized.current = true;

      playerRef.current = new window.YT.Player(containerRef.current, {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,
          playsinline: 1,
        },
        events: {
          onReady: () => onReady(),
          onStateChange: (event) => onStateChange(event.data),
        },
      });
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
        isInitialized.current = false;
      }
    };
  }, []);

  useEffect(() => {
    if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
      playerRef.current.loadVideoById(videoId);
    }
  }, [videoId]);

  useEffect(() => {
    if (!playerRef.current) return;
    
    if (isPlaying && typeof playerRef.current.playVideo === 'function') {
      playerRef.current.playVideo();
    } else if (!isPlaying && typeof playerRef.current.pauseVideo === 'function') {
      playerRef.current.pauseVideo();
    }
  }, [isPlaying]);

  return (
    <div
      className={`absolute inset-0 transition-opacity duration-500 ${
        showVideo ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
      }`}
    >
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
