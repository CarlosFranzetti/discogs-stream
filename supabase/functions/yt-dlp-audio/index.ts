import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Search mode: resolve candidate YouTube IDs via yt-dlp first.
    if (query) {
      console.log('[yt-dlp] Searching for query:', query)
      const limit = Math.min(Math.max(Number(maxResults) || 5, 1), 10)
      const searchExpr = `ytsearch${limit}:${String(query).trim()}`

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
      })

      const child = command.spawn()
      const timeoutId = setTimeout(() => {
        try {
          child.kill('SIGTERM')
        } catch {
          // noop
        }
      }, 9000)

      const [status, stdout, stderr] = await Promise.all([
        child.status,
        child.output(),
        child.stderrOutput(),
      ])
      clearTimeout(timeoutId)

      if (!status.success) {
        const errorText = new TextDecoder().decode(stderr)
        console.error('[yt-dlp] Search error:', errorText)
        throw new Error(`yt-dlp search failed: ${errorText}`)
      }

      const output = new TextDecoder().decode(stdout).trim()
      const lines = output ? output.split('\n') : []

      const videos = lines
        .map((line) => {
          try {
            const row = JSON.parse(line)
            const id = String(row?.id || '').trim()
            if (!id) return null
            return {
              videoId: id,
              title: row?.title || '',
              channelTitle: row?.uploader || row?.channel || '',
              thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            }
          } catch {
            return null
          }
        })
        .filter(Boolean)

      return new Response(
        JSON.stringify({
          success: true,
          source: 'yt-dlp',
          videos,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[yt-dlp] Extracting audio for video:', videoId)

    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`

    // Run yt-dlp to extract best audio format.
    const command = new Deno.Command('yt-dlp', {
      args: [
        '--dump-single-json',
        '--no-playlist',
        '--format', 'bestaudio/best',
        '--socket-timeout', '5',
        '--retries', '1',
        youtubeUrl
      ],
      stdout: 'piped',
      stderr: 'piped',
    })

    const process = command.spawn()
    const timeoutId = setTimeout(() => {
      try {
        process.kill('SIGTERM')
      } catch {
        // noop
      }
    }, 12000)

    const [status, stdout, stderr] = await Promise.all([
      process.status,
      process.output(),
      process.stderrOutput(),
    ])
    clearTimeout(timeoutId)

    if (!status.success) {
      const errorText = new TextDecoder().decode(stderr)
      console.error('[yt-dlp] Error:', errorText)
      throw new Error(`yt-dlp failed: ${errorText}`)
    }

    const output = new TextDecoder().decode(stdout)
    const parsed = JSON.parse(output)
    const title = parsed?.title || 'Unknown'
    const duration = parsed?.duration_string || String(parsed?.duration || 0)
    const audioUrl = parsed?.url || ''

    if (!audioUrl) {
      throw new Error('No audio URL found in yt-dlp output')
    }

    console.log('[yt-dlp] Successfully extracted audio URL')

    return new Response(
      JSON.stringify({
        success: true,
        source: 'yt-dlp',
        audioUrl,
        title,
        duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[yt-dlp] Error:', error)
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
