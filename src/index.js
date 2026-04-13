#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
//  Claude Code Op — Node.js installer
//  Developed by Ordis AI · github.com/ordisai/claude-code-op
//  Run via:  npx claude-code-op
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const fs            = require('fs');
const path          = require('path');
const os            = require('os');
const { execSync, spawnSync } = require('child_process');

const HOME     = os.homedir();
const REPO_DIR = path.resolve(__dirname, '..');   // package root, wherever npx unpacks it
const HOOKS_DST       = path.join(HOME, '.claude', 'hooks');
const SETTINGS        = path.join(HOME, '.claude', 'settings.json');
const CLAUDE_JSON     = path.join(HOME, '.claude.json');
const CAVEMAN_CFG_DIR = path.join(HOME, '.config', 'caveman');
const PLUGIN_DST      = path.join(HOME, '.claude', 'plugins', 'marketplaces', 'thedotmack');

// ── colour helpers ─────────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  red:    '\x1b[0;31m',
  green:  '\x1b[0;32m',
  yellow: '\x1b[1;33m',
  cyan:   '\x1b[0;36m',
  orange: '\x1b[38;5;172m',
};
const ok   = m => console.log(`  ${C.green}✓${C.reset} ${m}`);
const info = m => console.log(`  ${C.cyan}→${C.reset} ${m}`);
const warn = m => console.log(`  ${C.yellow}!${C.reset} ${m}`);
const fail = m => console.log(`  ${C.red}✗${C.reset} ${m}`);
const step = (n, m) => console.log(`\n${C.bold}[${n}]${C.reset} ${m}`);

// ── PATH that finds every tool we install ─────────────────────────────────
function richPath() {
  return [
    path.join(HOME, '.bun',   'bin'),
    path.join(HOME, '.local', 'bin'),
    path.join(HOME, '.cargo', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    process.env.PATH || '',
  ].join(':');
}

function sh(cmd, opts = {}) {
  return execSync(cmd, {
    encoding: 'utf8',
    env: { ...process.env, PATH: richPath() },
    stdio: opts.silent ? 'pipe' : 'inherit',
    ...opts,
  });
}

function has(bin) {
  try { sh(`command -v ${bin}`, { silent: true }); return true; } catch { return false; }
}

// ── sleep helper ──────────────────────────────────────────────────────────
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// ── animated welcome box (matches Claude Code welcome screen style) ────────
function animatedBanner() {
  // Smoke rises from the cigarette tip (─○) above the Claude head.
  // Each frame = 5 smoke rows (top to bottom). Smoke column offset = 37.
  // Uses two simultaneous puffs for the "puff puff" effect.
  //
  // Row index 0 = topmost row (furthest from cig), 4 = closest to cig.
  //
  // Puff lifecycle per column (left=older/higher, right=newer/lower):
  //   born as '·' near cig → grows '(·)' → '(o)' → '(O)' → disperses '≋ ≋' → fades

  const frames = [
    // [row0, row1, row2, row3, row4]  top→bottom
    ['          ','          ','          ','          ','    ·     '],
    ['          ','          ','          ','    ·     ','   (·)    '],
    ['          ','          ','    ·     ','   (·)    ','   (o)    '],
    ['          ','    ·     ','   (·)    ','   (o)    ','   (O)    '],
    ['    ·     ','   (·)    ','   (o)    ','   (O)    ','  ≋ ≋ ≋   '],
    ['   (·)    ','   (o)    ','   (O)    ','  ≋ ≋ ≋   ','    ·     '],
    ['   (o)    ','   (O)    ','  ≋ ≋ ≋   ','    ·     ','   (·)    '],
    ['   (O)    ','  ≋ ≋ ≋   ','    ·     ','   (·)    ','   (o)    '],
    ['  ≋ ≋ ≋   ','    ·     ','   (·)    ','   (o)    ','   (O)    '],
    ['  ≋  ≋    ','   (·)    ','   (o)    ','   (O)    ','  ≋ ≋ ≋   '],
    [' ≋   ≋    ','   (o)    ','   (O)    ','  ≋ ≋ ≋   ','    ·     '],
    ['          ','   (O)    ','  ≋ ≋ ≋   ','    ·     ','   (·)    '],
    ['          ','  ≋ ≋ ≋   ','    ·     ','   (·)    ','   (o)    '],
    ['          ','  ≋  ≋    ','   (·)    ','   (o)    ','   (O)    '],
    ['          ','          ','   (o)    ','   (O)    ','  ≋ ≋ ≋   '],
    ['          ','          ','   (O)    ','  ≋ ≋ ≋   ','    ·     '],
    ['          ','          ','  ≋ ≋ ≋   ','    ·     ','   (·)    '],
    ['          ','          ','          ','   (·)    ','   (o)    '],
    ['          ','          ','          ','   (o)    ','   (O)    '],
    ['          ','          ','          ','   (O)    ','  ≋ ≋ ≋   '],
    ['          ','          ','          ','          ','    ·     '],
  ];

  const COL = 34; // smoke column offset inside the box inner area

  function buildFrame(smoke) {
    const W   = 66;
    const pad = n => ' '.repeat(Math.max(0, n));

    // visible-length aware padding (strips ANSI for measuring)
    function vlen(s) { return s.replace(/\x1b\[[0-9;]*m/g, '').length; }
    function rpad(s, w) { const v = vlen(s); return s + pad(Math.max(0, w - v)); }

    const L = (inner) => `│ ${rpad(inner, W)} │`;

    const smokeLines = smoke.map(s =>
      L(`${pad(COL)}${C.cyan}${s}${C.reset}`)
    );

    return [
      `╭─── Claude Code Op ────────────────────────────────────────────────╮`,
      L(''),
      ...smokeLines,
      L(''),
      L(`${pad(21)}${C.cyan}${C.bold}▐▛█████▜▌${C.reset}`),
      L(`${pad(20)}${C.cyan}${C.bold}▝▜███████▛▘${C.reset}`),
      L(`${pad(20)}${C.cyan}${C.bold}▐▄███▌ ▐███▄▌${C.reset}   ${C.yellow}gigchad shades${C.reset}`),
      L(`${pad(21)}${C.cyan}${C.bold}▀▀▀▀   ▀▀▀▀${C.reset}`),
      L(`${pad(21)}${C.cyan}${C.bold}▘▘   ▝▝${C.reset}  ${C.yellow}─○${C.reset}  ← cig`),
      L(''),
      L(`${pad(10)}${C.bold}Maximum token efficiency · Developed by Ordis AI${C.reset}`),
      L(''),
      L(`${pad(3)}${C.orange}[CAVEMAN:ULTRA]${C.reset} ${C.green}[CTX:ON]${C.reset} ${C.cyan}[CRG:ON]${C.reset} \x1b[38;5;135m[SYM:ON]\x1b[0m \x1b[38;5;205m[MEM:ON]\x1b[0m`),
      L(''),
      `╰────────────────────────────────────────────────────────────────────╯`,
    ];
  }

  const NLINES = buildFrame(frames[0]).length;

  // Draw first frame
  for (const l of buildFrame(frames[0])) process.stdout.write(l + '\n');

  // Animate remaining frames
  for (const smoke of frames.slice(1)) {
    sleep(120);
    process.stdout.write(`\x1b[${NLINES}A`);
    for (const l of buildFrame(smoke)) {
      process.stdout.write(`\x1b[2K${l}\n`);
    }
  }
}

// ── banner ─────────────────────────────────────────────────────────────────
function banner() {
  console.log('');
  animatedBanner();
  console.log('');
  console.log('  ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗     ██████╗ ██████╗ ██████╗ ');
  console.log(' ██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝    ██╔════╝██╔═══██╗██╔══██╗');
  console.log(' ██║     ██║     ███████║██║   ██║██║  ██║█████╗      ██║     ██║   ██║██║  ██║');
  console.log(' ██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝      ██║     ██║   ██║██║  ██║');
  console.log(' ╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗    ╚██████╗╚██████╔╝██████╔╝');
  console.log('  ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝     ╚═════╝ ╚═════╝ ╚═════╝');
  console.log('                                                              ██████╗ ██████╗    ');
  console.log('                                                             ██╔═══██╗██╔══██╗   ');
  console.log('                                                             ██║   ██║██████╔╝   ');
  console.log('                                                             ██║   ██║██╔═══╝    ');
  console.log('                                                             ╚██████╔╝██║        ');
  console.log('                                                              ╚═════╝ ╚═╝        ');
  console.log(`${C.reset}`);
  console.log(`  ${C.bold}Claude Code Op${C.reset} — Maximum token efficiency for Claude Code`);
  console.log(`  Developed by ${C.cyan}Ordis AI${C.reset}  ·  github.com/ordisai/claude-code-op`);
  console.log('');
}

// ── step 0 — install Claude Code CLI ─────────────────────────────────────
function installClaudeCode() {
  step('0/9', 'Setting up Claude Code');

  if (has('claude')) {
    ok('Claude Code already installed');
    return;
  }

  const platform = process.platform;
  info('Installing Claude Code (native installer)...');

  if (platform === 'darwin' || platform === 'linux') {
    try {
      sh('curl -fsSL https://claude.ai/install.sh | bash');
      ok('Claude Code installed');
    } catch {
      fail('Claude Code install failed. Install manually:');
      fail('  macOS/Linux: curl -fsSL https://claude.ai/install.sh | bash');
      fail('  Homebrew:    brew install --cask claude-code');
      process.exit(1);
    }
  } else if (platform === 'win32') {
    info('Run this in PowerShell to install Claude Code, then re-run claude-code-op:');
    info('  irm https://claude.ai/install.ps1 | iex');
    process.exit(0);
  } else {
    warn('Unknown platform — install Claude Code from https://claude.ai/download then re-run.');
    process.exit(1);
  }

  // Auth: the first `claude` run opens the browser automatically.
  // We don't try to automate it — just tell the user.
  console.log('');
  info('Claude Code needs a one-time login. A browser will open when you first run it.');
  info('After this installer finishes, run: claude');
  console.log('');
}

// ── step 1 — prerequisites ─────────────────────────────────────────────────
function checkPrereqs() {
  step('1/9', 'Checking prerequisites');

  // Node 18+
  const major = parseInt(process.version.slice(1).split('.')[0], 10);
  if (major >= 18) ok(`Node.js ${process.version}`);
  else { fail(`Node.js 18+ required (found ${process.version})`); process.exit(1); }

  // npm
  if (has('npm')) ok(`npm ${sh('npm --version', { silent:true }).trim()}`);
  else { fail('npm not found — install Node.js from https://nodejs.org'); process.exit(1); }

  // curl
  if (has('curl')) ok('curl');
  else { fail('curl not found'); process.exit(1); }

  // claude CLI (optional — needed for plugin install)
  if (has('claude')) ok('claude CLI');
  else warn('claude CLI not in PATH — Caveman plugin install will be skipped');

  // ensure dirs exist
  fs.mkdirSync(path.join(HOME, '.claude', 'hooks'), { recursive: true });
  fs.mkdirSync(path.join(HOME, '.claude', 'plugins', 'marketplaces'), { recursive: true });
}

// ── step 2 — uv ───────────────────────────────────────────────────────────
function installUv() {
  step('2/9', 'Installing uv (Python tool manager)');
  if (has('uv')) { ok(`uv already installed (${sh('uv --version', { silent:true }).trim().split('\n')[0]})`); return; }
  sh('curl -LsSf https://astral.sh/uv/install.sh | sh');
  ok('uv installed');
}

// ── step 3 — bun ──────────────────────────────────────────────────────────
function installBun() {
  step('3/9', 'Installing Bun (for claude-mem)');
  const bunBin = path.join(HOME, '.bun', 'bin', 'bun');
  if (fs.existsSync(bunBin)) { ok(`Bun already installed (${sh(`"${bunBin}" --version`, { silent:true }).trim()})`); return; }
  sh('curl -fsSL https://bun.sh/install | bash');
  ok('Bun installed');
}

// ── step 4 — lean-ctx ─────────────────────────────────────────────────────
function installLeanCtx() {
  step('4/9', 'Installing lean-ctx (shell + file compression)');
  if (has('lean-ctx')) {
    ok(`lean-ctx already installed`);
  } else {
    info('Building via cargo install (~2 min)...');
    sh('curl -fsSL https://leanctx.com/install.sh | sh');
    ok('lean-ctx installed');
  }
  info('Running lean-ctx setup...');
  try {
    // pipe 'n' to skip telemetry prompt
    execSync('echo "n" | lean-ctx setup', {
      encoding: 'utf8',
      env: { ...process.env, PATH: richPath() },
      stdio: 'pipe',
    });
  } catch {
    try { sh('lean-ctx setup --skip-confirm', { silent: true }); } catch { /* ok */ }
  }
  ok('lean-ctx configured');
}

// ── step 5 — python tools ─────────────────────────────────────────────────
function installPythonTools() {
  step('5/9', 'Installing code-review-graph and symdex');
  if (has('code-review-graph')) {
    ok('code-review-graph already installed');
  } else {
    info('Installing code-review-graph (Python 3.11)...');
    sh('uv tool install code-review-graph --python 3.11');
    ok('code-review-graph installed');
  }
  if (has('symdex')) {
    ok('symdex already installed');
  } else {
    info('Installing symdex (Python 3.11)...');
    sh('uv tool install symdex --python 3.11');
    ok('symdex installed');
  }
}

// ── step 6 — caveman ──────────────────────────────────────────────────────
function installCaveman() {
  step('6/9', 'Installing Caveman (terse speech compression)');
  let alreadyInstalled = false;
  try {
    const list = sh('claude plugin list 2>/dev/null', { silent: true });
    if (list.includes('caveman')) alreadyInstalled = true;
  } catch { /* ignore */ }

  if (alreadyInstalled) {
    ok('Caveman plugin already installed');
  } else if (has('claude')) {
    try { sh('claude plugin marketplace add JuliusBrussee/caveman 2>/dev/null || true', { silent: true }); } catch { /* ok */ }
    try { sh('claude plugin install caveman@caveman 2>/dev/null || true', { silent: true }); ok('Caveman plugin installed'); } catch { warn('Plugin install failed — continuing'); }
  } else {
    warn('claude CLI not found — run manually after install:');
    warn('  claude plugin marketplace add JuliusBrussee/caveman');
    warn('  claude plugin install caveman@caveman');
  }

  fs.mkdirSync(CAVEMAN_CFG_DIR, { recursive: true });
  fs.writeFileSync(path.join(CAVEMAN_CFG_DIR, 'config.json'), JSON.stringify({ defaultMode: 'ultra' }));
  fs.writeFileSync(path.join(HOME, '.claude', '.caveman-active'), 'ultra');
  ok('Caveman set to ultra mode');
}

// ── step 7 — claude-mem ───────────────────────────────────────────────────
function installClaudeMem() {
  step('7/9', 'Installing claude-mem (persistent memory)');
  const mcpServer = path.join(PLUGIN_DST, 'plugin', 'scripts', 'mcp-server.cjs');

  if (fs.existsSync(mcpServer)) {
    ok('claude-mem plugin files already present');
    return;
  }

  info('Downloading claude-mem via npm...');
  try {
    sh('npm install --prefix /tmp/claude-mem-install claude-mem', { silent: true });
  } catch { /* continue — package might already be cached */ }

  // Locate mcp-server.cjs in npm cache or tmp install
  let found = null;
  const searchRoots = [
    path.join(HOME, '.npm', '_npx'),
    '/tmp/claude-mem-install',
  ];
  for (const root of searchRoots) {
    if (!fs.existsSync(root)) continue;
    try {
      const r = sh(`find "${root}" -name "mcp-server.cjs" 2>/dev/null | head -1`, { silent: true }).trim();
      if (r) { found = r; break; }
    } catch { /* ok */ }
  }

  if (found) {
    const pluginSrc = path.dirname(path.dirname(found)); // scripts/../
    fs.mkdirSync(PLUGIN_DST, { recursive: true });
    sh(`cp -r "${pluginSrc}" "${path.join(PLUGIN_DST, 'plugin')}"`);
    ok(`claude-mem installed to ${path.join(PLUGIN_DST, 'plugin')}`);
  } else {
    warn('Auto-install failed. Trying: npx claude-mem install');
    try { sh('npx claude-mem install', { silent: true }); ok('claude-mem installed via npx'); }
    catch { warn('claude-mem install failed — memory features may not work. Run: npx claude-mem install'); }
  }

  fs.writeFileSync(path.join(HOME, '.claude', '.mem-active'), 'on');
  fs.mkdirSync(path.join(HOME, '.claude-mem-default'), { recursive: true });
}

// ── step 8 — hooks, config, MCP ───────────────────────────────────────────
function installHooksAndConfig() {
  step('8/9', 'Installing hooks, config, and MCP servers');

  // Copy hook files from package
  info('Copying hook files...');
  const hooksSource = path.join(REPO_DIR, 'hooks');
  for (const f of fs.readdirSync(hooksSource)) {
    const src = path.join(hooksSource, f);
    const dst = path.join(HOOKS_DST, f);
    fs.copyFileSync(src, dst);
    if (f.endsWith('.sh')) fs.chmodSync(dst, 0o755);
  }
  ok(`Hooks copied to ${HOOKS_DST}`);

  // Merge settings.json
  info('Merging settings.json...');
  sh(`node "${path.join(REPO_DIR, 'scripts', 'merge-settings.js')}"`, { silent: true });
  ok('settings.json updated');

  // Merge .claude.json (MCP servers)
  info('Merging MCP servers into .claude.json...');
  sh(`node "${path.join(REPO_DIR, 'scripts', 'merge-mcp.js')}"`, { silent: true });
  ok('.claude.json updated');

  // Append CLAUDE.md rules
  const claudeMd = path.join(HOME, '.claude', 'CLAUDE.md');
  const ruleSrc  = path.join(REPO_DIR, 'config', 'CLAUDE.md');
  let existing = '';
  try { existing = fs.readFileSync(claudeMd, 'utf8'); } catch { /* new file */ }
  if (!existing.includes('lean-ctx-rules')) {
    fs.appendFileSync(claudeMd, '\n' + fs.readFileSync(ruleSrc, 'utf8'));
    ok('CLAUDE.md updated');
  } else {
    ok('CLAUDE.md already has lean-ctx rules');
  }

  // Caveman config
  fs.mkdirSync(CAVEMAN_CFG_DIR, { recursive: true });
  fs.copyFileSync(
    path.join(REPO_DIR, 'config', 'caveman-config.json'),
    path.join(CAVEMAN_CFG_DIR, 'config.json')
  );

  // Initialise flag files
  for (const flag of ['lean-ctx', 'crg', 'sym', 'mem']) {
    fs.writeFileSync(path.join(HOME, '.claude', `.${flag}-active`), 'on');
  }
  ok('Flag files initialized');
}

// ── step 9 — launch (or finish) ───────────────────────────────────────────
function launchClaude() {
  step('9/9', 'Launching Claude Code');

  console.log('');
  animatedBanner();
  console.log('');
  console.log(`  ${C.bold}${C.green}Ready. Starting Claude Code with full optimization stack...${C.reset}`);
  console.log('');

  // Hand off to claude — replaces this process
  const passArgs = process.argv.slice(2).filter(a => a !== '--install' && a !== '--reinstall');
  const r = spawnSync('claude', passArgs, {
    stdio: 'inherit',
    env: { ...process.env, PATH: richPath() },
  });
  process.exit(r.status ?? 0);
}

// ── summary ────────────────────────────────────────────────────────────────
function printSummary() {
  console.log('');
  console.log(`${C.bold}${C.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`);
  console.log(`${C.bold}  Claude Code Op — Installation Complete${C.reset}`);
  console.log(`${C.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`);
  console.log('');
  console.log(`  ${C.bold}Active tools:${C.reset}`);
  console.log(`  ${C.orange}[CAVEMAN:ULTRA]${C.reset}  Terse speech — 65-75% output token savings`);
  console.log(`  ${C.green}[CTX:ON]${C.reset}        lean-ctx — up to 99% file read token savings`);
  console.log(`  ${C.cyan}[CRG:ON]${C.reset}        code-review-graph — 8.2× code analysis savings`);
  console.log(`  ${C.cyan}[SYM:ON]${C.reset}        symdex — 97% symbol lookup token savings`);
  console.log(`  ${C.cyan}[MEM:folder]${C.reset}    claude-mem — persistent cross-session memory`);
  console.log('');
  console.log(`  ${C.bold}Statusline (2 lines, live after every response):${C.reset}`);
  console.log(`  ${C.orange}[CAVEMAN:ULTRA]${C.reset} ${C.green}[CTX:ON]${C.reset} ${C.cyan}[CRG:ON]${C.reset} [SYM:ON] [MEM:project]`);
  console.log('  Model | Context% | 5h rate | 7d rate | $cost');
  console.log('');
  console.log(`  ${C.bold}Per-project scope (auto on every folder):${C.reset}`);
  console.log('  .code-review-graph/  — code knowledge graph');
  console.log('  .symdex/             — symbol index');
  console.log('  .claude-mem/         — session memory');
  console.log('');
  console.log(`  ${C.bold}Toggle commands (say these to Claude):${C.reset}`);
  console.log('  "caveman ultra" / "caveman lite" / "stop caveman"');
  console.log('  "ctx off" / "ctx on"');
  console.log('  "crg off" / "crg on" / "graph off"');
  console.log('  "sym off" / "sym on"');
  console.log('  "mem off" / "mem on"');
  console.log('');
  console.log(`  ${C.bold}${C.yellow}Restart Claude Code to activate all changes.${C.reset}`);
  console.log('');
}

// ── main ──────────────────────────────────────────────────────────────────
const INSTALLED_FLAG = path.join(HOME, '.claude', '.claude-code-op-installed');
const args           = process.argv.slice(2);
const forceInstall   = args.includes('--install') || args.includes('--reinstall');
const alreadyDone    = fs.existsSync(INSTALLED_FLAG) && !forceInstall;

if (alreadyDone) {
  // Already set up — just show banner and launch claude
  banner();
  launchClaude();
} else {
  // Fresh install (or --reinstall)
  banner();
  installClaudeCode();
  checkPrereqs();
  installUv();
  installBun();
  installLeanCtx();
  installPythonTools();
  installCaveman();
  installClaudeMem();
  installHooksAndConfig();
  // Mark as installed
  fs.writeFileSync(INSTALLED_FLAG, new Date().toISOString());
  printSummary();
  // Launch claude after install
  launchClaude();
}
