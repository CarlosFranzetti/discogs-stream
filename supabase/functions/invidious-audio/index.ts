import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Public instance lists rot fast — the previous list here was entirely dead and
// was walked sequentially, so every call burned ~7s of timeouts before a 500.
// Keep these in sync with the vetted lists in youtube-search/index.ts.
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://yewtu.be',
  'https://invidious.f5.si',
  'https://invidious.nerdvpn.de',
  'https://iv.melmac.space',
]

const PIPED_INSTANCES = [
  'https://pipedapi.adminforge.de',
  'https://api.piped.private.coffee',
  'https://pipedapi.reallyaweso.me',
]

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

// Per-request timeout. Audio mode runs two raced tiers back to back
// (Invidious, then Piped), so the worst case is ~8s wall clock.
const REQUEST_TIMEOUT_MS = 4000

interface InvidiousVideo {
  adaptiveFormats?: Array<{
    type?: string;
    url?: string;
    bitrate?: number | string;
    audioQuality?: string;
  }>;
  formatStreams?: Array<{
    type?: string;
    url?: string;
    quality?: string;
  }>;
  title?: string;
  author?: string;
}

interface InvidiousSearchResult {
  type?: string;
  videoId?: string;
  title?: string;
  author?: string;
}

interface PipedStreams {
  title?: string;
  uploader?: string;
  audioStreams?: Array<{
    url?: string;
    bitrate?: number;
    mimeType?: string;
    codec?: string;
  }>;
}

interface AudioCandidate {
  url: string;
  mime: string; // mime type plus codec, e.g. 'audio/mp4; codecs="mp4a.40.2"'
  bitrate: number;
}

interface AudioResult {
  audioUrl: string;
  audioQuality: number;
  title: string;
  author: string;
  instance: string;
  source: 'invidious' | 'piped';
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/**
 * <audio> compatibility rank, lower is better. AAC (mp4a / m4a) plays
 * everywhere including iOS Safari; Opus/WebM does not on older iOS; Dolby
 * (ec-3 / ac-3) ships in an audio/mp4 container but most browsers can't decode it.
 */
function codecRank(mime: string): number {
  const m = mime.toLowerCase()
  if (m.includes('ec-3') || m.includes('ac-3')) return 3
  if (m.includes('mp4a') || m.includes('audio/mp4') || m.includes('m4a')) return 0
  if (m.includes('opus') || m.includes('audio/webm')) return 1
  return 2
}

/** Best stream = most compatible codec first, highest bitrate within it. */
function pickBestAudio(candidates: AudioCandidate[]): AudioCandidate | null {
  const usable = candidates.filter((c) => c.url)
  if (usable.length === 0) return null
  return usable.sort((a, b) => codecRank(a.mime) - codecRank(b.mime) || b.bitrate - a.bitrate)[0]
}

/** Invidious returns instance-relative URLs when proxying — make them absolute. */
function absoluteUrl(url: string, instance: string): string {
  try {
    return new URL(url, instance).toString()
  } catch {
    return ''
  }
}

/**
 * Race all instances — first one with a usable answer wins. `attempt` must
 * throw when an instance responds without anything usable, so a
 * healthy-but-empty mirror doesn't mask a live one. Null when all fail.
 */
async function raceInstances<T>(
  label: string,
  instances: string[],
  attempt: (instance: string) => Promise<T>,
): Promise<T | null> {
  try {
    return await Promise.any(instances.map(async (instance) => {
      try {
        return await attempt(instance)
      } catch (error) {
        console.log(`[${label}] Instance ${instance} failed:`, error instanceof Error ? error.message : String(error))
        throw error
      }
    }))
  } catch {
    return null
  }
}

function audioFromInvidious(videoId: string): Promise<AudioResult | null> {
  return raceInstances('Invidious', INVIDIOUS_INSTANCES, async (instance) => {
    // local=true makes the instance proxy the stream. Raw googlevideo URLs are
    // bound to the instance's IP and would 403 in the listener's browser.
    const response = await fetch(`${instance}/api/v1/videos/${videoId}?local=true`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data = await response.json() as InvidiousVideo

    // Audio-only adaptive streams (m4a or opus)
    const best = pickBestAudio(
      (Array.isArray(data?.adaptiveFormats) ? data.adaptiveFormats : [])
        .filter((f) => String(f?.type || '').startsWith('audio/') && f?.url)
        .map((f) => ({
          url: absoluteUrl(String(f.url), instance),
          mime: String(f.type),
          bitrate: Number(f.bitrate) || 0,
        }))
    )

    if (best) {
      console.log(`[Invidious] Found audio stream via ${instance}: ${best.mime}, ${best.bitrate} bps`)
      return {
        audioUrl: best.url,
        audioQuality: best.bitrate,
        title: data.title || '',
        author: data.author || '',
        instance,
        source: 'invidious' as const,
      }
    }

    // Fallback to a muxed mp4 (video + AAC) if there is no adaptive audio —
    // <audio> can still play its audio track.
    const muxed = (Array.isArray(data?.formatStreams) ? data.formatStreams : [])
      .map((f) => ({ quality: f?.quality || '', url: f?.url ? absoluteUrl(String(f.url), instance) : '' }))
      .find((f) => f.url)
    if (!muxed) throw new Error('No audio streams found')

    console.log(`[Invidious] Using fallback format via ${instance}: ${muxed.quality}`)
    return {
      audioUrl: muxed.url,
      audioQuality: 0,
      title: data.title || '',
      author: data.author || '',
      instance,
      source: 'invidious' as const,
    }
  })
}

function audioFromPiped(videoId: string): Promise<AudioResult | null> {
  return raceInstances('Piped', PIPED_INSTANCES, async (instance) => {
    const response = await fetch(`${instance}/streams/${videoId}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data = await response.json() as PipedStreams

    // Piped stream URLs already go through the instance's proxy.
    const best = pickBestAudio(
      (Array.isArray(data?.audioStreams) ? data.audioStreams : [])
        .filter((s) => s?.url)
        .map((s) => ({
          url: absoluteUrl(String(s.url), instance),
          mime: `${s.mimeType || ''} ${s.codec || ''}`,
          bitrate: Number(s.bitrate) || 0,
        }))
    )
    if (!best) throw new Error('No audio streams found')

    console.log(`[Piped] Found audio stream via ${instance}: ${best.mime.trim()}, ${best.bitrate} bps`)
    return {
      audioUrl: best.url,
      audioQuality: best.bitrate,
      title: data.title || '',
      author: data.uploader || '',
      instance,
      source: 'piped' as const,
    }
  })
}

function searchInvidious(query: string, limit: number) {
  return raceInstances('Invidious', INVIDIOUS_INSTANCES, async (instance) => {
    const response = await fetch(
      `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`,
      {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }
    )
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

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

    if (videos.length === 0) throw new Error('no matches')
    return { videos, instance }
  })
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { videoId, query, maxResults = 5 } = await req.json()

    if (!videoId && !query) {
      return jsonResponse({ success: false, error: 'videoId or query is required' }, 400)
    }

    // Search mode for fallback video-id resolution.
    if (query) {
      const q = String(query).trim()
      const limit = Math.min(Math.max(Number(maxResults) || 5, 1), 10)

      const found = await searchInvidious(q, limit)
      if (!found) {
        return jsonResponse({ success: false, error: 'All Invidious search instances failed' }, 502)
      }

      return jsonResponse({
        success: true,
        source: 'invidious',
        videos: found.videos,
        instance: found.instance,
      })
    }

    // The id is interpolated into upstream URL paths — accept real YouTube ids only.
    const id = String(videoId).trim()
    if (!/^[\w-]{11}$/.test(id)) {
      return jsonResponse({ success: false, error: 'Invalid videoId' }, 400)
    }

    console.log('[Invidious] Fetching audio for video:', id)

    // Invidious first, then Piped — both quota-free, each raced across instances.
    const result = await audioFromInvidious(id) ?? await audioFromPiped(id)

    if (!result) {
      console.log('[Invidious] No audio source for video:', id)
      return jsonResponse({ success: false, error: 'All Invidious and Piped instances failed' }, 502)
    }

    console.log(`[Invidious] Successfully retrieved audio URL (${result.source})`)
    return jsonResponse({ success: true, ...result })

  } catch (error) {
    console.error('[Invidious] Error:', error)
    return jsonResponse(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      500
    )
  }
})
