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
          onReady: () => onReady(),
          onStateChange: (event) => onStateChange(event.data),
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
    if (!playerRef.current) return;

    if (videoId) {
      // Direct video ID provided
      if (typeof playerRef.current.loadVideoById === 'function') {
        playerRef.current.loadVideoById(videoId);
        setCurrentVideoId(videoId);
      }
    } else if (searchQuery) {
      // Search for video using YouTube's search feature
      // YouTube IFrame API doesn't directly support search, so we use a workaround
      // We'll load a video by searching - this uses YouTube's internal search
      // For now, we'll show a placeholder and let user know
      // In production, you'd use YouTube Data API to search first
      console.log('Searching YouTube for:', searchQuery);
      
      // Unfortunately, IFrame API doesn't support direct search
      // We'll need to handle this differently - perhaps show a link to search
    }
  }, [videoId, searchQuery]);

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
