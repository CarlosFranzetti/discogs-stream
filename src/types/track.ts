export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  year: number;
  genre: string;
  label: string;
  duration: number; // in seconds
  coverUrl: string;
  youtubeId: string;
  source: 'collection' | 'wantlist' | 'similar';
  liked?: boolean;
  disliked?: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
}
