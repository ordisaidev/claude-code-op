#!/usr/bin/env node
// Merges claude-code-op hooks into ~/.claude/settings.json
// Safe: reads existing config, deep-merges, never wipes existing hooks.
// Platform-aware: skips bash-only hooks on Windows.

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const HOME         = os.homedir();
const HOOKS_DIR    = path.join(HOME, '.claude', 'hooks');
const SETTINGS     = path.join(HOME, '.claude', 'settings.json');
const PLUGIN_ROOT  = path.join(HOME, '.claude', 'plugins', 'marketplaces', 'thedotmack', 'plugin');
const WIN          = process.platform === 'win32';

function h(file) { return `node "${path.join(HOOKS_DIR, file)}"`; }

// Build hook list — mem worker hooks use bash and only run on Unix
const sessionStartHooks = [
  { type:"command", command: h('caveman-activate.js'),        timeout:5,  statusMessage:"Loading caveman mode..."       },
  { type:"command", command: h('lean-ctx-session-init.js'),   timeout:5,  statusMessage:"Loading lean-ctx..."           },
  { type:"command", command: h('project-init.js'),            timeout:10, statusMessage:"Initializing project tools..." },
];

if (!WIN) {
  // claude-mem worker hooks use bash PATH export + curl — Unix only
  const MEM_PREFIX = `export PATH="$HOME/.bun/bin:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"; export CLAUDE_MEM_DATA_DIR="$(pwd)/.claude-mem"; _R="${PLUGIN_ROOT}"; curl -sf http://localhost:37777/health >/dev/null 2>&1 &&`;

  sessionStartHooks.push(
    { type:"command", command: `export PATH="$HOME/.bun/bin:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"; export CLAUDE_MEM_DATA_DIR="$(pwd)/.claude-mem"; _R="${PLUGIN_ROOT}"; node "$_R/scripts/smart-install.js" 2>/dev/null || true`, timeout:60, statusMessage:"Checking claude-mem deps..." },
    { type:"command", command: `export PATH="$HOME/.bun/bin:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"; export CLAUDE_MEM_DATA_DIR="$(pwd)/.claude-mem"; _R="${PLUGIN_ROOT}"; node "$_R/scripts/bun-runner.js" "$_R/scripts/worker-service.cjs" start 2>/dev/null; for i in 1 2 3 4 5; do curl -sf http://localhost:37777/health >/dev/null 2>&1 && break; sleep 1; done; exit 0`, timeout:30, statusMessage:"Starting memory worker..." },
    { type:"command", command: `${MEM_PREFIX} node "$_R/scripts/bun-runner.js" "$_R/scripts/worker-service.cjs" hook claude-code context 2>/dev/null || true`, timeout:30, statusMessage:"Loading memory context..." }
  );
}

const OUR_HOOKS = {
  SessionStart: [{
    matcher: "startup|clear|compact",
    hooks: sessionStartHooks
  }],
  UserPromptSubmit: [{
    hooks: [
      { type:"command", command: h('caveman-mode-tracker.js'),  timeout:5, statusMessage:"Tracking caveman mode..."  },
      { type:"command", command: h('lean-ctx-toggle.js'),       timeout:5, statusMessage:"Checking lean-ctx state..." },
      { type:"command", command: h('graph-toggle.js'),          timeout:5, statusMessage:"Checking graph/sym state..." },
      { type:"command", command: h('mem-toggle.js'),            timeout:5, statusMessage:"Checking mem state..."      }
    ]
  }],
  PostToolUse: [{
    matcher: "Edit|Write|Bash",
    hooks: [
      // crg-update.sh — bash only; on Windows skip silently
      ...(!WIN ? [{ type:"command", command: `bash "${path.join(HOOKS_DIR, 'crg-update.sh')}"`, timeout:30, statusMessage:"Updating code graph..." }] : []),
      ...(!WIN ? [{
        type:"command",
        command: `export PATH="$HOME/.bun/bin:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"; export CLAUDE_MEM_DATA_DIR="$(pwd)/.claude-mem"; _R="${PLUGIN_ROOT}"; curl -sf http://localhost:37777/health >/dev/null 2>&1 && node "$_R/scripts/bun-runner.js" "$_R/scripts/worker-service.cjs" hook claude-code observation 2>/dev/null || true`,
        timeout:30, statusMessage:"Saving memory observation..."
      }] : []),
    ]
  }],
};

// PreToolUse lean-ctx redirect hooks — Unix only (lean-ctx not on Windows)
if (!WIN) {
  OUR_HOOKS.PreToolUse = [
    { matcher:"Bash|bash",
      hooks:[{ type:"command", command:"lean-ctx hook rewrite" }] },
    { matcher:"Read|read|ReadFile|read_file|View|view|Grep|grep|Search|search|ListFiles|list_files|ListDirectory|list_directory",
      hooks:[{ type:"command", command:"lean-ctx hook redirect" }] }
  ];
}

// Stop / SessionEnd — mem summarize, Unix only
if (!WIN) {
  const MEM_PREFIX = `export PATH="$HOME/.bun/bin:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"; export CLAUDE_MEM_DATA_DIR="$(pwd)/.claude-mem"; _R="${PLUGIN_ROOT}"; curl -sf http://localhost:37777/health >/dev/null 2>&1 &&`;
  OUR_HOOKS.Stop = [{
    hooks:[{ type:"command", command:`${MEM_PREFIX} node "$_R/scripts/bun-runner.js" "$_R/scripts/worker-service.cjs" hook claude-code summarize 2>/dev/null || true`, timeout:60, statusMessage:"Saving session summary..." }]
  }];
  OUR_HOOKS.SessionEnd = [{
    hooks:[{ type:"command", command:`${MEM_PREFIX} node "$_R/scripts/bun-runner.js" "$_R/scripts/worker-service.cjs" hook claude-code session-complete 2>/dev/null || true`, timeout:15, statusMessage:"Finalizing memory..." }]
  }];
}

// Read existing or start fresh
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(SETTINGS, 'utf8')); } catch(e) {}
if (!cfg.hooks) cfg.hooks = {};

// Merge: append our hook groups only if not already present (match by first hook command)
function alreadyPresent(existingGroups, newGroup) {
  if (!existingGroups || !existingGroups.length) return false;
  const newCmd = newGroup.hooks && newGroup.hooks[0] && newGroup.hooks[0].command;
  if (!newCmd) return false;
  return existingGroups.some(g => g.hooks && g.hooks.some(h => h.command === newCmd));
}

for (const [event, groups] of Object.entries(OUR_HOOKS)) {
  if (!cfg.hooks[event]) cfg.hooks[event] = [];
  for (const group of groups) {
    if (!alreadyPresent(cfg.hooks[event], group)) {
      cfg.hooks[event].push(group);
    }
  }
}

// Always set statusLine to our combined statusline
cfg.statusLine = {
  type: "command",
  command: h('combined-statusline.js')
};

fs.writeFileSync(SETTINGS, JSON.stringify(cfg, null, 2));
console.log('settings.json updated');
