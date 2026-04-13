#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  Claude Code Op — installer
#  Developed by Ordis AI
#  github.com/ordisai/claude-code-op
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOKS_DST="$HOME/.claude/hooks"
CLAUDE_SETTINGS="$HOME/.claude/settings.json"
CLAUDE_JSON="$HOME/.claude.json"
CAVEMAN_CFG_DIR="$HOME/.config/caveman"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
ok()   { echo -e "  ${GREEN}✓${RESET} $1"; }
info() { echo -e "  ${CYAN}→${RESET} $1"; }
warn() { echo -e "  ${YELLOW}!${RESET} $1"; }
fail() { echo -e "  ${RED}✗${RESET} $1"; }
step() { echo -e "\n${BOLD}[$1]${RESET} $2"; }

banner() {
  echo ""
  echo -e "${CYAN}${BOLD}"
  echo "  ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗     ██████╗ ██████╗ ██████╗ "
  echo " ██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝    ██╔════╝██╔═══██╗██╔══██╗"
  echo " ██║     ██║     ███████║██║   ██║██║  ██║█████╗      ██║     ██║   ██║██║  ██║"
  echo " ██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝      ██║     ██║   ██║██║  ██║"
  echo " ╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗    ╚██████╗╚██████╔╝██████╔╝"
  echo "  ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝     ╚═════╝ ╚═════╝ ╚═════╝"
  echo "                                                              ██████╗ ██████╗    "
  echo "                                                             ██╔═══██╗██╔══██╗   "
  echo "                                                             ██║   ██║██████╔╝   "
  echo "                                                             ██║   ██║██╔═══╝    "
  echo "                                                             ╚██████╔╝██║        "
  echo "                                                              ╚═════╝ ╚═╝        "
  echo -e "${RESET}"
  echo -e "  ${BOLD}Claude Code Op${RESET} — Maximum token efficiency for Claude Code"
  echo -e "  Developed by ${CYAN}Ordis AI${RESET}"
  echo ""
}

check_prereqs() {
  step "1/8" "Checking prerequisites"

  # Node.js 18+
  if command -v node &>/dev/null; then
    NODE_VER=$(node -e "process.stdout.write(process.version.slice(1).split('.')[0])")
    if [ "$NODE_VER" -ge 18 ]; then
      ok "Node.js $(node --version)"
    else
      fail "Node.js 18+ required (found v${NODE_VER}). Install from https://nodejs.org"
      exit 1
    fi
  else
    fail "Node.js not found. Install from https://nodejs.org"
    exit 1
  fi

  # npm
  if command -v npm &>/dev/null; then ok "npm $(npm --version)"; else fail "npm not found"; exit 1; fi

  # curl
  if command -v curl &>/dev/null; then ok "curl"; else fail "curl not found"; exit 1; fi

  # claude CLI
  if command -v claude &>/dev/null; then ok "claude CLI"; else warn "claude CLI not in PATH — plugin install may be skipped"; fi

  mkdir -p "$HOME/.claude/hooks" "$HOME/.claude/plugins/marketplaces"
}

install_uv() {
  step "2/8" "Installing uv (Python tool manager)"
  if command -v uv &>/dev/null; then
    ok "uv already installed ($(uv --version 2>/dev/null | head -1))"
    return
  fi
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
  ok "uv installed"
}

install_bun() {
  step "3/8" "Installing Bun (for claude-mem)"
  if [ -x "$HOME/.bun/bin/bun" ]; then
    ok "Bun already installed ($("$HOME/.bun/bin/bun" --version))"
    return
  fi
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
  ok "Bun installed"
}

install_lean_ctx() {
  step "4/8" "Installing lean-ctx (shell + file compression)"
  export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

  if command -v lean-ctx &>/dev/null; then
    ok "lean-ctx already installed ($(lean-ctx --version 2>/dev/null))"
  else
    info "Building from source via cargo install (takes ~2 min)..."
    curl -fsSL https://leanctx.com/install.sh | sh
    export PATH="$HOME/.cargo/bin:$PATH"
    ok "lean-ctx installed"
  fi

  info "Running lean-ctx setup (configures shell + MCP)..."
  # Auto-answer telemetry prompt: pipe 'n' to stdin
  echo "n" | lean-ctx setup 2>/dev/null || lean-ctx setup --skip-confirm 2>/dev/null || true
  ok "lean-ctx configured"
}

install_python_tools() {
  step "5/8" "Installing code-review-graph and symdex"
  export PATH="$HOME/.local/bin:$PATH"

  if command -v code-review-graph &>/dev/null; then
    ok "code-review-graph already installed"
  else
    info "Installing code-review-graph (Python 3.11)..."
    uv tool install code-review-graph --python 3.11
    ok "code-review-graph installed"
  fi

  if command -v symdex &>/dev/null; then
    ok "symdex already installed"
  else
    info "Installing symdex (Python 3.11)..."
    uv tool install symdex --python 3.11
    ok "symdex installed"
  fi
}

install_caveman() {
  step "6/8" "Installing Caveman (terse speech compression)"
  export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

  if claude plugin list 2>/dev/null | grep -q "caveman"; then
    ok "Caveman plugin already installed"
  elif command -v claude &>/dev/null; then
    info "Adding caveman marketplace..."
    claude plugin marketplace add JuliusBrussee/caveman 2>/dev/null || warn "Marketplace add failed — may already exist"
    info "Installing caveman plugin..."
    claude plugin install caveman@caveman 2>/dev/null || warn "Plugin install failed — continuing"
    ok "Caveman plugin installed"
  else
    warn "claude CLI not found — skipping plugin install. Run manually:"
    warn "  claude plugin marketplace add JuliusBrussee/caveman"
    warn "  claude plugin install caveman@caveman"
  fi

  # Set ultra as default mode
  mkdir -p "$CAVEMAN_CFG_DIR"
  echo '{"defaultMode": "ultra"}' > "$CAVEMAN_CFG_DIR/config.json"
  echo "ultra" > "$HOME/.claude/.caveman-active"
  ok "Caveman set to ultra mode"
}

install_claude_mem() {
  step "7/8" "Installing claude-mem (persistent memory)"
  export PATH="$HOME/.bun/bin:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

  PLUGIN_DST="$HOME/.claude/plugins/marketplaces/thedotmack"

  if [ -f "$PLUGIN_DST/plugin/scripts/mcp-server.cjs" ]; then
    ok "claude-mem plugin files already present"
    return
  fi

  info "Downloading claude-mem via npx..."
  # npx downloads the package to npm cache; we copy from there
  npm install --prefix /tmp/claude-mem-install claude-mem 2>/dev/null || true

  # Find the downloaded plugin dir
  SRC=$(find "$HOME/.npm/_npx" /tmp/claude-mem-install -name "mcp-server.cjs" 2>/dev/null | head -1)
  if [ -n "$SRC" ]; then
    PLUGIN_SRC="$(dirname "$(dirname "$SRC")")"
    mkdir -p "$PLUGIN_DST"
    cp -r "$PLUGIN_SRC" "$PLUGIN_DST/plugin"
    ok "claude-mem plugin files installed to $PLUGIN_DST/plugin"
  else
    warn "claude-mem auto-install failed. Trying npx claude-mem install..."
    npx claude-mem install 2>/dev/null || warn "npx install also failed — claude-mem may not work"
  fi

  # Initialize flag files
  echo "on" > "$HOME/.claude/.mem-active"
  mkdir -p "$HOME/.claude-mem-default"
}

install_hooks_and_config() {
  step "8/8" "Installing hooks, config, and MCP servers"
  export PATH="$HOME/.bun/bin:$HOME/.local/bin:$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

  # Copy all custom hook files
  info "Copying hook files..."
  cp "$REPO_DIR/hooks/"*.js  "$HOOKS_DST/"
  cp "$REPO_DIR/hooks/"*.sh  "$HOOKS_DST/"
  chmod +x "$HOOKS_DST/"*.sh
  ok "Hooks copied to $HOOKS_DST"

  # Merge settings.json (hooks + statusline)
  info "Merging settings.json..."
  node "$REPO_DIR/scripts/merge-settings.js"
  ok "settings.json updated"

  # Merge .claude.json (MCP servers)
  info "Merging MCP servers into .claude.json..."
  node "$REPO_DIR/scripts/merge-mcp.js"
  ok ".claude.json updated"

  # Install CLAUDE.md rules
  CLAUDE_MD="$HOME/.claude/CLAUDE.md"
  if grep -q "lean-ctx-rules" "$CLAUDE_MD" 2>/dev/null; then
    ok "CLAUDE.md already has lean-ctx rules"
  else
    cat "$REPO_DIR/config/CLAUDE.md" >> "$CLAUDE_MD"
    ok "CLAUDE.md updated"
  fi

  # Initialize flag files
  for flag in lean-ctx crg sym mem; do
    echo "on" > "$HOME/.claude/.${flag}-active"
  done
  ok "Flag files initialized"
}

print_summary() {
  echo ""
  echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${BOLD}  Claude Code Op — Installation Complete${RESET}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo ""
  echo -e "  ${BOLD}What's active:${RESET}"
  echo -e "  ${YELLOW}[CAVEMAN:ULTRA]${RESET}  Terse speech — 65-75% output token savings"
  echo -e "  ${GREEN}[CTX:ON]${RESET}        lean-ctx — up to 99% file read token savings"
  echo -e "  ${CYAN}[CRG:ON]${RESET}        code-review-graph — 8.2x code analysis savings"
  echo -e "  ${CYAN}[SYM:ON]${RESET}        symdex — 97% symbol lookup token savings"
  echo -e "  ${CYAN}[MEM:folder]${RESET}    claude-mem — persistent cross-session memory"
  echo ""
  echo -e "  ${BOLD}Statusline (2 lines):${RESET}"
  echo -e "  Line 1: ${YELLOW}[CAVEMAN:ULTRA]${RESET} ${GREEN}[CTX:ON]${RESET} ${CYAN}[CRG:ON]${RESET} [SYM:ON] [MEM:project]"
  echo -e "  Line 2: Model | Context% | 5h rate | 7d rate | \$cost"
  echo ""
  echo -e "  ${BOLD}Per-project scope (auto on every folder):${RESET}"
  echo -e "  .code-review-graph/  — code knowledge graph"
  echo -e "  .symdex/             — symbol index"
  echo -e "  .claude-mem/         — session memory"
  echo ""
  echo -e "  ${BOLD}Toggle commands (say these to Claude):${RESET}"
  echo -e "  \"caveman ultra\" / \"caveman lite\" / \"stop caveman\""
  echo -e "  \"ctx off\" / \"ctx on\""
  echo -e "  \"crg off\" / \"crg on\" / \"graph off\""
  echo -e "  \"sym off\" / \"sym on\""
  echo -e "  \"mem off\" / \"mem on\""
  echo ""
  echo -e "  ${BOLD}${YELLOW}Restart Claude Code to activate all changes.${RESET}"
  echo ""
}

main() {
  banner
  check_prereqs
  install_uv
  install_bun
  install_lean_ctx
  install_python_tools
  install_caveman
  install_claude_mem
  install_hooks_and_config
  print_summary
}

main "$@"
