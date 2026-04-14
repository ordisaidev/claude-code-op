#!/usr/bin/env node
// SessionStart hook — background-init code-review-graph and symdex.
// Returns immediately; indexing runs detached so it never blocks session start.

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { spawn } = require('child_process');

const HOME      = os.homedir();
const WIN       = process.platform === 'win32';
const LOCAL_BIN = path.join(HOME, '.local', 'bin');
const BUN_BIN   = path.join(HOME, '.bun', 'bin');
const CARGO_BIN = path.join(HOME, '.cargo', 'bin');

// Reset flags to "on" each session
['crg', 'sym', 'mem'].forEach(t => {
  try { fs.writeFileSync(path.join(HOME, '.claude', `.${t}-active`), 'on'); } catch(e) {}
});

const cwd      = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const repoName = path.basename(cwd);

// Build platform-appropriate PATH
let envPath;
if (WIN) {
  envPath = [
    path.join(HOME, 'AppData', 'Roaming', 'uv', 'bin'),
    path.join(HOME, 'AppData', 'Local', 'Programs', 'Python311'),
    path.join(HOME, 'AppData', 'Local', 'Programs', 'Python312'),
    'C:\\Python311', 'C:\\Python312',
    process.env.PATH || '',
  ].join(';');
} else {
  envPath = [BUN_BIN, LOCAL_BIN, CARGO_BIN, '/opt/homebrew/bin', '/usr/local/bin', process.env.PATH || ''].join(':');
}

const env = { ...process.env, PATH: envPath };

function bg(cmd, args, extraEnv = {}) {
  try {
    const p = spawn(cmd, args, {
      cwd,
      env: { ...env, ...extraEnv },
      stdio: 'ignore',
      detached: true,
      shell: WIN,
    });
    p.unref();
  } catch (e) { /* silent */ }
}

const msgs = [];

// code-review-graph — build graph in project dir on first visit
const crgDb = path.join(cwd, '.code-review-graph');
if (!fs.existsSync(crgDb)) {
  bg('code-review-graph', ['build', '--quiet']);
  msgs.push(`CRG: building graph for ${repoName} in background`);
} else {
  msgs.push(`CRG: graph ready (${repoName})`);
}

// symdex — index project dir on first visit, store in .symdex/
const symDb = path.join(cwd, '.symdex');
if (!fs.existsSync(symDb)) {
  bg('symdex', ['index', './', '--repo', repoName], { SYMDEX_STATE_DIR: symDb });
  msgs.push(`SYM: indexing ${repoName} in background`);
} else {
  msgs.push(`SYM: index ready (${repoName})`);
}

process.stdout.write(msgs.join('\n'));
