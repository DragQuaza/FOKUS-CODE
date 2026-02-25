# 🏆 FOKUS CODE

**Stay Locked In. Solve Better. Build Consistency.**

FOKUS CODE is a powerful Chrome extension designed to transform your browsing habits into a high-octane coding workflow. It blocks distractions, keeps you updated on upcoming contests, and provides a built-in AI assistant to help you solve problems without ever leaving your tab.

---

## 🚀 Key Features

- **🔐 Focus Mode**: Blocks all non-coding websites (Netflix, Instagram, etc.) while allowing trusted platforms like LeetCode, Codeforces, and YouTube.
- **✨ AI Assistant**: A standalone, secure AI chat modal triggered by a floating button. Ask questions about the problem you're viewing!
- **🏆 Contest Tracker**: Real-time updates for upcoming contests on Codeforces, LeetCode, CodeChef, and AtCoder with one-click reminders.
- **📊 Rating Tracking**: Keep an eye on your ratings across competitive programming platforms.
- **🎨 Modern UI**: Clean, glassmorphism-inspired design with a smooth, responsive interface.

---

## 🛠️ Installation & Setup

### 1. Clone the Project
```bash
git clone https://github.com/your-repo/FOKUS-CODE.git
cd FOKUS-CODE
```

### 2. Install Dependencies
Run the built-in setup command to install both extension and server dependencies:
```bash
npm run setup
```

### 3. Configure the AI Server
Create your environment file and add your Google Gemini API Key:
```bash
cd server
cp .env.example .env
# Open .env and add: GEMINI_API_KEY=your_actual_api_key_here
```
*(Get your free API key at [Google AI Studio](https://aistudio.google.com/))*

### 4. Load the Extension in Chrome
1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in top-right).
3. Click **Load unpacked** and select the root `FOKUS-CODE` directory.

---

## 🏃 Running the Project

To use the AI Assistant, you must have the backend server running locally:

```bash
npm run server
```
The server will start on `http://localhost:3001`.

---

## 📂 Folder Structure

- `/server`: Secure Node.js/Express backend for Gemini API calls.
- `/icons`: Extension icon assets.
- `manifest.json`: Chrome extension configuration.
- `popup.html/js`: The main user interface.
- `background.js`: Service worker for notifications and blocking logic.
- `content.js`: Page content extraction and site blocking.

---

## 🛡️ License

MIT License. Feel free to use and contribute!
