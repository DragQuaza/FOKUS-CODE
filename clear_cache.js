
const SUPPORTED_PLATFORMS = ['codeforces', 'codechef', 'leetcode', 'atcoder'];
function discoverRatingCacheKeys(callback) {
  chrome.storage.local.get(null, function(items) {
    const ratingKeys = Object.keys(items).filter(key => key.startsWith('rating_'));
    const cacheInfo = ratingKeys.map(key => {
      const parts = key.split('_');
      if (parts.length >= 3) {
        const platform = parts[1];
        const username = parts.slice(2).join('_'); 
        return { key, platform, username };
      }
      return { key, platform: 'unknown', username: 'unknown' };
    });
    
    callback(cacheInfo, ratingKeys);
  });
}
function checkUsernameInCache(username, callback) {
  discoverRatingCacheKeys(function(cacheInfo, allKeys) {
    const matchingEntries = cacheInfo.filter(entry => 
      entry.username.toLowerCase() === username.toLowerCase()
    );
    
    if (matchingEntries.length > 0) {
      console.log(`Username '${username}' found in cache:`);
      matchingEntries.forEach(entry => {
        console.log(`  - Platform: ${entry.platform}, Key: ${entry.key}`);
      });
      callback(true, matchingEntries);
    } else {
      console.log(`Username '${username}' not found in cache`);
      callback(false, []);
    }
  });
}
function clearCacheForUsername(username) {
  checkUsernameInCache(username, function(exists, entries) {
    if (exists) {
      const keysToRemove = entries.map(entry => entry.key);
      
      chrome.storage.local.remove(keysToRemove, function() {
        console.log(`Cache cleared for username '${username}':`);
        entries.forEach(entry => {
          console.log(`  - Removed: ${entry.key}`);
        });
        console.log(`Total keys cleared: ${keysToRemove.length}`);
      });
    } else {
      console.log(`No cache found for username '${username}'`);
    }
  });
}
function clearCacheForPlatform(platform) {
  if (!SUPPORTED_PLATFORMS.includes(platform.toLowerCase())) {
    console.warn(`Platform '${platform}' is not in supported platforms list: ${SUPPORTED_PLATFORMS.join(', ')}`);
    console.log('Proceeding anyway to check for cache entries...');
  }
  
  discoverRatingCacheKeys(function(cacheInfo, allKeys) {
    const platformEntries = cacheInfo.filter(entry => 
      entry.platform.toLowerCase() === platform.toLowerCase()
    );
    
    if (platformEntries.length > 0) {
      const keysToRemove = platformEntries.map(entry => entry.key);
      
      chrome.storage.local.remove(keysToRemove, function() {
        console.log(`Cache cleared for platform '${platform}':`);
        platformEntries.forEach(entry => {
          console.log(`  - Removed: ${entry.key} (user: ${entry.username})`);
        });
        console.log(`Total keys cleared: ${keysToRemove.length}`);
      });
    } else {
      console.log(`No cache found for platform '${platform}'`);
    }
  });
}
function clearCacheForUser(platform, username) {
  const key = `rating_${platform}_${username}`;
  
  chrome.storage.local.remove([key], function() {
    console.log(`Cache cleared for ${platform} user: ${username}`);
  });
}
function clearAllRatingCache() {
  chrome.storage.local.get(null, function(items) {
    const ratingKeys = Object.keys(items).filter(key => key.startsWith('rating_'));
    
    if (ratingKeys.length === 0) {
      console.log('No rating cache found');
      return;
    }
    
    chrome.storage.local.remove(ratingKeys, function() {
      console.log('All rating cache cleared:', ratingKeys);
      console.log('Total keys cleared:', ratingKeys.length);
    });
  });
}
clearCacheForUsers();

// Alternative usage examples:
// clearCacheForPlatform('codeforces');  // Clear only codeforces users
// clearCacheForUser('leetcode', 'newuser');  // Clear specific user
// clearAllRatingCache();  // Clear all rating cache
