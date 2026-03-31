# M2L Content Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Vite + React dashboard (`m2l-content-engine`) for managing a 13-week LinkedIn content calendar for the Manchester to London charity cycle ride.

**Architecture:** Express API (port 3001) handles all filesystem reads/writes for config JSON and markdown draft files; Vite dev server (port 5173) proxies `/api/*` to Express and serves the React SPA; `concurrently` starts both with one command.

**Tech Stack:** React 18, Vite 5, Express 4, gray-matter, concurrently, DM Sans + DM Serif Display (Google Fonts), CSS custom properties (no CSS framework)

---

## File Map

| File | Responsibility |
|---|---|
| `package.json` | Scripts, deps — `npm run dev` starts both servers |
| `.gitignore` | Exclude node_modules, .env |
| `.npmrc` | Force public npm registry (bypass Sectra internal) |
| `vite.config.js` | React plugin + `/api` proxy to port 3001 |
| `index.html` | Vite entry point, Google Fonts link |
| `config/campaign.json` | Campaign dates, phases, key events, author, current_raised |
| `config/posting-rules.json` | LinkedIn timing, tone, frequency rules |
| `content/drafts/.gitkeep` | Keeps empty drafts dir in git |
| `content/templates/story.md` | Structural pattern for story posts |
| `content/templates/milestone.md` | Structural pattern for milestone posts |
| `content/templates/ask.md` | Structural pattern for ask posts |
| `content/templates/thank.md` | Structural pattern for thank posts |
| `content/templates/training.md` | Structural pattern for training posts |
| `server/index.js` | Express API — all 9 endpoints, file I/O, gray-matter |
| `src/main.jsx` | React root render |
| `src/App.jsx` | Root state: campaign, drafts, selectedDraft, phaseFilter |
| `src/styles/index.css` | All styles — CSS vars, layout, components |
| `src/hooks/useApi.js` | Thin fetch wrappers for all API endpoints |
| `src/components/PhaseTimeline.jsx` | 3-segment clickable filter bar |
| `src/components/PostCard.jsx` | Compact card in calendar row |
| `src/components/Calendar.jsx` | 13-week grid with week rows, event pins |
| `src/components/StatusBar.jsx` | Countdown, progress, status counts, editable raised amount |
| `src/components/EventManager.jsx` | Key events list + add/delete form |
| `src/components/DetailPanel.jsx` | Post edit panel — textarea, status toggles, copy, tips |
| `README.md` | Setup + content generation prompts |

---

## Task 1: Scaffold project directory and package.json

**Files:**
- Create: `m2l-content-engine/package.json`
- Create: `m2l-content-engine/.gitignore`
- Create: `m2l-content-engine/.npmrc`

- [ ] **Step 1: Create directory and package.json**

```bash
mkdir -p "C:/Users/gu-car/Claude PlayArea/m2l-content-engine"
cd "C:/Users/gu-car/Claude PlayArea/m2l-content-engine"
```

Create `package.json`:
```json
{
  "name": "m2l-content-engine",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "concurrently \"vite\" \"node server/index.js\"",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "gray-matter": "^4.0.3"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "concurrently": "^8.2.2",
    "vite": "^5.1.4"
  }
}
```

- [ ] **Step 2: Create .gitignore**

```
node_modules/
.env
dist/
```

- [ ] **Step 3: Create .npmrc (bypass Sectra internal registry)**

```
registry=https://registry.npmjs.org
```

- [ ] **Step 4: Install dependencies**

```bash
cd "C:/Users/gu-car/Claude PlayArea/m2l-content-engine"
npm install
```

Expected: `node_modules/` created, no registry errors.

- [ ] **Step 5: Create remaining directories**

```bash
mkdir -p config content/drafts content/templates server src/components src/hooks src/styles output
```

- [ ] **Step 6: Commit**

```bash
git -C "C:/Users/gu-car/Claude PlayArea" add m2l-content-engine/
git -C "C:/Users/gu-car/Claude PlayArea" commit -m "feat: scaffold m2l-content-engine project"
```

---

## Task 2: Config files

**Files:**
- Create: `m2l-content-engine/config/campaign.json`
- Create: `m2l-content-engine/config/posting-rules.json`

- [ ] **Step 1: Create config/campaign.json**

```json
{
  "ride": {
    "name": "Manchester to London",
    "date": "2026-06-28",
    "distance_miles": 200,
    "charity": "Ambitious about Autism",
    "fundraising_target": 1000,
    "fundraising_url": "https://www.justgiving.com/page/guilherme-carvalho-manchester-to-london",
    "organiser": "Rapha"
  },
  "campaign_start": "2026-03-30",
  "current_raised": 0,
  "phases": [
    {
      "id": "why",
      "label": "The Why",
      "weeks": [1, 2, 3, 4],
      "description": "Announce the ride, tell the story, set the target. Personal connection through admiration for Simon Mottram and Rapha's commitment, not direct personal experience with autism. Honesty about that is the angle."
    },
    {
      "id": "journey",
      "label": "The Journey",
      "weeks": [5, 6, 7, 8, 9],
      "description": "Training milestones, Fred Whitton as proving ground, fundraising progress. Mix vulnerability with determination."
    },
    {
      "id": "push",
      "label": "The Push",
      "weeks": [10, 11, 12, 13],
      "description": "Countdown, final fundraising sprint, ride day, post-ride reflection. Last 2 weeks typically drive 40-50% of donations."
    }
  ],
  "key_events": [
    { "date": "2026-05-06", "name": "Sectra UK User Meeting (Day 1)", "type": "work" },
    { "date": "2026-05-07", "name": "Sectra UK User Meeting (Day 2)", "type": "work" },
    { "date": "2026-05-10", "name": "Fred Whitton Challenge", "type": "ride" },
    { "date": "2026-06-28", "name": "Manchester to London", "type": "ride" }
  ],
  "author": {
    "name": "Guil",
    "full_name": "Guilherme Carvalho",
    "role": "Head of Sales, Sectra UK&I",
    "background": "Portuguese, based in Leeds. Cyclist. Works in healthcare technology (medical imaging, PACS, digital pathology). Came to this cause through admiration for Simon Mottram (Rapha founder) and his personal commitment to this charity, not through personal experience with autism."
  }
}
```

- [ ] **Step 2: Create config/posting-rules.json**

```json
{
  "platform": "linkedin",
  "timing": {
    "best_days": ["Tuesday", "Wednesday", "Thursday"],
    "best_times": ["08:00-10:00", "12:00-13:00"],
    "avoid": ["Friday afternoon", "weekends"]
  },
  "formatting": {
    "max_length_chars": 1300,
    "use_line_breaks": true,
    "short_paragraphs": true,
    "link_placement": "Post fundraising link as FIRST COMMENT, not in post body. LinkedIn algorithm suppresses posts with external links.",
    "cta_frequency": "Every post should have a soft or hard call to action — donate, share, or comment."
  },
  "frequency": {
    "min_per_week": 1,
    "max_per_week": 2,
    "never_post_consecutive_days": true
  },
  "tone": {
    "voice": "Direct, honest, no corporate waffle. British English. Self-deprecating humour welcome. Never guilt-trip. Never fake emotion. Authenticity over polish.",
    "avoid": ["corporate jargon", "excessive emojis", "guilt-tripping", "fake enthusiasm", "humble bragging"]
  },
  "content_types": {
    "story": "Personal narrative, the 'why', learning about the cause",
    "milestone": "Training achievements, Fred Whitton, ride day",
    "ask": "Direct fundraising requests — honest, not apologetic",
    "thank": "Gratitude posts — specific, not generic",
    "training": "Behind-the-scenes training updates with honest reflections"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git -C "C:/Users/gu-car/Claude PlayArea" add m2l-content-engine/config/
git -C "C:/Users/gu-car/Claude PlayArea" commit -m "feat: add campaign and posting-rules config"
```

---

## Task 3: Content templates and drafts directory

**Files:**
- Create: `m2l-content-engine/content/drafts/.gitkeep`
- Create: `m2l-content-engine/content/templates/story.md`
- Create: `m2l-content-engine/content/templates/milestone.md`
- Create: `m2l-content-engine/content/templates/ask.md`
- Create: `m2l-content-engine/content/templates/thank.md`
- Create: `m2l-content-engine/content/templates/training.md`

- [ ] **Step 1: Create content/drafts/.gitkeep**

Empty file — keeps the directory in git.

- [ ] **Step 2: Create content/templates/story.md**

```markdown
# Story Post Template

Use for: personal narrative, explaining the why, introducing the cause.

## Structure

**Opening hook (1–2 lines):**
Start with a specific moment, person, or question — not a general statement.
Good: "I first heard of Simon Mottram's fundraising in 2019."
Avoid: "I wanted to share something important with you."

**Body (3–5 short paragraphs):**
- Establish the personal connection honestly
- Name the cause and why it matters
- Be specific — avoid abstract platitudes
- One idea per paragraph, white space between each

**CTA (1–2 lines):**
Soft CTA: invite comment or reflection
Hard CTA: ask for donation directly (every 2nd–3rd post)
Note: fundraising link goes as FIRST COMMENT, not in post body.

## Approximate length
600–900 characters (well under the 1,300 limit — leave room to breathe)

## Tone reminders
- British English
- No corporate waffle
- Self-deprecating humour is fine
- No guilt-tripping, no fake emotion
```

- [ ] **Step 3: Create content/templates/milestone.md**

```markdown
# Milestone Post Template

Use for: training achievements, Fred Whitton debrief, completing the ride.

## Structure

**Opening hook (1–2 lines):**
State the milestone directly — don't bury the lede.
Good: "Fred Whitton done. 112 miles, 4,000m of climbing, 11 hours."
Avoid: "What a weekend it's been!"

**Body (3–4 short paragraphs):**
- What happened (specific, factual)
- What it felt like (honest — can be hard/ugly, not just triumphant)
- What it means for the main event
- Optional: connect back to the cause

**CTA (1–2 lines):**
Post-milestone is a natural moment for a fundraising ask.
Note: fundraising link goes as FIRST COMMENT.

## Approximate length
500–800 characters

## Tone reminders
- Concrete details beat vague emotion
- Vulnerability is strength — don't pretend it was easy
- "Brutal" is more honest than "challenging"
```

- [ ] **Step 4: Create content/templates/ask.md**

```markdown
# Ask Post Template

Use for: direct fundraising requests.

## Structure

**Opening hook (1–2 lines):**
Be direct. Don't apologise for asking.
Good: "I'm going to ask you directly."
Avoid: "I know everyone's busy and inboxes are full, but..."

**Body (2–3 short paragraphs):**
- State what you're doing and why (briefly — they've seen previous posts)
- Give a specific fundraising update (£X of £1,000)
- Make the ask clearly — donate, share, or both

**CTA (1–2 lines):**
Hard CTA only. Clear and direct.
Note: fundraising link goes as FIRST COMMENT.

## Approximate length
400–700 characters — shorter is stronger for asks

## Tone reminders
- Not apologetic, not aggressive
- Specific amounts make it real: "£5 covers X"
- Never guilt-trip
```

- [ ] **Step 5: Create content/templates/thank.md**

```markdown
# Thank You Post Template

Use for: gratitude after donations, hitting milestones.

## Structure

**Opening hook (1–2 lines):**
Specific, not generic.
Good: "Someone just pushed us past £500."
Avoid: "Overwhelmed by the support, thank you all so much!"

**Body (2–3 short paragraphs):**
- Acknowledge what's happened specifically
- What it means in context (% of target, etc.)
- Keep the momentum going — what's next

**CTA (1–2 lines):**
Soft: invite others to join/share
Hard: if still far from target, include donation ask
Note: fundraising link goes as FIRST COMMENT.

## Approximate length
400–600 characters

## Tone reminders
- Specific > effusive
- No hollow phrases like "blown away" or "humbled"
- Gratitude + forward momentum in the same breath
```

- [ ] **Step 6: Create content/templates/training.md**

```markdown
# Training Update Post Template

Use for: behind-the-scenes training content, honest reflections.

## Structure

**Opening hook (1–2 lines):**
A specific detail from training — distance, weather, how it felt.
Good: "75 miles into the Dales on Saturday. My legs disagreed."
Avoid: "Training is going well!"

**Body (3–4 short paragraphs):**
- What the session was (route, distance, conditions)
- How it actually felt — honest, not sanitised
- What it's teaching you about the event ahead
- Optional: small connection to the cause/motivation

**CTA (1–2 lines):**
Usually soft — comment, share experience
Occasional hard CTA if it's been 2+ posts without an ask
Note: fundraising link goes as FIRST COMMENT.

## Approximate length
600–900 characters

## Tone reminders
- Details make it vivid — name the climb, the weather, the feeling
- Imperfection is relatable — don't pretend you're a machine
- Training posts build credibility for the eventual ask
```

- [ ] **Step 7: Commit**

```bash
git -C "C:/Users/gu-car/Claude PlayArea" add m2l-content-engine/content/
git -C "C:/Users/gu-car/Claude PlayArea" commit -m "feat: add content templates and drafts directory"
```

---

## Task 4: Express API server

**Files:**
- Create: `m2l-content-engine/server/index.js`

- [ ] **Step 1: Create server/index.js**

```js
import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const CAMPAIGN_PATH = path.join(ROOT, 'config', 'campaign.json');
const POSTING_RULES_PATH = path.join(ROOT, 'config', 'posting-rules.json');
const DRAFTS_PATH = path.join(ROOT, 'content', 'drafts');

const app = express();
app.use(cors());
app.use(express.json());

// --- Campaign ---

app.get('/api/campaign', async (req, res) => {
  try {
    const data = await fs.readFile(CAMPAIGN_PATH, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/campaign', async (req, res) => {
  try {
    await fs.writeFile(CAMPAIGN_PATH, JSON.stringify(req.body, null, 2));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/posting-rules', async (req, res) => {
  try {
    const data = await fs.readFile(POSTING_RULES_PATH, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Drafts ---

app.get('/api/drafts', async (req, res) => {
  try {
    const files = await fs.readdir(DRAFTS_PATH);
    const mdFiles = files.filter(f => f.endsWith('.md'));
    const drafts = await Promise.all(
      mdFiles.map(async (filename) => {
        const raw = await fs.readFile(path.join(DRAFTS_PATH, filename), 'utf8');
        const { data, content } = matter(raw);
        return { filename, ...data, body: content.trim() };
      })
    );
    drafts.sort((a, b) => (a.week ?? 99) - (b.week ?? 99) || a.filename.localeCompare(b.filename));
    res.json(drafts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/drafts/:filename', async (req, res) => {
  try {
    const filepath = path.join(DRAFTS_PATH, req.params.filename);
    const raw = await fs.readFile(filepath, 'utf8');
    const { data, content } = matter(raw);
    res.json({ filename: req.params.filename, ...data, body: content.trim() });
  } catch (err) {
    res.status(404).json({ error: 'Draft not found' });
  }
});

app.put('/api/drafts/:filename', async (req, res) => {
  try {
    const { body, filename: _f, ...frontmatter } = req.body;
    const fileContent = matter.stringify(body ?? '', frontmatter);
    await fs.writeFile(path.join(DRAFTS_PATH, req.params.filename), fileContent);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/drafts/:filename', async (req, res) => {
  try {
    await fs.unlink(path.join(DRAFTS_PATH, req.params.filename));
    res.json({ ok: true });
  } catch (err) {
    res.status(404).json({ error: 'Draft not found' });
  }
});

// --- Events ---

app.post('/api/events', async (req, res) => {
  try {
    const campaign = JSON.parse(await fs.readFile(CAMPAIGN_PATH, 'utf8'));
    campaign.key_events.push(req.body);
    campaign.key_events.sort((a, b) => a.date.localeCompare(b.date));
    await fs.writeFile(CAMPAIGN_PATH, JSON.stringify(campaign, null, 2));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/events/:date', async (req, res) => {
  try {
    const campaign = JSON.parse(await fs.readFile(CAMPAIGN_PATH, 'utf8'));
    campaign.key_events = campaign.key_events.filter(e => e.date !== req.params.date);
    await fs.writeFile(CAMPAIGN_PATH, JSON.stringify(campaign, null, 2));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () => console.log('API server → http://localhost:3001'));
```

- [ ] **Step 2: Smoke test the API**

```bash
cd "C:/Users/gu-car/Claude PlayArea/m2l-content-engine"
node server/index.js &
sleep 1
curl http://localhost:3001/api/campaign
```

Expected: JSON output of campaign.json. Kill the background process after.

- [ ] **Step 3: Commit**

```bash
git -C "C:/Users/gu-car/Claude PlayArea" add m2l-content-engine/server/
git -C "C:/Users/gu-car/Claude PlayArea" commit -m "feat: add Express API server"
```

---

## Task 5: Vite scaffold

**Files:**
- Create: `m2l-content-engine/vite.config.js`
- Create: `m2l-content-engine/index.html`
- Create: `m2l-content-engine/src/main.jsx`

- [ ] **Step 1: Create vite.config.js**

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
});
```

- [ ] **Step 2: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>M → L Content Engine</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Serif+Display&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Create src/main.jsx**

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 4: Create a stub App.jsx to verify Vite runs**

```jsx
export default function App() {
  return <div style={{ padding: '2rem', fontFamily: 'DM Sans' }}>M → L Content Engine loading…</div>;
}
```

- [ ] **Step 5: Verify Vite starts**

```bash
cd "C:/Users/gu-car/Claude PlayArea/m2l-content-engine"
npx vite &
sleep 3
curl -s http://localhost:5173 | head -5
```

Expected: HTML response containing `<title>M → L Content Engine</title>`. Kill after.

- [ ] **Step 6: Commit**

```bash
git -C "C:/Users/gu-car/Claude PlayArea" add m2l-content-engine/vite.config.js m2l-content-engine/index.html m2l-content-engine/src/
git -C "C:/Users/gu-car/Claude PlayArea" commit -m "feat: add Vite scaffold and entry point"
```

---

## Task 6: Design system (CSS)

**Files:**
- Create: `m2l-content-engine/src/styles/index.css`

- [ ] **Step 1: Create src/styles/index.css**

```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Serif+Display&display=swap');

/* ── Variables ─────────────────────────────────────────────── */
:root {
  --sidebar-bg:      #1B1B1E;
  --content-bg:      #FAFAFA;
  --white:           #FFFFFF;
  --border:          #E8E8E8;
  --text-primary:    #1B1B1E;
  --text-secondary:  #666666;
  --text-muted:      #AAAAAA;

  --phase-why:       #E85D26;
  --phase-journey:   #2D6A4F;
  --phase-push:      #1B1B1E;

  --linkedin:        #0A66C2;

  --status-draft:    #9E9E9E;
  --status-ready:    #2D6A4F;
  --status-posted:   #1B1B1E;
  --status-skipped:  #BDBDBD;

  --font-body:    'DM Sans', system-ui, sans-serif;
  --font-display: 'DM Serif Display', Georgia, serif;

  --radius-sm: 4px;
  --radius-md: 6px;
}

/* ── Reset ──────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font-body);
  background: var(--content-bg);
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.5;
  height: 100vh;
  overflow: hidden;
}

button { cursor: pointer; font-family: var(--font-body); }
input, textarea, select { font-family: var(--font-body); }
a { color: inherit; }

/* ── App Layout ─────────────────────────────────────────────── */
.app {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  color: var(--text-muted);
  font-size: 13px;
}

/* ── Sidebar ─────────────────────────────────────────────────── */
.sidebar {
  width: 210px;
  min-width: 210px;
  background: var(--sidebar-bg);
  color: #fff;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px 16px 24px;
  gap: 24px;
}

.sidebar-header { display: flex; flex-direction: column; gap: 2px; }

.brand {
  font-family: var(--font-display);
  font-size: 30px;
  font-weight: 400;
  line-height: 1;
  color: #fff;
}

.brand-sub {
  font-size: 11px;
  color: #888;
  margin-top: 2px;
}

.fundraising-link {
  font-size: 11px;
  color: var(--linkedin);
  text-decoration: none;
  margin-top: 6px;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.fundraising-link:hover { text-decoration: underline; }

.section-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #555;
  margin-bottom: 10px;
}

/* ── Status Bar ──────────────────────────────────────────────── */
.status-bar { display: flex; flex-direction: column; gap: 8px; }

.countdown { display: flex; flex-direction: column; }
.countdown strong { font-size: 24px; font-weight: 700; line-height: 1; color: #fff; }
.countdown span { font-size: 10px; color: #666; margin-top: 1px; }

.week-phase { font-size: 11px; color: #aaa; }

.raised-row {
  font-size: 11px;
  color: #888;
  display: flex;
  align-items: baseline;
  gap: 2px;
  cursor: pointer;
}
.raised-value { color: #ccc; }
.raised-value:hover { color: #fff; }
.raised-target { color: #555; }

.raised-input {
  width: 60px;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: var(--radius-sm);
  color: #fff;
  font-size: 11px;
  padding: 1px 4px;
  outline: none;
}

.progress-bar-outer {
  background: rgba(255,255,255,0.08);
  border-radius: 3px;
  height: 5px;
  overflow: hidden;
}
.progress-bar-inner {
  background: var(--phase-why);
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s ease;
}

.status-counts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
  margin-top: 4px;
}

.status-count {
  background: rgba(255,255,255,0.05);
  border-radius: var(--radius-sm);
  padding: 5px 8px;
}
.count-num { display: block; font-size: 16px; font-weight: 700; color: #fff; line-height: 1; }
.count-lbl { display: block; font-size: 9px; color: #555; margin-top: 2px; }

/* ── Event Manager ───────────────────────────────────────────── */
.event-manager { display: flex; flex-direction: column; }

.event-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }

.event-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: #aaa;
}

.event-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.event-dot-ride    { background: var(--phase-why); }
.event-dot-work    { background: var(--linkedin); }
.event-dot-personal { background: var(--phase-journey); }

.event-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.event-date { font-size: 9px; color: #555; flex-shrink: 0; }

.event-delete {
  background: none;
  border: none;
  color: #444;
  font-size: 10px;
  padding: 0 2px;
  line-height: 1;
  flex-shrink: 0;
}
.event-delete:hover { color: #ff6b6b; }

.add-event-btn {
  background: none;
  border: 1px dashed #333;
  color: #555;
  font-size: 10px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  width: 100%;
  text-align: left;
  transition: all 0.15s;
}
.add-event-btn:hover { border-color: #555; color: #888; }

.event-form { display: flex; flex-direction: column; gap: 5px; }

.event-input {
  width: 100%;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-sm);
  color: #fff;
  font-size: 10px;
  padding: 4px 6px;
  outline: none;
}
.event-input:focus { border-color: rgba(255,255,255,0.25); }
.event-input option { background: #2a2a2e; color: #fff; }

.event-form-buttons { display: flex; gap: 4px; }

.btn-primary-sm {
  background: var(--phase-why);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  padding: 4px 10px;
  font-size: 10px;
  font-weight: 600;
}
.btn-secondary-sm {
  background: rgba(255,255,255,0.07);
  color: #aaa;
  border: none;
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  font-size: 10px;
}

/* ── Phase Legend ────────────────────────────────────────────── */
.phase-legend { display: flex; flex-direction: column; gap: 7px; }

.phase-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  color: #777;
}

.phase-swatch {
  width: 10px; height: 10px;
  border-radius: 2px;
  flex-shrink: 0;
}
.phase-swatch.phase-why     { background: var(--phase-why); }
.phase-swatch.phase-journey { background: var(--phase-journey); }
.phase-swatch.phase-push    { background: #555; }

/* ── Main Area ───────────────────────────────────────────────── */
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--content-bg);
}

/* ── Phase Timeline ──────────────────────────────────────────── */
.phase-timeline {
  display: flex;
  height: 32px;
  flex-shrink: 0;
}

.phase-seg {
  display: flex;
  align-items: center;
  padding: 0 12px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: rgba(255,255,255,0.85);
  cursor: pointer;
  user-select: none;
  transition: filter 0.15s;
  white-space: nowrap;
  overflow: hidden;
}
.phase-seg:hover { filter: brightness(1.1); }
.phase-seg.active { filter: brightness(1.15); outline: 2px inset rgba(255,255,255,0.3); }

.phase-seg-why     { background: var(--phase-why); }
.phase-seg-journey { background: var(--phase-journey); }
.phase-seg-push    { background: var(--phase-push); }

/* ── Calendar ────────────────────────────────────────────────── */
.calendar {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.phase-separator {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 10px 0 4px;
  border-top: 1px solid var(--border);
  color: var(--text-muted);
}
.phase-separator-why     { color: var(--phase-why); border-color: #f5d0bf; }
.phase-separator-journey { color: var(--phase-journey); border-color: #c3e0d4; }
.phase-separator-push    { color: var(--text-muted); }

.week-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--white);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  min-height: 52px;
  flex-wrap: wrap;
}
.week-row.current-week { box-shadow: 0 0 0 2px var(--phase-why); border-color: transparent; }

.week-badge {
  width: 28px; height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}
.phase-bg-why     { background: var(--phase-why); }
.phase-bg-journey { background: var(--phase-journey); }
.phase-bg-push    { background: var(--phase-push); }

.week-dates {
  font-size: 10px;
  color: var(--text-muted);
  min-width: 72px;
  flex-shrink: 0;
}

.event-pin {
  font-size: 9px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 10px;
  flex-shrink: 0;
  white-space: nowrap;
}
.event-pin-ride    { background: #fff3ee; color: var(--phase-why); border: 1px solid #f5c4ae; }
.event-pin-work    { background: #eef4ff; color: var(--linkedin); border: 1px solid #b8d4f5; }
.event-pin-personal { background: #eef7f2; color: var(--phase-journey); border: 1px solid #b3d9c4; }

.post-cards {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  flex: 1;
  align-items: center;
}

.no-posts {
  font-size: 10px;
  color: var(--text-muted);
  font-style: italic;
}

/* ── Post Cards ──────────────────────────────────────────────── */
.post-card {
  display: flex;
  align-items: center;
  gap: 5px;
  background: #F5F5F5;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  font-size: 10px;
  cursor: pointer;
  transition: all 0.1s;
  max-width: 160px;
}
.post-card:hover { background: #EBEBEB; border-color: #D5D5D5; }
.post-card.selected { background: #EEF7F2; border-color: var(--phase-journey); }

.post-icon { font-size: 12px; flex-shrink: 0; }

.post-title {
  color: var(--text-primary);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.status-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.status-dot.status-draft   { background: var(--status-draft); }
.status-dot.status-ready   { background: var(--status-ready); }
.status-dot.status-posted  { background: var(--status-posted); }
.status-dot.status-skipped { background: var(--status-skipped); }

/* ── Detail Panel ────────────────────────────────────────────── */
.detail-panel {
  width: 270px;
  min-width: 270px;
  background: var(--white);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.detail-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 12px;
  text-align: center;
  padding: 24px;
}

.detail-header {
  padding: 14px 16px 12px;
  border-bottom: 1px solid var(--border);
  position: relative;
}

.close-btn {
  position: absolute;
  top: 12px; right: 12px;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 12px;
  padding: 2px 4px;
  line-height: 1;
}
.close-btn:hover { color: var(--text-primary); }

.detail-type-line {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 5px;
}

.detail-title {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 400;
  color: var(--text-primary);
  line-height: 1.3;
  padding-right: 20px;
}

.detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}

.meta-chip {
  font-size: 9px;
  padding: 2px 6px;
  border-radius: 10px;
  background: #F5F5F5;
  color: var(--text-secondary);
  font-weight: 600;
}

.status-toggles {
  display: flex;
  gap: 4px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.status-btn {
  font-size: 9px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--white);
  color: var(--text-muted);
  transition: all 0.1s;
}
.status-btn:hover { border-color: #ccc; color: var(--text-secondary); }
.status-btn.active.status-active-draft   { background: var(--status-draft);   color: #fff; border-color: var(--status-draft); }
.status-btn.active.status-active-ready   { background: var(--status-ready);   color: #fff; border-color: var(--status-ready); }
.status-btn.active.status-active-posted  { background: var(--status-posted);  color: #fff; border-color: var(--status-posted); }
.status-btn.active.status-active-skipped { background: var(--status-skipped); color: #fff; border-color: var(--status-skipped); }

.detail-body {
  flex: 1;
  width: 100%;
  padding: 12px 16px;
  border: none;
  outline: none;
  resize: none;
  font-family: var(--font-body);
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-primary);
  background: var(--content-bg);
}

.tips-box {
  margin: 0 16px 10px;
  padding: 9px 11px;
  background: #EEF4FF;
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--linkedin);
  flex-shrink: 0;
}
.tips-title {
  font-size: 9px;
  font-weight: 700;
  color: var(--linkedin);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-bottom: 5px;
}
.tips-box p {
  font-size: 10px;
  color: var(--text-secondary);
  margin: 2px 0;
  line-height: 1.5;
}
.char-ok    { color: var(--text-muted) !important; }
.char-over  { color: #e53935 !important; font-weight: 600; }

.detail-footer {
  padding: 10px 16px;
  border-top: 1px solid var(--border);
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.btn-primary {
  background: var(--text-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  padding: 7px 14px;
  font-size: 11px;
  font-weight: 600;
  flex: 1;
  transition: opacity 0.15s;
}
.btn-primary:hover { opacity: 0.85; }
.btn-primary:disabled { opacity: 0.5; cursor: default; }

.btn-secondary {
  background: #F5F5F5;
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 7px 12px;
  font-size: 11px;
  font-weight: 600;
  transition: all 0.15s;
}
.btn-secondary:hover { background: #EBEBEB; }
```

- [ ] **Step 2: Commit**

```bash
git -C "C:/Users/gu-car/Claude PlayArea" add m2l-content-engine/src/styles/
git -C "C:/Users/gu-car/Claude PlayArea" commit -m "feat: add design system CSS"
```

---

## Task 7: useApi hook

**Files:**
- Create: `m2l-content-engine/src/hooks/useApi.js`

- [ ] **Step 1: Create src/hooks/useApi.js**

```js
const BASE = '/api';

async function json(res) {
  if (!res.ok) throw new Error(`API ${res.status}: ${res.url}`);
  return res.json();
}

const headers = { 'Content-Type': 'application/json' };
const put  = (url, body) => fetch(url, { method: 'PUT',    headers, body: JSON.stringify(body) }).then(json);
const post = (url, body) => fetch(url, { method: 'POST',   headers, body: JSON.stringify(body) }).then(json);
const del  = (url)       => fetch(url, { method: 'DELETE' }).then(json);

export const getCampaign      = ()           => fetch(`${BASE}/campaign`).then(json);
export const updateCampaign   = (data)       => put(`${BASE}/campaign`, data);
export const getPostingRules  = ()           => fetch(`${BASE}/posting-rules`).then(json);

export const getDrafts        = ()           => fetch(`${BASE}/drafts`).then(json);
export const getDraft         = (filename)   => fetch(`${BASE}/drafts/${filename}`).then(json);
export const updateDraft      = (filename, data) => put(`${BASE}/drafts/${filename}`, data);
export const deleteDraft      = (filename)   => del(`${BASE}/drafts/${filename}`);

export const addEvent         = (event)      => post(`${BASE}/events`, event);
export const deleteEvent      = (date)       => del(`${BASE}/events/${encodeURIComponent(date)}`);
```

- [ ] **Step 2: Commit**

```bash
git -C "C:/Users/gu-car/Claude PlayArea" add m2l-content-engine/src/hooks/
git -C "C:/Users/gu-car/Claude PlayArea" commit -m "feat: add useApi fetch hook"
```

---

## Task 8: PhaseTimeline component

**Files:**
- Create: `m2l-content-engine/src/components/PhaseTimeline.jsx`

- [ ] **Step 1: Create src/components/PhaseTimeline.jsx**

```jsx
export default function PhaseTimeline({ phases, activeFilter, onFilterChange }) {
  return (
    <div className="phase-timeline">
      {phases.map(p => (
        <div
          key={p.id}
          className={`phase-seg phase-seg-${p.id}${activeFilter === p.id ? ' active' : ''}`}
          style={{ flex: p.weeks.length }}
          onClick={() => onFilterChange(activeFilter === p.id ? null : p.id)}
          title={`Click to filter to ${p.label}`}
        >
          {p.label} · Wk {p.weeks[0]}–{p.weeks[p.weeks.length - 1]}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git -C "C:/Users/gu-car/Claude PlayArea" add m2l-content-engine/src/components/PhaseTimeline.jsx
git -C "C:/Users/gu-car/Claude PlayArea" commit -m "feat: add PhaseTimeline component"
```

---

## Task 9: PostCard component

**Files:**
- Create: `m2l-content-engine/src/components/PostCard.jsx`

- [ ] **Step 1: Create src/components/PostCard.jsx**

```jsx
const TYPE_ICONS = {
  story:     '📖',
  milestone: '🏔️',
  ask:       '🙏',
  thank:     '❤️',
  training:  '🚴',
};

export default function PostCard({ draft, selected, onClick }) {
  return (
    <div
      className={`post-card${selected ? ' selected' : ''}`}
      onClick={onClick}
      title={draft.title}
    >
      <span className="post-icon">{TYPE_ICONS[draft.content_type] ?? '📄'}</span>
      <span className="post-title">{draft.title}</span>
      <div className={`status-dot status-dot status-${draft.status}`} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git -C "C:/Users/gu-car/Claude PlayArea" add m2l-content-engine/src/components/PostCard.jsx
git -C "C:/Users/gu-car/Claude PlayArea" commit -m "feat: add PostCard component"
```

---

## Task 10: Calendar component

**Files:**
- Create: `m2l-content-engine/src/components/Calendar.jsx`

- [ ] **Step 1: Create src/components/Calendar.jsx**

```jsx
import { useMemo } from 'react';
import PostCard from './PostCard.jsx';

function weekStartDate(campaignStart, weekNum) {
  const d = new Date(campaignStart);
  d.setDate(d.getDate() + (weekNum - 1) * 7);
  return d;
}

function weekEndDate(campaignStart, weekNum) {
  const d = weekStartDate(campaignStart, weekNum);
  d.setDate(d.getDate() + 6);
  return d;
}

function fmtShort(d) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getWeekPhase(phases, weekNum) {
  return phases.find(p => p.weeks.includes(weekNum)) ?? null;
}

function eventsInWeek(keyEvents, campaignStart, weekNum) {
  const start = weekStartDate(campaignStart, weekNum);
  const end   = weekEndDate(campaignStart, weekNum);
  return keyEvents.filter(e => {
    const d = new Date(e.date);
    return d >= start && d <= end;
  });
}

export default function Calendar({
  campaign, drafts, currentWeek, phaseFilter, onSelectDraft, selectedDraft
}) {
  const allWeeks = useMemo(() => Array.from({ length: 13 }, (_, i) => i + 1), []);

  const visibleWeeks = phaseFilter
    ? allWeeks.filter(w => getWeekPhase(campaign.phases, w)?.id === phaseFilter)
    : allWeeks;

  const draftsByWeek = useMemo(() => {
    const map = {};
    drafts.forEach(d => {
      if (!map[d.week]) map[d.week] = [];
      map[d.week].push(d);
    });
    return map;
  }, [drafts]);

  let lastPhaseId = null;

  return (
    <div className="calendar">
      {visibleWeeks.map(weekNum => {
        const phase = getWeekPhase(campaign.phases, weekNum);
        const phaseChanged = phase?.id !== lastPhaseId;
        const isFirst = weekNum === visibleWeeks[0];
        if (phase) lastPhaseId = phase.id;

        const start = weekStartDate(campaign.campaign_start, weekNum);
        const end   = weekEndDate(campaign.campaign_start, weekNum);
        const events = eventsInWeek(campaign.key_events, campaign.campaign_start, weekNum);
        const weekDrafts = draftsByWeek[weekNum] ?? [];
        const isCurrent = weekNum === currentWeek;

        return (
          <div key={weekNum}>
            {phaseChanged && !isFirst && (
              <div className={`phase-separator phase-separator-${phase?.id ?? ''}`}>
                {phase?.label}
              </div>
            )}
            <div className={`week-row${isCurrent ? ' current-week' : ''}`}>
              <div className={`week-badge phase-bg-${phase?.id ?? 'push'}`}>{weekNum}</div>
              <div className="week-dates">{fmtShort(start)}–{fmtShort(end)}</div>
              {events.map(e => (
                <span key={e.date} className={`event-pin event-pin-${e.type}`}>
                  {e.name}
                </span>
              ))}
              <div className="post-cards">
                {weekDrafts.length === 0 ? (
                  <span className="no-posts">No posts planned</span>
                ) : (
                  weekDrafts.map(d => (
                    <PostCard
                      key={d.filename}
                      draft={d}
                      selected={selectedDraft?.filename === d.filename}
                      onClick={() => onSelectDraft(d)}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git -C "C:/Users/gu-car/Claude PlayArea" add m2l-content-engine/src/components/Calendar.jsx
git -C "C:/Users/gu-car/Claude PlayArea" commit -m "feat: add Calendar component"
```

---

## Task 11: StatusBar component

**Files:**
- Create: `m2l-content-engine/src/components/StatusBar.jsx`

- [ ] **Step 1: Create src/components/StatusBar.jsx**

```jsx
import { useState } from 'react';
import { updateCampaign } from '../hooks/useApi.js';

const STATUSES = ['draft', 'ready', 'posted', 'skipped'];

export default function StatusBar({ campaign, drafts, weekNum, currentPhase, daysUntilRide, onCampaignUpdate }) {
  const [editing, setEditing] = useState(false);
  const [raisedInput, setRaisedInput] = useState(String(campaign.current_raised));

  const target = campaign.ride.fundraising_target;
  const pct = Math.min(100, Math.round((campaign.current_raised / target) * 100));

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = drafts.filter(d => d.status === s).length;
    return acc;
  }, {});

  const saveRaised = async () => {
    const val = Number(raisedInput);
    if (!isNaN(val)) {
      await updateCampaign({ ...campaign, current_raised: val });
      onCampaignUpdate();
    }
    setEditing(false);
  };

  return (
    <div className="status-bar">
      <div className="section-label">Status</div>
      <div className="countdown">
        <strong>{daysUntilRide}</strong>
        <span>days until ride</span>
      </div>
      <div className="week-phase">Week {weekNum} · {currentPhase?.label ?? '—'}</div>

      <div>
        <div className="raised-row">
          {editing ? (
            <>
              <span style={{ color: '#888' }}>£</span>
              <input
                type="number"
                className="raised-input"
                value={raisedInput}
                onChange={e => setRaisedInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveRaised()}
                onBlur={saveRaised}
                autoFocus
              />
            </>
          ) : (
            <span
              className="raised-value"
              onClick={() => { setRaisedInput(String(campaign.current_raised)); setEditing(true); }}
              title="Click to edit"
            >
              £{campaign.current_raised.toLocaleString('en-GB')} raised
            </span>
          )}
          <span className="raised-target"> / £{target.toLocaleString('en-GB')}</span>
        </div>
        <div className="progress-bar-outer">
          <div className="progress-bar-inner" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="status-counts">
        {STATUSES.map(s => (
          <div key={s} className="status-count">
            <span className="count-num">{counts[s]}</span>
            <span className="count-lbl">{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git -C "C:/Users/gu-car/Claude PlayArea" add m2l-content-engine/src/components/StatusBar.jsx
git -C "C:/Users/gu-car/Claude PlayArea" commit -m "feat: add StatusBar component"
```

---

## Task 12: EventManager component

**Files:**
- Create: `m2l-content-engine/src/components/EventManager.jsx`

- [ ] **Step 1: Create src/components/EventManager.jsx**

```jsx
import { useState } from 'react';
import { addEvent, deleteEvent } from '../hooks/useApi.js';

function fmtEventDate(dateStr) {
  const [, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}

export default function EventManager({ events, onEventsChange }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ date: '', name: '', type: 'work' });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleAdd = async () => {
    if (!form.date || !form.name.trim()) return;
    await addEvent(form);
    setForm({ date: '', name: '', type: 'work' });
    setAdding(false);
    onEventsChange();
  };

  const handleDelete = async (date) => {
    await deleteEvent(date);
    onEventsChange();
  };

  return (
    <div className="event-manager">
      <div className="section-label">Key Events</div>
      <div className="event-list">
        {events.map(e => (
          <div key={e.date} className="event-item">
            <div className={`event-dot event-dot-${e.type}`} />
            <span className="event-name" title={e.name}>{e.name}</span>
            <span className="event-date">{fmtEventDate(e.date)}</span>
            <button className="event-delete" onClick={() => handleDelete(e.date)} title="Remove">✕</button>
          </div>
        ))}
      </div>

      {adding ? (
        <div className="event-form">
          <input
            type="date"
            className="event-input"
            value={form.date}
            onChange={e => set('date', e.target.value)}
          />
          <input
            type="text"
            className="event-input"
            placeholder="Event name"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <select className="event-input" value={form.type} onChange={e => set('type', e.target.value)}>
            <option value="work">Work</option>
            <option value="ride">Ride</option>
            <option value="personal">Personal</option>
          </select>
          <div className="event-form-buttons">
            <button className="btn-primary-sm" onClick={handleAdd}>Add</button>
            <button className="btn-secondary-sm" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="add-event-btn" onClick={() => setAdding(true)}>+ Add event</button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git -C "C:/Users/gu-car/Claude PlayArea" add m2l-content-engine/src/components/EventManager.jsx
git -C "C:/Users/gu-car/Claude PlayArea" commit -m "feat: add EventManager component"
```

---

## Task 13: DetailPanel component

**Files:**
- Create: `m2l-content-engine/src/components/DetailPanel.jsx`

- [ ] **Step 1: Create src/components/DetailPanel.jsx**

```jsx
import { useState, useEffect } from 'react';
import { updateDraft } from '../hooks/useApi.js';

const TYPE_ICONS = {
  story: '📖', milestone: '🏔️', ask: '🙏', thank: '❤️', training: '🚴',
};

const STATUSES = ['draft', 'ready', 'posted', 'skipped'];

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export default function DetailPanel({ draft, onClose, onSave }) {
  const [body, setBody]       = useState('');
  const [status, setStatus]   = useState('draft');
  const [saving, setSaving]   = useState(false);
  const [copied, setCopied]   = useState(false);

  useEffect(() => {
    if (draft) {
      setBody(draft.body ?? '');
      setStatus(draft.status ?? 'draft');
    }
  }, [draft?.filename]);

  if (!draft) {
    return (
      <aside className="detail-panel">
        <div className="detail-empty">Select a post to view and edit</div>
      </aside>
    );
  }

  const charCount = body.length;

  const save = async (overrides = {}) => {
    const updated = { ...draft, body, status, ...overrides };
    setSaving(true);
    await updateDraft(draft.filename, updated);
    onSave(updated);
    setSaving(false);
  };

  const handleStatusChange = async (newStatus) => {
    setStatus(newStatus);
    await save({ status: newStatus });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <aside className="detail-panel">
      <div className="detail-header">
        <button className="close-btn" onClick={onClose}>✕</button>
        <div className="detail-type-line">
          Week {draft.week} · {draft.day} · {TYPE_ICONS[draft.content_type] ?? '📄'} {draft.content_type}
        </div>
        <h2 className="detail-title">{draft.title}</h2>
        <div className="detail-meta">
          {draft.date          && <span className="meta-chip">{fmtDate(draft.date)}</span>}
          {draft.suggested_time && <span className="meta-chip">{draft.suggested_time}</span>}
          {draft.platform      && <span className="meta-chip">{draft.platform}</span>}
        </div>
      </div>

      <div className="status-toggles">
        {STATUSES.map(s => (
          <button
            key={s}
            className={`status-btn${status === s ? ` active status-active-${s}` : ''}`}
            onClick={() => handleStatusChange(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <textarea
        className="detail-body"
        value={body}
        onChange={e => setBody(e.target.value)}
        spellCheck
      />

      <div className="tips-box">
        <div className="tips-title">LinkedIn Tips</div>
        <p>Best times: Tue–Thu, 8–10am or 12–1pm</p>
        <p>⚠️ Fundraising link → first COMMENT, not post body</p>
        <p className={charCount > 1300 ? 'char-over' : 'char-ok'}>{charCount} / 1,300 chars</p>
      </div>

      <div className="detail-footer">
        <button className="btn-primary" onClick={() => save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button className="btn-secondary" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git -C "C:/Users/gu-car/Claude PlayArea" add m2l-content-engine/src/components/DetailPanel.jsx
git -C "C:/Users/gu-car/Claude PlayArea" commit -m "feat: add DetailPanel component"
```

---

## Task 14: App.jsx — wire everything together

**Files:**
- Modify: `m2l-content-engine/src/App.jsx` (replace the stub from Task 5)

- [ ] **Step 1: Replace src/App.jsx with full implementation**

```jsx
import { useState, useEffect, useCallback } from 'react';
import { getCampaign, getDrafts } from './hooks/useApi.js';
import Calendar from './components/Calendar.jsx';
import DetailPanel from './components/DetailPanel.jsx';
import StatusBar from './components/StatusBar.jsx';
import PhaseTimeline from './components/PhaseTimeline.jsx';
import EventManager from './components/EventManager.jsx';

function calcCurrentWeek(campaignStart) {
  const start = new Date(campaignStart);
  const today = new Date();
  const diff  = today - start;
  const week  = Math.ceil(diff / (7 * 24 * 60 * 60 * 1000));
  return Math.max(1, Math.min(13, week));
}

function calcDaysUntilRide(rideDate) {
  const ride  = new Date(rideDate);
  const today = new Date();
  return Math.max(0, Math.ceil((ride - today) / (24 * 60 * 60 * 1000)));
}

export default function App() {
  const [campaign,      setCampaign]      = useState(null);
  const [drafts,        setDrafts]        = useState([]);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [phaseFilter,   setPhaseFilter]   = useState(null);

  const refreshCampaign = useCallback(() => getCampaign().then(setCampaign), []);
  const refreshDrafts   = useCallback(() => getDrafts().then(setDrafts), []);

  useEffect(() => {
    refreshCampaign();
    refreshDrafts();
  }, []);

  if (!campaign) return <div className="loading">Loading…</div>;

  const weekNum      = calcCurrentWeek(campaign.campaign_start);
  const currentPhase = campaign.phases.find(p => p.weeks.includes(weekNum)) ?? null;
  const daysUntilRide = calcDaysUntilRide(campaign.ride.date);

  const handleSaveDraft = (updated) => {
    setSelectedDraft(updated);
    refreshDrafts();
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="brand">M → L</h1>
          <p className="brand-sub">28 June 2026 · £1,000</p>
          <a
            href={campaign.ride.fundraising_url}
            target="_blank"
            rel="noopener noreferrer"
            className="fundraising-link"
          >
            ↗ JustGiving
          </a>
        </div>

        <StatusBar
          campaign={campaign}
          drafts={drafts}
          weekNum={weekNum}
          currentPhase={currentPhase}
          daysUntilRide={daysUntilRide}
          onCampaignUpdate={refreshCampaign}
        />

        <EventManager
          events={campaign.key_events}
          onEventsChange={refreshCampaign}
        />

        <div className="phase-legend">
          <div className="section-label">Phases</div>
          {campaign.phases.map(p => (
            <div key={p.id} className="phase-item">
              <div className={`phase-swatch phase-swatch phase-${p.id}`} />
              <span>{p.label} · Wk {p.weeks[0]}–{p.weeks[p.weeks.length - 1]}</span>
            </div>
          ))}
        </div>
      </aside>

      <main className="main">
        <PhaseTimeline
          phases={campaign.phases}
          activeFilter={phaseFilter}
          onFilterChange={setPhaseFilter}
        />
        <Calendar
          campaign={campaign}
          drafts={drafts}
          currentWeek={weekNum}
          phaseFilter={phaseFilter}
          onSelectDraft={setSelectedDraft}
          selectedDraft={selectedDraft}
        />
      </main>

      <DetailPanel
        draft={selectedDraft}
        onClose={() => setSelectedDraft(null)}
        onSave={handleSaveDraft}
      />
    </div>
  );
}
```

- [ ] **Step 2: Run the full dev stack**

```bash
cd "C:/Users/gu-car/Claude PlayArea/m2l-content-engine"
npm run dev
```

Expected output:
```
[0] VITE v5.x.x  ready in Xms
[0]   ➜  Local:   http://localhost:5173/
[1] API server → http://localhost:3001
```

Open http://localhost:5173. Verify:
- Dark sidebar with "M → L" branding, 89 days countdown, week 1 / The Why
- Phase timeline bar (orange / green / dark)
- 13-week calendar grid, week 1 highlighted with orange ring
- All 4 key events showing in sidebar
- Detail panel showing "Select a post to view and edit"
- No console errors

- [ ] **Step 3: Commit**

```bash
git -C "C:/Users/gu-car/Claude PlayArea" add m2l-content-engine/src/App.jsx
git -C "C:/Users/gu-car/Claude PlayArea" commit -m "feat: wire up App.jsx — dashboard complete"
```

---

## Task 15: README and GitHub

**Files:**
- Create: `m2l-content-engine/README.md`

- [ ] **Step 1: Create README.md**

```markdown
# M → L Content Engine

Local content calendar dashboard for the Manchester to London charity cycle ride — 28 June 2026, raising £1,000 for Ambitious about Autism via Rapha.

## Setup

```bash
npm install
npm run dev
```

Opens at http://localhost:5173. Requires Node 18+.

## How it works

- `config/campaign.json` — campaign dates, phases, key events, fundraising target
- `config/posting-rules.json` — LinkedIn timing, tone, frequency rules
- `content/drafts/` — one markdown file per post (`week-NN-day-type.md`)
- `content/templates/` — structural guides for each content type

Content drafts are plain markdown files with YAML frontmatter. The dashboard reads and writes them via a local Express API. No database, no cloud sync.

## Dashboard features

- **Calendar view** — 13-week grid with phase colour-coding, event markers, and post cards
- **Detail panel** — edit draft text, toggle status (draft/ready/posted/skipped), copy to clipboard
- **Status bar** — countdown, fundraising progress (click to update), post counts by status
- **Event management** — add/remove key events from the sidebar

## Generating content

Content drafts are generated and reviewed conversationally through Claude Code — not through the dashboard. The dashboard just shows, edits, and manages what's there.

### Generating drafts

```
Read config/campaign.json and config/posting-rules.json, then generate a LinkedIn draft for week 5.
Write it to content/drafts/ following the template format in content/templates/.
```

```
Generate all drafts for the 'why' phase (weeks 1–4). Vary the opening hooks and emotional register
across posts. Write each to content/drafts/ using the filename pattern week-NN-day-type.md.
```

### Reviewing drafts

```
Review content/drafts/week-03-tue-story.md against the posting rules in config/posting-rules.json.
Give me critical feedback on tone, length, CTA, and authenticity. Don't rewrite it — just tell me what's wrong.
```

```
Read all drafts in content/drafts/ and flag any that sound too corporate or use guilt-tripping.
```

### Updating for real events

```
The fundraising page shows £340 raised. Update config/campaign.json current_raised to 340 and
regenerate the week 6 draft to reflect this milestone.
```

```
Fred Whitton is done — I finished in 11 hours, Hardknott was brutal. Write the week 7 debrief
post based on the milestone template in content/templates/milestone.md.
```

## Posting workflow

1. Open http://localhost:5173
2. Click a post card to open it in the detail panel
3. Review and edit the draft
4. Mark as **Ready** when happy
5. Copy to clipboard and paste into LinkedIn
6. Post the fundraising link as the **first comment** (LinkedIn suppresses posts with external links)
7. Mark as **Posted** in the dashboard
```

- [ ] **Step 2: Initialise git and push to GitHub**

```bash
cd "C:/Users/gu-car/Claude PlayArea/m2l-content-engine"
git init
git add .
git commit -m "feat: initial commit — M2L content engine dashboard"
gh repo create m2l-content-engine --private --source=. --remote=origin --push
```

Expected: Private repo created at `github.com/<user>/m2l-content-engine` and all files pushed.

- [ ] **Step 3: Commit README to parent repo too**

```bash
git -C "C:/Users/gu-car/Claude PlayArea" add m2l-content-engine/README.md
git -C "C:/Users/gu-car/Claude PlayArea" commit -m "docs: add M2L content engine README"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| config/campaign.json with all fields | Task 2 |
| config/posting-rules.json | Task 2 |
| content/templates/ (5 types) | Task 3 |
| content/drafts/ (empty, gitkeep) | Task 3 |
| Express API — all 9 endpoints | Task 4 |
| Vite + React plugin + /api proxy | Task 5 |
| DM Sans + DM Serif Display fonts | Task 5 (index.html) + Task 6 (CSS) |
| CSS variables for all colours | Task 6 |
| PhaseTimeline — clickable filter | Task 8 |
| PostCard — icon, title, status dot | Task 9 |
| Calendar — 13 weeks, badges, events, current week ring | Task 10 |
| StatusBar — countdown, progress, editable raised | Task 11 |
| EventManager — list, add form, delete | Task 12 |
| DetailPanel — edit, status toggle, copy, tips, char count | Task 13 |
| App.jsx — state, layout wiring | Task 14 |
| .npmrc registry bypass | Task 1 |
| README with generation prompts | Task 15 |
| GitHub private repo | Task 15 |
| npm run dev (concurrently) | Task 1 (package.json) |
| British date format DD/MM/YYYY | Calendar.jsx (Task 10), DetailPanel.jsx (Task 13) |

All spec requirements covered. No gaps found.
```
