import { extractYouTubeVideoId } from '@/lib/youtube';

export function parseDiscogsDurationToSeconds(input: string): number | null {
  const raw = (input || '').trim();
  if (!raw) return null;

  // Common Discogs format is "MM:SS" or "H:MM:SS".
  if (!/^\d+:\d{2}(:\d{2})?$/.test(raw)) return null;
  const parts = raw.split(':').map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n))) return null;

  if (parts.length === 2) {
    const [m, s] = parts;
    return m * 60 + s;
  }
  const [h, m, s] = parts;
  return h * 3600 + m * 60 + s;
}

export function extractYouTubeIdsFromDiscogsRelease(release: unknown): string[] {
  const videos = (release as { videos?: Array<{ uri?: string; url?: string }> })?.videos;
  if (!Array.isArray(videos)) return [];

  const ids: string[] = [];
  for (const v of videos) {
    const uri = v?.uri || v?.url || '';
    const id = extractYouTubeVideoId(uri);
    if (id && !ids.includes(id)) ids.push(id);
  }

  return ids;
}

export function extractYouTubeCandidatesFromDiscogsRelease(release: unknown): Array<{ videoId: string; title?: string }> {
  const videos = (release as { videos?: Array<{ uri?: string; url?: string; title?: string }> })?.videos;
  if (!Array.isArray(videos)) return [];

  const out: Array<{ videoId: string; title?: string }> = [];
  for (const v of videos) {
    const uri = v?.uri || v?.url || '';
    const id = extractYouTubeVideoId(uri);
    if (!id) continue;
    if (out.some((x) => x.videoId === id)) continue;
    out.push({ videoId: id, title: v?.title });
  }
  return out;
}

