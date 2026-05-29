document.addEventListener('DOMContentLoaded', function () {
  const enableToggle = document.getElementById('enableToggle');
  const openSettingsBtn = document.getElementById('openSettingsBtn');
  const backBtn = document.getElementById('backBtn');
  const mainView = document.getElementById('mainView');
  const settingsView = document.getElementById('settingsView');
  const addBlocklistDomainBtn = document.getElementById('addBlocklistDomain');
  const blocklistInputEl = document.getElementById('blocklistInput');

  initializePopup();
  initializeContests();
  initializeProfile();
  initializeAiAssistant();

  // Navigate to settings page
  openSettingsBtn.addEventListener('click', function () {
    mainView.style.display = 'none';
    settingsView.style.display = 'block';
    loadFullBlocklist();
  });

  // Navigate back to main page
  backBtn.addEventListener('click', function () {
    settingsView.style.display = 'none';
    mainView.style.display = 'block';
  });

  // Add domain to blocklist
  addBlocklistDomainBtn.addEventListener('click', addToBlocklist);
  blocklistInputEl.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') addToBlocklist();
  });
  
  // Real-time filter list when typing
  blocklistInputEl.addEventListener('input', function (e) {
    const query = e.target.value.toLowerCase().trim();
    const items = document.querySelectorAll('.domain-item');
    items.forEach(item => {
      const domainName = item.dataset.search || '';
      if (domainName.includes(query)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  });

  enableToggle.addEventListener('change', function () {
    const enabled = enableToggle.checked;
    const timerInput = document.getElementById('focusTimerInput');
    const duration = enabled && timerInput.value ? parseInt(timerInput.value, 10) : 0;

    chrome.runtime.sendMessage({
      action: 'toggle',
      enabled: enabled,
      duration: duration
    }, function (response) {
      if (chrome.runtime.lastError) {
        showNotification('Error toggling focus mode.', 'error');
        enableToggle.checked = !enabled;
        return;
      }

      if (response && response.success) {
        if (enabled) {
          showNotification('Focus mode enabled', 'success');
        } else {
          showNotification('Focus mode disabled', 'error');
        }
        chrome.runtime.sendMessage({ action: 'checkAllTabs', enabled: enabled });
      } else {
        showNotification('Failed to toggle focus mode', 'error');
        enableToggle.checked = !enabled;
      }
    });
  });

  function initializePopup() {
    chrome.runtime.sendMessage({ action: 'getSettings' }, function (response) {
      if (response) {
        enableToggle.checked = response.enabled ?? false;
      }
    });

    // Set up inline timer UI
    const timerInput = document.getElementById('focusTimerInput');
    const timerLabel = document.getElementById('focusTimerLabel');
    const countdown = document.getElementById('focusCountdown');
    let inlineInterval;
    
    function updateInlineDisplay(ms) {
      if (ms <= 0) ms = 0;
      const totalSeconds = Math.floor(ms / 1000);
      const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
      const s = (totalSeconds % 60).toString().padStart(2, '0');
      countdown.textContent = `⏳ ${m}:${s}`;
    }
    
    function renderInlineTimer(endTime) {
      clearInterval(inlineInterval);
      if (endTime > Date.now()) {
        timerInput.style.display = 'none';
        timerLabel.style.display = 'none';
        countdown.style.display = 'inline-block';
        
        const tick = () => {
          const remaining = endTime - Date.now();
          if (remaining <= 0) {
            updateInlineDisplay(0);
            clearInterval(inlineInterval);
          } else {
            updateInlineDisplay(remaining);
          }
        };
        tick();
        inlineInterval = setInterval(tick, 1000);
      } else {
        timerInput.style.display = 'inline-block';
        timerLabel.style.display = 'inline-block';
        countdown.style.display = 'none';
      }
    }
    
    chrome.storage.local.get(['pomodoroEndTime'], (res) => {
      renderInlineTimer(res.pomodoroEndTime || 0);
    });
    
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.pomodoroEndTime) {
        renderInlineTimer(changes.pomodoroEndTime.newValue || 0);
      }
    });
  }

  function addToBlocklist() {
    const domain = blocklistInputEl.value.trim().toLowerCase();
    if (!domain) return;

    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]*\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) {
      showNotification('Enter a valid domain', 'error');
      return;
    }

    chrome.runtime.sendMessage({ action: 'addToBlocklist', domain: domain }, function (response) {
      if (response && response.success) {
        blocklistInputEl.value = '';
        loadFullBlocklist();
        showNotification('Site added!', 'success');
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

    // Sort alphabetically
    blocklist.sort((a, b) => a.domain.localeCompare(b.domain));

    blocklistDomains.innerHTML = '';
    if (blocklistCount) {
      blocklistCount.textContent = `${blocklist.length} site${blocklist.length !== 1 ? 's' : ''} allowed`;
    }

    blocklist.forEach(item => {
      const el = document.createElement('div');
      el.className = 'domain-item';
      // Store domain for filtering
      el.dataset.search = item.domain.toLowerCase();
      el.innerHTML = `
        <div class="domain-info"><span>${item.domain}</span></div>
        <button class="remove-btn" data-domain="${item.domain}">×</button>
      `;
      blocklistDomains.appendChild(el);
    });

    blocklistDomains.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const domain = this.dataset.domain;
        chrome.runtime.sendMessage({ action: 'removeFromBlocklist', domain: domain }, function (response) {
          if (response && response.success) {
            loadFullBlocklist();
            showNotification(`${domain} removed`, 'success');
          }
        });
      });
    });
  }


  function showNotification(message, type = 'success') {
    // Remove existing notification to prevent spam
    const existing = document.getElementById('fokus-notification');
    if (existing) existing.remove();

    // Create notification element
    const notification = document.createElement('div');
    notification.id = 'fokus-notification';
    notification.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      padding: 10px 15px;
      border-radius: 5px;
      color: white;
      font-size: 12px;
      font-weight: 500;
      z-index: 1000;
      background: ${type === 'success' ? '#4CAF50' : '#f44336'};
      animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Remove notification after 3 seconds
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  // Add CSS animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);

  function initializeContests() {
    loadContests();

    const remindAllBtn = document.getElementById('remindAllBtn');
    if (remindAllBtn) {
      remindAllBtn.addEventListener('click', () => {
        chrome.storage.local.get(['disabledReminders'], (result) => {
          let disabled = result.disabledReminders || {};
          const allBtns = document.querySelectorAll('#contestsList .reminder-btn');
          const isAllSet = remindAllBtn.classList.contains('all-set');

          if (isAllSet) {
            // Turn OFF all reminders
            allBtns.forEach(btn => {
              if (btn.dataset.contestId) {
                disabled[btn.dataset.contestId] = true;
                btn.classList.remove('active');
                btn.innerHTML = `<span class="reminder-icon">🔔</span>Remind`;
                btn.title = 'Set reminder for this contest';
              }
            });
            chrome.storage.local.set({ disabledReminders: disabled }, () => {
              showNotification('All reminders turned off!', 'success');
              updateRemindAllButtonState();
            });
          } else {
            // Turn ON all reminders
            allBtns.forEach(btn => {
              if (btn.dataset.contestId) {
                delete disabled[btn.dataset.contestId];
                btn.classList.add('active');
                btn.innerHTML = `<span class="reminder-icon">✓</span>Set`;
                btn.title = 'Reminder set - click to remove';
              }
            });
            chrome.storage.local.set({ disabledReminders: disabled }, () => {
              showNotification('Reminders set for all upcoming contests!', 'success');
              updateRemindAllButtonState();
            });
          }
        });
      });
    }

    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'refresh-btn';
    refreshBtn.textContent = '🔄 Refresh Contests';
    refreshBtn.onclick = () => {
      refreshBtn.disabled = true;
      refreshBtn.textContent = 'Refreshing...';
      loadContests(true).finally(() => {
        refreshBtn.disabled = false;
        refreshBtn.textContent = '🔄 Refresh Contests';
      });
    };

    document.getElementById('contestsContainer').appendChild(refreshBtn);
  }

  async function loadContests(forceRefresh = false) {
    const contestsLoading = document.getElementById('contestsLoading');
    const contestsList = document.getElementById('contestsList');

    if (contestsLoading) {
      contestsLoading.style.display = 'block';
    }
    contestsList.innerHTML = '';

    try {
      const contests = await fetchContests(forceRefresh);

      if (contestsLoading) {
        contestsLoading.style.display = 'none';
      }

      if (contests.length === 0) {
        contestsList.innerHTML = '<div class="no-contests">No upcoming contests found</div>';
        return;
      }

      contests.forEach(contest => {
        const contestItem = createContestElement(contest);
        if (contestItem) {
          contestsList.appendChild(contestItem);
        }
      });

      // Update Remind All button state after rendering and checking storage
      setTimeout(updateRemindAllButtonState, 100);

    } catch (error) {
      if (contestsLoading) {
        contestsLoading.style.display = 'none';
      }
      contestsList.innerHTML = '<div class="no-contests">Failed to load contests</div>';
    }
  }

  async function fetchContests(forceRefresh = false) {
    const cached = await getCachedContests();
    if (!forceRefresh && cached && cached.contests && cached.timestamp) {
      const cacheAge = Date.now() - cached.timestamp;
      const cacheTimeout = 30 * 60 * 1000;

      if (cacheAge < cacheTimeout) {
        return cached.contests;
      }
    }

    const contests = [];

    try {
      const [codeforces, codechef] = await Promise.allSettled([
        fetchCodeforces(),
        fetchCodeChef()
      ]);

      if (codeforces.status === 'fulfilled') {
        contests.push(...codeforces.value);
      } else {
        contests.push(...getFallbackCodeforces());
      }

      if (codechef.status === 'fulfilled') {
        contests.push(...codechef.value);
      } else {
        contests.push(...getFallbackCodeChef());
      }

      contests.push(...getStaticContests());

      contests.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

      const now = new Date();
      const futureContests = contests.filter(contest => new Date(contest.startTime) > now);

      await cacheContests(futureContests);
      chrome.runtime.sendMessage({ action: 'updateBadge' });

      return futureContests.slice(0, 10);
    } catch (error) {
      return getStaticContests();
    }
  }

  async function fetchCodeforces() {
    try {
      const response = await fetch('https://codeforces.com/api/contest.list');
      const data = await response.json();

      if (data.status !== 'OK') {
        throw new Error('Codeforces API error');
      }

      return data.result
        .filter(contest => contest.phase === 'BEFORE')
        .slice(0, 5)
        .map(contest => ({
          id: `cf-${contest.id}`,
          title: contest.name,
          platform: 'codeforces',
          startTime: new Date(contest.startTimeSeconds * 1000).toISOString(),
          duration: contest.durationSeconds,
          url: `https://codeforces.com/contestRegistration/${contest.id}`,
          type: contest.type || 'Contest'
        }));
    } catch (error) {
      return [];
    }
  }

  async function fetchCodeChef() {
    try {
      const response = await fetch('https://www.codechef.com/api/list/contests/all?sort_by=START&sorting_order=asc&offset=0&mode=all');
      const data = await response.json();

      const contests = [];

      if (data.future_contests) {
        Object.values(data.future_contests).slice(0, 5).forEach(contest => {
          contests.push({
            id: `cc-${contest.contest_code}`,
            title: contest.contest_name,
            platform: 'codechef',
            startTime: contest.contest_start_date_iso,
            duration: parseInt(contest.contest_duration) * 60,
            url: `https://www.codechef.com/${contest.contest_code}`,
            type: 'Contest'
          });
        });
      }

      return contests;
    } catch (error) {
      return [];
    }
  }

  function createContestElement(contest) {
    if (!contest || !contest.id || !contest.title || !contest.startTime) {
      return null;
    }

    const contestItem = document.createElement('div');
    contestItem.className = 'contest-item';
    contestItem.onclick = (e) => {
      if (e.target.closest('.reminder-btn')) {
        return;
      }
      if (contest.url) {
        chrome.tabs.create({ url: contest.url });
      }
    };

    const timeUntil = getTimeUntilContest(contest.startTime);
    const status = getContestStatus(contest.startTime, contest.duration || 0);

    contestItem.innerHTML = `
      <div class="contest-header">
        <div class="contest-title">${contest.title}</div>
        <div class="contest-platform ${contest.platform || 'unknown'}">${contest.platform || 'Unknown'}</div>
      </div>
      <div class="contest-footer">
        <div class="reminder-button-container"></div>
        <div class="contest-countdown ${status}">${timeUntil}</div>
      </div>
    `;

    const reminderBtn = createReminderButton(contest);
    const reminderContainer = contestItem.querySelector('.reminder-button-container');
    reminderContainer.appendChild(reminderBtn);

    return contestItem;
  }

  function getTimeUntilContest(startTime) {
    const now = new Date();
    const start = new Date(startTime);
    const diff = start - now;

    if (diff <= 0) {
      return 'Started';
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days}d ${hours}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }


  function getContestStatus(startTime, duration) {
    const now = new Date();
    const start = new Date(startTime);
    const end = new Date(start.getTime() + duration * 1000);

    if (now < start) {
      return 'upcoming';
    } else if (now >= start && now <= end) {
      return 'live';
    } else {
      return 'ended';
    }
  }

  async function getCachedContests() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['contestsCache'], (result) => {
        resolve(result.contestsCache || null);
      });
    });
  }

  async function cacheContests(contests) {
    return new Promise((resolve) => {
      chrome.storage.local.set({
        contestsCache: {
          contests: contests,
          timestamp: Date.now()
        }
      }, resolve);
    });
  }

  function getFallbackCodeforces() {
    const now = new Date();
    return [
      {
        id: 'cf-demo-1',
        title: 'Codeforces Round #XX (Div. 2)',
        platform: 'codeforces',
        startTime: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 7200,
        url: 'https://codeforces.com/contests',
        type: 'Contest'
      }
    ];
  }

  function getFallbackCodeChef() {
    const now = new Date();
    return [
      {
        id: 'cc-demo-1',
        title: 'CodeChef Starters',
        platform: 'codechef',
        startTime: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 10800,
        url: 'https://www.codechef.com/contests',
        type: 'Contest'
      }
    ];
  }

  function getStaticContests() {
    const now = new Date();
    return [
      {
        id: 'lc-weekly',
        title: 'LeetCode Weekly Contest',
        platform: 'leetcode',
        startTime: getNextSunday(now, 10, 30).toISOString(),
        duration: 5400,
        url: 'https://leetcode.com/contest/',
        type: 'Weekly Contest'
      },
      {
        id: 'lc-biweekly',
        title: 'LeetCode Biweekly Contest',
        platform: 'leetcode',
        startTime: getNextSaturday(now, 20, 30).toISOString(),
        duration: 5400,
        url: 'https://leetcode.com/contest/',
        type: 'Biweekly Contest'
      },
      {
        id: 'ac-beginner',
        title: 'AtCoder Beginner Contest',
        platform: 'atcoder',
        startTime: getNextSaturday(now, 21, 0).toISOString(),
        duration: 6000,
        url: 'https://atcoder.jp/contests/',
        type: 'ABC'
      }
    ];
  }

  function getNextSunday(date, hour = 0, minute = 0) {
    const result = new Date(date);
    result.setDate(result.getDate() + (7 - result.getDay()) % 7);
    result.setHours(hour, minute, 0, 0);
    if (result <= date) {
      result.setDate(result.getDate() + 7);
    }
    return result;
  }

  function getNextSaturday(date, hour = 0, minute = 0) {
    const result = new Date(date);
    result.setDate(result.getDate() + (6 - result.getDay()) % 7);
    result.setHours(hour, minute, 0, 0);
    if (result <= date) {
      result.setDate(result.getDate() + 7);
    }
    return result;
  }

  // ===========================
  // Profile functionality
  // ===========================
  function initializeProfile() {
    loadProfile();
    document.getElementById('saveProfile').addEventListener('click', handleSaveProfile);
    document.getElementById('signOut').addEventListener('click', handleSignOut);
  }

  function loadProfile() {
    chrome.storage.sync.get(['userProfile'], function (result) {
      if (result.userProfile) {
        displayProfile(result.userProfile);
      } else {
        showAuthSection();
      }
    });
  }

  function handleSaveProfile() {
    const displayName = document.getElementById('displayName').value.trim();
    const codeforcesUsername = document.getElementById('codeforcesUsername').value.trim();
    const codechefUsername = document.getElementById('codechefUsername').value.trim();
    const leetcodeUsername = document.getElementById('leetcodeUsername').value.trim();
    const atcoderUsername = document.getElementById('atcoderUsername').value.trim();

    if (!displayName && !codeforcesUsername && !codechefUsername && !leetcodeUsername && !atcoderUsername) {
      showNotification('Please enter your name or at least one username', 'error');
      return;
    }

    const profile = {
      type: 'manual',
      usernames: {
        codeforces: codeforcesUsername,
        codechef: codechefUsername,
        leetcode: leetcodeUsername,
        atcoder: atcoderUsername
      },
      displayName: displayName || 'Coder',
      email: '',
      avatar: ''
    };

    chrome.storage.sync.set({ userProfile: profile }, function () {
      showNotification('Profile saved successfully!', 'success');
      displayProfile(profile);
    });
  }

  function handleSignOut() {
    chrome.storage.sync.remove(['userProfile'], function () {
      showNotification('Signed out successfully', 'success');
      showAuthSection();
    });
  }

  function showAuthSection() {
    document.getElementById('authSection').style.display = 'block';
    document.getElementById('profileDisplay').style.display = 'none';

    document.getElementById('displayName').value = '';
    document.getElementById('codeforcesUsername').value = '';
    document.getElementById('codechefUsername').value = '';
    document.getElementById('leetcodeUsername').value = '';
    document.getElementById('atcoderUsername').value = '';
  }

  function displayProfile(profile) {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('profileDisplay').style.display = 'block';

    const displayName = profile.displayName || 'Coder';
    const firstName = displayName.split(' ')[0];
    const profileTitle = `${firstName}'s Profile`;
    const usernameHandle = `@${displayName.toLowerCase().replace(/\s+/g, '')}`;

    document.getElementById('profileName').textContent = profileTitle;
    document.getElementById('profileEmail').textContent = usernameHandle;

    document.getElementById('displayName').value = profile.displayName || '';
    document.getElementById('codeforcesUsername').value = profile.usernames?.codeforces || '';
    document.getElementById('codechefUsername').value = profile.usernames?.codechef || '';
    document.getElementById('leetcodeUsername').value = profile.usernames?.leetcode || '';
    document.getElementById('atcoderUsername').value = profile.usernames?.atcoder || '';

    const profilePhoto = document.getElementById('profilePhoto');
    const profileInitials = document.getElementById('profileInitials');

    if (profile.avatar) {
      profilePhoto.src = profile.avatar;
      profilePhoto.style.display = 'block';
      profileInitials.style.display = 'none';
    } else {
      profilePhoto.style.display = 'none';
      profileInitials.style.display = 'flex';
      profileInitials.textContent = displayName.charAt(0).toUpperCase();
    }

    if (profile.usernames) {
      updatePlatformDisplay('codeforces', profile.usernames.codeforces);
      updatePlatformDisplay('codechef', profile.usernames.codechef);
      updatePlatformDisplay('leetcode', profile.usernames.leetcode);
      updatePlatformDisplay('atcoder', profile.usernames.atcoder);
      fetchUserRatings(profile.usernames);
    }
  }

  function updatePlatformDisplay(platform, username) {
    const usernameElement = document.getElementById(`${platform}DisplayUsername`);
    const ratingElement = document.getElementById(`${platform}Rating`);

    if (username) {
      usernameElement.textContent = username;
      ratingElement.textContent = 'Loading...';
      ratingElement.className = 'platform-loading';
    } else {
      usernameElement.textContent = '-';
      ratingElement.textContent = '-';
      ratingElement.className = '';
    }
  }

  async function fetchUserRatings(usernames) {
    if (usernames.codeforces) fetchPlatformRating('codeforces', usernames.codeforces);
    if (usernames.codechef) fetchPlatformRating('codechef', usernames.codechef);
    if (usernames.leetcode) fetchPlatformRating('leetcode', usernames.leetcode);
    if (usernames.atcoder) fetchPlatformRating('atcoder', usernames.atcoder);
  }

  function fetchPlatformRating(platform, username) {
    chrome.runtime.sendMessage({
      action: 'fetchRating',
      platform: platform,
      username: username
    }, function (response) {
      const ratingElement = document.getElementById(`${platform}Rating`);

      if (response && response.success) {
        const data = response.data;
        updateRatingDisplay(platform, data);
      } else {
        ratingElement.textContent = response && response.error ? 'Error' : 'N/A';
        ratingElement.className = 'platform-error';
        ratingElement.style.color = '#EF4444';
        ratingElement.title = response && response.error ? response.error : 'Unable to fetch rating';
      }
    });
  }

  function updateRatingDisplay(platform, data) {
    const ratingElement = document.getElementById(`${platform}Rating`);

    if (typeof data === 'string') {
      ratingElement.textContent = data;
      ratingElement.className = data.includes('Error') || data.includes('not found') ? 'platform-error' : 'platform-loading';
      return;
    }

    if (data && (data.rating === 'N/A' || data.rating === 'API Error')) {
      ratingElement.textContent = data.rating === 'API Error' ? 'Error' : 'N/A';
      ratingElement.className = 'platform-error';
      ratingElement.style.color = '#EF4444';
      ratingElement.title = 'Rating not available - API may be down';
      return;
    }

    if (data && (data.rating === 'Network Error' || data.rating === 'Request timeout')) {
      ratingElement.textContent = 'Network Error';
      ratingElement.className = 'platform-error';
      ratingElement.style.color = '#EF4444';
      ratingElement.title = 'Network error - please check your connection';
      return;
    }

    switch (platform) {
      case 'codeforces':
        if (data.rating && data.rating !== 'Unrated') {
          ratingElement.textContent = data.rating;
          ratingElement.className = 'platform-rating';
          if (data.maxRating && data.maxRating !== data.rating) {
            ratingElement.title = `Current: ${data.rating}, Max: ${data.maxRating}`;
          }
          ratingElement.style.color = '#10B981';
        } else {
          ratingElement.textContent = 'Unrated';
          ratingElement.className = 'platform-loading';
        }
        break;

      case 'codechef':
        if (data.rating && data.rating !== 'Unrated') {
          ratingElement.textContent = data.rating;
          ratingElement.className = 'platform-rating';
          if (data.stars > 0) {
            ratingElement.title = `${data.stars} stars`;
          }
          ratingElement.style.color = '#10B981';
        } else {
          ratingElement.textContent = 'Unrated';
          ratingElement.className = 'platform-loading';
        }
        break;

      case 'leetcode':
        if (data.rating && data.rating !== 'Unrated' && data.rating !== 'unrated') {
          const rating = typeof data.rating === 'number' ? Math.round(data.rating) : data.rating;
          ratingElement.textContent = rating;
          ratingElement.className = 'platform-rating';
          if (data.totalSolved) {
            ratingElement.title = `Rating: ${rating}, Problems solved: ${data.totalSolved}`;
          }
          ratingElement.style.color = '#10B981';
        } else {
          ratingElement.textContent = 'unrated';
          ratingElement.className = 'platform-loading';
        }
        break;

      case 'atcoder':
        if (data.rating && data.rating !== 'Unrated') {
          ratingElement.textContent = data.rating;
          ratingElement.className = 'platform-rating';
          if (data.color) {
            ratingElement.title = `${data.color} coder`;
          }
          if (data.maxRating && data.maxRating !== data.rating) {
            ratingElement.title = `Current: ${data.rating}, Max: ${data.maxRating}, Color: ${data.color}`;
          }
          ratingElement.style.color = '#10B981';
        } else {
          ratingElement.textContent = 'Unrated';
          ratingElement.className = 'platform-loading';
        }
        break;

      default:
        ratingElement.textContent = '-';
        ratingElement.className = '';
    }
  }

  // ===========================
  // Contest Reminder Functions
  // ===========================
  function createReminderButton(contest) {
    const reminderBtn = document.createElement('button');
    reminderBtn.className = 'reminder-btn';
    reminderBtn.title = 'Set reminder for this contest';
    reminderBtn.innerHTML = `<span class="reminder-icon">🔔</span>Remind`;

    if (contest && contest.id) {
      reminderBtn.dataset.contestId = contest.id; // Store ID for bulk actions
      checkReminderStatus(contest.id).then(isSet => {
        if (isSet) {
          reminderBtn.classList.add('active');
          reminderBtn.innerHTML = `<span class="reminder-icon">✓</span>Set`;
          reminderBtn.title = 'Reminder set - click to remove';
        } else {
          reminderBtn.classList.remove('active');
          reminderBtn.innerHTML = `<span class="reminder-icon">🔔</span>Remind`;
          reminderBtn.title = 'Set reminder for this contest';
        }
      }).catch(() => { });
    }

    reminderBtn.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      toggleReminder(contest, reminderBtn);
    };

    return reminderBtn;
  }

  async function checkReminderStatus(contestId) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['disabledReminders'], (result) => {
        const disabled = result.disabledReminders || {};
        // It is SET (true) by default, unless it is in the disabled list
        resolve(!disabled[contestId]);
      });
    });
  }

  async function toggleReminder(contest, buttonElement) {
    const isCurrentlySet = buttonElement.classList.contains('active');

    chrome.storage.local.get(['disabledReminders'], (result) => {
      const disabled = result.disabledReminders || {};
      
      if (isCurrentlySet) {
        // User wants to turn it off
        disabled[contest.id] = true;
        chrome.storage.local.set({ disabledReminders: disabled }, () => {
          buttonElement.classList.remove('active');
          buttonElement.innerHTML = `<span class="reminder-icon">🔔</span>Remind`;
          buttonElement.title = 'Set reminder for this contest';
          showNotification('Reminder removed', 'success');
          updateRemindAllButtonState();
        });
      } else {
        // User wants to turn it back on
        delete disabled[contest.id];
        chrome.storage.local.set({ disabledReminders: disabled }, () => {
          buttonElement.classList.add('active');
          buttonElement.innerHTML = `<span class="reminder-icon">✓</span>Set`;
          buttonElement.title = 'Reminder set - click to remove';
          showNotification('Reminder set! You\'ll be notified 1 hour before.', 'success');
          updateRemindAllButtonState();
        });
      }
    });
  }

  function updateRemindAllButtonState() {
    const remindAllBtn = document.getElementById('remindAllBtn');
    if (!remindAllBtn) return;

    const unsetBtns = document.querySelectorAll('#contestsList .reminder-btn:not(.active)');
    const allBtns = document.querySelectorAll('#contestsList .reminder-btn');

    if (allBtns.length > 0 && unsetBtns.length === 0) {
      remindAllBtn.classList.add('all-set');
      remindAllBtn.innerHTML = '✓ All Set';
    } else {
      remindAllBtn.classList.remove('all-set');
      remindAllBtn.innerHTML = '🔔 Remind All';
    }
  }

  // ===========================
  // AI Assistant (Backend-powered)
  // ===========================
  const AI_SERVER_URL = 'http://localhost:3001';

  // ── AI Assistant: Open Side Panel ──
  function initializeAiAssistant() {
    const fab = document.getElementById('aiFab');
    if (!fab) return;

    fab.addEventListener('click', async () => {
      try {
        // Open the side panel on the current window
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.sidePanel.open({ windowId: tab.windowId });
        // Close the popup so the side panel is clearly visible
        window.close();
      } catch (err) {
        console.error('Failed to open side panel:', err);
      }
    });
  }

});

