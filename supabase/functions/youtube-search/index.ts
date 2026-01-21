import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY')!;

function isQuotaExceededPayload(errorText: string): boolean {
  try {
    const parsed = JSON.parse(errorText);
    const reasons = (parsed?.error?.errors || []).map((e: any) => e?.reason).filter(Boolean);
    return reasons.includes('quotaExceeded') || reasons.includes('dailyLimitExceeded');
  } catch {
    return /quotaExceeded|dailyLimitExceeded|exceeded.*quota/i.test(errorText);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, maxResults = 1 } = await req.json();
    
    if (!query) {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Searching YouTube for: ${query}`);

    // 1) Search for candidate videos
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('maxResults', String(Math.min(Math.max(maxResults, 1), 10)));
    searchUrl.searchParams.set('key', YOUTUBE_API_KEY);
    // Prefer music videos and official content
    searchUrl.searchParams.set('videoCategoryId', '10'); // Music category

    const searchResponse = await fetch(searchUrl.toString());

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('YouTube API search error:', errorText);
      if (searchResponse.status === 403 && isQuotaExceededPayload(errorText)) {
        return new Response(JSON.stringify({ error: 'quota_exceeded' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({ error: `YouTube API search error: ${searchResponse.status}` }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const searchData = await searchResponse.json();
    const items = searchData.items || [];

    const candidateIds: string[] = items
      .map((item: any) => item?.id?.videoId)
      .filter(Boolean);

    if (candidateIds.length === 0) {
      return new Response(JSON.stringify({ videos: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2) Verify embeddable status (avoids IFrame errors like 150/101)
    const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
    videosUrl.searchParams.set('part', 'status,snippet');
    videosUrl.searchParams.set('id', candidateIds.join(','));
    videosUrl.searchParams.set('key', YOUTUBE_API_KEY);

    const videosResponse = await fetch(videosUrl.toString());

    if (!videosResponse.ok) {
      const errorText = await videosResponse.text();
      console.error('YouTube API videos.list error:', errorText);
      if (videosResponse.status === 403 && isQuotaExceededPayload(errorText)) {
        return new Response(JSON.stringify({ error: 'quota_exceeded' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({ error: `YouTube API videos.list error: ${videosResponse.status}` }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const videosData = await videosResponse.json();

    const embeddable = (videosData.items || [])
      .filter((item: any) => item?.status?.embeddable === true)
      .map((item: any) => ({
        videoId: item.id,
        title: item.snippet?.title,
        channelTitle: item.snippet?.channelTitle,
        thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url,
      }));

    console.log(`Found ${embeddable.length} embeddable videos for query: ${query}`);

    return new Response(JSON.stringify({ videos: embeddable }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('YouTube search error:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
