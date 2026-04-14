# Claude Code Op — Token Efficiency Rules
<!-- lean-ctx-rules-v8 -->

## lean-ctx — MANDATORY file/shell tool replacement

CRITICAL: ALWAYS use lean-ctx MCP tools. This is NOT optional. Using native Read/Grep/Bash wastes tokens.

| ALWAYS USE | NEVER USE | Why |
|------------|-----------|-----|
| `ctx_read(path)` | `Read` / `cat` / `head` / `tail` | Cached, 8 compression modes, re-reads ~13 tokens |
| `ctx_shell(command)` | `Shell` / `bash` / terminal | Pattern compression for git/npm/cargo output |
| `ctx_search(pattern, path)` | `Grep` / `rg` | Compact, token-efficient results |
| `ctx_tree(path, depth)` | `ls` / `find` | Compact directory maps |

Compatibility: ctx_read replaces READ operations only. Your native Edit/Write/StrReplace tools remain unchanged.
If Edit requires native Read and Read is unavailable, use `ctx_edit(path, old_string, new_string)` instead.
Write, Delete, Glob → use normally. NEVER loop on Edit failures — switch to ctx_edit immediately.

<!-- /lean-ctx -->

## code-review-graph — MANDATORY for codebase exploration

ALWAYS use code-review-graph MCP tools BEFORE Grep/Glob/Read when exploring code. The graph is faster and gives structural context file scanning cannot.

| Use this | Instead of | When |
|----------|-----------|------|
| `semantic_search_nodes` | Grep | Finding functions/classes by name |
| `query_graph` | Manual import tracing | Tracing callers, callees, tests |
| `get_impact_radius` | Reading each file | Understanding blast radius |
| `get_architecture_overview` | Exploring files | Understanding structure |
| `detect_changes` + `get_review_context` | Reading diffs manually | Code review |

Fall back to Grep/ctx_read ONLY when the graph doesn't cover what you need.

## claude-mem — ALWAYS query at session start

At the START of every session, ALWAYS call `mcp__claude-mem__search` or `mcp__claude-mem__smart_search` to retrieve relevant past observations about the project. This prevents re-explaining context across sessions.

Use claude-mem when:
- Starting work on a feature: search for past observations about that area
- Debugging a bug: search for past observations about that component
- Before asking the user to re-explain something: search first

Example: `mcp__claude-mem__smart_search(query="recent work on auth middleware")`

## Long-running processes

NEVER use `ctx_shell` or `Bash` synchronously for commands that run indefinitely.
Dev servers, watchers, and test runners in watch mode block forever when run synchronously.

For any command that starts a server or watcher (`npm run dev`, `npm start`, `yarn dev`, `next dev`, `vite`, `nodemon`, `cargo watch`, etc.):
- Use the `Bash` tool with `run_in_background: true`
- OR append ` &` to the command in Bash

WRONG: `ctx_shell("npm run dev")` — hangs forever
RIGHT: Bash tool with `run_in_background: true` and command `npm run dev`
