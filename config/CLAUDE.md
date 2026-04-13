# lean-ctx — Context Engineering Layer
<!-- lean-ctx-rules-v8 -->

CRITICAL: ALWAYS use lean-ctx MCP tools instead of native equivalents. This is NOT optional.

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

## Long-running processes

NEVER use `ctx_shell` or `Bash` synchronously for commands that run indefinitely.
Dev servers, watchers, and test runners in watch mode block forever when run synchronously.

For any command that starts a server or watcher (`npm run dev`, `npm start`, `yarn dev`, `next dev`, `vite`, `nodemon`, `cargo watch`, etc.):
- Use the `Bash` tool with `run_in_background: true`
- OR append ` &` to the command in Bash

WRONG: `ctx_shell("npm run dev")` — hangs forever
RIGHT: Bash tool with `run_in_background: true` and command `npm run dev`
