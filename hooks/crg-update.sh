#!/usr/bin/env bash
# PostToolUse — silently update code-review-graph after file edits.
# Respects ~/.claude/.crg-active flag. Runs in background, never blocks.
# Skips gracefully if not in a git repository.

FLAG="$HOME/.claude/.crg-active"
[ "$(cat "$FLAG" 2>/dev/null)" = "off" ] && exit 0

# Skip if not in a git repo — code-review-graph update requires git
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

export PATH="$HOME/.local/bin:$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
code-review-graph update --skip-flows 2>/dev/null &
exit 0
