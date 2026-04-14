#!/usr/bin/env node
// UserPromptSubmit hook — detects caveman mode switches in the user's prompt.
// Developed by Ordis AI

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const HOME     = os.homedir();
const flagFile = path.join(HOME, '.claude', '.caveman-active');

let raw = '';
process.stdin.on('data', d => raw += d);
process.stdin.on('end', () => {
  let data = {};
  try { data = JSON.parse(raw); } catch { /* not JSON — skip */ }

  const prompt = (data.prompt || data.message || '').toLowerCase().trim();
  if (!prompt) process.exit(0);

  let newMode = null;
  if (/caveman\s+ultra/.test(prompt))                          newMode = 'ultra';
  else if (/caveman\s+full/.test(prompt))                      newMode = 'full';
  else if (/caveman\s+lite/.test(prompt))                      newMode = 'lite';
  else if (/stop\s+caveman|caveman\s+off|normal\s+mode/.test(prompt)) newMode = 'off';

  if (newMode !== null) {
    try { fs.writeFileSync(flagFile, newMode); } catch { /* ok */ }
  }

  process.exit(0);
});
