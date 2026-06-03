function extractReleaseIdFromUrl(url: string): { id: number; isMaster: boolean } | null {
  const releaseMatch = url.match(/\/release\/(\d+)/);
  if (releaseMatch) return { id: parseInt(releaseMatch[1], 10), isMaster: false };
  const masterMatch = url.match(/\/master\/(\d+)/);
  if (masterMatch) return { id: parseInt(masterMatch[1], 10), isMaster: true };
  return null;
}

function extractPageInfo() {
  const url = window.location.href;
  const parsed = extractReleaseIdFromUrl(url);
  if (!parsed) return null;

  const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content || '';
  const ogImage = document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content || '';
  const h1 = document.querySelector('h1')?.textContent?.trim() || '';

  let artist = '';
  let title = '';

  const artistEl = document.querySelector('[itemprop="byArtist"] a, .profile_in_head a, .artists_links a');
  if (artistEl) {
    artist = artistEl.textContent?.trim() || '';
  }

  if (ogTitle.includes(' - ')) {
    const parts = ogTitle.split(' - ');
    artist = artist || parts[0].trim();
    title = parts.slice(1).join(' - ').trim();
  } else {
    title = h1 || ogTitle;
  }

  const yearEl = document.querySelector('.profile_in_head .year, [itemprop="datePublished"]');
  const year = yearEl ? parseInt(yearEl.textContent || '0', 10) : 0;

  const labelEl = document.querySelector('.profile_in_head .label a, [itemprop="recordLabel"] a');
  const label = labelEl?.textContent?.trim() || '';

  const genreEl = document.querySelector('[itemprop="genre"]');
  const genre = genreEl?.textContent?.trim() || '';

  return {
    releaseId: parsed.id,
    isMaster: parsed.isMaster,
    title,
    artist,
    year,
    label,
    genre,
    coverUrl: ogImage,
    url,
  };
}

function sendReleaseInfo() {
  const info = extractPageInfo();
  if (!info) return;

  chrome.runtime.sendMessage({
    type: 'RELAY_RELEASE',
    data: info,
  }).catch(() => {});

  window.postMessage({ type: 'DISCOGS_RELEASE_INFO', data: info }, '*');
}

function init() {
  sendReleaseInfo();

  let lastUrl = window.location.href;
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      setTimeout(sendReleaseInfo, 600);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  const titleObserver = new MutationObserver(() => {
    setTimeout(sendReleaseInfo, 300);
  });

  const titleEl = document.querySelector('title');
  if (titleEl) titleObserver.observe(titleEl, { childList: true });
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'CHECK_RELEASE') {
    sendReleaseInfo();
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
