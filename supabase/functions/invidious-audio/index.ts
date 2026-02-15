import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Multiple Invidious instances for failover
const INVIDIOUS_INSTANCES = [
  'https://invidious.snopyta.org',
  'https://yewtu.be',
  'https://invidious.kavin.rocks',
  'https://vid.puffyan.us',
  'https://invidious.lunar.icu',
]

interface InvidiousVideo {
  adaptiveFormats?: Array<{
    type: string;
    url: string;
    bitrate: number;
    audioQuality?: string;
  }>;
  formatStreams?: Array<{
    type: string;
    url: string;
    quality: string;
  }>;
  title: string;
  author: string;
}

interface InvidiousSearchResult {
  type?: string;
  videoId?: string;
  title?: string;
  author?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { videoId, query, maxResults = 5 } = await req.json()

    if (!videoId && !query) {
      throw new Error('videoId or query is required')
    }

    // Search mode for fallback video-id resolution.
    if (query) {
      const q = String(query).trim()
      const limit = Math.min(Math.max(Number(maxResults) || 5, 1), 10)
      let lastSearchError: Error | null = null

      for (const instance of INVIDIOUS_INSTANCES) {
        try {
          const searchUrl = `${instance}/api/v1/search?q=${encodeURIComponent(q)}&type=video`
          const response = await fetch(searchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            signal: AbortSignal.timeout(5000)
          })

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
          }

          const data = await response.json() as InvidiousSearchResult[]
          const videos = (Array.isArray(data) ? data : [])
            .filter((row) => row?.type === 'video' && row?.videoId)
            .slice(0, limit)
            .map((row) => ({
              videoId: row.videoId!,
              title: row.title || '',
              channelTitle: row.author || '',
              thumbnail: `https://i.ytimg.com/vi/${row.videoId}/hqdefault.jpg`,
            }))

          return new Response(
            JSON.stringify({
              success: true,
              source: 'invidious',
              videos,
              instance,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } catch (error) {
          console.log(`[Invidious] Search instance ${instance} failed:`, error.message)
          lastSearchError = error
          continue
        }
      }

      throw new Error(`All Invidious search instances failed. Last error: ${lastSearchError?.message}`)
    }

    console.log('[Invidious] Fetching audio for video:', videoId)

    // Try each instance until one works
    let lastError: Error | null = null

    for (const instance of INVIDIOUS_INSTANCES) {
      try {
        console.log(`[Invidious] Trying instance: ${instance}`)

        const response = await fetch(`${instance}/api/v1/videos/${videoId}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          signal: AbortSignal.timeout(5000) // 5 second timeout per instance
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data: InvidiousVideo = await response.json()

        // Find best audio-only format
        let audioUrl: string | null = null
        let audioQuality = 0

        if (data.adaptiveFormats) {
          // Look for audio-only streams (opus or m4a)
          const audioFormats = data.adaptiveFormats.filter(f =>
            f.type.startsWith('audio/') && f.url
          ).sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))

          if (audioFormats.length > 0) {
            audioUrl = audioFormats[0].url
            audioQuality = audioFormats[0].bitrate || 0
            console.log(`[Invidious] Found audio stream: ${audioFormats[0].type}, ${audioQuality} bps`)
          }
        }

        // Fallback to regular formats if no adaptive audio
        if (!audioUrl && data.formatStreams) {
          const bestFormat = data.formatStreams.find(f => f.url)
          if (bestFormat) {
            audioUrl = bestFormat.url
            console.log(`[Invidious] Using fallback format: ${bestFormat.quality}`)
          }
        }

        if (audioUrl) {
          console.log('[Invidious] Successfully retrieved audio URL')
          return new Response(
            JSON.stringify({
              success: true,
              audioUrl,
              audioQuality,
              title: data.title,
              author: data.author,
              instance,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        throw new Error('No audio streams found')

      } catch (error) {
        console.log(`[Invidious] Instance ${instance} failed:`, error.message)
        lastError = error
        continue // Try next instance
      }
    }

    // All instances failed
    throw new Error(`All Invidious instances failed. Last error: ${lastError?.message}`)

  } catch (error) {
    console.error('[Invidious] Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
