
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
    switch (request.action) {
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
    // Check cache first
    const cacheKey = `rating_${platform}_${username}`;
    const cachedData = await getCachedRating(cacheKey);

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


// ============================
// CODECHEF SERVICE (HTML Scraper)
// Fetches the profile page directly and parses rating data.
// Strategy 1: Extract __NEXT_DATA__ JSON (CodeChef uses Next.js)
// Strategy 2: Regex fallback on raw HTML
// ============================
async function fetchCodeChefRating(username) {
  try {
    // Fetch the actual profile page HTML
    const response = await fetchWithRetry(
      `https://www.codechef.com/users/${username}`,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      },
      2,  // retries
      15000 // timeout (longer for HTML pages)
    );

    if (!response.ok) {
      if (response.status === 404) {
        return { rating: 'User not found', stars: 0, globalRank: 'N/A', countryRank: 'N/A', username: username };
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    // Check for 404 / user not found in page content
    if (html.includes('Page Not Found') || html.includes('page-not-found')) {
      return { rating: 'User not found', stars: 0, globalRank: 'N/A', countryRank: 'N/A', username: username };
    }

    // --- Strategy 1: Parse __NEXT_DATA__ JSON ---
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const pageProps = nextData?.props?.pageProps;
        if (pageProps) {
          // Navigate through possible data shapes in Next.js payload
          const userData = pageProps.userData || pageProps.data || pageProps;
          const rating = parseInt(userData.currentRating || userData.rating) || 0;
          if (rating > 0) {
            console.log(`CodeChef: Parsed rating ${rating} from __NEXT_DATA__ for ${username}`);
            return {
              rating: rating.toString(),
              stars: userData.stars || getStarsFromRating(rating),
              globalRank: userData.globalRank || userData.global_rank || 'N/A',
              countryRank: userData.countryRank || userData.country_rank || 'N/A',
              username: username
            };
          }
        }
      } catch (parseError) {
        console.warn('CodeChef: Failed to parse __NEXT_DATA__, falling back to regex:', parseError.message);
      }
    }

    // --- Strategy 2: Regex-based HTML parsing ---
    // Look for rating number in common HTML patterns
    const ratingMatch = html.match(/rating-number[^>]*>(\d+)/i) ||
      html.match(/"currentRating"\s*:\s*(\d+)/) ||
      html.match(/"rating"\s*:\s*"?(\d+)"?/);

    if (ratingMatch) {
      const rating = parseInt(ratingMatch[1]);
      if (rating > 0) {
        console.log(`CodeChef: Parsed rating ${rating} from HTML regex for ${username}`);

        // Extract stars from HTML
        let stars = getStarsFromRating(rating);
        const starsMatch = html.match(/rating-star[^>]*>([\s\S]*?)<\/span>/i);
        if (starsMatch) {
          const starCount = (starsMatch[1].match(/\u2605/g) || []).length; // ★ character
          if (starCount > 0) stars = starCount;
        }

        // Extract global rank
        const globalRankMatch = html.match(/Global\s*Rank[^<]*<[^>]*>(\d+)/i) ||
          html.match(/"globalRank"\s*:\s*"?(\d+)"?/);
        const globalRank = globalRankMatch ? globalRankMatch[1] : 'N/A';

        // Extract country rank
        const countryRankMatch = html.match(/Country\s*Rank[^<]*<[^>]*>(\d+)/i) ||
          html.match(/"countryRank"\s*:\s*"?(\d+)"?/);
        const countryRank = countryRankMatch ? countryRankMatch[1] : 'N/A';

        return {
          rating: rating.toString(),
          stars: stars,
          globalRank: globalRank,
          countryRank: countryRank,
          username: username
        };
      }
    }

    // User exists but is unrated
    console.log(`CodeChef: No rating found for ${username}, returning unrated`);
    return {
      rating: 'Unrated',
      stars: 0,
      globalRank: 'N/A',
      countryRank: 'N/A',
      username: username
    };

  } catch (error) {
    console.error('CodeChef scraper error:', error);
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

// ============================
// LEETCODE SERVICE (Direct GraphQL)
// Single POST to leetcode.com/graphql — no mirrors needed.
// Fetches contest rating + total problems solved.
// ============================
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

    // GraphQL query for contest ranking and solve statistics
    const query = `
      query getUserProfile($username: String!) {
        userContestRanking(username: $username) {
          rating
          globalRanking
          attendedContestsCount
        }
        matchedUser(username: $username) {
          profile {
            ranking
          }
          submitStatsGlobal {
            acSubmissionNum {
              difficulty
              count
            }
          }
        }
      }
    `;

    const response = await fetchWithRetry(
      'https://leetcode.com/graphql',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Referer': 'https://leetcode.com',
          'Origin': 'https://leetcode.com'
        },
        body: JSON.stringify({
          query: query,
          variables: { username: username }
        })
      },
      2,  // retries
      10000 // timeout
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    // Handle GraphQL-level errors (e.g., user not found)
    if (data.errors) {
      const notFound = data.errors.some(e => e.message && e.message.toLowerCase().includes('not found'));
      if (notFound) return 'User not found';
      console.error('LeetCode GraphQL errors:', data.errors);
      throw new Error(data.errors[0].message);
    }

    const contestRanking = data.data?.userContestRanking;
    const matchedUser = data.data?.matchedUser;

    // If matchedUser is null, the username does not exist
    if (!matchedUser) {
      return 'User not found';
    }

    // Calculate total problems solved from the submission stats
    let totalSolved = 0;
    if (matchedUser.submitStatsGlobal?.acSubmissionNum) {
      const allDifficulty = matchedUser.submitStatsGlobal.acSubmissionNum.find(
        s => s.difficulty === 'All'
      );
      totalSolved = allDifficulty?.count || 0;
    }

    // Contest rating (rounded) or 'unrated' if user hasn't participated
    const rating = contestRanking ? Math.round(contestRanking.rating) : 'unrated';
    const ranking = matchedUser.profile?.ranking || contestRanking?.globalRanking || 'N/A';

    console.log(`LeetCode: Fetched rating ${rating} for ${username} via GraphQL`);

    return {
      rating: rating,
      totalSolved: totalSolved,
      ranking: ranking,
      acceptanceRate: 'N/A',
      username: username
    };

  } catch (error) {
    console.error('LeetCode GraphQL error:', error);
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      return 'Network Error';
    } else if (error.message.includes('timeout')) {
      return 'Request timeout';
    }
    return 'API Error';
  }
}


// ============================
// ATCODER SERVICE (Kenkoooo API only)
// Single stable endpoint — returns rating history as a JSON array.
// ============================
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

    // Primary: Official AtCoder history endpoint (most reliable)
    // Fallback: Kenkoooo v2 user_info (for basic stats if official fails)
    const apiUrls = [
      `https://atcoder.jp/users/${username}/history/json`,
      `https://kenkoooo.com/atcoder/atcoder-api/v2/user_info?user=${username}`
    ];

    for (const apiUrl of apiUrls) {
      try {
        console.log(`AtCoder: Trying ${apiUrl}`);
        const response = await fetchWithRetry(
          apiUrl,
          {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Cache-Control': 'no-cache'
            }
          },
          2,  // retries
          10000 // timeout
        );

        if (!response.ok) {
          console.warn(`AtCoder: ${apiUrl} returned HTTP ${response.status}`);
          continue;
        }

        const data = await response.json();

        // Handle array response (official AtCoder history endpoint)
        if (Array.isArray(data)) {
          if (data.length === 0) {
            console.log(`AtCoder: ${username} has no rating history (unrated)`);
            return {
              rating: 'Unrated',
              maxRating: 'N/A',
              color: 'Gray',
              username: username
            };
          }

          // Latest rating is the last element in the array
          const latestRating = data[data.length - 1];
          const rating = latestRating.NewRating || 0;
          const maxRating = Math.max(...data.map(entry => entry.NewRating || 0));
          const color = getAtCoderColor(rating);

          console.log(`AtCoder: Fetched rating ${rating} (max: ${maxRating}) for ${username}`);
          return {
            rating: rating,
            maxRating: maxRating,
            color: color,
            username: username
          };
        }

        // Handle object response (Kenkoooo v2 user_info — no rating, but confirms user exists)
        if (data && data.user_id) {
          console.log(`AtCoder: Found user ${username} via Kenkoooo v2 but no rating data available`);
          return {
            rating: 'Unrated',
            maxRating: 'N/A',
            color: 'Gray',
            username: username
          };
        }

      } catch (error) {
        console.error(`AtCoder: Error fetching ${apiUrl}:`, error.message);
        continue;
      }
    }

    // All endpoints failed
    console.log(`AtCoder: All endpoints failed for ${username}`);
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

