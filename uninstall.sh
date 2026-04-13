#!/usr/bin/env bash
# Claude Code Op — uninstaller
# Developed by Ordis AI

set -euo pipefail
HOOKS_DIR="$HOME/.claude/hooks"

echo "Removing Claude Code Op hooks and config..."

# Remove our custom hooks
for f in combined-statusline.js project-init.js lean-ctx-session-init.js \
          lean-ctx-toggle.js graph-toggle.js mem-toggle.js crg-update.sh; do
  rm -f "$HOOKS_DIR/$f" && echo "  removed $f"
done

# Remove flag files
for f in .lean-ctx-active .crg-active .sym-active .mem-active; do
  rm -f "$HOME/.claude/$f"
done

# Remove caveman config
rm -f "$HOME/.config/caveman/config.json"

echo ""
echo "Done. MCP servers and tool binaries are left in place."
echo "To remove tools: lean-ctx uninstall | uv tool uninstall code-review-graph symdex"
echo "To remove caveman: claude plugin uninstall caveman@caveman"
echo "Restart Claude Code to apply."
