document.addEventListener('DOMContentLoaded', function () {
  const enableToggle = document.getElementById('enableToggle');
  const domainInput = document.getElementById('domainInput');
  const addDomainBtn = document.getElementById('addDomain');
  const customDomainsContainer = document.getElementById('customDomains');

  initializePopup();
  initializeContests();
  initializeProfile();
  initializeAiAssistant();

  enableToggle.addEventListener('change', function () {
    const enabled = enableToggle.checked;
    console.log('Toggle clicked, enabled:', enabled);

    chrome.runtime.sendMessage({
      action: 'toggle',
      enabled: enabled
    }, function (response) {
      if (chrome.runtime.lastError) {
        console.error('Runtime error:', chrome.runtime.lastError);
        showNotification('Error toggling focus mode. Please try again.', 'error');
        enableToggle.checked = !enabled;
        return;
      }

      if (response && response.success) {
        console.log('Toggle successful');
        updateStatus(enabled);

        // Check all tabs immediately
        chrome.runtime.sendMessage({
          action: 'checkAllTabs',
          enabled: enabled
        });
      } else {
        console.error('Toggle failed:', response);
        showNotification('Failed to toggle focus mode', 'error');
        enableToggle.checked = !enabled;
      }
    });
  });

  addDomainBtn.addEventListener('click', addCustomDomain);
  domainInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      addCustomDomain();
    }
  });

  function initializePopup() {
    chrome.runtime.sendMessage({ action: 'getStatus' }, function (response) {
      enableToggle.checked = response.enabled ?? false;
    });
    loadCustomDomains();
  }

  function updateStatus(enabled) {
    if (enabled) {
      showNotification('Focus mode enabled - only coding sites allowed', 'success');
    } else {
      showNotification('Focus mode disabled', 'error');
    }
  }

  function addCustomDomain() {
    const domain = domainInput.value.trim().toLowerCase();

    if (!domain) {
      showNotification('Please enter a domain name', 'error');
      return;
    }

    // More flexible domain validation
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]*\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) {
      showNotification('Please enter a valid domain (e.g., example.com)', 'error');
      return;
    }

    chrome.runtime.sendMessage({
      action: 'addCustomDomain',
      domain: domain
    }, function (response) {
      if (response.success) {
        domainInput.value = '';
        loadCustomDomains();
        showNotification('Domain added successfully!', 'success');
      }
    });
  }

  function loadCustomDomains() {
    chrome.runtime.sendMessage({ action: 'getCustomDomains' }, function (response) {
      displayCustomDomains(response.domains);
    });
  }

  function displayCustomDomains(domains) {
    customDomainsContainer.innerHTML = '';

    domains.forEach(domain => {
      const domainItem = document.createElement('div');
      domainItem.className = 'domain-item';
      domainItem.innerHTML = `
        <span>${domain}</span>
        <button class="remove-btn" data-domain="${domain}">×</button>
      `;
      customDomainsContainer.appendChild(domainItem);
    });

    document.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        removeCustomDomain(this.dataset.domain);
      });
    });
  }

  function removeCustomDomain(domain) {
    chrome.runtime.sendMessage({
      action: 'removeCustomDomain',
      domain: domain
    }, function (response) {
      if (response && response.success) {
        loadCustomDomains();
        showNotification('Domain removed', 'success');
      }
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
        const unsetBtns = document.querySelectorAll('#contestsList .reminder-btn:not(.active)');
        if (unsetBtns.length === 0) {
          showNotification('All reminders are already set!', 'success');
          return;
        }

        // Programmatically click all unset buttons
        unsetBtns.forEach(btn => btn.click());
        showNotification('Reminders set for all upcoming contests!', 'success');
        updateRemindAllButtonState();
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
      checkReminderStatus(contest.id).then(isSet => {
        if (isSet) {
          reminderBtn.classList.add('active');
          reminderBtn.innerHTML = `<span class="reminder-icon">✓</span>Set`;
          reminderBtn.title = 'Reminder set - click to remove';
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
      chrome.storage.local.get(['contestReminders'], (result) => {
        const reminders = result.contestReminders || {};
        resolve(!!reminders[contestId]);
      });
    });
  }

  async function toggleReminder(contest, buttonElement) {
    const isCurrentlySet = buttonElement.classList.contains('active');

    if (isCurrentlySet) {
      await removeReminder(contest.id);
      buttonElement.classList.remove('active');
      buttonElement.innerHTML = `<span class="reminder-icon">🔔</span>Remind`;
      buttonElement.title = 'Set reminder for this contest';
      showNotification('Reminder removed', 'success');
    } else {
      await setReminder(contest);
      buttonElement.classList.add('active');
      buttonElement.innerHTML = `<span class="reminder-icon">✓</span>Set`;
      buttonElement.title = 'Reminder set - click to remove';
      showNotification('Reminder set! You\'ll be notified 1 hour before the contest.', 'success');
    }

    updateRemindAllButtonState();
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

  async function setReminder(contest) {
    const contestStart = new Date(contest.startTime);
    const now = new Date();
    const reminderTime = new Date(contestStart.getTime() - (1 * 60 * 60 * 1000));

    if (reminderTime <= now) {
      const timeUntilContest = Math.floor((contestStart - now) / (1000 * 60));
      if (timeUntilContest <= 0) {
        showNotification('Contest has already started', 'error');
        return;
      } else if (timeUntilContest < 60) {
        showNotification(`Contest starts in ${timeUntilContest} minutes - too soon for 1 hour reminder`, 'error');
        return;
      }
    }

    return new Promise((resolve) => {
      chrome.storage.local.get(['contestReminders'], (result) => {
        const reminders = result.contestReminders || {};
        reminders[contest.id] = {
          id: contest.id,
          title: contest.title,
          platform: contest.platform,
          startTime: contest.startTime,
          url: contest.url,
          reminderTime: reminderTime.toISOString(),
          alarmName: `contest-${contest.id}`
        };

        chrome.storage.local.set({ contestReminders: reminders }, () => {
          chrome.runtime.sendMessage({
            action: 'setContestReminder',
            contest: contest,
            reminderTime: reminderTime.toISOString()
          }, (response) => {
            resolve();
          });
        });
      });
    });
  }

  async function removeReminder(contestId) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['contestReminders'], (result) => {
        const reminders = result.contestReminders || {};
        const reminder = reminders[contestId];

        if (reminder) {
          delete reminders[contestId];
          chrome.storage.local.set({ contestReminders: reminders }, () => {
            chrome.runtime.sendMessage({
              action: 'removeContestReminder',
              contestId: contestId,
              alarmName: reminder.alarmName
            }, (response) => {
              resolve();
            });
          });
        } else {
          resolve();
        }
      });
    });
  }

  // ===========================
  // AI Assistant (Backend-powered)
  // ===========================
  const AI_SERVER_URL = 'http://localhost:3001';

  function initializeAiAssistant() {
    const fab = document.getElementById('aiFab');
    const modal = document.getElementById('aiModal');
    const overlay = document.getElementById('aiOverlay');
    const closeBtn = document.getElementById('aiClose');
    const sendBtn = document.getElementById('aiSend');
    const input = document.getElementById('aiInput');

    fab.addEventListener('click', toggleAiModal);
    closeBtn.addEventListener('click', toggleAiModal);
    overlay.addEventListener('click', toggleAiModal);
    sendBtn.addEventListener('click', handleAskAi);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleAskAi();
    });
  }

  function toggleAiModal() {
    const modal = document.getElementById('aiModal');
    const overlay = document.getElementById('aiOverlay');
    const fab = document.getElementById('aiFab');

    const isOpen = modal.classList.contains('visible');

    if (isOpen) {
      modal.classList.remove('visible');
      overlay.classList.remove('visible');
      fab.classList.remove('active');
      fab.textContent = '✨';
    } else {
      modal.classList.add('visible');
      overlay.classList.add('visible');
      fab.classList.add('active');
      fab.textContent = '✕';
      document.getElementById('aiInput').focus();
    }
  }

  // Lightweight markdown → HTML renderer
  function renderMarkdown(text) {
    let html = text;
    // Escape HTML entities first
    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Code blocks (```lang ... ```)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Headers (### → h4, ## → h3)  
    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    // Unordered lists
    html = html.replace(/^[\*\-] (.+)$/gm, '<li>$1</li>');
    html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
    // Ordered lists
    html = html.replace(/^\d+\.\s(.+)$/gm, '<li>$1</li>');
    // Paragraphs (double newlines)
    html = html.replace(/\n\n/g, '</p><p>');
    // Single newlines → <br> (but not inside pre/code)
    html = html.replace(/\n/g, '<br>');
    // Wrap in paragraph
    html = '<p>' + html + '</p>';
    // Clean up empty paragraphs
    html = html.replace(/<p><\/p>/g, '');
    return html;
  }

  function addMessage(text, type) {
    const messagesContainer = document.getElementById('aiMessages');

    // Remove welcome message on first interaction
    const welcome = messagesContainer.querySelector('.ai-welcome');
    if (welcome) welcome.remove();

    const msg = document.createElement('div');
    msg.className = `ai-msg ${type}`;

    // Render markdown for bot messages, plain text for user messages
    if (type.startsWith('bot') && !type.includes('thinking')) {
      msg.innerHTML = renderMarkdown(text);
    } else {
      msg.textContent = text;
    }

    messagesContainer.appendChild(msg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return msg;
  }

  async function handleAskAi() {
    const input = document.getElementById('aiInput');
    const sendBtn = document.getElementById('aiSend');
    const question = input.value.trim();

    if (!question) return;

    // Show user message
    addMessage(question, 'user');
    input.value = '';
    sendBtn.disabled = true;

    // Show thinking indicator
    const thinkingMsg = addMessage('Thinking…', 'bot thinking');

    try {
      // 1. Get page context from content script (with injection fallback)
      let pageContext = '';
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // Skip system/extension pages
        if (tab && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
          let contentResponse = null;

          // Try the content script first
          try {
            contentResponse = await chrome.tabs.sendMessage(tab.id, { action: 'getPageContent' });
          } catch (e) {
            // Content script not loaded — inject one on the fly
            console.log('Content script not available, injecting...');
            try {
              const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                  const bodyText = document.body.innerText;
                  const maxLen = 10000;
                  return {
                    content: bodyText.length > maxLen ? bodyText.substring(0, maxLen) + '... [Truncated]' : bodyText,
                    title: document.title,
                    url: window.location.href
                  };
                }
              });
              if (results && results[0] && results[0].result) {
                contentResponse = results[0].result;
              }
            } catch (injectErr) {
              console.log('Script injection also failed:', injectErr.message);
            }
          }

          if (contentResponse && contentResponse.content) {
            pageContext = `Page: "${contentResponse.title}"\nURL: ${contentResponse.url}\n\n${contentResponse.content}`;
          }
        }
      } catch (e) {
        pageContext = '';
      }

      // 2. Send to secure backend
      const response = await fetch(`${AI_SERVER_URL}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: question, context: pageContext })
      });

      const data = await response.json();

      // Replace thinking message with answer
      thinkingMsg.remove();

      if (response.ok && data.answer) {
        addMessage(data.answer, 'bot');
      } else {
        addMessage(data.error || 'Failed to get a response.', 'bot error');
      }

    } catch (err) {
      thinkingMsg.remove();
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        addMessage('Cannot reach the AI server. Make sure it\'s running:\n\ncd server && npm start', 'bot error');
      } else {
        addMessage(`Error: ${err.message}`, 'bot error');
      }
    } finally {
      sendBtn.disabled = false;
      document.getElementById('aiInput').focus();
    }
  }

});
