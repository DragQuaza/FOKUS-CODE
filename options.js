document.addEventListener('DOMContentLoaded', function () {
  const blocklistInputEl = document.getElementById('blocklistInput');
  const addBlocklistDomainBtn = document.getElementById('addBlocklistDomain');
  
  initializeOptions();

  function initializeOptions() {
    loadFullBlocklist();

    if (addBlocklistDomainBtn) {
      addBlocklistDomainBtn.addEventListener('click', addToBlocklist);
    }
    if (blocklistInputEl) {
      blocklistInputEl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addToBlocklist();
      });
    }
  }

  function addToBlocklist() {
    const domain = blocklistInputEl.value.trim().toLowerCase();

    if (!domain) {
      showNotification('Please enter a domain name', 'error');
      return;
    }

    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]*\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) {
      showNotification('Please enter a valid domain (e.g., example.com)', 'error');
      return;
    }

    chrome.runtime.sendMessage({
      action: 'addToBlocklist',
      domain: domain
    }, function (response) {
      if (response && response.success) {
        blocklistInputEl.value = '';
        loadFullBlocklist();
        showNotification('Site added to blocklist!', 'success');
        
        // Push instant updates to the live contest countdown badge
        chrome.runtime.sendMessage({ action: 'updateBadge' });
      } else {
        showNotification(response && response.error ? response.error : 'Failed to add', 'error');
      }
    });
  }

  function loadFullBlocklist() {
    chrome.runtime.sendMessage({ action: 'getFullBlocklist' }, function (response) {
      if (response && response.blocklist) {
        displayBlocklist(response.blocklist);
      }
    });
  }

  function displayBlocklist(blocklist) {
    const blocklistDomains = document.getElementById('blocklistDomains');
    const blocklistCount = document.getElementById('blocklistCount');
    if (!blocklistDomains) return;

    blocklistDomains.innerHTML = '';
    if (blocklistCount) {
      blocklistCount.textContent = `${blocklist.length} site${blocklist.length !== 1 ? 's' : ''} blocked`;
    }

    blocklist.forEach(item => {
      const domainItem = document.createElement('div');
      domainItem.className = 'domain-item';
      
      const defaultTag = item.isDefault 
        ? '<span class="domain-tag-default">default</span>' 
        : '';
      
      domainItem.innerHTML = `
        <div class="domain-info">
          <span class="domain-name">${item.domain}</span>
          ${defaultTag}
        </div>
        <button class="remove-btn" data-domain="${item.domain}" title="Unblock ${item.domain}">×</button>
      `;
      blocklistDomains.appendChild(domainItem);
    });

    blocklistDomains.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const domain = this.dataset.domain;
        chrome.runtime.sendMessage({
          action: 'removeFromBlocklist',
          domain: domain
        }, function (response) {
          if (response && response.success) {
            loadFullBlocklist();
            showNotification(`${domain} removed from blocklist`, 'success');
            
            // Push instant updates to the live contest countdown badge
            chrome.runtime.sendMessage({ action: 'updateBadge' });
          }
        });
      });
    });
  }

  function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    if (!notification) return;

    notification.textContent = message;
    notification.style.display = 'flex';
    notification.style.background = type === 'success' ? '#10B981' : '#EF4444';

    setTimeout(() => {
      notification.style.display = 'none';
    }, 3000);
  }
});
