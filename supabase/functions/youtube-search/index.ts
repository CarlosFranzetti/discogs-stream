import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Public instance lists rot fast — dead entries cost a timeout each before the
// chain moves on, which is how searches ended up falling through to the quota'd
// official API. Keep these pruned to instances that actually respond.
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://yewtu.be',
  'https://invidious.f5.si',
  'https://invidious.nerdvpn.de',
  'https://iv.melmac.space',
];

const PIPED_INSTANCES = [
  'https://pipedapi.adminforge.de',
  'https://api.piped.private.coffee',
  'https://pipedapi.reallyaweso.me',
];

interface VideoRow {
  videoId: string;
  title?: string;
  channelTitle?: string;
  thumbnail?: string;
  durationIso?: string;
}

function isQuotaExceededPayload(errorText: string): boolean {
  try {
    const parsed = JSON.parse(errorText);
    const reasons = (parsed?.error?.errors || []).map((e: { reason?: string }) => e?.reason).filter(Boolean);
    return reasons.includes('quotaExceeded') || reasons.includes('dailyLimitExceeded');
  } catch {
    return /quotaExceeded|dailyLimitExceeded|exceeded.*quota/i.test(errorText);
  }
}

function normalizeStr(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function scoreResult(videoTitle: string, channelTitle: string, artist: string, title: string): number {
  const v = normalizeStr(videoTitle);
  const c = normalizeStr(channelTitle);
  const a = normalizeStr(artist);
  const t = normalizeStr(title);
  if (!v || !t) return 0;
  let score = 0;
  if (v.includes(t)) score += 10;
  if (a && v.includes(a)) score += 4;
  if (a && c.includes(a)) score += 3; // channel name matches artist → likely official
  const tTokens = t.split(' ').filter(w => w.length > 2);
  for (const tok of tTokens) {
    if (v.includes(tok)) score += 1;
  }
  return score;
}

/** Generate query variants from artist + title, most-specific first. */
function buildQueryVariants(artist: string, title: string): string[] {
  // Strip common clutter from title
  const clean = title
    .replace(/\s*\([^)]*\)/g, '')   // remove (...)
    .replace(/\s*\[[^\]]*\]/g, '')  // remove [...]
    .replace(/\s+feat\.?\s+.*/i, '') // remove feat. onwards
    .replace(/\s+ft\.?\s+.*/i, '')
    .replace(/\s+featuring\s+.*/i, '')
    .trim();

  const base = clean && clean !== title ? clean : title;
  const variants = [
    `${artist} ${title}`,           // exact
    `${artist} ${base}`,            // cleaned title
    `${artist} - ${base}`,          // dash-separated (common for official uploads)
    `${artist} ${base} official`,   // official audio
  ];
  // deduplicate while preserving order
  return [...new Map(variants.map(v => [v.toLowerCase(), v])).values()];
}

async function searchWithYtDlp(query: string, maxResults: number): Promise<VideoRow[]> {
  try {
    const limit = Math.min(Math.max(maxResults, 1), 10);
    const searchExpr = `ytsearch${limit}:${query}`;

    const command = new Deno.Command('yt-dlp', {
      args: [
        '--dump-json',
        '--flat-playlist',
        '--playlist-end', String(limit),
        '--socket-timeout', '5',
        '--retries', '1',
        searchExpr,
      ],
      stdout: 'piped',
      stderr: 'piped',
    });

    const child = command.spawn();
    const timeoutId = setTimeout(() => {
      try {
        child.kill('SIGTERM');
      } catch {
        // noop
      }
    }, 9000);

    const [status, stdout, stderr] = await Promise.all([
      child.status,
      child.output(),
      child.stderrOutput(),
    ]);

    clearTimeout(timeoutId);

    if (!status.success) {
      const err = new TextDecoder().decode(stderr);
      console.warn('[youtube-search] yt-dlp search failed:', err);
      return [];
    }

    const output = new TextDecoder().decode(stdout).trim();
    if (!output) return [];

    return output
      .split('\n')
      .map((line) => {
        try {
          const row = JSON.parse(line);
          const id = String(row?.id || '').trim();
          if (!id) return null;
          return {
            videoId: id,
            title: row?.title || '',
            channelTitle: row?.uploader || row?.channel || '',
            thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          } as VideoRow;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as VideoRow[];
  } catch (error) {
    console.warn('[youtube-search] yt-dlp unavailable:', error);
    return [];
  }
}

/**
 * Quota-free, key-free, instance-free fallback: scrape YouTube's own results
 * page. The page embeds `ytInitialData` JSON whose videoRenderer blocks carry
 * videoId/title/channel. Survives as long as youtube.com serves search results;
 * a consent or bot wall simply yields zero matches and the chain moves on.
 */
async function searchWithYouTubeScrape(query: string, maxResults: number): Promise<VideoRow[]> {
  try {
    const response = await fetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=en`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!response.ok) return [];

    const html = await response.text();
    const limit = Math.min(Math.max(maxResults, 1), 10);
    const videos: VideoRow[] = [];
    const seen = new Set<string>();
    const unescapeJson = (s: string) => {
      try { return JSON.parse(`"${s}"`) as string; } catch { return s; }
    };

    const blocks = html.split('"videoRenderer":{"videoId":"');
    for (let i = 1; i < blocks.length && videos.length < limit; i++) {
      const block = blocks[i];
      const videoId = block.slice(0, 11);
      if (!/^[\w-]{11}$/.test(videoId) || seen.has(videoId)) continue;
      seen.add(videoId);
      const titleMatch = block.match(/"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/);
      const channelMatch = block.match(/"ownerText":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/);
      videos.push({
        videoId,
        title: titleMatch ? unescapeJson(titleMatch[1]) : '',
        channelTitle: channelMatch ? unescapeJson(channelMatch[1]) : '',
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      });
    }
    return videos;
  } catch (error) {
    console.warn('[youtube-search] YouTube scrape failed:', error);
    return [];
  }
}

async function searchWithPiped(query: string, maxResults: number): Promise<VideoRow[]> {
  const limit = Math.min(Math.max(maxResults, 1), 10);

  for (const instance of PIPED_INSTANCES) {
    try {
      const response = await fetch(
        `${instance}/search?q=${encodeURIComponent(query)}&filter=videos`,
        {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(5000),
        }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json() as { items?: Array<{ url?: string; title?: string; uploaderName?: string }> };
      const videos = (data?.items || [])
        .map((item) => {
          const idMatch = String(item?.url || '').match(/[?&]v=([\w-]{11})/);
          if (!idMatch) return null;
          return {
            videoId: idMatch[1],
            title: item.title || '',
            channelTitle: item.uploaderName || '',
            thumbnail: `https://i.ytimg.com/vi/${idMatch[1]}/hqdefault.jpg`,
          } as VideoRow;
        })
        .filter(Boolean)
        .slice(0, limit) as VideoRow[];

      if (videos.length > 0) return videos;
    } catch (error) {
      console.warn(`[youtube-search] Piped ${instance} failed:`, error);
      continue;
    }
  }

  return [];
}

async function searchWithInvidious(query: string, maxResults: number): Promise<VideoRow[]> {
  const limit = Math.min(Math.max(maxResults, 1), 10);

  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const response = await fetch(
        `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          signal: AbortSignal.timeout(5000),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json() as Array<{ type?: string; videoId?: string; title?: string; author?: string }>;
      const videos = (Array.isArray(data) ? data : [])
        .filter((row) => row?.type === 'video' && row?.videoId)
        .slice(0, limit)
        .map((row) => ({
          videoId: row.videoId!,
          title: row.title || '',
          channelTitle: row.author || '',
          thumbnail: `https://i.ytimg.com/vi/${row.videoId}/hqdefault.jpg`,
        }));

      return videos;
    } catch (error) {
      console.warn(`[youtube-search] Invidious ${instance} failed:`, error);
      continue;
    }
  }

  return [];
}

async function searchWithOfficialApi(query: string, maxResults: number, pageToken?: string): Promise<{ videos: VideoRow[]; nextPageToken: string | null; error?: string }> {
  if (!YOUTUBE_API_KEY) {
    return { videos: [], nextPageToken: null, error: 'youtube_api_key_missing' };
  }

  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
  searchUrl.searchParams.set('part', 'snippet');
  searchUrl.searchParams.set('q', query);
  searchUrl.searchParams.set('type', 'video');
  searchUrl.searchParams.set('maxResults', String(Math.min(Math.max(maxResults, 1), 10)));
  searchUrl.searchParams.set('key', YOUTUBE_API_KEY);
  searchUrl.searchParams.set('videoCategoryId', '10');
  if (pageToken) {
    searchUrl.searchParams.set('pageToken', pageToken);
  }

  const searchResponse = await fetch(searchUrl.toString());

  if (!searchResponse.ok) {
    const errorText = await searchResponse.text();
    if (searchResponse.status === 403 && isQuotaExceededPayload(errorText)) {
      return { videos: [], nextPageToken: null, error: 'quota_exceeded' };
    }
    return { videos: [], nextPageToken: null, error: `youtube_api_search_error_${searchResponse.status}` };
  }

  const searchData = await searchResponse.json();
  const items = searchData.items || [];
  const nextPageToken = searchData.nextPageToken || null;

  const candidateIds: string[] = items
    .map((item: { id?: { videoId?: string } }) => item?.id?.videoId)
    .filter(Boolean) as string[];

  if (candidateIds.length === 0) {
    return { videos: [], nextPageToken };
  }

  const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
  videosUrl.searchParams.set('part', 'status,snippet,contentDetails');
  videosUrl.searchParams.set('id', candidateIds.join(','));
  videosUrl.searchParams.set('key', YOUTUBE_API_KEY);

  const videosResponse = await fetch(videosUrl.toString());
  if (!videosResponse.ok) {
    const errorText = await videosResponse.text();
    if (videosResponse.status === 403 && isQuotaExceededPayload(errorText)) {
      return { videos: [], nextPageToken: null, error: 'quota_exceeded' };
    }
    return { videos: [], nextPageToken: null, error: `youtube_api_videos_error_${videosResponse.status}` };
  }

  const videosData = await videosResponse.json();
  const embeddable = (videosData.items || [])
    .filter((item: { status?: { embeddable?: boolean } }) => item?.status?.embeddable === true)
    .map((item: { id: string; snippet?: { title?: string; channelTitle?: string; thumbnails?: { medium?: { url?: string }; default?: { url?: string } } }; contentDetails?: { duration?: string } }) => ({
      videoId: item.id,
      title: item.snippet?.title,
      channelTitle: item.snippet?.channelTitle,
      thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url,
      durationIso: item.contentDetails?.duration,
    }));

  return { videos: embeddable, nextPageToken };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, maxResults = 5, pageToken, artist, title, refresh = false } = await req.json();

    if (!query) {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const limit = Number(maxResults) || 5;
    let existingVideoId: string | null = null;

    // 0) Permanent DB cache by artist/title.
    if (artist && title) {
      const { data: dbVideo } = await supabase
        .from('youtube_videos')
        .select('*')
        .eq('artist', artist)
        .eq('title', title)
        .maybeSingle();

      if (dbVideo) {
        existingVideoId = dbVideo.video_id;
        if (!refresh) {
          return new Response(JSON.stringify({
            videos: [{
              videoId: dbVideo.video_id,
              title,
              channelTitle: dbVideo.channel_title,
              thumbnail: dbVideo.thumbnail,
              durationIso: dbVideo.duration_iso,
            }],
            source: 'db',
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
    }

    // 1) Query cache — only use cached results that are non-empty.
    if (!refresh) {
      const { data: cachedData } = await supabase
        .from('search_cache')
        .select('results')
        .eq('query', query)
        .eq('page_token', pageToken || null)
        .gt('expires_at', new Date().toISOString())
        .limit(1)
        .maybeSingle();

      if (cachedData) {
        const cached = cachedData.results as { videos?: VideoRow[] };
        // Only serve from cache if it actually has results — empty caches are stale
        if (cached?.videos && cached.videos.length > 0) {
          return new Response(JSON.stringify(cachedData.results), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // Build query variants to try in order (most specific first)
    const queryVariants = (artist && title)
      ? buildQueryVariants(String(artist), String(title))
      : [String(query)];

    let videos: VideoRow[] = [];
    let nextPageToken: string | null = null;
    let source: 'yt-dlp' | 'scrape' | 'invidious' | 'piped' | 'youtube-api' = 'yt-dlp';

    // 2) yt-dlp — instant no-op in Supabase's edge runtime (no subprocesses),
    // but kept first so self-hosted deployments get the best extractor.
    for (const q of queryVariants) {
      videos = await searchWithYtDlp(q, limit);
      if (videos.length > 0) break;
    }

    // 3) YouTube results-page scrape — the quota workaround that doesn't depend
    // on third-party instances. This is the tier expected to serve most traffic.
    if (videos.length === 0) {
      source = 'scrape';
      for (const q of queryVariants) {
        videos = await searchWithYouTubeScrape(q, limit);
        if (videos.length > 0) break;
      }
    }

    // 4) Invidious instances — first two variants only; each dead instance
    // costs a timeout, so don't multiply that by every variant.
    if (videos.length === 0) {
      source = 'invidious';
      for (const q of queryVariants.slice(0, 2)) {
        videos = await searchWithInvidious(q, limit);
        if (videos.length > 0) break;
      }
    }

    // 5) Piped instances — same quota-free deal, different network.
    if (videos.length === 0) {
      source = 'piped';
      for (const q of queryVariants.slice(0, 2)) {
        videos = await searchWithPiped(q, limit);
        if (videos.length > 0) break;
      }
    }

    // 6) Official API — strictly last: the only tier that burns quota.
    if (videos.length === 0) {
      source = 'youtube-api';
      for (const q of queryVariants.slice(0, 2)) {
        const fallback = await searchWithOfficialApi(q, limit, pageToken);
        if (fallback.error === 'quota_exceeded') {
          return new Response(JSON.stringify({ error: 'quota_exceeded', videos: [] }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (!fallback.error && fallback.videos.length > 0) {
          videos = fallback.videos;
          nextPageToken = fallback.nextPageToken;
          break;
        }
      }
    }

    // 7) Score and rank results by relevance to artist + title.
    if (videos.length > 1 && artist && title) {
      videos = videos
        .map(v => ({ ...v, _score: scoreResult(v.title || '', v.channelTitle || '', String(artist), String(title)) }))
        .sort((a, b) => (b as VideoRow & { _score: number })._score - (a as VideoRow & { _score: number })._score)
        .map(({ _score: _s, ...v }) => v as VideoRow);
    }

    // 8) Keep prior ID as secondary fallback candidate when refreshing.
    if (existingVideoId && !videos.some((v) => v.videoId === existingVideoId)) {
      videos = [
        ...videos,
        {
          videoId: existingVideoId,
          title,
          channelTitle: '',
          thumbnail: `https://i.ytimg.com/vi/${existingVideoId}/hqdefault.jpg`,
        },
      ];
    }

    const resultData = { videos, nextPageToken, source };

    // Persist best match to permanent store (only when results found).
    if (artist && title && videos.length > 0) {
      const topVideo = videos[0];
      try {
        await supabase.from('youtube_videos').upsert({
          artist,
          title,
          video_id: topVideo.videoId,
          channel_title: topVideo.channelTitle || null,
          thumbnail: topVideo.thumbnail || null,
          duration_iso: topVideo.durationIso || null,
        }, { onConflict: 'artist,title' });
      } catch (dbError) {
        console.error('Failed to save to youtube_videos:', dbError);
      }
    }

    // Cache the result — only when non-empty (empty results mean transient failure, not absence).
    if (videos.length > 0) {
      try {
        await supabase.from('search_cache').insert({
          query,
          page_token: pageToken || null,
          results: resultData,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
      } catch (cacheError) {
        console.error('Failed to cache results:', cacheError);
      }
    }

    return new Response(JSON.stringify(resultData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('YouTube search error:', errorMessage);

    if (
      /quotaExceeded|dailyLimitExceeded|exceeded.*quota/i.test(errorMessage)
    ) {
      return new Response(JSON.stringify({ error: 'quota_exceeded' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
