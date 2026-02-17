import React, { useEffect, useRef, useState, type MutableRefObject } from 'react';

interface YouTubePlayerProps {
  videoId: string;
  searchQuery?: string; // Used when videoId is empty to search YouTube
  isPlaying: boolean;
  showVideo: boolean;
  playerRef: MutableRefObject<YT.Player | null>;
  onStateChange: (state: number) => void;
  onError?: (code: number) => void;
  onReady: () => void;
}

export function YouTubePlayer({
  videoId,
  searchQuery,
  isPlaying,
  showVideo,
  playerRef,
  onStateChange,
  onError,
  onReady,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitialized = useRef(false);
  const [currentVideoId, setCurrentVideoId] = useState(videoId);
  // Keep a ref so the video-change effect can read the latest isPlaying without a stale closure
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  // When we have a search query but no videoId, we'll use YouTube's search feature
  const effectiveVideoId = videoId || currentVideoId;

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

      console.log('[YouTubePlayer] Initializing YouTube player with videoId:', effectiveVideoId);
      console.log('[YouTubePlayer] Container dimensions:', containerRef.current?.offsetWidth, 'x', containerRef.current?.offsetHeight);
      
      // If we have a videoId, use it; otherwise use search query in the player
      const playerOptions: YT.PlayerOptions = {
        height: '100%',
        width: '100%',
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            console.log('[YouTubePlayer] YouTube player ready');

            if (typeof event.target.unMute === 'function') {
              event.target.unMute();
              event.target.setVolume(100);
            }

            onReady();
            // Only play if the app already wants playback (e.g. user pressed play before player was ready)
            if (isPlayingRef.current && effectiveVideoId) {
              event.target.playVideo();
            }
          },
          onStateChange: (event) => {
            console.log('YouTube player state changed:', event.data);
            onStateChange(event.data);
          },
          onError: (event) => {
            console.error('YouTube player error:', event.data);
            onError?.(event.data);
          },
        },
      };

      if (effectiveVideoId) {
        playerOptions.videoId = effectiveVideoId;
      }

      playerRef.current = new window.YT.Player(containerRef.current, playerOptions);
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
        isInitialized.current = false;
      }
    };
  }, []);

  // Handle video changes
  useEffect(() => {
    if (!playerRef.current) {
      console.log('Player not ready yet, videoId:', videoId);
      return;
    }

    if (videoId && videoId !== currentVideoId) {
      console.log('[YouTubePlayer] Loading new video:', videoId);
      if (typeof playerRef.current.loadVideoById === 'function') {
        playerRef.current.loadVideoById(videoId);
        setCurrentVideoId(videoId);
        // Only auto-play when the app state says we're playing (e.g. user pressed next/prev)
        if (isPlayingRef.current) {
          playerRef.current.playVideo();
        }
      }
    }
  }, [videoId, currentVideoId]);

  useEffect(() => {
    if (!playerRef.current) return;
    
    if (isPlaying && typeof playerRef.current.playVideo === 'function') {
      playerRef.current.playVideo();
    } else if (!isPlaying && typeof playerRef.current.pauseVideo === 'function') {
      playerRef.current.pauseVideo();
    }
  }, [isPlaying]);

  // Audio-only mode: invisible but properly sized for YouTube API; fullscreen when showVideo is true
  const pipClass = showVideo
    ? 'absolute inset-0 z-10'
    : 'absolute opacity-0 pointer-events-none';

  const pipStyle = showVideo
    ? {}
    : { width: '320px', height: '180px', overflow: 'hidden', bottom: '-200px', right: 0 };

  return (
    <div className={pipClass} style={pipStyle}>
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Show search link when no video ID */}
      {!effectiveVideoId && searchQuery && showVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-20">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">Video not linked yet</p>
            <a
              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
            >
              Search on YouTube
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
