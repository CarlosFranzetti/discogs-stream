import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

interface YtDlpOutput {
  success: boolean;
  stdout: string;
  stderr: string;
}

/**
 * Runs yt-dlp and collects its output. Returns null when the subprocess can't
 * be run at all — Supabase's hosted edge runtime forbids subprocesses, and a
 * self-hosted box may not have the binary. That is the expected case in
 * production, so it must be cheap: no retries, no waiting.
 */
async function runYtDlp(args: string[], timeoutMs: number): Promise<YtDlpOutput | null> {
  let timeoutId: number | undefined
  try {
    const command = new Deno.Command('yt-dlp', {
      args,
      stdout: 'piped',
      stderr: 'piped',
    })

    const child = command.spawn()
    timeoutId = setTimeout(() => {
      try {
        child.kill('SIGTERM')
      } catch {
        // noop
      }
    }, timeoutMs)

    const { success, stdout, stderr } = await child.output()
    return {
      success,
      stdout: new TextDecoder().decode(stdout),
      stderr: new TextDecoder().decode(stderr),
    }
  } catch (error) {
    console.warn('[yt-dlp] unavailable:', error instanceof Error ? error.message : String(error))
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

/** 501, not 500 — the client just moves on to the next audio source. */
function unavailableResponse(): Response {
  return jsonResponse({ success: false, error: 'yt_dlp_unavailable' }, 501)
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

      const result = await runYtDlp([
        '--dump-json',
        '--flat-playlist',
        '--playlist-end', String(limit),
        '--socket-timeout', '5',
        '--retries', '1',
        searchExpr,
      ], 9000)

      if (!result) return unavailableResponse()

      if (!result.success) {
        console.error('[yt-dlp] Search error:', result.stderr)
        throw new Error(`yt-dlp search failed: ${result.stderr}`)
      }

      const output = result.stdout.trim()
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

      return jsonResponse({
        success: true,
        source: 'yt-dlp',
        videos,
      })
    }

    console.log('[yt-dlp] Extracting audio for video:', videoId)

    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`

    // Run yt-dlp to extract best audio format.
    const result = await runYtDlp([
      '--dump-single-json',
      '--no-playlist',
      '--format', 'bestaudio/best',
      '--socket-timeout', '5',
      '--retries', '1',
      youtubeUrl
    ], 12000)

    if (!result) return unavailableResponse()

    if (!result.success) {
      console.error('[yt-dlp] Error:', result.stderr)
      throw new Error(`yt-dlp failed: ${result.stderr}`)
    }

    const parsed = JSON.parse(result.stdout)
    const title = parsed?.title || 'Unknown'
    const duration = parsed?.duration_string || String(parsed?.duration || 0)
    const audioUrl = parsed?.url || ''

    if (!audioUrl) {
      throw new Error('No audio URL found in yt-dlp output')
    }

    console.log('[yt-dlp] Successfully extracted audio URL')

    return jsonResponse({
      success: true,
      source: 'yt-dlp',
      audioUrl,
      title,
      duration,
    })

  } catch (error) {
    console.error('[yt-dlp] Error:', error)
    return jsonResponse(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      500
    )
  }
})
