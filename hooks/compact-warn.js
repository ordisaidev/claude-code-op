#!/usr/bin/env node
// UserPromptSubmit — fires once when context window crosses 70%.
// Tells Claude to suggest /compact, then clears the flag so it won't repeat.

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const flagPath = path.join(os.homedir(), '.claude', '.compact-needed');

if (!fs.existsSync(flagPath)) process.exit(0);

let pct = '70';
try { pct = fs.readFileSync(flagPath, 'utf8').trim(); } catch {}

// Clear flag immediately so this fires only once per threshold crossing
try { fs.rmSync(flagPath); } catch {}

process.stdout.write(
  `⚠ Context window at ${pct}% — approaching limit. ` +
  `Suggest typing /compact to compress conversation history and free context. ` +
  `(/compact preserves key decisions while reducing token usage ~70%)`
);
process.exit(0);
