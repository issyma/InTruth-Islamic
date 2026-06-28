// Скрипт содержимого для YouTube страниц

// Функция для безопасного извлечения описания из DOM
function getDescriptionFromDOM() {
  const selectors = [
    '#description-inline-expander',
    'ytd-text-inline-expander#description-inline-expander',
    '#description-text',
    '#description .ytd-video-secondary-info-renderer',
    'meta[name="description"]'
  ];
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      if (el.tagName === 'META') {
        return el.getAttribute('content') || "";
      }
      const text = el.textContent.trim();
      if (text) return text;
    }
  }
  return "";
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getVideoDetails") {
    try {
      const titleEl = document.querySelector('h1.ytd-watch-metadata') || 
                      document.querySelector('h1.title.ytd-video-primary-info-renderer');
      
      const channelEl = document.querySelector('#owner #channel-name a') || 
                        document.querySelector('ytd-video-owner-renderer #channel-name a');
      
      const title = titleEl ? titleEl.textContent.trim() : document.title.replace(" - YouTube", "");
      const channel = channelEl ? channelEl.textContent.trim() : "Неизвестный канал";
      const url = window.location.href;
      const urlParams = new URLSearchParams(window.location.search);
      const videoId = urlParams.get('v');
      const description = getDescriptionFromDOM();

      sendResponse({ 
        success: true, 
        title, 
        channel, 
        url, 
        videoId,
        description
      });
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
  }
  return true; 
});
