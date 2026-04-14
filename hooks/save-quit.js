#!/usr/bin/env node
// UserPromptSubmit — detects "save state" / "exit" / "quit" / "save and quit"
// Instructs Claude to write a rich .claude-state.md before quitting.
// The auto-generated version (session-handoff.js) runs at Stop anyway,
// but this lets Claude write a RICHER version with actual next steps.

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const SAVE_PATTERNS = [
  /\bsave\s+(state|session|context|handoff)\b/i,
  /\bwrite\s+handoff\b/i,
  /\b(save\s+and\s+quit|save\s*&\s*quit)\b/i,
  /\bsave\s+and\s+exit\b/i,
];

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  let prompt = '';
  try { prompt = (JSON.parse(input).prompt || ''); } catch { process.exit(0); }

  if (!SAVE_PATTERNS.some(p => p.test(prompt))) process.exit(0);

  const cwd       = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const stateFile = path.join(cwd, '.claude-state.md');
  const proj      = path.basename(cwd);
  const date      = new Date().toISOString().slice(0, 10);

  // Read existing state to preserve any manually written next steps
  let existing = '';
  try { existing = fs.readFileSync(stateFile, 'utf8'); } catch {}

  process.stdout.write(
    `SAVE SESSION STATE REQUEST DETECTED.\n` +
    `Write or update \`${stateFile}\` using the Write tool with this format:\n\n` +
    `# Session State — ${date}\n` +
    `> Edit freely — auto-injected at next session start (~200 tokens).\n\n` +
    `## Project\n` +
    `${proj} — [one line description]\n\n` +
    `## Current task\n` +
    `[What we are actively working on right now]\n\n` +
    `## Completed this session\n` +
    `- [key thing done]\n` +
    `- [key thing done]\n\n` +
    `## Next steps\n` +
    `1. [concrete next action]\n` +
    `2. [next after that]\n\n` +
    `## Key files\n` +
    `- \`path/to/file\` — [why it matters]\n\n` +
    `## Key decisions & context\n` +
    `[Decisions made, gotchas, context needed for next session]\n\n` +
    `After writing the file, confirm: "State saved. Press Ctrl+C (or Cmd+C) to exit."\n` +
    `Do NOT quit yourself — user will press Ctrl+C after seeing the confirmation.`
  );

  process.exit(0);
});
