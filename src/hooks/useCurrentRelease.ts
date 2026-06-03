import { useState, useEffect, useCallback } from 'react';
import { PageReleaseInfo } from '@/types/extension';

export function useCurrentRelease() {
  const [currentRelease, setCurrentRelease] = useState<PageReleaseInfo | null>(null);

  useEffect(() => {
    const isChromeExt = typeof chrome !== 'undefined' && !!chrome.runtime?.id;
    if (!isChromeExt) return;

    const handleMessage = (message: { type: string; data?: PageReleaseInfo }) => {
      if (message.type === 'RELEASE_DETECTED' && message.data) {
        setCurrentRelease(message.data);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'CHECK_RELEASE' }).catch(() => {});
      }
    });

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      if (event.data?.type === 'DISCOGS_RELEASE_INFO' && event.data.data) {
        setCurrentRelease(event.data.data);
      }
    };
    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, []);

  const clearCurrentRelease = useCallback(() => {
    setCurrentRelease(null);
  }, []);

  return { currentRelease, clearCurrentRelease };
}
