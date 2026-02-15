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

const INVIDIOUS_INSTANCES = [
  'https://yewtu.be',
  'https://vid.puffyan.us',
  'https://invidious.kavin.rocks',
  'https://invidious.snopyta.org',
  'https://invidious.lunar.icu',
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
    const { query, maxResults = 1, pageToken, artist, title, refresh = false } = await req.json();

    if (!query) {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    // 1) Query cache.
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
        return new Response(JSON.stringify(cachedData.results), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    let videos: VideoRow[] = [];
    let nextPageToken: string | null = null;
    let source: 'yt-dlp' | 'invidious' | 'youtube-api' = 'yt-dlp';

    // 2) Primary: yt-dlp search.
    videos = await searchWithYtDlp(String(query), Number(maxResults) || 1);

    // 3) Fallback: Invidious search.
    if (videos.length === 0) {
      source = 'invidious';
      videos = await searchWithInvidious(String(query), Number(maxResults) || 1);
    }

    // 4) Last resort: Official API.
    if (videos.length === 0) {
      source = 'youtube-api';
      const fallback = await searchWithOfficialApi(String(query), Number(maxResults) || 1, pageToken);
      if (fallback.error === 'quota_exceeded') {
        return new Response(JSON.stringify({ error: 'quota_exceeded', videos: [] }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (fallback.error) {
        return new Response(JSON.stringify({ error: fallback.error, videos: [] }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      videos = fallback.videos;
      nextPageToken = fallback.nextPageToken;
    }

    // Keep prior ID as secondary fallback candidate when refreshing.
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
