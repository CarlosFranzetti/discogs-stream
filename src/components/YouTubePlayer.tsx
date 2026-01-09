/// <reference path="../types/youtube.d.ts" />
import { useEffect, useRef, MutableRefObject, useState } from 'react';

interface YouTubePlayerProps {
  videoId: string;
  searchQuery?: string; // Used when videoId is empty to search YouTube
  isPlaying: boolean;
  showVideo: boolean;
  playerRef: MutableRefObject<YT.Player | null>;
  onStateChange: (state: number) => void;
  onReady: () => void;
}

export function YouTubePlayer({
  videoId,
  searchQuery,
  isPlaying,
  showVideo,
  playerRef,
  onStateChange,
  onReady,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitialized = useRef(false);
  const [currentVideoId, setCurrentVideoId] = useState(videoId);

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

      console.log('Initializing YouTube player with videoId:', effectiveVideoId);
      
      // If we have a videoId, use it; otherwise use search query in the player
      const playerOptions: YT.PlayerOptions = {
        height: '100%',
        width: '100%',
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
          onReady: (event) => {
            console.log('YouTube player ready');
            onReady();
            // Auto-play when ready
            if (effectiveVideoId) {
              event.target.playVideo();
            }
          },
          onStateChange: (event) => {
            console.log('YouTube player state changed:', event.data);
            onStateChange(event.data);
          },
          onError: (event) => {
            console.error('YouTube player error:', event.data);
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
      console.log('Loading new video:', videoId);
      // Direct video ID provided
      if (typeof playerRef.current.loadVideoById === 'function') {
        playerRef.current.loadVideoById(videoId);
        setCurrentVideoId(videoId);
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

  return (
    <div
      className={`absolute inset-0 transition-opacity duration-500 ${
        showVideo ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
      }`}
    >
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
