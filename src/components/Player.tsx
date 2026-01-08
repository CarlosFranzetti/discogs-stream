import { usePlayer } from '@/hooks/usePlayer';
import { YouTubePlayer } from './YouTubePlayer';
import { AlbumArt } from './AlbumArt';
import { Timeline } from './Timeline';
import { PlayerControls } from './PlayerControls';
import { TrackInfo } from './TrackInfo';
import { PlaylistSidebar } from './PlaylistSidebar';

export function Player() {
  const {
    playlist,
    currentTrack,
    currentIndex,
    isPlaying,
    currentTime,
    showVideo,
    isLiked,
    isDisliked,
    playerRef,
    togglePlay,
    skipNext,
    skipPrev,
    seekTo,
    skipForward,
    skipBackward,
    likeTrack,
    dislikeTrack,
    selectTrack,
    toggleVideo,
    setIsPlaying,
  } = usePlayer();

  const handlePlayerStateChange = (state: number) => {
    // YT.PlayerState.ENDED = 0
    if (state === 0) {
      skipNext();
    }
    // YT.PlayerState.PLAYING = 1
    if (state === 1) {
      setIsPlaying(true);
    }
    // YT.PlayerState.PAUSED = 2
    if (state === 2) {
      setIsPlaying(false);
    }
  };

  if (!currentTrack) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <p className="text-muted-foreground">No tracks available</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Main player area */}
      <div className="flex-1 flex flex-col">
        {/* Album art / Video area */}
        <div className="flex-1 relative overflow-hidden bg-gradient-to-b from-card to-background">
          <YouTubePlayer
            videoId={currentTrack.youtubeId}
            isPlaying={isPlaying}
            showVideo={showVideo}
            playerRef={playerRef}
            onStateChange={handlePlayerStateChange}
            onReady={() => {}}
          />
          <AlbumArt
            track={currentTrack}
            isPlaying={isPlaying}
            showVideo={showVideo}
            onClick={toggleVideo}
          />

          {/* Video toggle hint when showing video */}
          {showVideo && (
            <button
              onClick={toggleVideo}
              className="absolute bottom-4 right-4 z-20 bg-background/80 backdrop-blur-sm rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Show album art
            </button>
          )}
        </div>

        {/* Controls area */}
        <div className="bg-card border-t border-border p-6 space-y-4">
          <TrackInfo track={currentTrack} />
          
          <div className="max-w-xl mx-auto w-full">
            <Timeline
              currentTime={currentTime}
              duration={currentTrack.duration}
              onSeek={seekTo}
            />
          </div>

          <PlayerControls
            isPlaying={isPlaying}
            isLiked={isLiked}
            isDisliked={isDisliked}
            onTogglePlay={togglePlay}
            onSkipPrev={skipPrev}
            onSkipNext={skipNext}
            onSkipBackward={skipBackward}
            onSkipForward={skipForward}
            onLike={likeTrack}
            onDislike={dislikeTrack}
          />
        </div>
      </div>

      {/* Playlist sidebar */}
      <div className="hidden md:block w-80 lg:w-96">
        <PlaylistSidebar
          playlist={playlist}
          currentIndex={currentIndex}
          onSelectTrack={selectTrack}
        />
      </div>
    </div>
  );
}
