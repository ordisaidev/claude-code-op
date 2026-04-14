#!/usr/bin/env node
// Merges MCP server entries into ~/.claude.json
// Safe: reads existing, only adds missing servers.
// Dynamic scoping: MCP servers configured with symlink paths that the
// SessionStart hook repoints to the current project on every session.

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const HOME        = os.homedir();
const CLAUDE_JSON = path.join(HOME, '.claude.json');
const LOCAL_BIN   = path.join(HOME, '.local', 'bin');
const PLUGIN_ROOT = path.join(HOME, '.claude', 'plugins', 'marketplaces', 'thedotmack', 'plugin');
const LEAN_DATA   = path.join(HOME, '.lean-ctx');

// Symlink paths — repointed by SessionStart hook on every session.
// MCP servers resolve these on each file access → real-time per-project scoping.
const MEM_LINK    = path.join(HOME, '.claude-mem-link');   // → $(pwd)/.claude-mem
const SYMDEX_LINK = path.join(HOME, '.symdex-link');       // → $(pwd)/.symdex
const CRG_LINK    = path.join(HOME, '.crg-link');          // → $(pwd)/.code-review-graph

// Ensure symlink targets exist as real dirs on first install
// (hook will repoint them on first session start)
for (const p of [MEM_LINK, SYMDEX_LINK, CRG_LINK]) {
  if (!fs.existsSync(p)) {
    try { fs.mkdirSync(p, { recursive: true }); } catch { /* ok */ }
  }
}

const MCP_SERVERS = {
  "lean-ctx": {
    command: "lean-ctx",
    env: {
      LEAN_CTX_DATA_DIR: LEAN_DATA,
      // LEAN_CTX_PROJECT_ROOT injected by CLAUDE_ENV_FILE at session start
    },
    autoApprove: [
      "ctx_read","ctx_shell","ctx_search","ctx_tree","ctx_overview","ctx_compress",
      "ctx_metrics","ctx_session","ctx_knowledge","ctx_agent","ctx_analyze","ctx_benchmark",
      "ctx_cache","ctx_discover","ctx_smart_read","ctx_delta","ctx_edit","ctx_dedup",
      "ctx_fill","ctx_intent","ctx_response","ctx_context","ctx_graph","ctx_wrapped",
      "ctx_multi_read","ctx_semantic_search","ctx"
    ]
  },
  "code-review-graph": {
    command: path.join(LOCAL_BIN, 'code-review-graph'),
    args: ["serve"],
    type: "stdio",
    env: {
      // CODE_REVIEW_GRAPH_ROOT injected dynamically via CLAUDE_ENV_FILE.
      // crg-link symlink also repointed by SessionStart hook.
      CODE_REVIEW_GRAPH_ROOT: CRG_LINK,
    }
  },
  "symdex": {
    command: path.join(LOCAL_BIN, 'symdex'),
    args: ["serve"],
    type: "stdio",
    env: {
      // Symlink repointed on every SessionStart → real-time project scoping
      SYMDEX_STATE_DIR: SYMDEX_LINK,
    }
  },
  "claude-mem": {
    command: "node",
    args: [path.join(PLUGIN_ROOT, 'scripts', 'mcp-server.cjs')],
    type: "stdio",
    env: {
      // Symlink repointed on every SessionStart → real-time project scoping
      CLAUDE_MEM_DATA_DIR: MEM_LINK,
      PATH: `${path.join(HOME, '.bun', 'bin')}:${LOCAL_BIN}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin`
    }
  }
};

let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(CLAUDE_JSON, 'utf8')); } catch(e) {}
if (!cfg.mcpServers) cfg.mcpServers = {};

let added = 0;
for (const [name, server] of Object.entries(MCP_SERVERS)) {
  if (!cfg.mcpServers[name]) {
    cfg.mcpServers[name] = server;
    added++;
    console.log(`  + MCP: ${name}`);
  } else {
    // Always update — ensures symlink paths are in place after upgrades
    cfg.mcpServers[name] = server;
    console.log(`  ↻ MCP: ${name} (updated to symlink-scoped paths)`);
  }
}

fs.writeFileSync(CLAUDE_JSON, JSON.stringify(cfg, null, 2));
console.log(`\n.claude.json updated (${added} added)`);
