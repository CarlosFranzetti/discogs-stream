export function extractYouTubeVideoId(input: string): string | null {
  const raw = (input || '').trim();
  if (!raw) return null;

  // If it already looks like a video id, accept it.
  // YouTube video ids are typically 11 chars (letters, digits, _ and -).
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;

  try {
    const url = new URL(raw);

    // https://www.youtube.com/watch?v=VIDEO_ID
    const v = url.searchParams.get('v');
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

    // https://youtu.be/VIDEO_ID
    if (url.hostname === 'youtu.be') {
      const id = url.pathname.replace(/^\//, '').slice(0, 11);
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }

    // https://www.youtube.com/embed/VIDEO_ID, /shorts/VIDEO_ID
    const parts = url.pathname.split('/').filter(Boolean);
    const embedIdx = parts.indexOf('embed');
    if (embedIdx >= 0 && parts[embedIdx + 1] && /^[a-zA-Z0-9_-]{11}$/.test(parts[embedIdx + 1])) {
      return parts[embedIdx + 1];
    }
    const shortsIdx = parts.indexOf('shorts');
    if (shortsIdx >= 0 && parts[shortsIdx + 1] && /^[a-zA-Z0-9_-]{11}$/.test(parts[shortsIdx + 1])) {
      return parts[shortsIdx + 1];
    }

    return null;
  } catch {
    return null;
  }
}

