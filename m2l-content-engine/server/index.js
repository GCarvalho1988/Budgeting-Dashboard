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
