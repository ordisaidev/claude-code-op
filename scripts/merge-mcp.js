#!/usr/bin/env node
// Merges MCP server entries into ~/.claude.json
// Safe: reads existing, only adds missing servers.

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const HOME        = os.homedir();
const CLAUDE_JSON = path.join(HOME, '.claude.json');
const LOCAL_BIN   = path.join(HOME, '.local', 'bin');
const CARGO_BIN   = path.join(HOME, '.cargo', 'bin');
const PLUGIN_ROOT = path.join(HOME, '.claude', 'plugins', 'marketplaces', 'thedotmack', 'plugin');
const LEAN_DATA   = path.join(HOME, '.lean-ctx');
// Default claude-mem data dir — SessionStart hook patches this to $(pwd)/.claude-mem
// each session so the MCP server always points to the current project on restart.
const MEM_DATA    = path.join(HOME, '.claude-mem');

const MCP_SERVERS = {
  "lean-ctx": {
    command: "lean-ctx",
    env: { LEAN_CTX_DATA_DIR: LEAN_DATA },
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
    type: "stdio"
  },
  "symdex": {
    command: path.join(LOCAL_BIN, 'symdex'),
    args: ["serve"],
    type: "stdio"
  },
  "claude-mem": {
    command: "node",
    args: [path.join(PLUGIN_ROOT, 'scripts', 'mcp-server.cjs')],
    type: "stdio",
    env: {
      CLAUDE_MEM_DATA_DIR: MEM_DATA,
      PATH: `${path.join(HOME, '.bun', 'bin')}:${LOCAL_BIN}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin`
    }
  }
};

// Ensure central mem dir exists
fs.mkdirSync(MEM_DATA, { recursive: true });

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
    // Always update claude-mem to fix stale CLAUDE_MEM_DATA_DIR
    if (name === 'claude-mem') {
      cfg.mcpServers[name] = server;
      console.log(`  ↻ MCP: ${name} (updated data dir → ~/.claude-mem)`);
    } else {
      console.log(`  ~ MCP: ${name} (already present)`);
    }
  }
}

fs.writeFileSync(CLAUDE_JSON, JSON.stringify(cfg, null, 2));
console.log(`\n.claude.json updated (${added} added)`);
