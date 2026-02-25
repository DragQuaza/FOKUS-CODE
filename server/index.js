require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// --- Middleware ---

// CORS: allow Chrome extension origins
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests from Chrome extensions and localhost (for testing)
        if (!origin || origin.startsWith('chrome-extension://') || origin.startsWith('http://localhost')) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
}));

app.use(express.json({ limit: '50kb' })); // cap payload size

// Rate limiter: 30 requests per minute per IP
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please wait a moment.' }
});
app.use('/api/', limiter);

// --- Routes ---

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// AI Assistant endpoint
app.post('/api/ask', async (req, res) => {
    try {
        if (!GEMINI_API_KEY) {
            return res.status(500).json({ error: 'Server misconfigured: GEMINI_API_KEY not set.' });
        }

        const { prompt, context } = req.body;

        if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
            return res.status(400).json({ error: 'A question is required.' });
        }

        if (prompt.length > 2000) {
            return res.status(400).json({ error: 'Question is too long (max 2000 chars).' });
        }

        const pageContext = (typeof context === 'string' && context.trim().length > 0)
            ? context.substring(0, 12000) // cap context to ~3k tokens
            : 'No page context provided.';

        const fullPrompt = `You are a helpful coding assistant integrated into the "FOKUS CODE" browser extension.
Your goal is to help competitive programmers and students.

${pageContext !== 'No page context provided.' ? `CONTEXT FROM THE CURRENT PAGE:
---
${pageContext}
---

` : ''}USER QUESTION:
${prompt}

Provide a concise, helpful answer.${pageContext !== 'No page context provided.' ? ' Use the page context if relevant.' : ''} Use plain text formatting. Never say you cannot see the screen or page — just answer the question directly from your knowledge if no context is available.`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

        const geminiRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: fullPrompt }] }]
            })
        });

        const data = await geminiRes.json();

        if (!geminiRes.ok) {
            const msg = data.error?.message || `Gemini API returned ${geminiRes.status}`;
            console.error('[Gemini Error]', msg);

            // Friendly message for rate limits
            if (geminiRes.status === 429) {
                const retryMatch = msg.match(/retry in ([\d.]+)s/i);
                const waitSec = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : 60;
                return res.status(429).json({
                    error: `⏳ Free tier limit reached. Please wait ${waitSec} seconds and try again.`
                });
            }

            return res.status(502).json({ error: msg });
        }

        const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!answer) {
            return res.status(502).json({ error: 'Gemini returned an empty response.' });
        }

        res.json({ answer });

    } catch (err) {
        console.error('[Server Error]', err.message);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// --- Start ---
app.listen(PORT, () => {
    console.log(`✅ FOKUS CODE AI Server running on http://localhost:${PORT}`);
    if (!GEMINI_API_KEY) {
        console.warn('⚠️  WARNING: GEMINI_API_KEY is not set. Copy .env.example to .env and add your key.');
    }
});
