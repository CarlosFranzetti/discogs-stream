declare const chrome: typeof globalThis.chrome;

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;

  const isDiscogs = tab.url.includes('www.discogs.com');
  chrome.sidePanel.setOptions({
    tabId,
    path: 'panel.html',
    enabled: true,
  }).catch(console.error);

  if (isDiscogs && changeInfo.url) {
    const releaseMatch = changeInfo.url.match(/\/release\/(\d+)/);
    const masterMatch = changeInfo.url.match(/\/master\/(\d+)/);

    if (releaseMatch || masterMatch) {
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, { type: 'CHECK_RELEASE' }).catch(() => {});
      }, 800);
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_PANEL') {
    if (sender.tab?.id) {
      chrome.sidePanel.open({ tabId: sender.tab.id }).catch(console.error);
    }
  }

  if (message.type === 'RELAY_RELEASE') {
    chrome.runtime.sendMessage({ type: 'RELEASE_DETECTED', data: message.data }).catch(() => {});
  }

  if (message.type === 'OPEN_URL') {
    chrome.tabs.create({ url: message.url, active: true });
  }

  if (message.type === 'GET_ACTIVE_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ tab: tabs[0] || null });
    });
    return true;
  }
});
