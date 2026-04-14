#!/usr/bin/env node
// SessionStart hook — restores caveman mode from saved flag file.
// Developed by Ordis AI

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const HOME     = os.homedir();
const flagFile = path.join(HOME, '.claude', '.caveman-active');

let mode = 'ultra'; // default
try {
  const saved = fs.readFileSync(flagFile, 'utf8').trim();
  if (saved) mode = saved;
} catch { /* first run — use default */ }

// Ensure flag file exists for this session
try { fs.writeFileSync(flagFile, mode); } catch { /* ok */ }

if (mode !== 'off') {
  process.stdout.write(`CAVEMAN MODE ACTIVE — level: ${mode}\n`);
}
