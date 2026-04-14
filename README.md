# Claude Code Op

**Maximum token efficiency for Claude Code — one install, every project.**

Developed by [Ordis AI](https://github.com/ordisai)

---

## What it does

Claude Code Op wires together 5 tools that each attack token waste from a different angle. The result is a Claude Code environment that reads faster, writes less, remembers more, and costs a fraction of vanilla Claude Code.

```
[CAVEMAN:ULTRA] [CTX:ON] [CRG:ON] [SYM:ON] [MEM:your-project]
Sonnet 4.6 | ████░░░░ 42% | 5h:23% | 7d:11% | $0.018
```

Two-line statusline. Every tool visible. Every project scoped automatically.

---

## The stack

| Tool | What it does | Token impact |
|------|-------------|--------------|
| **Caveman** | Compresses Claude's output to terse prose | 65–75% output tokens saved |
| **lean-ctx** | Replaces file reads with cached compressed versions | Up to 99% per file read |
| **code-review-graph** | Builds a knowledge graph of your codebase, only sends relevant files | 8.2× average reduction |
| **SymDex** | Pre-indexed symbol/function lookup instead of full-file reads | 97% per symbol lookup |
| **claude-mem** | Persists session observations across restarts, no re-explaining | Cross-session context |

Combined: **80–99% fewer tokens** depending on workload. See [BENEFITS.md](./BENEFITS.md) for real benchmark data.

---

## Install

### One command (recommended)

```bash
npx claude-code-op
```

That's it. On first run it:
1. Installs **Claude Code** (via `curl -fsSL https://claude.ai/install.sh | bash`) if not present
2. Installs uv, Bun, lean-ctx, code-review-graph, symdex, Caveman, claude-mem
3. Wires hooks, MCP servers, and the 2-line statusline into `~/.claude/`
4. Shows the animated gigchad Claude banner and launches Claude Code

On every subsequent run, `npx claude-code-op` just shows the banner and opens Claude Code. Pass `--reinstall` to re-run the full setup. The package auto-detects newer versions and updates itself silently.

> **First-time login:** Claude Code handles auth itself. When you run `claude` for the first time after install, a browser window opens for OAuth. Requires a Claude Pro / Max / Team / Enterprise account.

### Flags

| Flag | Effect |
|------|--------|
| *(none)* | Fresh install on first run, launcher on repeat runs |
| `--reinstall` | Force re-run the full install even if already set up |
| Any other args | Passed through to `claude` (e.g. `npx claude-code-op -c`) |

### Alternative (clone + bash)

```bash
git clone https://github.com/ordisaidev/claude-code-op
cd claude-code-op
chmod +x install.sh
./install.sh
```

### Requirements

- macOS or Linux (Windows: run `irm https://claude.ai/install.ps1 | iex` first)
- Node.js 18+
- curl

Everything else — Claude Code, uv, Bun, Rust/cargo, all tools — is installed automatically.

### Claude Code

Claude Code is Anthropic's official CLI. Source: [github.com/anthropics/claude-code](https://github.com/anthropics/claude-code)

---

## How scoping works

Everything is **global by default, project-local by data**.

The MCP servers run globally (registered in `~/.claude.json`). On every session start, a hook detects the current working directory and:

- Builds `.code-review-graph/` in that project (first visit only, background)
- Builds `.symdex/` in that project (first visit only, background)  
- Points claude-mem to `.claude-mem/` in that project

You get fresh, isolated intelligence for every codebase — no cross-project contamination. Subfolders inherit the parent project's indexes.

```
~/projects/
  my-app/
    .code-review-graph/   ← graph scoped to my-app
    .symdex/              ← symbols scoped to my-app
    .claude-mem/          ← memory scoped to my-app
  other-project/
    .code-review-graph/   ← completely separate
    .symdex/
    .claude-mem/
```

---

## Statusline

The statusline updates live after every Claude response.

**Line 1 — tool badges:**

| Badge | Color | Meaning |
|-------|-------|---------|
| `[CAVEMAN:ULTRA]` | Orange | Caveman speech level |
| `[CTX:ON/OFF]` | Green/Grey | lean-ctx file compression |
| `[CRG:ON/OFF]` | Blue | code-review-graph active |
| `[SYM:ON/OFF]` | Purple | SymDex symbol index active |
| `[MEM:foldername]` | Pink | claude-mem active, showing current project |

**Line 2 — session stats:**

| Field | Description |
|-------|-------------|
| `Sonnet 4.6` | Current model |
| `████░░░░ 42%` | Context window usage (green → yellow → red) |
| `5h:23%` | 5-hour rate limit usage (Pro/Max only) |
| `7d:11%` | 7-day rate limit usage (Pro/Max only) |
| `$0.018` | Session cost (only shown when > $0) |

---

## Toggle commands

Say these to Claude mid-session:

| What to say | Effect |
|---|---|
| `caveman ultra` / `caveman lite` / `stop caveman` | Change speech compression level |
| `ctx off` / `ctx on` | Disable/enable lean-ctx file reads |
| `use normal file read` | Disable lean-ctx (alias) |
| `crg off` / `crg on` | Disable/enable code-review-graph |
| `graph off` / `disable graph` | Disable code-review-graph (alias) |
| `sym off` / `sym on` | Disable/enable SymDex |
| `mem off` / `mem on` | Pause/resume claude-mem |

All flags reset to **ON** on every new session.

---

## Hook architecture

```
SessionStart
  ├── caveman-activate.js       → loads caveman ultra rules
  ├── lean-ctx-session-init.js  → resets CTX flag to "on"
  ├── project-init.js           → bg-builds CRG + SYM indexes for cwd
  ├── smart-install.js          → checks claude-mem deps (bun, chroma)
  ├── worker-service start      → starts claude-mem worker on :37777
  └── worker-service context    → injects past session memory

UserPromptSubmit (every prompt, fast <5s total)
  ├── caveman-mode-tracker.js   → detects /caveman mode switches
  ├── lean-ctx-toggle.js        → detects "ctx off/on"
  ├── graph-toggle.js           → detects "crg/sym off/on"
  └── mem-toggle.js             → detects "mem off/on"

PostToolUse (after Edit/Write/Bash)
  ├── crg-update.sh             → updates knowledge graph (background)
  └── worker-service observation → saves tool use to memory (background)

PreToolUse
  ├── lean-ctx hook rewrite     → rewrites bash commands through lean-ctx
  └── lean-ctx hook redirect    → redirects file reads through ctx_read

Stop / SessionEnd
  └── worker-service summarize  → saves session summary to memory
```

---

## MCP servers

Registered globally in `~/.claude.json`:

| Server | Tools | Purpose |
|--------|-------|---------|
| `lean-ctx` | 34 tools (`ctx_read`, `ctx_shell`, `ctx_search`, …) | Compressed file reads and shell output |
| `code-review-graph` | 22 tools | Codebase knowledge graph, blast-radius analysis |
| `symdex` | 20 tools | Symbol search, call graphs, route lookup |
| `claude-mem` | 4 tools (`search`, `timeline`, `get_observations`, …) | Persistent memory search |

---

## File layout

```
claude-code-op/
├── install.sh                  # One-command installer
├── uninstall.sh                # Clean removal
├── BENEFITS.md                 # Real benchmark data from each tool
├── hooks/
│   ├── combined-statusline.js  # Two-line live statusline
│   ├── project-init.js         # Background CRG + SYM init per project
│   ├── lean-ctx-session-init.js
│   ├── lean-ctx-toggle.js
│   ├── graph-toggle.js
│   ├── mem-toggle.js
│   └── crg-update.sh
├── config/
│   ├── CLAUDE.md               # Global rules (lean-ctx + long-running processes)
│   └── caveman-config.json     # Caveman ultra default
└── scripts/
    ├── merge-settings.js       # Safe-merge hooks into ~/.claude/settings.json
    └── merge-mcp.js            # Safe-merge MCP servers into ~/.claude.json
```

---

## Uninstall

```bash
./uninstall.sh
```

Removes hooks and flags. Tool binaries stay. To remove tools individually:
```bash
lean-ctx uninstall
uv tool uninstall code-review-graph
uv tool uninstall symdex
claude plugin uninstall caveman@caveman
```

---

## License

MIT — Developed by [Ordis AI](https://github.com/ordisai)
