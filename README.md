# 🏆 FOKUS CODE

**Stay Locked In. Solve Better. Build Consistency.**

FOKUS CODE is a powerful Chrome extension designed to transform your browsing habits into a high-octane coding workflow. It blocks distractions, keeps you updated on upcoming contests, tracks your competitive programming ratings, and provides a full-featured AI assistant that works alongside you as you code — without ever leaving your tab.

---

## 🚀 Key Features

### 🤖 FOKUS AI — Full Side Panel Assistant
- **Persistent Side Panel**: The AI assistant opens as a full-height Chrome Side Panel that docks beside your browser tab, so it never overlaps your code on LeetCode, Codeforces, or any coding platform.
- **Page-Aware Context**: Automatically reads the current problem/page and uses it as context for all your questions.
- **Quick Prompts**: One-click buttons for the most common actions — Explain, Complexity, Hint, Approach, Find Bug, Optimize.

### 🖱️ Right-Click "Explain with FOKUS AI"
- Highlight **any code, formula, or error** on any website (GitHub, StackOverflow, AtCoder editorials, etc.).
- Right-click and select **"Explain with FOKUS AI"**.
- The side panel opens instantly and starts explaining — automatically, no copy-paste needed.

### 🔐 Focus Mode
- Blocks all non-coding websites (social media, streaming, news, etc.) while keeping coding platforms like LeetCode, Codeforces, GitHub, and YouTube accessible.
- Toggle Focus Mode on/off from the popup with a single click.
- Optional countdown timer to set a deep work session duration.

### 🏆 Contest Tracker
- Real-time upcoming contest listings for **Codeforces**, **LeetCode**, **CodeChef**, and **AtCoder**.
- One-click reminders — get a browser notification before a contest starts.
- Live badge countdown on the extension icon showing time to the next contest.

### 📊 Rating Tracker
- Track your competitive programming ratings across **LeetCode**, **Codeforces**, **CodeChef**, and **AtCoder** directly from the popup.
- Ratings are cached locally for instant loading and refreshed automatically.

### 🎨 Modern UI
- Clean, dark glassmorphism-inspired design.
- Smooth animations and micro-interactions throughout.

---

## 🛠️ Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/DragQuaza/FOKUS-CODE.git
cd FOKUS-CODE
```

### 2. Install Server Dependencies
```bash
cd server
npm install
```

### 3. Configure the AI Server
Create your environment file and add your Google Gemini API Key:
```bash
cp .env.example .env
# Open .env and set: GEMINI_API_KEY=your_actual_api_key_here
```
*(Get your free API key at [Google AI Studio](https://aistudio.google.com/))*

### 4. Load the Extension in Chrome
1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in top-right corner).
3. Click **Load unpacked** and select the root `FOKUS-CODE` directory.

---

## 🏃 Running the AI Server

The FOKUS AI side panel requires the local backend server to be running:

```bash
cd server
npm start
```

The server will start on `http://localhost:3001`. Keep this running in the background while you use FOKUS AI.

---

## 📂 Folder Structure

```
FOKUS-CODE/
├── server/             # Secure Node.js/Express backend for Gemini API calls
│   ├── index.js        # Express server with /api/ask and /api/health routes
│   ├── .env.example    # Template for environment variables
│   └── package.json
├── icons/              # Extension icon assets (16, 32, 48, 128px)
├── manifest.json       # Chrome extension manifest (MV3)
├── popup.html/js       # Main extension popup UI
├── sidepanel.html/js   # FOKUS AI full side panel chat interface
├── background.js       # Service worker: blocking, contest tracking, context menus
├── content.js          # Page content extraction and site blocking
├── blocked.html/js     # Blocked site redirect page
├── options.html/js     # Allowed sites management page
└── clear_cache.js      # Utility to clear cached rating data
```

---

## 🔒 Privacy & Permissions

| Permission | Reason |
|---|---|
| `activeTab` & `scripting` | Read current page content so the AI can answer context-aware questions |
| `sidePanel` | Display the persistent FOKUS AI chat panel beside the browser tab |
| `contextMenus` | Allow right-clicking selected text to "Explain with FOKUS AI" |
| `storage` | Save user settings, ratings cache, and contest reminders locally |
| `alarms` | Schedule contest reminder notifications |
| `notifications` | Show contest reminder pop-ups |

> ⚠️ Your Gemini API key is **never** stored in the extension. It lives securely in the local server's `.env` file only.

---

## 🛡️ License

MIT License. Feel free to use, fork, and contribute!
