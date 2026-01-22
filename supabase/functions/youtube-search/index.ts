import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function isQuotaExceededPayload(errorText: string): boolean {
  try {
    const parsed = JSON.parse(errorText);
    const reasons = (parsed?.error?.errors || []).map((e: { reason?: string }) => e?.reason).filter(Boolean);
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
    const { query, maxResults = 1, pageToken, artist, title, refresh = false } = await req.json();
    
    if (!query) {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let existingVideoId: string | null = null;

    // 0) Check Permanent DB (youtube_videos)
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
            console.log(`DB hit for ${artist} - ${title}`);
            return new Response(JSON.stringify({
              videos: [{
                videoId: dbVideo.video_id,
                title: title, 
                channelTitle: dbVideo.channel_title,
                thumbnail: dbVideo.thumbnail,
                durationIso: dbVideo.duration_iso
              }] 
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
       }
    }

    // Check Cache (only if not refreshing)
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
        console.log(`Cache hit for query: ${query}`);
        return new Response(JSON.stringify(cachedData.results), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 1) If we have an existing ID and we're refreshing or it's a miss, try videos.list first (cheap)
    if (existingVideoId) {
      console.log(`Verifying existing video ID: ${existingVideoId}`);
      const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
      videosUrl.searchParams.set('part', 'status,snippet,contentDetails');
      videosUrl.searchParams.set('id', existingVideoId);
      videosUrl.searchParams.set('key', YOUTUBE_API_KEY);

      const videosResponse = await fetch(videosUrl.toString());
      if (videosResponse.ok) {
        const videosData = await videosResponse.json();
        const item = (videosData.items || [])[0];
        
        if (item?.status?.embeddable) {
          console.log(`Existing video ID ${existingVideoId} is still valid and embeddable.`);
          const resultData = {
            videos: [{
              videoId: item.id,
              title: item.snippet?.title,
              channelTitle: item.snippet?.channelTitle,
              thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url,
              durationIso: item.contentDetails?.duration,
            }],
            nextPageToken: null
          };

          // Update DB if needed (e.g. update updated_at or other details)
          await supabase.from('youtube_videos').upsert({
            artist,
            title,
            video_id: item.id,
            channel_title: item.snippet?.channelTitle,
            thumbnail: resultData.videos[0].thumbnail,
            duration_iso: item.contentDetails?.duration,
            updated_at: new Date().toISOString()
          }, { onConflict: 'artist,title' });

          return new Response(JSON.stringify(resultData), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        console.log(`Existing video ID ${existingVideoId} is no longer valid or embeddable. Proceeding to search.`);
      }
    }

    console.log(`Searching YouTube for: ${query}`);

    // 2) Search for candidate videos (expensive - 100 units)
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('maxResults', String(Math.min(Math.max(maxResults, 1), 10)));
    searchUrl.searchParams.set('key', YOUTUBE_API_KEY);
    // Prefer music videos and official content
    searchUrl.searchParams.set('videoCategoryId', '10'); // Music category
    if (pageToken) {
      searchUrl.searchParams.set('pageToken', pageToken);
    }

    const searchResponse = await fetch(searchUrl.toString());

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('YouTube API search error:', errorText);

      // 403 can mean either quota exceeded OR access forbidden (bad/disabled key, billing, etc.)
      // Never bubble this up as a 500.
      if (searchResponse.status === 403) {
        // Return 200 to avoid client/platform treating this as a hard runtime failure.
        // The client still detects `error: 'quota_exceeded'` and will stop background verification.
        if (isQuotaExceededPayload(errorText)) {
          return new Response(JSON.stringify({ error: 'quota_exceeded', videos: [] }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ error: 'youtube_forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: `YouTube API search error: ${searchResponse.status}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const searchData = await searchResponse.json();
    const items = searchData.items || [];
    const nextPageToken = searchData.nextPageToken;

    const candidateIds: string[] = items
      .map((item: { id?: { videoId?: string } }) => item?.id?.videoId)
      .filter(Boolean) as string[];

    if (candidateIds.length === 0) {
       // Cache empty result
       const emptyResult = { videos: [], nextPageToken };
       await supabase.from('search_cache').insert({
         query,
         page_token: pageToken || null,
         results: emptyResult,
         expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
       });

      return new Response(JSON.stringify(emptyResult), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2) Verify embeddable status (avoids IFrame errors like 150/101)
    const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
    videosUrl.searchParams.set('part', 'status,snippet,contentDetails');
    videosUrl.searchParams.set('id', candidateIds.join(','));
    videosUrl.searchParams.set('key', YOUTUBE_API_KEY);

    const videosResponse = await fetch(videosUrl.toString());

    if (!videosResponse.ok) {
      const errorText = await videosResponse.text();
      console.error('YouTube API videos.list error:', errorText);

      if (videosResponse.status === 403) {
        if (isQuotaExceededPayload(errorText)) {
          return new Response(JSON.stringify({ error: 'quota_exceeded', videos: [] }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ error: 'youtube_forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: `YouTube API videos.list error: ${videosResponse.status}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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

    console.log(`Found ${embeddable.length} embeddable videos for query: ${query}`);

    const resultData = { videos: embeddable, nextPageToken };

    // Store in Permanent DB
    if (artist && title && embeddable.length > 0) {
      const topVideo = embeddable[0];
      try {
        await supabase.from('youtube_videos').upsert({
          artist,
          title,
          video_id: topVideo.videoId,
          channel_title: topVideo.channelTitle,
          thumbnail: topVideo.thumbnail,
          duration_iso: topVideo.durationIso,
        }, { onConflict: 'artist,title' });
        console.log(`Saved video for ${artist} - ${title}`);
      } catch (dbError) {
        console.error('Failed to save to youtube_videos:', dbError);
      }
    }

    // Store in Cache
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

    // Defensive: some older implementations throw on 403; treat as quota so the client
    // can stop background verification instead of crashing.
    if (
      /youtube api search error:\s*403/i.test(errorMessage) ||
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
