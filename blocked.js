function showFallback() {
    const image = document.querySelector('.blocked-image');
    const fallback = document.querySelector('.fallback-content');
    const caption = document.querySelector('.image-caption');
    
    if (image) image.style.display = 'none';
    if (fallback) fallback.style.display = 'block';
    if (caption) caption.style.display = 'none';
}

function getOriginalUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('original');
}

function checkFocusMode() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.sync.get(['enabled'], (result) => {
            if (!result.enabled) {
                // Focus mode is disabled, restore original URL
                const originalUrl = getOriginalUrl();
                
                if (originalUrl) {
                    // Redirect to original URL
                    window.location.href = originalUrl;
                } else if (window.history.length > 1) {
                    // Fallback: try to go back
                    window.history.back();
                } else {
                    // No history, redirect to GitHub
                    window.location.href = 'https://github.com';
                }
            }
        });
    }
}

// Listen for messages from background script
if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'focusModeDisabled') {
            checkFocusMode();
        }
    });
}

// Listen for storage changes
if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync' && changes.enabled) {
            if (!changes.enabled.newValue) {
                // Focus mode was just disabled
                setTimeout(checkFocusMode, 100);
            }
        }
    });
}

// Add some visual effects
document.addEventListener('DOMContentLoaded', function() {
    const container = document.querySelector('.container');
    container.style.opacity = '0';
    container.style.transform = 'translateY(20px)';
    
    setTimeout(() => {
        container.style.transition = 'all 0.5s ease';
        container.style.opacity = '1';
        container.style.transform = 'translateY(0)';
    }, 100);

    const image = document.querySelector('.blocked-image');
    if (image) {
        image.addEventListener('error', showFallback);
    }

    const quotes = [
        "\"Don't stop when you're tired. Stop when you're done.\" - David Goggins",
        "\"Suffering is the true test of life.\" - David Goggins",
        "\"First, solve the problem. Then, write the code.\" - John Johnson",
        "\"You don't know me, son! Get back to coding!\" - David Goggins",
        "\"Stay hard! The compiler doesn't care about your feelings.\"",
        "\"They don't know you son! Close this tab and build something great.\"",
        "\"Talk is cheap. Show me the code.\" - Linus Torvalds"
    ];
    
    const quoteContainer = document.getElementById('quoteContainer');
    if (quoteContainer) {
        quoteContainer.textContent = quotes[Math.floor(Math.random() * quotes.length)];
    }
    
    // Check focus mode status on load
    setTimeout(checkFocusMode, 500);
    
    // Poll focus mode status every second
    setInterval(checkFocusMode, 1000);
});
