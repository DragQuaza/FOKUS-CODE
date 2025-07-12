document.addEventListener('DOMContentLoaded', function() {
  const enableToggle = document.getElementById('enableToggle');
  const domainInput = document.getElementById('domainInput');
  const addDomainBtn = document.getElementById('addDomain');
  const customDomainsContainer = document.getElementById('customDomains');

  initializePopup();
  initializeContests();
  initializeProfile();

  enableToggle.addEventListener('change', function() {
    const enabled = enableToggle.checked;
    console.log('Toggle clicked, enabled:', enabled);
    
    chrome.runtime.sendMessage({
      action: 'toggle',
      enabled: enabled
    }, function(response) {
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
  domainInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      addCustomDomain();
    }
  });

  function initializePopup() {
    chrome.runtime.sendMessage({ action: 'getStatus' }, function(response) {
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
    }, function(response) {
      if (response.success) {
        domainInput.value = '';
        loadCustomDomains();
        showNotification('Domain added successfully!', 'success');
      }
    });
  }

  function loadCustomDomains() {
    chrome.runtime.sendMessage({ action: 'getCustomDomains' }, function(response) {
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
      btn.addEventListener('click', function() {
        removeCustomDomain(this.dataset.domain);
      });
    });
  }

  function removeCustomDomain(domain) {
    chrome.storage.sync.get(['customDomains'], function(result) {
      const customDomains = result.customDomains || [];
      const updatedDomains = customDomains.filter(d => d !== domain);
      
      chrome.storage.sync.set({ customDomains: updatedDomains }, function() {
        loadCustomDomains();
        showNotification('Domain removed', 'success');
        
        chrome.runtime.sendMessage({
          action: 'updateRules'
        });
      });
    });
  }


  function showNotification(message, type) {
    // Create notification element
    const notification = document.createElement('div');
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
        if (contestItem) { // Only append if contest element was created successfully
          contestsList.appendChild(contestItem);
        }
      });
      
    } catch (error) {
        // Error loading contests
      if (contestsLoading) {
        contestsLoading.style.display = 'none';
      }
      contestsList.innerHTML = '<div class="no-contests">Failed to load contests</div>';
    }
  }
  
  async function fetchContests(forceRefresh = false) {
    // Check cache first
    const cached = await getCachedContests();
    if (!forceRefresh && cached && cached.contests && cached.timestamp) {
      const cacheAge = Date.now() - cached.timestamp;
      const cacheTimeout = 30 * 60 * 1000; // 30 minutes
      
      if (cacheAge < cacheTimeout) {
        return cached.contests;
      }
    }
    
    const contests = [];
    
    // Fetch from all platforms
    try {
      const [codeforces, codechef] = await Promise.allSettled([
        fetchCodeforces(),
        fetchCodeChef()
      ]);
      
      if (codeforces.status === 'fulfilled') {
        contests.push(...codeforces.value);
      } else {
        // Codeforces fetch failed, using fallback data
        contests.push(...getFallbackCodeforces());
      }
      
      if (codechef.status === 'fulfilled') {
        contests.push(...codechef.value);
      } else {
        // CodeChef fetch failed, using fallback data
        contests.push(...getFallbackCodeChef());
      }
      
      // Add static contests for demonstration
      contests.push(...getStaticContests());
      
      // Sort by start time
      contests.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
      
      // Filter future contests only
      const now = new Date();
      const futureContests = contests.filter(contest => new Date(contest.startTime) > now);
      
      // Cache the results
      await cacheContests(futureContests);
      
      return futureContests.slice(0, 10); // Limit to 10 contests
    } catch (error) {
      // Error fetching contests
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
      // Codeforces fetch error
      return [];
    }
  }
  
  async function fetchCodeChef() {
    try {
      const response = await fetch('https://www.codechef.com/api/list/contests/all?sort_by=START&sorting_order=asc&offset=0&mode=all');
      const data = await response.json();
      
      const contests = [];
      
      // Add future contests
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
      // CodeChef fetch error
      return [];
    }
  }
  
  function createContestElement(contest) {
    // Ensure contest has required properties
    if (!contest || !contest.id || !contest.title || !contest.startTime) {
      // Contest missing required properties
      return null;
    }
    
    const contestItem = document.createElement('div');
    contestItem.className = 'contest-item';
    contestItem.onclick = (e) => {
      // Don't open contest if clicking on reminder button
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
    
    // Add reminder button to bottom-left position
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
        startTime: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
        duration: 7200, // 2 hours
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
        startTime: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
        duration: 10800, // 3 hours
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
        startTime: getNextSunday(now, 10, 30).toISOString(), // Next Sunday 10:30 AM
        duration: 5400, // 1.5 hours
        url: 'https://leetcode.com/contest/',
        type: 'Weekly Contest'
      },
      {
        id: 'lc-biweekly',
        title: 'LeetCode Biweekly Contest',
        platform: 'leetcode',
        startTime: getNextSaturday(now, 20, 30).toISOString(), // Next Saturday 8:30 PM
        duration: 5400, // 1.5 hours
        url: 'https://leetcode.com/contest/',
        type: 'Biweekly Contest'
      },
      {
        id: 'ac-beginner',
        title: 'AtCoder Beginner Contest',
        platform: 'atcoder',
        startTime: getNextSaturday(now, 21, 0).toISOString(), // Next Saturday 9:00 PM
        duration: 6000, // 100 minutes
        url: 'https://atcoder.jp/contests/',
        type: 'ABC'
      }
    ];
  }
  
  function getNextSunday(date, hour = 0, minute = 0) {
    const result = new Date(date);
    result.setDate(result.getDate() + (7 - result.getDay()) % 7);
    if (result.getDay() === 0 && result < date) {
      result.setDate(result.getDate() + 7);
    }
    result.setHours(hour, minute, 0, 0);
    return result;
  }
  
  function getNextSaturday(date, hour = 0, minute = 0) {
    const result = new Date(date);
    result.setDate(result.getDate() + (6 - result.getDay()) % 7);
    if (result.getDay() === 6 && result < date) {
      result.setDate(result.getDate() + 7);
    }
    result.setHours(hour, minute, 0, 0);
    return result;
  }
  
  // Profile functionality
  function initializeProfile() {
    loadProfile();
    
    document.getElementById('saveProfile').addEventListener('click', handleSaveProfile);
    document.getElementById('signOut').addEventListener('click', handleSignOut);
  }
  
  function loadProfile() {
    chrome.storage.sync.get(['userProfile'], function(result) {
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
      email: '', // Remove default 'Local Profile' text
      avatar: ''
    };
    
    chrome.storage.sync.set({ userProfile: profile }, function() {
      showNotification('Profile saved successfully!', 'success');
      displayProfile(profile);
    });
  }
  
  function handleSignOut() {
    chrome.storage.sync.remove(['userProfile'], function() {
      showNotification('Signed out successfully', 'success');
      showAuthSection();
    });
  }
  
  function showAuthSection() {
    document.getElementById('authSection').style.display = 'block';
    document.getElementById('profileDisplay').style.display = 'none';
    
    // Clear input fields
    document.getElementById('displayName').value = '';
    document.getElementById('codeforcesUsername').value = '';
    document.getElementById('codechefUsername').value = '';
    document.getElementById('leetcodeUsername').value = '';
    document.getElementById('atcoderUsername').value = '';
  }
  
  function displayProfile(profile) {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('profileDisplay').style.display = 'block';
    
    // Set profile info
    const displayName = profile.displayName || 'Coder';
    
    // General profile display logic
    const firstName = displayName.split(' ')[0]; // Get first word as first name
    const profileTitle = `${firstName}'s Profile`;
    const usernameHandle = `@${displayName.toLowerCase().replace(/\s+/g, '')}`; // Remove spaces and lowercase
    
    document.getElementById('profileName').textContent = profileTitle;
    document.getElementById('profileEmail').textContent = usernameHandle;
    
    // Handle avatar
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
    
    // Update platform usernames
    if (profile.usernames) {
      updatePlatformDisplay('codeforces', profile.usernames.codeforces);
      updatePlatformDisplay('codechef', profile.usernames.codechef);
      updatePlatformDisplay('leetcode', profile.usernames.leetcode);
      updatePlatformDisplay('atcoder', profile.usernames.atcoder);
      
      // Fetch ratings
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
    // Fetch ratings for each platform
    if (usernames.codeforces) {
      fetchPlatformRating('codeforces', usernames.codeforces);
    }
    
    if (usernames.codechef) {
      fetchPlatformRating('codechef', usernames.codechef);
    }
    
    if (usernames.leetcode) {
      fetchPlatformRating('leetcode', usernames.leetcode);
    }
    
    if (usernames.atcoder) {
      fetchPlatformRating('atcoder', usernames.atcoder);
    }
  }
  
  function fetchPlatformRating(platform, username) {
    // Use background script to fetch ratings (to avoid CORS)
    chrome.runtime.sendMessage({
      action: 'fetchRating',
      platform: platform,
      username: username
    }, function(response) {
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
      // Handle error or status messages
      ratingElement.textContent = data;
      ratingElement.className = data.includes('Error') || data.includes('not found') ? 'platform-error' : 'platform-loading';
      return;
    }
    
    // Handle N/A or fallback responses
    if (data && (data.rating === 'N/A' || data.rating === 'API Error')) {
      ratingElement.textContent = data.rating === 'API Error' ? 'Error' : 'N/A';
      ratingElement.className = 'platform-error';
      ratingElement.style.color = '#EF4444';
      ratingElement.title = 'Rating not available - API may be down';
      return;
    }
    
    // Handle Network Error or API timeout
    if (data && (data.rating === 'Network Error' || data.rating === 'Request timeout')) {
      ratingElement.textContent = 'Network Error';
      ratingElement.className = 'platform-error';
      ratingElement.style.color = '#EF4444';
      ratingElement.title = 'Network error - please check your connection';
      return;
    }
    
    // Handle different platform data formats
    switch (platform) {
      case 'codeforces':
        if (data.rating && data.rating !== 'Unrated') {
          ratingElement.textContent = data.rating;
          ratingElement.className = 'platform-rating';
          if (data.maxRating && data.maxRating !== data.rating) {
            ratingElement.title = `Current: ${data.rating}, Max: ${data.maxRating}`;
          }
          
          // All ratings in extension green
          ratingElement.style.color = '#10B981'; // Extension green for all ratings
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
          
          // All ratings in extension green
          ratingElement.style.color = '#10B981'; // Extension green for all ratings
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
          
          // All ratings in extension green
          ratingElement.style.color = '#10B981'; // Extension green for all ratings
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
          
          // All ratings in extension green
          ratingElement.style.color = '#10B981'; // Extension green for all ratings
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
  
  // Contest Reminder Functions
  function createReminderButton(contest) {
    const reminderBtn = document.createElement('button');
    reminderBtn.className = 'reminder-btn';
    reminderBtn.title = 'Set reminder for this contest';
    reminderBtn.innerHTML = `<span class="reminder-icon">🔔</span>Remind`;
    
    // Always check reminder status for all contests
    if (contest && contest.id) {
      checkReminderStatus(contest.id).then(isSet => {
        if (isSet) {
          reminderBtn.classList.add('active');
          reminderBtn.innerHTML = `<span class="reminder-icon">✓</span>Set`;
          reminderBtn.title = 'Reminder set - click to remove';
        }
      }).catch(error => {
        // Error checking reminder status
        // Default to unset state
      });
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
      // Remove reminder
      await removeReminder(contest.id);
      buttonElement.classList.remove('active');
      buttonElement.innerHTML = `<span class="reminder-icon">🔔</span>Remind`;
      buttonElement.title = 'Set reminder for this contest';
      showNotification('Reminder removed', 'success');
    } else {
      // Set reminder
      await setReminder(contest);
      buttonElement.classList.add('active');
      buttonElement.innerHTML = `<span class="reminder-icon">✓</span>Set`;
      buttonElement.title = 'Reminder set - click to remove';
      showNotification('Reminder set! You\'ll be notified 1 hour before the contest.', 'success');
    }
  }
  
  async function setReminder(contest) {
    const contestStart = new Date(contest.startTime);
    const now = new Date();
    const reminderTime = new Date(contestStart.getTime() - (1 * 60 * 60 * 1000)); // 1 hour before
    
    // Don't set reminder if contest starts in less than 1 hour or if reminder time has passed
    if (reminderTime <= now) {
      const timeUntilContest = Math.floor((contestStart - now) / (1000 * 60)); // minutes
      if (timeUntilContest <= 0) {
        showNotification('Contest has already started', 'error');
        return;
      } else if (timeUntilContest < 60) {
        showNotification(`Contest starts in ${timeUntilContest} minutes - too soon for 1 hour reminder`, 'error');
        return;
      }
    }
    
    // Store reminder in local storage
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
          // Set chrome alarm
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
            // Remove chrome alarm
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
  

});
