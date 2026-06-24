import express from 'express';
import { spawn } from 'child_process';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3333;

// Allow requests from any origin (needed when prospects.html is served from a different port)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  next();
});

app.get('/', (_req, res) => res.redirect('/prospects.html'));

app.use(express.static(__dir));
app.use(express.json());

// ── GET /api/scan ─────────────────────────────────────────────────────────────
// Streams scanner output via Server-Sent Events.
// Query params:
//   key   - Google Places API key
//   types - comma-separated place types (optional, defaults to all)
app.get('/api/scan', (req, res) => {
  const apiKey = (req.query.key || '').trim();
  const types  = (req.query.types || '').trim();

  if (!apiKey) {
    res.status(400).json({ error: 'Missing API key' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  const args = [join(__dir, 'scanner', 'scan.js')];
  if (types) args.push('--types', types);

  const child = spawn('node', args, {
    env: { ...process.env, GOOGLE_API_KEY: apiKey },
  });

  child.stdout.on('data', chunk => send({ type: 'log', msg: chunk.toString() }));
  child.stderr.on('data', chunk => send({ type: 'log', msg: chunk.toString() }));

  child.on('close', code => {
    if (code === 0) {
      // Read the freshest JSON results file and send it back
      try {
        const resultsDir = join(__dir, 'scanner', 'results');
        if (existsSync(resultsDir)) {
          const files = readdirSync(resultsDir)
            .filter(f => f.endsWith('.json'))
            .sort()
            .reverse();
          if (files.length > 0) {
            const raw = readFileSync(join(resultsDir, files[0]), 'utf8');
            const prospects = JSON.parse(raw);
            send({ type: 'results', prospects });
          }
        }
      } catch (err) {
        send({ type: 'log', msg: `Could not read results: ${err.message}\n` });
      }
    }
    send({ type: 'done', code });
    res.end();
  });

  // Clean up if the browser disconnects
  req.on('close', () => {
    if (!child.killed) child.kill();
  });
});

// ── GET /api/latest ───────────────────────────────────────────────────────────
// Returns the most recently scanned results JSON (for loading on page open).
app.get('/api/latest', (_req, res) => {
  try {
    const resultsDir = join(__dir, 'scanner', 'results');
    if (!existsSync(resultsDir)) return res.json({ prospects: [], file: null });
    const files = readdirSync(resultsDir)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse();
    if (files.length === 0) return res.json({ prospects: [], file: null });
    const raw = readFileSync(join(resultsDir, files[0]), 'utf8');
    res.json({ prospects: JSON.parse(raw), file: files[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n  Prospect scanner API running at http://localhost:${PORT}`);
  console.log(`  Open prospects.html in your browser (any server or file://) and click "Run Scanner".\n`);
});
