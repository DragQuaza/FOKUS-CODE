// ── FOKUS CODE: AI Assistant Side Panel ──

const SERVER_URL = 'http://localhost:3001/api';

// DOM refs
const messagesEl = document.getElementById('messages');
const welcomeEl  = document.getElementById('welcome');
const inputEl    = document.getElementById('chatInput');
const sendBtn    = document.getElementById('sendBtn');
const clearBtn   = document.getElementById('clearBtn');
const statusDot  = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');

let pageContext  = '';
let isLoading    = false;
let sessionHistory = [];

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  loadPageContext();
  setupEventListeners();
  checkServer();
  checkPendingSelection();
});

// ── Event Listeners ──
function setupEventListeners() {
  sendBtn.addEventListener('click', handleSend);

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // Auto-resize textarea
  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
  });

  clearBtn.addEventListener('click', clearChat);

  // Quick prompt buttons
  document.querySelectorAll('.qp-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const prompt = btn.getAttribute('data-prompt');
      if (prompt) handleSend(prompt);
    });
  });
}

// ── Page Context ──
function loadPageContext() {
  setStatus('idle', 'Reading page context...');

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab) {
      setStatus('error', 'No active tab found');
      return;
    }

    const url = tab.url || '';
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:')) {
      setStatus('idle', 'Open a coding page to enable full context');
      pageContext = '';
      return;
    }

    // Extract page text via scripting API
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Try to get problem description smartly
        const selectors = [
          // LeetCode
          '[data-track-load="description_content"]',
          '.elfjS',
          // Codeforces
          '.problem-statement',
          // CodeChef
          '.problem-statement',
          // AtCoder
          '#task-statement',
          // Generic
          'article', 'main', '.content', '#content', '.problem'
        ];

        let text = '';
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el && el.innerText && el.innerText.trim().length > 100) {
            text = el.innerText.trim();
            break;
          }
        }

        // Fallback: grab body text (truncated)
        if (!text) text = document.body.innerText.trim();

        return {
          text: text.substring(0, 8000),
          title: document.title,
          url: window.location.href
        };
      }
    }, (results) => {
      if (chrome.runtime.lastError || !results || !results[0]) {
        setStatus('idle', 'Context unavailable — answers from general knowledge');
        pageContext = '';
        return;
      }

      const result = results[0].result;
      pageContext = `PAGE: ${result.title}\nURL: ${result.url}\n\n${result.text}`;

      const domain = new URL(result.url).hostname.replace('www.', '');
      setStatus('active', `@${domain}`);
    });
  });
}

// ── Status Bar ──
function setStatus(state, message) {
  statusText.textContent = message;
  statusDot.className = 'status-dot' + (state === 'active' ? ' active' : '');
}

// ── Server Health ──
async function checkServer() {
  try {
    const res = await fetch(`${SERVER_URL}/health`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error();
  } catch {
    // Server not running — show a warning in status (non-blocking)
    setStatus('error', '⚠️ AI server not running — start it to use AI');
  }
}

// ── Clear Chat ──
function clearChat() {
  sessionHistory = [];
  // Remove all messages except the welcome div (which we re-show)
  messagesEl.innerHTML = '';
  const welcome = document.createElement('div');
  welcome.className = 'welcome';
  welcome.id = 'welcome';
  welcome.innerHTML = `
    <div class="welcome-icon">🤖</div>
    <h2>Ask me anything</h2>
    <p>I can help you understand problems, debug code, explain algorithms, and more.</p>
    <div class="welcome-tips">
      <div class="tip-card"><span>💡</span><span>Ask "Explain this problem" to break down what the current page is asking</span></div>
      <div class="tip-card"><span>🧠</span><span>Ask for hints without spoilers — I'll guide you step by step</span></div>
      <div class="tip-card"><span>⚡</span><span>Paste your code and ask "Find bugs" or "Optimize this"</span></div>
    </div>`;
  messagesEl.appendChild(welcome);
}

// ── Send Message ──
async function handleSend(quickPrompt = null) {
  const rawText = quickPrompt || inputEl.value.trim();
  if (!rawText || isLoading) return;

  // Clear input
  if (!quickPrompt) {
    inputEl.value = '';
    inputEl.style.height = 'auto';
  }

  // Hide welcome
  const welcome = document.getElementById('welcome');
  if (welcome) welcome.remove();

  isLoading = true;
  sendBtn.disabled = true;

  // Add user message
  addMessage('user', rawText);
  sessionHistory.push({ role: 'user', text: rawText });

  // Add thinking indicator
  const thinkingEl = addThinking();

  try {
    const response = await fetch(`${SERVER_URL}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: rawText,
        context: pageContext,
        history: sessionHistory.slice(-8)  // last 4 exchanges
      }),
      signal: AbortSignal.timeout(30000)
    });

    thinkingEl.remove();

    const data = await response.json();

    if (!response.ok) {
      addMessage('bot error', data.error || `Server error ${response.status}`, rawText);
      return;
    }

    const answer = data.answer || 'No response received.';
    addMessage('bot', answer, rawText);
    sessionHistory.push({ role: 'assistant', text: answer });

  } catch (err) {
    thinkingEl.remove();
    if (err.name === 'TimeoutError') {
      addMessage('bot error', '⏱️ Request timed out. The server may be busy — try again.', rawText);
    } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      addMessage('bot error', '🔴 Cannot reach the AI server.\n\nMake sure it\'s running:\n\n  cd server && npm start', rawText);
    } else {
      addMessage('bot error', `Error: ${err.message}`, rawText);
    }
  } finally {
    isLoading = false;
    sendBtn.disabled = false;
    inputEl.focus();
  }
}

// ── Add Message Bubble ──
function addMessage(type, text, userPrompt = null) {
  const isUser = type === 'user';
  const isError = type.includes('error');

  const wrapper = document.createElement('div');
  wrapper.className = `msg ${isUser ? 'user' : 'bot' + (isError ? ' error' : '')}`;

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = isUser ? '👤' : '🤖';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';

  if (isUser) {
    bubble.textContent = text;
  } else {
    bubble.innerHTML = renderMarkdown(text);
    attachActions(bubble, text, userPrompt);
  }

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  messagesEl.appendChild(wrapper);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  return wrapper;
}

// ── Attach Actions (Copy, Try Again) ──
function attachActions(bubble, text, userPrompt) {
  // Clear any existing actions
  const existing = bubble.querySelector('.msg-actions');
  if (existing) existing.remove();

  // Attach copy buttons to code blocks
  bubble.querySelectorAll('.code-block-wrapper').forEach(block => {
    const copyBtn = block.querySelector('.copy-btn');
    const code = block.querySelector('pre code');
    if (copyBtn && code) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(code.textContent).then(() => {
          copyBtn.textContent = 'Copied!';
          copyBtn.classList.add('copied');
          setTimeout(() => {
            copyBtn.textContent = 'Copy';
            copyBtn.classList.remove('copied');
          }, 2000);
        });
      });
    }
  });

  const actions = document.createElement('div');
  actions.className = 'msg-actions';

  const copySvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
  const checkSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  const retrySvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><polyline points="21 3 21 8 16 8"/></svg>`;

  const copyBtn = document.createElement('button');
  copyBtn.className = 'msg-action-btn';
  copyBtn.innerHTML = copySvg;
  copyBtn.title = 'Copy reply';
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.innerHTML = checkSvg;
      copyBtn.classList.add('copied');
      setTimeout(() => {
        copyBtn.innerHTML = copySvg;
        copyBtn.classList.remove('copied');
      }, 2000);
    });
  });
  actions.appendChild(copyBtn);

  if (userPrompt) {
    const retryBtn = document.createElement('button');
    retryBtn.className = 'msg-action-btn';
    retryBtn.innerHTML = retrySvg;
    retryBtn.title = 'Try again';
    retryBtn.addEventListener('click', () => {
      regenerateResponse(bubble, userPrompt);
    });
    actions.appendChild(retryBtn);
  }

  bubble.appendChild(actions);
}

// ── In-place Regeneration ──
async function regenerateResponse(bubble, userPrompt) {
  if (isLoading) return;
  isLoading = true;
  sendBtn.disabled = true;

  // Render a clean inline thinking indicator inside this specific bubble
  bubble.innerHTML = `<div class="thinking" style="padding: 4px 8px;"><span></span><span></span><span></span></div>`;

  try {
    const response = await fetch(`${SERVER_URL}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: userPrompt,
        context: pageContext,
        history: sessionHistory.slice(0, -1).slice(-8) // Slice off the last bot reply we are replacing!
      }),
      signal: AbortSignal.timeout(30000)
    });

    const data = await response.json();

    if (!response.ok) {
      bubble.parentNode.classList.add('error');
      const errText = data.error || `Server error ${response.status}`;
      bubble.innerHTML = renderMarkdown(errText);
      attachActions(bubble, errText, userPrompt);
      return;
    }

    const answer = data.answer || 'No response received.';
    bubble.parentNode.classList.remove('error');
    bubble.innerHTML = renderMarkdown(answer);

    // Update the last assistant response in session history
    if (sessionHistory.length > 0 && sessionHistory[sessionHistory.length - 1].role === 'assistant') {
      sessionHistory[sessionHistory.length - 1].text = answer;
    }

    attachActions(bubble, answer, userPrompt);

  } catch (err) {
    bubble.parentNode.classList.add('error');
    let errText = '';
    if (err.name === 'TimeoutError') {
      errText = '⏱️ Request timed out. The server may be busy — try again.';
    } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      errText = '🔴 Cannot reach the AI server.\n\nMake sure it\'s running:\n\n  cd server && npm start';
    } else {
      errText = `Error: ${err.message}`;
    }
    bubble.innerHTML = renderMarkdown(errText);
    attachActions(bubble, errText, userPrompt);
  } finally {
    isLoading = false;
    sendBtn.disabled = false;
    inputEl.focus();
  }
}

// ── Thinking Dots ──
function addThinking() {
  const wrapper = document.createElement('div');
  wrapper.className = 'msg bot';

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = '🤖';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.innerHTML = `<div class="thinking"><span></span><span></span><span></span></div>`;

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  messagesEl.appendChild(wrapper);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  return wrapper;
}

// ── Markdown Renderer ──
function renderMarkdown(text) {
  // Escape HTML first
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Fenced code blocks (``` lang ... ```)
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const displayLang = lang || 'code';
    return `<div class="code-block-wrapper">
      <div class="code-block-header">
        <span class="code-lang">${displayLang}</span>
        <button class="copy-btn">Copy</button>
      </div>
      <pre><code>${code.trim()}</code></pre>
    </div>`;
  });

  // Inline code (must come after block code)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h3>$1</h3>');

  // Bold & italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Unordered lists
  html = html.replace(/^[\*\-] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  // Ordered lists
  html = html.replace(/^\d+\.\s(.+)$/gm, '<li>$1</li>');

  // Paragraphs
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  html = '<p>' + html + '</p>';
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>(<(?:div|ul|h[1-6]|pre))/g, '$1');
  html = html.replace(/<\/(?:div|ul|h[1-6]|pre)><\/p>/g, (m) => m.replace('</p>', ''));

  return html;
}

// ── Check Pending Selections from Context Menu ──
function checkPendingSelection() {
  chrome.storage.local.get(['pendingSelectionText'], (res) => {
    if (res.pendingSelectionText) {
      const selected = res.pendingSelectionText;
      chrome.storage.local.remove('pendingSelectionText', () => {
        handleSend(`Explain this code or text:\n\n${selected}`);
      });
    }
  });
}

// Listen for incoming selection messages if sidepanel is already open
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'explain-selection' && msg.text) {
    chrome.storage.local.remove('pendingSelectionText');
    handleSend(`Explain this code or text:\n\n${msg.text}`);
  }
});
