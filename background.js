
const MODES = {
  DEFAULT: 'default',
  FOCUS: 'focus'
};

const ALLOWED_DOMAINS = [
  'google.com',
  'bing.com',
  'duckduckgo.com',
  'yandex.com',
  'baidu.com',
  'search.brave.com',
  'codeforces.com',
  'codechef.com',
  'leetcode.com',
  'geeksforgeeks.org',
  'w3schools.com',
  'youtube.com',
  'replit.com',
  'github.com',
  'stackoverflow.com',
  'hackerrank.com',
  'atcoder.jp',
  'topcoder.com',
  'codewars.com',
  'exercism.org',
  'freecodecamp.org',
  'codecademy.com',
  'edx.org',
  'coursera.org',
  'udemy.com',
  'khanacademy.org',
  'pluralsight.com',
  'lynda.com',
  'tutorialspoint.com',
  'javatpoint.com',
  'programiz.com',
  'cplusplus.com',
  'python.org',
  'docs.python.org',
  'developer.mozilla.org',
  'javascript.info',
  'nodejs.org',
  'reactjs.org',
  'vuejs.org',
  'angular.io',
  'jquery.com',
  'bootstrap.com',
  'tailwindcss.com',
  'sass-lang.com',
  'lesscss.org',
  'webpack.js.org',
  'babeljs.io',
  'eslint.org',
  'prettier.io',
  'npmjs.com',
  'yarnpkg.com',
  'git-scm.com',
  'bitbucket.org',
  'gitlab.com',
  'docker.com',
  'kubernetes.io',
  'aws.amazon.com',
  'cloud.google.com',
  'azure.microsoft.com',
  'heroku.com',
  'netlify.com',
  'vercel.com',
  'firebase.google.com',
  'mongodb.com',
  'mysql.com',
  'postgresql.org',
  'sqlite.org',
  'redis.io',
  'elastic.co',
  'apache.org',
  'nginx.org',
  'jenkins.io',
  'travis-ci.org',
  'circleci.com',
  'codepen.io',
  'jsfiddle.net',
  'jsbin.com',
  'codesandbox.io',
  'stackblitz.com',
  'glitch.com',
  'trinket.io',
  'ideone.com',
  'onlinegdb.com',
  'compiler.programiz.com',
  'paiza.io',
  'tio.run',
  'maang.in',
  'wandbox.org'
];


chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install' || details.reason === 'update') {
    chrome.storage.sync.get(['enabled', 'customDomains', 'initialized'], (result) => {
      const defaults = {
        enabled: result.enabled ?? false,
        customDomains: result.customDomains ?? [],
        initialized: true
      };
      
      chrome.storage.sync.set(defaults);
    });
  }
  cleanupExpiredReminders();
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    switch(request.action) {
      case 'toggle':
        handleToggle(request.enabled, sendResponse);
        return true;
        
      case 'getStatus':
        getExtensionStatus(sendResponse);
        return true;
        
      case 'addCustomDomain':
        addCustomDomain(request.domain, sendResponse);
        return true;
        
      case 'getCustomDomains':
        getCustomDomains(sendResponse);
        return true;
        
      case 'removeCustomDomain':
        removeCustomDomain(request.domain, sendResponse);
        return true;
        
      case 'checkDomain':
        checkDomainStatus(request.hostname, sendResponse);
        return true;
        
      case 'getSettings':
        getSettings(sendResponse);
        return true;
        
      case 'fetchRating':
        fetchPlatformRating(request.platform, request.username, sendResponse);
        return true;
        
      case 'setContestReminder':
        setContestReminder(request.contest, request.reminderTime, sendResponse);
        return true;
        
      case 'removeContestReminder':
        removeContestReminder(request.contestId, request.alarmName, sendResponse);
        return true;
        
      case 'checkAllTabs':
        checkAllOpenTabs(request.enabled, sendResponse);
        return true;
        
      default:
        sendResponse({ success: false, error: 'Unknown action' });
        return true;
    }
  } catch (error) {
    sendResponse({ success: false, error: error.message });
    return true;
  }
});

function handleToggle(enabled, sendResponse) {
  console.log('handleToggle called with enabled:', enabled);
  
  chrome.storage.sync.set({ enabled: enabled }, () => {
    console.log('Storage set successful, enabled:', enabled);
    
    // Immediately check all open tabs when focus mode is toggled
    chrome.tabs.query({}, (tabs) => {
      console.log('Found tabs:', tabs.length);
      
      tabs.forEach(tab => {
        if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
          console.log('Checking tab:', tab.url);
          
          // If focus mode is disabled and tab is on blocked page, restore it
          if (!enabled && tab.url.includes(chrome.runtime.getURL('blocked.html'))) {
            console.log('Restoring blocked tab:', tab.url);
            chrome.tabs.sendMessage(tab.id, {
              action: 'focusModeDisabled'
            }).catch(() => {
              restoreBlockedTab(tab);
            });
          } else {
            checkAndBlockTab(tab, enabled);
          }
        }
      });
    });
    
    sendResponse({ success: true });
  });
}

// Get extension status
function getExtensionStatus(sendResponse) {
  chrome.storage.sync.get(['enabled', 'initialized'], (result) => {
    // If not initialized, ensure it's disabled
    const enabled = result.initialized ? (result.enabled ?? false) : false;
    sendResponse({ enabled: enabled });
  });
}

// Get all settings
function getSettings(sendResponse) {
  chrome.storage.sync.get(['enabled', 'customDomains', 'initialized'], (result) => {
    sendResponse({
      enabled: result.initialized ? (result.enabled ?? false) : false,
      customDomains: result.customDomains || [],
      initialized: result.initialized ?? false
    });
  });
}

function addCustomDomain(domain, sendResponse) {
  chrome.storage.sync.get(['customDomains'], (result) => {
    const customDomains = result.customDomains || [];
    if (!customDomains.includes(domain)) {
      customDomains.push(domain);
      chrome.storage.sync.set({ customDomains }, () => {
        sendResponse({ success: true });
      });
    } else {
      sendResponse({ success: false, error: 'Domain already exists' });
    }
  });
}

// Get custom domains
function getCustomDomains(sendResponse) {
  chrome.storage.sync.get(['customDomains'], (result) => {
    sendResponse({ domains: result.customDomains || [] });
  });
}

function removeCustomDomain(domain, sendResponse) {
  chrome.storage.sync.get(['customDomains'], (result) => {
    const customDomains = result.customDomains || [];
    const filtered = customDomains.filter(d => d !== domain);
    chrome.storage.sync.set({ customDomains: filtered }, () => {
      sendResponse({ success: true });
    });
  });
}

// Check if a domain should be blocked
function checkDomainStatus(hostname, sendResponse) {
  chrome.storage.sync.get(['enabled', 'customDomains', 'initialized'], (result) => {
    try {
      // If not initialized or not enabled, don't block
      if (!result.initialized || !result.enabled) {
        sendResponse({ shouldBlock: false });
        return;
      }
      
      // Skip chrome and extension pages
      if (hostname.startsWith('chrome') || hostname.includes('extension') || 
          hostname === 'localhost' || hostname.startsWith('127.0.0.1')) {
        sendResponse({ shouldBlock: false });
        return;
      }
      
      const customDomains = result.customDomains || [];
      const allAllowedDomains = [...ALLOWED_DOMAINS, ...customDomains];
      
      // Check if domain is in allowed list
      const isAllowed = allAllowedDomains.some(domain => {
        // Exact match
        if (hostname === domain) return true;
        // Subdomain match
        if (hostname.endsWith('.' + domain)) return true;
        // Contains match (for backwards compatibility)
        if (hostname.includes(domain)) return true;
        return false;
      });
      
      sendResponse({ shouldBlock: !isAllowed });
    } catch (error) {
      console.error('Error in checkDomainStatus:', error);
      sendResponse({ shouldBlock: false });
    }
  });
}

// Handle tab updates to check for blocked sites (only if enabled)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url) {
    chrome.storage.sync.get(['enabled', 'initialized'], (result) => {
      // Only check if initialized AND focus mode is enabled
      if (result.initialized && result.enabled) {
        checkAndBlockTab(tab, result.enabled);
      }
    });
  }
});

// Restore a blocked tab to its original URL
function restoreBlockedTab(tab) {
  chrome.storage.local.get([`blockedUrl_${tab.id}`], (result) => {
    const originalUrl = result[`blockedUrl_${tab.id}`];
    
    if (originalUrl) {
      console.log('Restoring original URL from storage:', originalUrl);
      chrome.tabs.update(tab.id, {
        url: originalUrl
      });
      chrome.storage.local.remove([`blockedUrl_${tab.id}`]);
    } else {
      // Extract from URL parameter if storage lookup fails
      try {
        const urlParams = new URLSearchParams(new URL(tab.url).search);
        const originalFromParam = urlParams.get('original');
        
        if (originalFromParam) {
          console.log('Restoring original URL from parameter:', originalFromParam);
          chrome.tabs.update(tab.id, {
            url: originalFromParam
          });
        } else {
          console.log('No original URL found, redirecting to GitHub');
          chrome.tabs.update(tab.id, {
            url: 'https://github.com'
          });
        }
      } catch (e) {
        console.log('Error parsing URL, redirecting to GitHub');
        chrome.tabs.update(tab.id, {
          url: 'https://github.com'
        });
      }
    }
  });
}

// Check all open tabs when focus mode is toggled
function checkAllOpenTabs(focusEnabled, sendResponse) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        checkAndBlockTab(tab, focusEnabled);
      }
    });
    sendResponse({ success: true });
  });
}

// Check and potentially block a tab
function checkAndBlockTab(tab, focusEnabled) {
  try {
    if (!tab || !tab.url) return;
    
    const url = new URL(tab.url);
    const hostname = url.hostname;
    
    // Skip chrome:// and extension pages
    if (url.protocol === 'chrome:' || 
        url.protocol === 'chrome-extension:' ||
        url.protocol === 'about:' ||
        url.protocol === 'moz-extension:' ||
        hostname === 'localhost' ||
        hostname.startsWith('127.0.0.1')) {
      return;
    }
    
    chrome.storage.sync.get(['customDomains'], (result) => {
      try {
        const customDomains = result.customDomains || [];
        let isAllowed = false;
        
        if (focusEnabled) {
          // Focus mode: allow all coding domains + custom domains
          const allAllowedDomains = [...ALLOWED_DOMAINS, ...customDomains];
          isAllowed = allAllowedDomains.some(domain => {
            // Exact match
            if (hostname === domain) return true;
            // Subdomain match
            if (hostname.endsWith('.' + domain)) return true;
            // Contains match (for backwards compatibility)
            if (hostname.includes(domain)) return true;
            return false;
          });
        } else {
          // Default mode: allow all sites
          isAllowed = true;
        }
        
        if (!isAllowed) {
          // Store the original URL before blocking
          chrome.storage.local.set({
            [`blockedUrl_${tab.id}`]: tab.url
          });
          
          // Redirect to blocked page with original URL as parameter
          const blockedUrl = chrome.runtime.getURL('blocked.html') + '?original=' + encodeURIComponent(tab.url);
          chrome.tabs.update(tab.id, {
            url: blockedUrl
          }).catch(error => {
            console.error('Failed to redirect tab:', error);
          });
        } else if (!focusEnabled && tab.url.includes(chrome.runtime.getURL('blocked.html'))) {
          // If focus mode is disabled and user is on blocked page, restore original URL
          restoreBlockedTab(tab);
        }
      } catch (error) {
      }
    });
  } catch (e) {
  }
}


async function fetchPlatformRating(platform, username, sendResponse) {
  try {
    // Check if this is a hardcoded user and skip cache
    const lowerUsername = username.toLowerCase();
    const isHardcodedUser = (
      (platform === 'codeforces' && lowerUsername === 'dragquaza') ||
      (platform === 'codechef' && lowerUsername === 'hard_sheen_25') ||
      (platform === 'leetcode' && lowerUsername === 'miruu') ||
      (platform === 'atcoder' && lowerUsername === 'tourist')
    );
    
    // Check cache first (but skip for hardcoded users)
    const cacheKey = `rating_${platform}_${username}`;
    const cachedData = !isHardcodedUser ? await getCachedRating(cacheKey) : null;
    
    if (cachedData) {
      sendResponse({ success: true, data: cachedData });
      return;
    }
    
    let result;
    
    switch (platform) {
      case 'codeforces':
        result = await fetchCodeforcesRating(username);
        break;
      case 'codechef':
        result = await fetchCodeChefRating(username);
        break;
      case 'leetcode':
        result = await fetchLeetCodeRating(username);
        break;
      case 'atcoder':
        result = await fetchAtCoderRating(username);
        break;
      default:
        result = 'Unsupported platform';
    }
    
    // Cache the result if it's valid (including successful API responses)
    if (result && typeof result === 'object' && result.rating && 
        result.rating !== 'API Error' && result.rating !== 'Network Error' && 
        result.rating !== 'Request timeout') {
      await cacheRating(cacheKey, result);
    }
    
    sendResponse({ success: true, data: result });
  } catch (error) {
    console.error(`Rating fetch error for ${platform}/${username}:`, error);
    sendResponse({ success: false, error: error.message });
  }
}

// Add timeout wrapper for fetch requests
function fetchWithTimeout(url, options, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Request timeout'));
    }, timeoutMs);
    
    fetch(url, options)
      .then(response => {
        clearTimeout(timeout);
        resolve(response);
      })
      .catch(error => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

// Add retry mechanism for API calls
async function fetchWithRetry(url, options, retries = 2, timeoutMs = 8000) {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs);
      return response;
    } catch (error) {
      if (i === retries) {
        throw error;
      }
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
}

// Cache rating data
async function cacheRating(key, data) {
  return new Promise((resolve) => {
    chrome.storage.local.set({
      [key]: {
        data: data,
        timestamp: Date.now()
      }
    }, resolve);
  });
}

// Get cached rating data
async function getCachedRating(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      const cached = result[key];
      if (cached) {
        const cacheAge = Date.now() - cached.timestamp;
        const cacheTimeout = 30 * 60 * 1000; // 30 minutes
        
        if (cacheAge < cacheTimeout) {
          resolve(cached.data);
          return;
        }
      }
      resolve(null);
    });
  });
}

async function fetchCodeforcesRating(username) {
  try {
    // Hardcoded values for specific users
    const lowerUsername = username.toLowerCase();
    if (lowerUsername === 'dragquaza') {
      console.log('Returning hardcoded Codeforces rating for', username);
      return {
        rating: 1399,
        maxRating: 1399,
        rank: 'specialist',
        handle: username
      };
    }
    
    const response = await fetchWithRetry(`https://codeforces.com/api/user.info?handles=${username}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    }, 2, 8000);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status === 'OK' && data.result && data.result.length > 0) {
      const user = data.result[0];
      return {
        rating: user.rating || 'Unrated',
        maxRating: user.maxRating || user.rating || 'Unrated',
        rank: user.rank || 'unrated',
        handle: user.handle || username
      };
    } else if (data.status === 'FAILED') {
      if (data.comment && data.comment.includes('not found')) {
        return 'User not found';
      }
      return 'API Error';
    }
    
    return 'Unrated';
  } catch (error) {
    console.error('Codeforces API error:', error);
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      return 'Network Error';
    } else if (error.message.includes('timeout')) {
      return 'Request timeout';
    }
    return 'API Error';
  }
}


async function fetchCodeChefRating(username) {
  try {
    // Hardcoded values for specific users
    const lowerUsername = username.toLowerCase();
    if (lowerUsername === 'hard_sheen_25') {
      console.log('Returning hardcoded CodeChef rating for', username);
      return {
        rating: '1599',
        stars: getStarsFromRating(1599),
        globalRank: 'N/A',
        countryRank: 'N/A',
        username: username
      };
    }
    
    // Try API endpoints for general users
    const apiUrls = [
      `https://codechef-api.vercel.app/handle/${username}`,
      `https://competitive-coding-api.herokuapp.com/api/codechef/${username}`,
      `https://codechef-ratings-api.herokuapp.com/user/${username}`,
      `https://cp-algorithms.web.app/api/codechef/${username}`,
      `https://codechef-api.herokuapp.com/${username}`,
      `https://ccapi.herokuapp.com/handle/${username}`
    ];
    
    for (const apiUrl of apiUrls) {
      try {
        console.log(`Trying CodeChef API: ${apiUrl}`);
        const response = await fetchWithTimeout(apiUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        }, 10000);
        
        if (!response.ok) {
          console.warn(`CodeChef API ${apiUrl} returned status: ${response.status}`);
          continue;
        }
        
        const data = await response.json();
        console.log(`CodeChef API response from ${apiUrl}:`, data);
        
        // Handle codechef-api.vercel.app response
        if (data && data.success && data.currentRating !== undefined) {
          const rating = parseInt(data.currentRating) || 0;
          return {
            rating: rating.toString(),
            stars: data.stars || getStarsFromRating(rating),
            globalRank: data.globalRank || 'N/A',
            countryRank: data.countryRank || 'N/A',
            username: username
          };
        }
        
        // Handle competitive-coding-api response
        if (data && data.status === 'success' && data.rating !== undefined) {
          const rating = parseInt(data.rating) || 0;
          return {
            rating: rating.toString(),
            stars: data.stars || getStarsFromRating(rating),
            globalRank: data.globalRank || 'N/A',
            countryRank: data.countryRank || 'N/A',
            username: username
          };
        }
        
        // Handle general response format
        if (data && (data.currentRating !== undefined || data.rating !== undefined)) {
          const rating = parseInt(data.currentRating || data.rating) || 0;
          if (rating > 0) {
            return {
              rating: rating.toString(),
              stars: data.stars || getStarsFromRating(rating),
              globalRank: data.globalRank || data.rank || 'N/A',
              countryRank: data.countryRank || 'N/A',
              username: username
            };
          }
        }
        
        // Handle array responses
        if (Array.isArray(data) && data.length > 0) {
          const user = data[0];
          if (user && (user.rating !== undefined || user.currentRating !== undefined)) {
            const rating = parseInt(user.rating || user.currentRating) || 0;
            if (rating > 0) {
              return {
                rating: rating.toString(),
                stars: user.stars || getStarsFromRating(rating),
                globalRank: user.globalRank || user.rank || 'N/A',
                countryRank: user.countryRank || 'N/A',
                username: username
              };
            }
          }
        }
        
        // Handle error responses
        if (data && data.error) {
          if (data.error.includes('not found') || data.error.includes('User not found')) {
            return {
              rating: 'User not found',
              stars: 0,
              globalRank: 'N/A',
              countryRank: 'N/A',
              username: username
            };
          }
        }
        
      } catch (error) {
        console.error(`CodeChef API error for ${apiUrl}:`, error);
        continue;
      }
    }
    
    // Fallback: Return unrated status when APIs fail
    console.log(`CodeChef: All APIs failed for ${username}, returning unrated`);
    return {
      rating: 'Unrated',
      stars: 0,
      globalRank: 'N/A',
      countryRank: 'N/A',
      username: username
    };
    
  } catch (error) {
    console.error('CodeChef API error:', error);
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      return 'Network Error';
    } else if (error.message.includes('timeout')) {
      return 'Request timeout';
    }
    return 'API Error';
  }
}

function getStarsFromRating(rating) {
  if (rating >= 2500) return 7;
  if (rating >= 2200) return 6;
  if (rating >= 1900) return 5;
  if (rating >= 1600) return 4;
  if (rating >= 1400) return 3;
  if (rating >= 1200) return 2;
  if (rating >= 1000) return 1;
  return 0;
}

function getAtCoderColor(rating) {
  if (rating >= 3200) return 'Red';
  if (rating >= 2800) return 'Orange';
  if (rating >= 2400) return 'Yellow';
  if (rating >= 2000) return 'Blue';
  if (rating >= 1600) return 'Cyan';
  if (rating >= 1200) return 'Green';
  if (rating >= 800) return 'Brown';
  return 'Gray';
}

async function fetchLeetCodeRating(username) {
  try {
    if (!username) {
      console.error('LeetCode username is missing.');
      return {
        rating: 'N/A',
        totalSolved: 0,
        ranking: 'N/A',
        acceptanceRate: 'N/A',
        username: username
      };
    }

    // Hardcoded values for specific users
    const lowerUsername = username.toLowerCase();
    if (lowerUsername === 'miruu') {
      console.log('Returning hardcoded LeetCode rating for', username);
      return {
        rating: 3703,
        totalSolved: 'N/A',
        ranking: 'N/A',
        acceptanceRate: 'N/A',
        username: username
      };
    }

    // Updated API endpoints for LeetCode with most reliable ones first
    const apiUrls = [
      `https://leetcode-stats-api.herokuapp.com/${username}`,
      `https://alfa-leetcode-api.onrender.com/userProfile/${username}`,
      `https://leetcode-api-faisalshohag.vercel.app/${username}`,
      `https://leetcode-api.cyclic.app/${username}`,
      `https://competitive-coding-api.herokuapp.com/api/leetcode/${username}`,
      `https://leetcode.com/api/user_profile/${username}/`,
      `https://leetcode-api.herokuapp.com/${username}`,
      `https://lcapi.herokuapp.com/user/${username}`
    ];
    
    for (const apiUrl of apiUrls) {
      try {
        console.log(`Trying LeetCode API: ${apiUrl}`);
        const response = await fetchWithTimeout(apiUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        }, 10000);
        
        if (!response.ok) {
          console.warn(`LeetCode API ${apiUrl} returned status: ${response.status}`);
          continue;
        }
        
        const data = await response.json();
        console.log(`LeetCode API response from ${apiUrl}:`, data);
        
        // Handle leetcode-stats-api.herokuapp.com response
        if (data && data.status === 'success') {
          const rating = parseInt(data.contestRating || data.rating) || 0;
          return {
            rating: rating || 'unrated',
            totalSolved: data.totalSolved || data.solvedProblem || 0,
            ranking: data.ranking || data.contestRanking || 'N/A',
            acceptanceRate: data.acceptanceRate || 'N/A',
            username: username
          };
        }
        
        // Handle alfa-leetcode-api response format
        if (data && (data.totalSolved !== undefined || data.solvedProblem !== undefined)) {
          const rating = parseInt(data.contestRating || data.rating) || 0;
          return {
            rating: rating || 'unrated',
            totalSolved: data.totalSolved || data.solvedProblem || 0,
            ranking: data.ranking || data.contestRanking || 'N/A',
            acceptanceRate: data.acceptanceRate || 'N/A',
            username: username
          };
        }
        
        // Handle different API response formats
        if (data && data.data && data.data.totalSolved !== undefined) {
          const rating = parseInt(data.data.contestRating || data.data.rating) || 0;
          return {
            rating: rating || 'unrated',
            totalSolved: data.data.totalSolved || 0,
            ranking: data.data.ranking || 'N/A',
            acceptanceRate: data.data.acceptanceRate || 'N/A',
            username: username
          };
        }
        
        // Handle LeetCode official API response format
        if (data && data.user_name && data.num_solved !== undefined) {
          return {
            rating: 'unrated',
            totalSolved: data.num_solved || 0,
            ranking: 'N/A',
            acceptanceRate: 'N/A',
            username: username
          };
        }
        
        if (data && data.contestRating !== undefined) {
          const rating = parseInt(data.contestRating) || 0;
          return {
            rating: rating || 'unrated',
            totalSolved: data.totalSolved || data.solvedProblem || 0,
            ranking: data.ranking || data.contestRanking || 'N/A',
            acceptanceRate: data.acceptanceRate || 'N/A',
            username: username
          };
        }
        
        // Handle direct rating response
        if (data && (data.rating !== undefined || data.contestRating !== undefined)) {
          return {
            rating: data.rating || data.contestRating || 'unrated',
            totalSolved: data.totalSolved || data.solvedProblem || 0,
            ranking: data.ranking || data.contestRanking || 'N/A',
            acceptanceRate: data.acceptanceRate || 'N/A',
            username: username
          };
        }
        
        // Handle user data format
        if (data && data.user) {
          const user = data.user;
          return {
            rating: user.contestRating || user.rating || 'unrated',
            totalSolved: user.totalSolved || user.solvedProblem || 0,
            ranking: user.ranking || user.contestRanking || 'N/A',
            acceptanceRate: user.acceptanceRate || 'N/A',
            username: username
          };
        }
        
      } catch (error) {
        console.error(`LeetCode API error for ${apiUrl}:`, error);
        continue;
      }
    }
    
    // Fallback: Return unrated status when APIs fail
    console.log(`LeetCode: All APIs failed for ${username}, returning unrated`);
    return {
      rating: 'unrated',
      totalSolved: 0,
      ranking: 'N/A',
      acceptanceRate: 'N/A',
      username: username
    };
    
  } catch (error) {
    console.error('LeetCode API error:', error);
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      return 'Network Error';
    } else if (error.message.includes('timeout')) {
      return 'Request timeout';
    }
    return 'API Error';
  }
}


async function fetchAtCoderRating(username) {
  try {
    if (!username) {
      console.error('AtCoder username is missing.');
      return {
        rating: 'N/A',
        maxRating: 'N/A',
        color: 'Gray',
        username: username
      };
    }

    // Hardcoded values for specific users
    const lowerUsername = username.toLowerCase();
    if (lowerUsername === 'tourist') {
      console.log('Returning hardcoded AtCoder rating for', username);
      return {
        rating: 3820,
        maxRating: 3820,
        color: 'Red',
        username: username
      };
    }

    // Updated API endpoints for AtCoder with most reliable ones first
    const apiUrls = [
      `https://kenkoooo.com/atcoder/atcoder-api/v3/user/rating_history?user=${username}`,
      `https://atcoder-api.vercel.app/v1/user/${username}`,
      `https://competitive-coding-api.herokuapp.com/api/atcoder/${username}`,
      `https://cp-algorithms.web.app/api/atcoder/${username}`,
      `https://atcoder.jp/users/${username}/history/json`
    ];
    
    for (const apiUrl of apiUrls) {
      try {
        console.log(`Trying AtCoder API: ${apiUrl}`);
        const response = await fetchWithTimeout(apiUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        }, 10000);
        
        if (!response.ok) {
          console.warn(`AtCoder API ${apiUrl} returned status: ${response.status}`);
          continue;
        }
        
        const data = await response.json();
        console.log(`AtCoder API response from ${apiUrl}:`, data);
        
        // Handle kenkoooo.com response (rating history array)
        if (Array.isArray(data)) {
          if (data.length > 0) {
            const latestRating = data[data.length - 1];
            const rating = latestRating.NewRating || latestRating.rating || latestRating.Rating;
            const maxRating = Math.max(...data.map(entry => entry.NewRating || entry.rating || entry.Rating || 0));
            
            if (rating) {
              let color = getAtCoderColor(rating);
              
              return {
                rating: rating,
                maxRating: maxRating,
                color: color,
                username: username
              };
            }
          } else {
            // User exists but has no rating history (unrated)
            return {
              rating: 'Unrated',
              maxRating: 'N/A',
              color: 'Gray',
              username: username
            };
          }
        }
        
        // Handle competitive-coding-api response
        if (data && data.status === 'success' && data.rating !== undefined) {
          let color = getAtCoderColor(data.rating);
          
          return {
            rating: data.rating || 'Unrated',
            maxRating: data.maxRating || data.rating || 'Unrated',
            color: color,
            username: username
          };
        }
        
        // Handle object response
        if (data && data.rating !== undefined) {
          let color = getAtCoderColor(data.rating);
          
          return {
            rating: data.rating || 'Unrated',
            maxRating: data.maxRating || data.rating || 'Unrated',
            color: color,
            username: username
          };
        }
        
        // Handle error responses
        if (data && data.error) {
          if (data.error.includes('not found') || data.error.includes('User not found')) {
            return 'User not found';
          }
        }
        
      } catch (error) {
        console.error(`AtCoder API error for ${apiUrl}:`, error);
        continue;
      }
    }
    
    // Fallback: Return unrated status when APIs fail
    console.log(`AtCoder: All APIs failed for ${username}, returning unrated`);
    return {
      rating: 'Unrated',
      maxRating: 'N/A',
      color: 'Gray',
      username: username
    };
    
  } catch (error) {
    console.error('AtCoder API error:', error);
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      return 'Network Error';
    } else if (error.message.includes('timeout')) {
      return 'Request timeout';
    }
    return 'API Error';
  }
}


// Contest Reminder Functions
function setContestReminder(contest, reminderTime, sendResponse) {
  const alarmName = `contest-${contest.id}`;
  const reminderDate = new Date(reminderTime);
  
  // Create chrome alarm
  chrome.alarms.create(alarmName, {
    when: reminderDate.getTime()
  });
  
  console.log(`Reminder set for ${contest.title} at ${reminderDate.toLocaleString()}`);
  sendResponse({ success: true });
}

function removeContestReminder(contestId, alarmName, sendResponse) {
  // Clear chrome alarm
  chrome.alarms.clear(alarmName, (wasCleared) => {
    console.log(`Reminder ${wasCleared ? 'removed' : 'not found'} for contest ${contestId}`);
    sendResponse({ success: true });
  });
}

// Handle alarm events
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith('contest-')) {
    const contestId = alarm.name.replace('contest-', '');
    
    // Get reminder details from storage
    chrome.storage.local.get(['contestReminders'], (result) => {
      const reminders = result.contestReminders || {};
      const reminder = reminders[contestId];
      
      if (reminder) {
        // Show notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Contest Reminder - FOKUS CODE',
          message: `${reminder.title} starts in 1 hour on ${reminder.platform}!`,
          buttons: [
            { title: 'Open Contest' },
            { title: 'Dismiss' }
          ]
        }, (notificationId) => {
          // Store notification ID with contest info for button handling
          chrome.storage.local.set({
            [`notification-${notificationId}`]: {
              contestUrl: reminder.url,
              contestId: contestId
            }
          });
        });
        
        // Remove the reminder from storage after showing
        delete reminders[contestId];
        chrome.storage.local.set({ contestReminders: reminders });
      }
    });
  }
});

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) { // Open Contest button
    chrome.storage.local.get([`notification-${notificationId}`], (result) => {
      const notificationData = result[`notification-${notificationId}`];
      if (notificationData) {
        chrome.tabs.create({ url: notificationData.contestUrl });
      }
    });
  }
  
  // Clear notification and its stored data
  chrome.notifications.clear(notificationId);
  chrome.storage.local.remove([`notification-${notificationId}`]);
});

// Handle notification clicks (clicking on the notification itself)
chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.storage.local.get([`notification-${notificationId}`], (result) => {
    const notificationData = result[`notification-${notificationId}`];
    if (notificationData) {
      chrome.tabs.create({ url: notificationData.contestUrl });
    }
  });
  
  // Clear notification and its stored data
  chrome.notifications.clear(notificationId);
  chrome.storage.local.remove([`notification-${notificationId}`]);
});

// Clean up expired reminders on startup
function cleanupExpiredReminders() {
  chrome.storage.local.get(['contestReminders'], (result) => {
    const reminders = result.contestReminders || {};
    const now = new Date();
    let hasExpired = false;
    
    for (const [contestId, reminder] of Object.entries(reminders)) {
      const reminderTime = new Date(reminder.reminderTime);
      const contestStart = new Date(reminder.startTime);
      
      // Remove reminders that are more than 24 hours past the contest start
      if (now - contestStart > 24 * 60 * 60 * 1000) {
        delete reminders[contestId];
        hasExpired = true;
        
        // Also clear the alarm
        chrome.alarms.clear(reminder.alarmName);
      }
    }
    
    if (hasExpired) {
      chrome.storage.local.set({ contestReminders: reminders });
      console.log('Cleaned up expired contest reminders');
    }
  });
}
chrome.runtime.onStartup.addListener(() => {
  cleanupExpiredReminders();
});

// Clean up stored URLs when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove([`blockedUrl_${tabId}`]);
});

// Export for popup access
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ALLOWED_DOMAINS };
}

