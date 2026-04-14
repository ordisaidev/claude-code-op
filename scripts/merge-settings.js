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
const CLAUDE_JSON  = path.join(HOME, '.claude.json');
const PLUGIN_ROOT  = path.join(HOME, '.claude', 'plugins', 'marketplaces', 'thedotmack', 'plugin');
const WIN          = process.platform === 'win32';

function h(file) { return `node "${path.join(HOOKS_DIR, file)}"`; }

// ── real-time dynamic MCP scoping via symlinks ────────────────────────────
// MCP servers start once with static env vars. To get real-time per-project
// scoping without restarting:
//   1. MCP servers point to stable symlink paths (~/.claude-*-link)
//   2. SessionStart hook atomically repoints symlinks to current project dir
//   3. MCP servers resolve symlinks on each file access → instant scoping
// ALSO patch .claude.json for a full cold-start fix on next Claude restart.
//
// Symlink paths used in merge-mcp.js:
//   ~/.claude-mem-link  → $(pwd)/.claude-mem
//   ~/.symdex-link      → $(pwd)/.symdex
//   ~/.crg-link         → $(pwd)/.code-review-graph
// SCOPE_UPDATE_CMD runs on every SessionStart. Three-layer approach:
// 1. $CLAUDE_ENV_FILE  — official Claude Code API: env vars written here are injected
//    into ALL subsequent bash + MCP server processes in the running session (real-time).
// 2. Symlinks          — ~/.claude-mem-link etc. atomically repointed to $(pwd) dirs.
//    MCP servers configured to use these paths; symlinks resolve on each file access.
// 3. .claude.json patch — ensures correct paths on next cold Claude restart.
const SCOPE_UPDATE_CMD = `
_CWD="$(pwd)"
_HOME="$HOME"
# Ensure target dirs exist
mkdir -p "$_CWD/.claude-mem" "$_CWD/.symdex" "$_CWD/.code-review-graph"
# Layer 1: inject env vars into running session via CLAUDE_ENV_FILE (official API)
if [ -n "$CLAUDE_ENV_FILE" ]; then
  echo "CLAUDE_MEM_DATA_DIR=$_CWD/.claude-mem" >> "$CLAUDE_ENV_FILE"
  echo "SYMDEX_STATE_DIR=$_CWD/.symdex" >> "$CLAUDE_ENV_FILE"
  echo "LEAN_CTX_PROJECT_ROOT=$_CWD" >> "$CLAUDE_ENV_FILE"
  echo "CODE_REVIEW_GRAPH_ROOT=$_CWD" >> "$CLAUDE_ENV_FILE"
fi
# Layer 2: repoint symlinks — MCP servers follow on each file access (real-time)
ln -sfn "$_CWD/.claude-mem"         "$_HOME/.claude-mem-link"
ln -sfn "$_CWD/.symdex"             "$_HOME/.symdex-link"
ln -sfn "$_CWD/.code-review-graph"  "$_HOME/.crg-link"
# Layer 3: patch .claude.json so next cold restart is also correct
node -e "
  const fs=require('fs'),p='$_HOME/.claude.json',cwd='$_CWD';
  try {
    const c=JSON.parse(fs.readFileSync(p,'utf8'));
    const s=c.mcpServers||{};
    if(s['claude-mem']&&s['claude-mem'].env) s['claude-mem'].env.CLAUDE_MEM_DATA_DIR=cwd+'/.claude-mem';
    if(s['symdex']){if(!s['symdex'].env)s['symdex'].env={};s['symdex'].env.SYMDEX_STATE_DIR=cwd+'/.symdex';}
    if(s['lean-ctx']){if(!s['lean-ctx'].env)s['lean-ctx'].env={};s['lean-ctx'].env.LEAN_CTX_PROJECT_ROOT=cwd;}
    if(s['code-review-graph']){if(!s['code-review-graph'].env)s['code-review-graph'].env={};s['code-review-graph'].env.CODE_REVIEW_GRAPH_ROOT=cwd;}
    fs.writeFileSync(p,JSON.stringify(c,null,2));
  } catch(e){}
" 2>/dev/null || true
`.trim().replace(/\n/g, '; ');

// Build hook list — mem worker hooks use bash and only run on Unix
const sessionStartHooks = [
  { type:"command", command: h('caveman-activate.js'),        timeout:5,  statusMessage:"Loading caveman mode..."       },
  { type:"command", command: h('lean-ctx-session-init.js'),   timeout:5,  statusMessage:"Loading lean-ctx..."           },
  { type:"command", command: h('project-init.js'),            timeout:10, statusMessage:"Initializing project tools..." },
];

if (!WIN) {
  sessionStartHooks.push(
    // Patch .claude.json for all MCP servers to current project dir (takes effect on next restart)
    { type:"command", command: SCOPE_UPDATE_CMD, timeout:5, statusMessage:"Scoping MCP tools to project..." },
    // claude-mem worker hooks use bash PATH export + curl
    { type:"command", command: `export PATH="$HOME/.bun/bin:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"; export CLAUDE_MEM_DATA_DIR="$(pwd)/.claude-mem"; _R="${PLUGIN_ROOT}"; node "$_R/scripts/smart-install.js" 2>/dev/null || true`, timeout:60, statusMessage:"Checking claude-mem deps..." },
    { type:"command", command: `export PATH="$HOME/.bun/bin:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"; export CLAUDE_MEM_DATA_DIR="$(pwd)/.claude-mem"; _R="${PLUGIN_ROOT}"; node "$_R/scripts/bun-runner.js" "$_R/scripts/worker-service.cjs" start 2>/dev/null; for i in 1 2 3 4 5; do curl -sf http://localhost:37777/health >/dev/null 2>&1 && break; sleep 1; done; exit 0`, timeout:30, statusMessage:"Starting memory worker..." },
    { type:"command", command: `export PATH="$HOME/.bun/bin:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"; export CLAUDE_MEM_DATA_DIR="$(pwd)/.claude-mem"; _R="${PLUGIN_ROOT}"; curl -sf http://localhost:37777/health >/dev/null 2>&1 && node "$_R/scripts/bun-runner.js" "$_R/scripts/worker-service.cjs" hook claude-code context 2>/dev/null || true`, timeout:30, statusMessage:"Loading memory context..." }
  );
}

const OUR_HOOKS = {
  SessionStart: [{
    matcher: "startup|clear|compact",
    hooks: sessionStartHooks
  }],
  UserPromptSubmit: [{
    hooks: [
      { type:"command", command: h('compact-warn.js'),          timeout:3, statusMessage:"Checking context..."        },
      { type:"command", command: h('caveman-mode-tracker.js'),  timeout:5, statusMessage:"Tracking caveman mode..."  },
      { type:"command", command: h('lean-ctx-toggle.js'),       timeout:5, statusMessage:"Checking lean-ctx state..." },
      { type:"command", command: h('graph-toggle.js'),          timeout:5, statusMessage:"Checking graph/sym state..." },
      { type:"command", command: h('mem-toggle.js'),            timeout:5, statusMessage:"Checking mem state..."      },
      ...(!WIN ? [{
        type:"command",
        command: `export PATH="$HOME/.bun/bin:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"; export CLAUDE_MEM_DATA_DIR="$(pwd)/.claude-mem"; _R="${PLUGIN_ROOT}"; curl -sf http://localhost:37777/health >/dev/null 2>&1 && node "$_R/scripts/bun-runner.js" "$_R/scripts/worker-service.cjs" hook claude-code session-init 2>/dev/null || true`,
        timeout:10, statusMessage:"Initializing memory session..."
      }] : []),
    ]
  }],
  PostToolUse: [{
    matcher: "Edit|Write|Bash",
    hooks: [
      ...(!WIN ? [{ type:"command", command: `bash "${path.join(HOOKS_DIR, 'crg-update.sh')}"`, timeout:30, statusMessage:"Updating code graph..." }] : []),
      ...(!WIN ? [{
        type:"command",
        command: `export PATH="$HOME/.bun/bin:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"; export CLAUDE_MEM_DATA_DIR="$(pwd)/.claude-mem"; _R="${PLUGIN_ROOT}"; curl -sf http://localhost:37777/health >/dev/null 2>&1 && node "$_R/scripts/bun-runner.js" "$_R/scripts/worker-service.cjs" hook claude-code observation 2>/dev/null || true`,
        timeout:30, statusMessage:"Saving memory observation..."
      }] : []),
    ]
  }],
};

// PreToolUse lean-ctx redirect hooks — Unix only
if (!WIN) {
  OUR_HOOKS.PreToolUse = [
    { matcher:"Bash|bash",
      hooks:[{ type:"command", command:"lean-ctx hook rewrite" }] },
    { matcher:"Read|read|ReadFile|read_file|View|view|Grep|grep|Search|search|ListFiles|list_files|ListDirectory|list_directory",
      hooks:[{ type:"command", command:"lean-ctx hook redirect" }] }
  ];
}

// Stop / SessionEnd — mem summarize + session handoff, Unix only
if (!WIN) {
  OUR_HOOKS.Stop = [{
    hooks:[
      { type:"command", command: h('session-handoff.js'), timeout:10, statusMessage:"Writing session state..." },
      { type:"command", command:`export PATH="$HOME/.bun/bin:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"; export CLAUDE_MEM_DATA_DIR="$(pwd)/.claude-mem"; _R="${PLUGIN_ROOT}"; curl -sf http://localhost:37777/health >/dev/null 2>&1 && node "$_R/scripts/bun-runner.js" "$_R/scripts/worker-service.cjs" hook claude-code summarize 2>/dev/null || true`, timeout:60, statusMessage:"Saving session summary..." }
    ]
  }];
  OUR_HOOKS.SessionEnd = [{
    hooks:[{ type:"command", command:`export PATH="$HOME/.bun/bin:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"; export CLAUDE_MEM_DATA_DIR="$(pwd)/.claude-mem"; _R="${PLUGIN_ROOT}"; curl -sf http://localhost:37777/health >/dev/null 2>&1 && node "$_R/scripts/bun-runner.js" "$_R/scripts/worker-service.cjs" hook claude-code session-complete 2>/dev/null || true`, timeout:15, statusMessage:"Finalizing memory..." }]
  }];
}

// Read existing or start fresh
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(SETTINGS, 'utf8')); } catch(e) {}
if (!cfg.hooks) cfg.hooks = {};

// Events where we REPLACE existing ours entries rather than append (prevents duplicates
// that cause e.g. session-complete being called twice, killing observations)
const REPLACE_EVENTS = new Set(['Stop', 'SessionEnd']);

// Marker to identify our hooks vs user's own hooks
function isOurHook(cmd) {
  return ['caveman-activate','lean-ctx-session-init','project-init','smart-install',
          'worker-service','caveman-mode-tracker','lean-ctx-toggle','graph-toggle',
          'mem-toggle','crg-update','lean-ctx hook','combined-statusline',
          'bun-runner','CLAUDE_MEM','lean-ctx-session','compact-warn','session-handoff'
  ].some(marker => (cmd || '').includes(marker));
}

for (const [event, groups] of Object.entries(OUR_HOOKS)) {
  if (!cfg.hooks[event]) cfg.hooks[event] = [];

  if (REPLACE_EVENTS.has(event)) {
    // Strip any existing entries that contain our hooks, then add fresh
    cfg.hooks[event] = cfg.hooks[event].filter(g =>
      !(g.hooks || []).some(h => isOurHook(h.command))
    );
    cfg.hooks[event].push(...groups);
  } else {
    // Append only if not already present (match by first hook command)
    for (const group of groups) {
      const newCmd = group.hooks && group.hooks[0] && group.hooks[0].command;
      const already = newCmd && cfg.hooks[event].some(
        g => g.hooks && g.hooks.some(h => h.command === newCmd)
      );
      if (!already) cfg.hooks[event].push(group);
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
