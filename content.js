(function () {
  'use strict';

  function checkAndBlock() {
    chrome.storage.sync.get(['enabled'], (result) => {
      if (!result.enabled) {
        return;
      }

      const currentHostname = window.location.hostname;

      if (currentHostname.startsWith('chrome') ||
        currentHostname.includes('extension') ||
        window.location.protocol.startsWith('chrome') ||
        window.location.protocol.startsWith('moz')) {
        return;
      }

      chrome.runtime.sendMessage({
        action: 'checkDomain',
        hostname: currentHostname
      }, function (response) {
        if (chrome.runtime.lastError) {
          return;
        }

        if (response && response.shouldBlock) {
          try {
            window.location.href = chrome.runtime.getURL('blocked.html') + '?original=' + encodeURIComponent(window.location.href);
          } catch (error) {
          }
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(checkAndBlock, 200);
    });
  } else {
    setTimeout(checkAndBlock, 200);
  }

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && (changes.enabled || changes.customDomains)) {
      if (changes.enabled) {
        const newEnabled = changes.enabled.newValue;
        const oldEnabled = changes.enabled.oldValue;

        if (newEnabled !== oldEnabled) {
          setTimeout(() => {
            checkAndBlock();
          }, 50);
        }
      } else {
        setTimeout(() => {
          checkAndBlock();
        }, 100);
      }
    }
  });

  // Handle messages for AI Assistant
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getPageContent') {
      // Get visible text from body, truncated to reasonable size for Gemini
      const bodyText = document.body.innerText;
      const maxLength = 10000; // ~2.5k tokens
      const truncatedText = bodyText.length > maxLength
        ? bodyText.substring(0, maxLength) + '... [Content Truncated]'
        : bodyText;

      sendResponse({
        content: truncatedText,
        title: document.title,
        url: window.location.href
      });
      return true;
    }
  });

})();
