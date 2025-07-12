(function() {
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
      }, function(response) {
        if (chrome.runtime.lastError) {
          return;
        }
        
        if (response && response.shouldBlock) {
          try {
            window.location.href = chrome.runtime.getURL('blocked.html');
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

})();
