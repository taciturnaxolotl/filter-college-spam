#!/usr/bin/env bun
// filename: label-emails.ts
// Web app for labeling exported emails to build test suite

import { serve } from "bun";
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";

const PORT = 3000;
const DATA_FILE = process.argv[2] || "college_emails_export.json";
const LABELS_FILE = DATA_FILE.replace(".json", "_labeled.json");

interface Email {
  thread_id: string;
  subject: string;
  from: string;
  to: string;
  cc: string;
  date: string;
  body: string;
  labels: string[];
  is_in_inbox: boolean;
}

interface LabeledEmail extends Email {
  pertains?: boolean;
  reason?: string;
  labeled_at?: string;
  confidence?: "high" | "medium" | "low";
  notes?: string;
}

interface ExportData {
  exported_at: string;
  total_count: number;
  label: string;
  emails: Email[];
}

interface LabeledData {
  source_file: string;
  labeled_at: string;
  total_count: number;
  labeled_count: number;
  emails: LabeledEmail[];
}

// Load or initialize data
let data: LabeledData;

async function loadData() {
  if (!existsSync(DATA_FILE)) {
    console.error(`Error: ${DATA_FILE} not found`);
    console.log("Usage: bun label-emails.ts <exported_json_file>");
    process.exit(1);
  }

  const rawData: ExportData = JSON.parse(await readFile(DATA_FILE, "utf-8"));

  if (existsSync(LABELS_FILE)) {
    // Continue from existing labels
    data = JSON.parse(await readFile(LABELS_FILE, "utf-8"));
    console.log(`Loaded existing labels from ${LABELS_FILE}`);
  } else {
    // Initialize new labeled data
    data = {
      source_file: DATA_FILE,
      labeled_at: new Date().toISOString(),
      total_count: rawData.emails.length,
      labeled_count: 0,
      emails: rawData.emails.map((e) => ({ ...e })),
    };
    console.log(`Initialized ${data.total_count} emails for labeling`);
  }
}

async function saveData() {
  data.labeled_count = data.emails.filter((e) => e.pertains !== undefined).length;
  await writeFile(LABELS_FILE, JSON.stringify(data, null, 2));
}

const HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Labeling Tool</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0a0a0a;
      color: #e0e0e0;
      padding: 20px;
      line-height: 1.6;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .header {
      background: #1a1a1a;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      border: 1px solid #333;
    }
    .progress {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .progress-bar {
      flex: 1;
      height: 8px;
      background: #333;
      border-radius: 4px;
      overflow: hidden;
      margin: 0 20px;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #00d4ff, #0099ff);
      transition: width 0.3s ease;
    }
    .stats {
      display: flex;
      gap: 30px;
      font-size: 14px;
      color: #888;
    }
    .email-card {
      background: #1a1a1a;
      padding: 25px;
      border-radius: 8px;
      margin-bottom: 20px;
      border: 1px solid #333;
    }
    .email-meta {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 10px 20px;
      margin-bottom: 20px;
      font-size: 14px;
    }
    .meta-label {
      color: #666;
      font-weight: 600;
    }
    .meta-value {
      color: #e0e0e0;
      word-break: break-all;
    }
    .email-subject {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 15px;
      color: #00d4ff;
    }
    .email-body {
      background: #0f0f0f;
      padding: 15px;
      border-radius: 4px;
      border: 1px solid #222;
      max-height: 400px;
      overflow-y: auto;
      white-space: pre-wrap;
      font-size: 13px;
      line-height: 1.5;
      margin-bottom: 20px;
      color: #ccc;
    }
    .actions {
      display: flex;
      gap: 15px;
      margin-bottom: 20px;
    }
    .btn {
      flex: 1;
      padding: 15px;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .btn-relevant {
      background: #00c853;
      color: white;
    }
    .btn-relevant:hover { background: #00e676; transform: translateY(-2px); }
    .btn-not-relevant {
      background: #d32f2f;
      color: white;
    }
    .btn-not-relevant:hover { background: #f44336; transform: translateY(-2px); }
    .btn-skip {
      background: #424242;
      color: white;
      flex: 0.5;
    }
    .btn-skip:hover { background: #616161; }
    .reason-input {
      width: 100%;
      padding: 12px;
      background: #0f0f0f;
      border: 1px solid #333;
      border-radius: 4px;
      color: #e0e0e0;
      font-size: 14px;
      margin-bottom: 15px;
      font-family: inherit;
    }
    .reason-input:focus {
      outline: none;
      border-color: #00d4ff;
    }
    .confidence-select {
      display: flex;
      gap: 10px;
      margin-bottom: 15px;
    }
    .confidence-btn {
      flex: 1;
      padding: 8px;
      background: #0f0f0f;
      border: 1px solid #333;
      border-radius: 4px;
      color: #888;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 13px;
    }
    .confidence-btn:hover { border-color: #00d4ff; color: #00d4ff; }
    .confidence-btn.active { background: #00d4ff; color: #000; border-color: #00d4ff; }
    .notes-input {
      width: 100%;
      padding: 12px;
      background: #0f0f0f;
      border: 1px solid #333;
      border-radius: 4px;
      color: #e0e0e0;
      font-size: 13px;
      min-height: 60px;
      font-family: inherit;
      resize: vertical;
    }
    .notes-input:focus {
      outline: none;
      border-color: #00d4ff;
    }
    .navigation {
      display: flex;
      gap: 10px;
      justify-content: center;
      margin-top: 20px;
    }
    .nav-btn {
      padding: 10px 20px;
      background: #424242;
      border: none;
      border-radius: 4px;
      color: white;
      cursor: pointer;
      font-size: 14px;
    }
    .nav-btn:hover { background: #616161; }
    .nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }
    .nav-btn:disabled:hover { background: #424242; }
    .shortcuts {
      background: #1a1a1a;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
      border: 1px solid #333;
      font-size: 13px;
    }
    .shortcuts-title {
      font-weight: 600;
      margin-bottom: 10px;
      color: #00d4ff;
    }
    .shortcuts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 8px;
    }
    .shortcut {
      display: flex;
      justify-content: space-between;
    }
    .shortcut-key {
      font-family: monospace;
      background: #0f0f0f;
      padding: 2px 8px;
      border-radius: 3px;
      border: 1px solid #333;
    }
    .complete {
      text-align: center;
      padding: 40px;
      background: #1a1a1a;
      border-radius: 8px;
      border: 1px solid #333;
    }
    .complete h2 {
      color: #00d4ff;
      margin-bottom: 20px;
    }
    .export-btn {
      background: #00c853;
      color: white;
      padding: 15px 30px;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 20px;
    }
    .export-btn:hover { background: #00e676; }
    .existing-label {
      background: #1a3a1a;
      border: 1px solid #2a5a2a;
      padding: 10px;
      border-radius: 4px;
      margin-bottom: 15px;
      font-size: 14px;
    }
    .existing-label-header {
      font-weight: 600;
      color: #4caf50;
      margin-bottom: 5px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="progress">
        <span id="progress-text">Loading...</span>
        <div class="progress-bar">
          <div class="progress-fill" id="progress-fill"></div>
        </div>
        <span id="progress-percent">0%</span>
      </div>
      <div class="stats">
        <span>Total: <strong id="total-count">0</strong></span>
        <span>Labeled: <strong id="labeled-count">0</strong></span>
        <span>Remaining: <strong id="remaining-count">0</strong></span>
      </div>
    </div>

    <div class="shortcuts">
      <div class="shortcuts-title">Keyboard Shortcuts</div>
      <div class="shortcuts-grid">
        <div class="shortcut"><span>Relevant</span><span class="shortcut-key">Y</span></div>
        <div class="shortcut"><span>Not Relevant</span><span class="shortcut-key">N</span></div>
        <div class="shortcut"><span>Skip</span><span class="shortcut-key">S</span></div>
        <div class="shortcut"><span>Previous</span><span class="shortcut-key">←</span></div>
        <div class="shortcut"><span>Next</span><span class="shortcut-key">→</span></div>
        <div class="shortcut"><span>High Confidence</span><span class="shortcut-key">1</span></div>
        <div class="shortcut"><span>Medium Confidence</span><span class="shortcut-key">2</span></div>
        <div class="shortcut"><span>Low Confidence</span><span class="shortcut-key">3</span></div>
      </div>
    </div>

    <div id="content"></div>

    <div class="navigation">
      <button class="nav-btn" id="prev-btn" onclick="navigate(-1)">← Previous</button>
      <button class="nav-btn" id="next-btn" onclick="navigate(1)">Next →</button>
    </div>
  </div>

  <script>
    let data = null;
    let currentIndex = 0;
    let pendingDecision = null;
    let pendingConfidence = 'high';

    async function loadData() {
      const res = await fetch('/api/data');
      data = await res.json();
      
      // Find first unlabeled or start at 0
      currentIndex = data.emails.findIndex(e => e.pertains === undefined);
      if (currentIndex === -1) currentIndex = 0;
      
      render();
    }

    function updateProgress() {
      const labeled = data.emails.filter(e => e.pertains !== undefined).length;
      const total = data.emails.length;
      const remaining = total - labeled;
      const percent = Math.round((labeled / total) * 100);

      document.getElementById('progress-text').textContent = \`Email \${currentIndex + 1} of \${total}\`;
      document.getElementById('progress-fill').style.width = \`\${percent}%\`;
      document.getElementById('progress-percent').textContent = \`\${percent}%\`;
      document.getElementById('total-count').textContent = total;
      document.getElementById('labeled-count').textContent = labeled;
      document.getElementById('remaining-count').textContent = remaining;
      
      document.getElementById('prev-btn').disabled = currentIndex === 0;
      document.getElementById('next-btn').disabled = currentIndex === total - 1;
    }

    function render() {
      updateProgress();
      
      const labeled = data.emails.filter(e => e.pertains !== undefined).length;
      if (labeled === data.emails.length) {
        renderComplete();
        return;
      }

      const email = data.emails[currentIndex];
      const existingLabel = email.pertains !== undefined;

      const content = document.getElementById('content');
      content.innerHTML = \`
        <div class="email-card">
          \${existingLabel ? \`
            <div class="existing-label">
              <div class="existing-label-header">Previously Labeled</div>
              <div>Pertains: <strong>\${email.pertains ? 'YES' : 'NO'}</strong></div>
              <div>Reason: \${email.reason || 'N/A'}</div>
              <div>Confidence: \${email.confidence || 'N/A'}</div>
              \${email.notes ? \`<div>Notes: \${email.notes}</div>\` : ''}
            </div>
          \` : ''}

          <div class="email-subject">\${escapeHtml(email.subject)}</div>
          
          <div class="email-meta">
            <div class="meta-label">From:</div>
            <div class="meta-value">\${escapeHtml(email.from)}</div>
            
            <div class="meta-label">To:</div>
            <div class="meta-value">\${escapeHtml(email.to)}</div>
            
            \${email.cc ? \`
              <div class="meta-label">Cc:</div>
              <div class="meta-value">\${escapeHtml(email.cc)}</div>
            \` : ''}
            
            <div class="meta-label">Date:</div>
            <div class="meta-value">\${new Date(email.date).toLocaleString()}</div>

            <div class="meta-label">Labels:</div>
            <div class="meta-value">\${email.labels.join(', ')}</div>
          </div>

          <div class="email-body">\${escapeHtml(email.body.slice(0, 5000))}\${email.body.length > 5000 ? '...' : ''}</div>

          <div class="confidence-select">
            <button class="confidence-btn \${pendingConfidence === 'high' ? 'active' : ''}" onclick="setConfidence('high')">High Confidence (1)</button>
            <button class="confidence-btn \${pendingConfidence === 'medium' ? 'active' : ''}" onclick="setConfidence('medium')">Medium Confidence (2)</button>
            <button class="confidence-btn \${pendingConfidence === 'low' ? 'active' : ''}" onclick="setConfidence('low')">Low Confidence (3)</button>
          </div>

          <input type="text" 
                 class="reason-input" 
                 id="reason-input" 
                 placeholder="Reason (required)" 
                 value="\${existingLabel ? email.reason || '' : ''}">

          <textarea class="notes-input" 
                    id="notes-input" 
                    placeholder="Additional notes (optional)">\${existingLabel ? email.notes || '' : ''}</textarea>

          <div class="actions">
            <button class="btn btn-relevant" onclick="label(true)">✓ Relevant (Y)</button>
            <button class="btn btn-not-relevant" onclick="label(false)">✗ Not Relevant (N)</button>
            <button class="btn btn-skip" onclick="skip()">Skip (S)</button>
          </div>
        </div>
      \`;

      // Focus reason input
      setTimeout(() => document.getElementById('reason-input')?.focus(), 100);
    }

    function renderComplete() {
      const content = document.getElementById('content');
      content.innerHTML = \`
        <div class="complete">
          <h2>🎉 All emails labeled!</h2>
          <p>You've labeled all \${data.emails.length} emails.</p>
          <p>Data has been auto-saved to: <code>\${data.source_file.replace('.json', '_labeled.json')}</code></p>
          <button class="export-btn" onclick="exportTestSuite()">Export Test Suite</button>
        </div>
      \`;
    }

    async function label(pertains) {
      const reason = document.getElementById('reason-input')?.value.trim();
      const notes = document.getElementById('notes-input')?.value.trim();
      
      if (!reason) {
        alert('Please provide a reason');
        return;
      }

      await fetch('/api/label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          index: currentIndex,
          pertains,
          reason,
          confidence: pendingConfidence,
          notes
        })
      });

      data.emails[currentIndex].pertains = pertains;
      data.emails[currentIndex].reason = reason;
      data.emails[currentIndex].confidence = pendingConfidence;
      data.emails[currentIndex].notes = notes;

      // Move to next unlabeled
      const nextUnlabeled = data.emails.findIndex((e, i) => i > currentIndex && e.pertains === undefined);
      if (nextUnlabeled !== -1) {
        currentIndex = nextUnlabeled;
      } else {
        currentIndex = Math.min(currentIndex + 1, data.emails.length - 1);
      }

      pendingConfidence = 'high'; // Reset
      render();
    }

    function skip() {
      const nextUnlabeled = data.emails.findIndex((e, i) => i > currentIndex && e.pertains === undefined);
      if (nextUnlabeled !== -1) {
        currentIndex = nextUnlabeled;
      } else {
        currentIndex = Math.min(currentIndex + 1, data.emails.length - 1);
      }
      render();
    }

    function navigate(delta) {
      currentIndex = Math.max(0, Math.min(data.emails.length - 1, currentIndex + delta));
      render();
    }

    function setConfidence(level) {
      pendingConfidence = level;
      render();
    }

    async function exportTestSuite() {
      const res = await fetch('/api/export');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'test_suite.json';
      a.click();
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      switch(e.key.toLowerCase()) {
        case 'y': label(true); break;
        case 'n': label(false); break;
        case 's': skip(); break;
        case 'arrowleft': navigate(-1); break;
        case 'arrowright': navigate(1); break;
        case '1': setConfidence('high'); break;
        case '2': setConfidence('medium'); break;
        case '3': setConfidence('low'); break;
      }
    });

    loadData();
  </script>
</body>
</html>
`;

const server = serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/") {
      return new Response(HTML, {
        headers: { "Content-Type": "text/html" },
      });
    }

    if (url.pathname === "/api/data") {
      return Response.json(data);
    }

    if (url.pathname === "/api/label" && req.method === "POST") {
      const body = await req.json();
      const { index, pertains, reason, confidence, notes } = body;

      data.emails[index].pertains = pertains;
      data.emails[index].reason = reason;
      data.emails[index].confidence = confidence;
      data.emails[index].labeled_at = new Date().toISOString();
      if (notes) data.emails[index].notes = notes;

      await saveData();

      return Response.json({ success: true });
    }

    if (url.pathname === "/api/export") {
      // Generate test suite format
      const testSuite = {
        created_at: new Date().toISOString(),
        source_file: data.source_file,
        total_examples: data.emails.length,
        labeled_examples: data.emails.filter((e) => e.pertains !== undefined).length,
        test_cases: data.emails
          .filter((e) => e.pertains !== undefined)
          .map((e) => ({
            input: {
              subject: e.subject,
              from: e.from,
              to: e.to,
              cc: e.cc,
              body: e.body,
            },
            expected: {
              pertains: e.pertains,
              reason: e.reason,
            },
            metadata: {
              thread_id: e.thread_id,
              date: e.date,
              confidence: e.confidence,
              notes: e.notes,
              labels: e.labels,
            },
          })),
      };

      return new Response(JSON.stringify(testSuite, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": "attachment; filename=test_suite.json",
        },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
});

await loadData();

console.log(`
🚀 Email Labeling Tool Started
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📂 Source: ${DATA_FILE}
💾 Saving to: ${LABELS_FILE}
📊 Total emails: ${data.total_count}
✅ Already labeled: ${data.labeled_count}

🌐 Open: http://localhost:${PORT}

Keyboard Shortcuts:
  Y - Mark as relevant
  N - Mark as not relevant
  S - Skip
  ← → - Navigate
  1/2/3 - Set confidence level

Press Ctrl+C to stop and save progress.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);