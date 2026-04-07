# Conclude — Meeting Intelligence Hub

> *Every meeting, distilled.*

---

## Project Title

**Conclude** — A real-time Meeting Intelligence Hub that transforms raw meeting transcripts into structured decisions, action items, and sentiment insights — instantly, in the browser.

---

## The Problem

Meeting transcripts are long, unstructured, and easy to lose track of. Teams waste valuable time re-reading entire conversations just to find out **who committed to what**, **what was decided**, and **by when**. There is no fast, accessible tool that helps individuals and teams extract intelligence from their meetings without needing a paid AI subscription or complex setup.

---

## The Solution

Conclude allows users to upload any `.txt` or `.vtt` meeting transcript and instantly receive:

- ✅ **Key Decisions** extracted from the conversation — who made them, what was decided
- ✅ **Key Actions** per person — with assignee name and deadline (if mentioned)
- ✅ **Sentiment Analysis** per action/decision — Confident, Concerned, or Neutral
- ✅ **Speaker Detection** — automatically identifies all unique speakers
- ✅ **Sentiment & Tone Timeline** — a visual overview of meeting energy
- ✅ **AI Chatbot (RAG)** — ask any question about the meeting and get instant answers
- ✅ **PDF Export** — download a clean, branded summary of all actions and decisions
- ✅ **Recent Analyses Dashboard** — tracks all your past meeting uploads (persisted in browser)
- ✅ **Fully Responsive** — works on mobile, tablet, and desktop

The entire app runs **100% in the browser** — no backend, no login, no data leaves your device.

---

## Tech Stack

### Programming Languages
- **HTML5** — app structure and semantic markup
- **CSS3** — full glassmorphic design system with animations
- **JavaScript (ES6+)** — all logic, parsing, and interactivity

### Frameworks / Libraries
- **Vanilla JS** (no framework) — lightweight and fast
- **html2pdf.js** (via CDN) — PDF generation from HTML
- **Google Fonts (Inter, Outfit)** — premium typography

### Databases / Storage
- **localStorage** (browser-native) — persists chat history and recent analyses across sessions

### APIs / Third-party Tools
- No external APIs required — fully offline-capable
- Deployed via **Vercel** (static hosting)

---

## Setup Instructions

### Option 1: View Live (Recommended)
Open the deployed app directly — no setup needed:

```
https://concludeapp.vercel.app
```

### Option 2: Run Locally

**Prerequisites:** Any modern browser (Chrome, Edge, Firefox, Safari)

```bash
# 1. Clone the repository
git clone https://github.com/Sruthimj04/Conclude.git

# 2. Navigate to the project folder
cd Conclude

# 3. Serve the files locally (Python required)
python -m http.server 8000

# 4. Open in browser
# Visit: http://localhost:8000
```

> **Note:** You can also simply open `index.html` directly in a browser — no build step, no dependencies to install.

---

## How to Use

1. Open the app at `https://concludeapp.vercel.app`
2. Click **"Conclude a Meeting"** on the dashboard
3. Drag & drop a `.txt` or `.vtt` transcript file (or click to browse)
4. Wait for the animated waveform to complete analysis (~2 seconds)
5. View your **Key Actions**, **Decisions**, **Sentiment**, and **Speaker breakdown**
6. Use the **💬 chatbot** (bottom-right) to ask questions like *"What did Aaisha commit to?"*
7. Click **Export Summary.pdf** to download a branded PDF report

---

## Key Features Highlight

| Feature | Description |
|---|---|
| 🎯 Smart Extraction | Sentence-level scoring engine filters real actions/decisions from casual conversation |
| 🧠 Chatbot (RAG) | Keyword-scored retrieval answers questions directly from your transcript |
| 🌈 Animated UI | Rotating gradient border on hero card, waveform upload animation |
| 📱 Mobile Ready | Hamburger sidebar, responsive layouts, full mobile support |
| 🔐 Private by Design | Zero data sent to any server — all processing is in-browser |

---

## Hosted Link

🌐 **Live App:** [https://concludeapp.vercel.app](https://concludeapp.vercel.app)

📁 **GitHub Repo:** [https://github.com/Sruthimj04/Conclude](https://github.com/Sruthimj04/Conclude)

---

## Screenshots

> Upload a transcript → get structured intelligence instantly.

---

*Built for the Cymonic.ai Hackathon 2024*
