import { useCallback } from 'react';
import { Track } from '@/types/track';
import { parseDiscogsDurationToSeconds, extractYouTubeIdsFromDiscogsRelease } from '@/lib/discogs';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface DiscogsPublicRelease {
  id: number;
  title?: string;
  year?: number;
  country?: string;
  thumb?: string;
  cover_image?: string;
  images?: Array<{ uri?: string; type?: string }>;
  artists?: Array<{ name: string }>;
  genres?: string[];
  styles?: string[];
  labels?: Array<{ name: string }>;
  tracklist?: Array<{
    position?: string;
    title?: string;
    duration?: string;
    type_?: string;
    artists?: Array<{ name: string }>;
  }>;
  videos?: Array<{ uri?: string; title?: string }>;
}

async function fetchReleaseDetails(releaseId: number): Promise<DiscogsPublicRelease | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/discogs-public`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ release_id: releaseId }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * Expands a CSV release-level Track into individual per-track entries
 * by fetching the full tracklist from the Discogs public API.
 */
export function useCsvTrackExpander() {
  const expandRelease = useCallback(async (releasePlaceholder: Track): Promise<Track[]> => {
    const releaseId = releasePlaceholder.discogsReleaseId;
    if (!releaseId) return [releasePlaceholder];

    const details = await fetchReleaseDetails(releaseId);
    if (!details) return [releasePlaceholder];

    const tracklist = Array.isArray(details.tracklist) ? details.tracklist : [];
    const playableTracks = tracklist.filter(
      (t) => (!t.type_ || t.type_ === 'track') && t.title?.trim()
    );

    if (playableTracks.length === 0) return [releasePlaceholder];

    // Cover art
    const coverUrls = (details.images || [])
      .map((img) => img.uri || '')
      .filter(Boolean)
      .slice(0, 4);
    const coverUrl = coverUrls[0] || details.cover_image || details.thumb || releasePlaceholder.coverUrl;

    // YouTube IDs from release videos field (quota-free)
    const releaseVideoIds = extractYouTubeIdsFromDiscogsRelease(details);

    const album = details.title || releasePlaceholder.album;
    const year = details.year || releasePlaceholder.year;
    const genre =
      details.genres?.[0] || details.styles?.[0] || releasePlaceholder.genre;
    const label = details.labels?.[0]?.name || releasePlaceholder.label;
    const country = details.country || releasePlaceholder.country;
    const source = releasePlaceholder.source;
    const cleanName = (name: string) => name.replace(/\s*\(\d+\)$/, '');
    const albumArtist = details.artists?.[0]?.name
      ? cleanName(details.artists[0].name)
      : releasePlaceholder.artist;

    const tracks: Track[] = [];
    let idx = 0;
    for (const t of playableTracks) {
      const title = (t.title || '').trim();
      const pos = (t.position || '').trim();
      const position = pos || String(idx + 1);
      const duration = parseDiscogsDurationToSeconds(t.duration || '') ?? 240;
      const trackArtist = t.artists?.[0]?.name
        ? cleanName(t.artists[0].name)
        : albumArtist;

      // Assign the first release video ID to track 1, etc. (best-effort mapping)
      const youtubeId = releaseVideoIds[idx] || '';

      tracks.push({
        id: `${source}-${releaseId}-${position}`,
        title,
        artist: trackArtist,
        album,
        year,
        genre,
        label,
        duration,
        coverUrl,
        coverUrls: coverUrls.length > 0 ? coverUrls : (coverUrl ? [coverUrl] : []),
        youtubeId,
        youtubeCandidates: youtubeId ? [youtubeId] : [],
        discogsReleaseId: releaseId,
        discogsTrackPosition: position,
        country,
        workingStatus: youtubeId ? 'working' : 'pending',
        source,
      });
      idx++;
    }

    return tracks;
  }, []);

  /**
   * Expand an array of release-level tracks into per-track entries.
   * Calls are rate-limited to 1 request/second to stay within Discogs limits.
   */
  const expandAll = useCallback(
    async (
      releaseTracks: Track[],
      onProgress?: (expanded: Track[], done: number, total: number) => void,
    ): Promise<Track[]> => {
      const result: Track[] = [];
      const seen = new Set<number>();

      for (let i = 0; i < releaseTracks.length; i++) {
        const placeholder = releaseTracks[i];
        const rid = placeholder.discogsReleaseId;

        // Skip duplicate releases (same release in collection + wantlist)
        if (rid && seen.has(rid)) continue;
        if (rid) seen.add(rid);

        const expanded = await expandRelease(placeholder);
        result.push(...expanded);

        onProgress?.(result, i + 1, releaseTracks.length);

        // 1 req/sec rate limit for Discogs public API
        if (i < releaseTracks.length - 1) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      return result;
    },
    [expandRelease],
  );

  return { expandRelease, expandAll };
}
