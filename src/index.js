#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
//  Claude Code Op — Node.js installer
//  Developed by Ordis AI · github.com/ordisaidev/claude-code-op
//  Run via:  npx claude-code-op
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const fs            = require('fs');
const path          = require('path');
const os            = require('os');
const { execSync, spawnSync } = require('child_process');

const HOME     = os.homedir();
const REPO_DIR = path.resolve(__dirname, '..');
const HOOKS_DST       = path.join(HOME, '.claude', 'hooks');
const SETTINGS        = path.join(HOME, '.claude', 'settings.json');
const CLAUDE_JSON     = path.join(HOME, '.claude.json');
const CAVEMAN_CFG_DIR = path.join(HOME, '.config', 'caveman');
const PLUGIN_DST      = path.join(HOME, '.claude', 'plugins', 'marketplaces', 'thedotmack');
const WIN             = process.platform === 'win32';
const MAC             = process.platform === 'darwin';

// ── colour helpers ─────────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m', bold: '\x1b[1m', red: '\x1b[0;31m',
  green:  '\x1b[0;32m', yellow: '\x1b[1;33m', cyan: '\x1b[0;36m',
  orange: '\x1b[38;5;172m',
};
const ok   = m => console.log(`  ${C.green}✓${C.reset} ${m}`);
const info = m => console.log(`  ${C.cyan}→${C.reset} ${m}`);
const warn = m => console.log(`  ${C.yellow}!${C.reset} ${m}`);
const fail = m => console.log(`  ${C.red}✗${C.reset} ${m}`);
const step = (n, m) => console.log(`\n${C.bold}[${n}]${C.reset} ${m}`);

// ── cross-platform PATH ────────────────────────────────────────────────────
function richPath() {
  const extra = [
    path.join(HOME, '.bun',   'bin'),
    path.join(HOME, '.local', 'bin'),
    path.join(HOME, '.cargo', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
  ];
  if (WIN) {
    extra.push(
      path.join(HOME, 'AppData', 'Local', 'Programs', 'bun'),
      path.join(HOME, 'AppData', 'Roaming', 'uv', 'bin'),
      path.join(HOME, '.local', 'bin'),
      'C:\\Program Files\\bun',
    );
  }
  const sep = WIN ? ';' : ':';
  return [...extra, process.env.PATH || ''].join(sep);
}

function sh(cmd, opts = {}) {
  return execSync(cmd, {
    encoding: 'utf8',
    env: { ...process.env, PATH: richPath() },
    stdio: opts.silent ? 'pipe' : 'inherit',
    shell: WIN ? 'cmd.exe' : '/bin/bash',
    ...opts,
  });
}

// Run a PowerShell command (Windows only)
function ps(cmd, opts = {}) {
  return execSync(`powershell -ExecutionPolicy ByPass -NoProfile -Command "${cmd.replace(/"/g, '\\"')}"`, {
    encoding: 'utf8',
    env: { ...process.env, PATH: richPath() },
    stdio: opts.silent ? 'pipe' : 'inherit',
    ...opts,
  });
}

// Cross-platform binary check
function has(bin) {
  try {
    if (WIN) {
      execSync(`where ${bin}`, { stdio: 'pipe', env: { ...process.env, PATH: richPath() } });
    } else {
      execSync(`command -v ${bin}`, { stdio: 'pipe', shell: '/bin/bash', env: { ...process.env, PATH: richPath() } });
    }
    return true;
  } catch { return false; }
}

// Pure-Node recursive file finder (replaces `find`)
function findFile(dir, name) {
  if (!fs.existsSync(dir)) return null;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { const r = findFile(full, name); if (r) return r; }
    else if (entry.name === name) return full;
  }
  return null;
}

// Pure-Node recursive copy (replaces `cp -r`)
function cpR(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name), d = path.join(dst, entry.name);
    entry.isDirectory() ? cpR(s, d) : fs.copyFileSync(s, d);
  }
}

// ── interactive Y/N prompt (synchronous, works on all platforms) ───────────
function ask(question, defaultYes = true) {
  const hint = defaultYes ? '[Y/n]' : '[y/N]';
  process.stdout.write(`  ${C.yellow}?${C.reset} ${question} ${hint} `);
  // Read one line from stdin synchronously
  if (!process.stdin.isTTY) {
    // Non-interactive (piped) — default to yes
    process.stdout.write('y\n');
    return true;
  }
  try {
    const buf = Buffer.alloc(256);
    const n   = fs.readSync(process.stdin.fd, buf, 0, buf.length);
    const ans = buf.slice(0, n).toString().trim().toLowerCase();
    if (ans === '' ) return defaultYes;
    return ans === 'y' || ans === 'yes';
  } catch {
    return defaultYes;
  }
}

// ── sleep ──────────────────────────────────────────────────────────────────
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// ── animated welcome box ───────────────────────────────────────────────────
function animatedBanner() {
  const frames = [
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

  const COL = 34;
  function buildFrame(smoke) {
    const W = 66, pad = n => ' '.repeat(Math.max(0, n));
    function vlen(s) { return s.replace(/\x1b\[[0-9;]*m/g, '').length; }
    function rpad(s, w) { return s + pad(Math.max(0, w - vlen(s))); }
    const L = inner => `│ ${rpad(inner, W)} │`;
    return [
      `╭─── Claude Code Op ────────────────────────────────────────────────╮`,
      L(''),
      ...smoke.map(s => L(`${pad(COL)}${C.cyan}${s}${C.reset}`)),
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
  const canAnimate = process.stdout.isTTY && (
    !WIN || process.env.WT_SESSION || process.env.TERM_PROGRAM === 'vscode'
  );

  if (!canAnimate) {
    for (const l of buildFrame(frames[4])) process.stdout.write(l + '\n');
    return;
  }
  for (const l of buildFrame(frames[0])) process.stdout.write(l + '\n');
  for (const smoke of frames.slice(1)) {
    sleep(120);
    process.stdout.write(`\x1b[${NLINES}A`);
    for (const l of buildFrame(smoke)) process.stdout.write(`\x1b[2K${l}\n`);
  }
}

function banner() { console.log(''); animatedBanner(); console.log(''); }

// ── step 0 — Claude Code ───────────────────────────────────────────────────
function installClaudeCode() {
  step('0/9', 'Claude Code (the AI coding CLI)');
  if (has('claude')) { ok('Claude Code already installed'); return; }

  warn('claude not found.');
  if (!ask('Install Claude Code now?')) {
    warn('Skipping — install manually: https://claude.ai/download');
    return;
  }
  info('Installing Claude Code...');
  try {
    if (WIN) ps('iwr https://claude.ai/install.ps1 -useb | iex');
    else     sh('curl -fsSL https://claude.ai/install.sh | bash');
    ok('Claude Code installed. First run opens browser for login.');
  } catch {
    fail('Install failed. Try manually:');
    if (WIN) fail('  PowerShell: iwr https://claude.ai/install.ps1 -useb | iex');
    else     fail('  macOS/Linux: curl -fsSL https://claude.ai/install.sh | bash');
    if (MAC) fail('  Homebrew:   brew install --cask claude-code');
  }
}

// ── step 1 — prerequisites ─────────────────────────────────────────────────
function checkPrereqs() {
  step('1/9', 'Checking prerequisites');

  const major = parseInt(process.version.slice(1).split('.')[0], 10);
  if (major >= 18) ok(`Node.js ${process.version}`);
  else { fail(`Node.js 18+ required (found ${process.version}). Install from https://nodejs.org`); process.exit(1); }

  if (has('npm')) ok(`npm ${sh('npm --version', { silent: true }).trim()}`);
  else { fail('npm not found — install Node.js from https://nodejs.org'); process.exit(1); }

  if (!WIN) {
    if (has('curl')) ok('curl');
    else { fail('curl not found — install via package manager'); process.exit(1); }
  }

  if (has('claude')) ok('claude CLI in PATH');
  else warn('claude CLI not in PATH yet — Caveman plugin install will be skipped');

  fs.mkdirSync(path.join(HOME, '.claude', 'hooks'), { recursive: true });
  fs.mkdirSync(path.join(HOME, '.claude', 'plugins', 'marketplaces'), { recursive: true });
}

// ── step 2 — uv ───────────────────────────────────────────────────────────
function installUv() {
  step('2/9', 'uv — Python tool manager (needed for CRG + symdex)');
  if (has('uv')) { ok(`uv ${sh('uv --version', { silent: true }).trim().split('\n')[0]}`); return; }

  warn('uv not found.');
  if (!ask('Install uv now?')) { warn('Skipping — code-review-graph and symdex will not install.'); return; }
  info('Installing uv...');
  try {
    if (WIN) ps('irm https://astral.sh/uv/install.ps1 | iex');
    else     sh('curl -LsSf https://astral.sh/uv/install.sh | sh');
    ok('uv installed');
  } catch { warn('uv install failed — run manually: https://docs.astral.sh/uv/getting-started/installation/'); }
}

// ── step 3 — bun ──────────────────────────────────────────────────────────
function installBun() {
  step('3/9', 'Bun — JS runtime (needed for claude-mem memory worker)');
  if (has('bun')) { ok(`bun ${sh('bun --version', { silent: true }).trim()}`); return; }

  warn('bun not found.');
  if (!ask('Install Bun now?')) { warn('Skipping — claude-mem memory worker will not run.'); return; }
  info('Installing Bun...');
  try {
    if (WIN) ps('irm bun.sh/install | iex');
    else     sh('curl -fsSL https://bun.sh/install | bash');
    ok('Bun installed');
  } catch { warn('Bun install failed — run manually: https://bun.sh'); }
}

// ── step 4 — lean-ctx ─────────────────────────────────────────────────────
function installLeanCtx() {
  step('4/9', 'lean-ctx — compresses file reads + shell output (up to 99% savings)');
  if (!has('lean-ctx')) {
    warn('lean-ctx not found.');
    if (!ask('Install lean-ctx now?')) { warn('Skipping — file/shell compression disabled.'); return; }
    info('Installing lean-ctx...');
    try {
      if (WIN) {
        if (has('cargo')) {
          sh('cargo install lean-ctx-bin');
          ok('lean-ctx installed via cargo');
        } else {
          warn('lean-ctx on Windows requires Rust (cargo).');
          if (ask('Install Rust (rustup) first?')) {
            ps('irm https://win.rustup.rs -useb | iex');
            sh('cargo install lean-ctx-bin');
            ok('lean-ctx installed');
          } else {
            warn('Skipping lean-ctx.');
            return;
          }
        }
      } else {
        sh('curl -fsSL https://leanctx.com/install.sh | sh');
        ok('lean-ctx installed');
      }
    } catch { warn('lean-ctx install failed — skipping'); return; }
  } else {
    ok('lean-ctx already installed');
  }

  info('Configuring lean-ctx...');
  try {
    execSync(WIN ? 'lean-ctx setup --skip-confirm' : 'echo "n" | lean-ctx setup', {
      encoding: 'utf8', env: { ...process.env, PATH: richPath() },
      shell: WIN ? 'cmd.exe' : '/bin/bash', stdio: 'pipe',
    });
  } catch {
    try { sh('lean-ctx setup --skip-confirm', { silent: true }); } catch { /* ok */ }
  }
  ok('lean-ctx configured');
}

// ── step 5 — code-review-graph + symdex ───────────────────────────────────
function installPythonTools() {
  step('5/9', 'code-review-graph + symdex — codebase knowledge graph + symbol index');
  if (!has('uv')) { warn('uv not found — skipping (install uv first)'); return; }

  if (has('code-review-graph')) {
    ok('code-review-graph already installed');
  } else {
    warn('code-review-graph not found.');
    if (ask('Install code-review-graph? (8.2× token savings on code analysis)')) {
      info('Installing code-review-graph...');
      try { sh('uv tool install code-review-graph --python 3.11'); ok('code-review-graph installed'); }
      catch { warn('code-review-graph install failed'); }
    } else { warn('Skipping code-review-graph.'); }
  }

  if (has('symdex')) {
    ok('symdex already installed');
  } else {
    warn('symdex not found.');
    if (ask('Install symdex? (97% token savings on symbol lookups)')) {
      info('Installing symdex...');
      try { sh('uv tool install symdex --python 3.11'); ok('symdex installed'); }
      catch { warn('symdex install failed'); }
    } else { warn('Skipping symdex.'); }
  }
}

// ── step 6 — caveman ──────────────────────────────────────────────────────
function installCaveman() {
  step('6/9', 'Caveman — compresses Claude\'s output (65-75% fewer output tokens)');
  let alreadyInstalled = false;
  try {
    const list = sh('claude plugin list', { silent: true });
    if (list.includes('caveman')) alreadyInstalled = true;
  } catch { /* ignore */ }

  if (alreadyInstalled) {
    ok('Caveman already installed');
  } else if (!has('claude')) {
    warn('claude CLI not found — cannot install Caveman plugin.');
    warn('  After installing Claude Code, run:');
    warn('  claude plugin marketplace add JuliusBrussee/caveman');
    warn('  claude plugin install caveman@caveman');
  } else {
    warn('Caveman plugin not found.');
    if (ask('Install Caveman now?')) {
      try { sh('claude plugin marketplace add JuliusBrussee/caveman', { silent: true }); } catch { /* ok */ }
      try { sh('claude plugin install caveman@caveman', { silent: true }); ok('Caveman installed'); }
      catch { warn('Install failed — run manually: claude plugin install caveman@caveman'); }
    } else { warn('Skipping Caveman.'); }
  }

  fs.mkdirSync(CAVEMAN_CFG_DIR, { recursive: true });
  fs.writeFileSync(path.join(CAVEMAN_CFG_DIR, 'config.json'), JSON.stringify({ defaultMode: 'ultra' }));
  fs.writeFileSync(path.join(HOME, '.claude', '.caveman-active'), 'ultra');
  ok('Caveman → ultra mode');
}

// ── step 7 — claude-mem ───────────────────────────────────────────────────
function installClaudeMem() {
  step('7/9', 'claude-mem — persistent memory across sessions');
  const mcpServer = path.join(PLUGIN_DST, 'plugin', 'scripts', 'mcp-server.cjs');
  if (fs.existsSync(mcpServer)) { ok('claude-mem already present'); return; }

  warn('claude-mem not found.');
  if (!ask('Install claude-mem now?')) { warn('Skipping — cross-session memory disabled.'); return; }
  info('Downloading claude-mem...');
  const tmpDir = path.join(os.tmpdir(), 'claude-mem-install');
  try { sh(`npm install --prefix "${tmpDir}" claude-mem`, { silent: true }); } catch { /* may already be cached */ }

  // Pure-Node search for mcp-server.cjs
  const searchRoots = [path.join(HOME, '.npm', '_npx'), tmpDir];
  let found = null;
  for (const root of searchRoots) { found = findFile(root, 'mcp-server.cjs'); if (found) break; }

  if (found) {
    const pluginSrc = path.dirname(path.dirname(found));
    fs.mkdirSync(PLUGIN_DST, { recursive: true });
    cpR(pluginSrc, path.join(PLUGIN_DST, 'plugin'));
    ok('claude-mem installed');
  } else {
    warn('Auto-install failed. Trying: npx claude-mem install');
    try { sh('npx claude-mem install', { silent: true }); ok('claude-mem installed via npx'); }
    catch { warn('claude-mem install failed — run: npx claude-mem install'); }
  }

  fs.writeFileSync(path.join(HOME, '.claude', '.mem-active'), 'on');
  fs.mkdirSync(path.join(HOME, '.claude-mem-default'), { recursive: true });
}

// ── step 8 — hooks, config, MCP ───────────────────────────────────────────
function installHooksAndConfig() {
  step('8/9', 'Hooks, statusline, and MCP servers — wires everything into Claude Code');

  if (!ask('Install hooks and MCP config into ~/.claude/?')) {
    warn('Skipping — statusline and toggles will not work.');
    return;
  }
  info('Copying hook files...');
  const hooksSource = path.join(REPO_DIR, 'hooks');
  for (const f of fs.readdirSync(hooksSource)) {
    const src = path.join(hooksSource, f);
    const dst = path.join(HOOKS_DST, f);
    fs.copyFileSync(src, dst);
    if (!WIN && f.endsWith('.sh')) fs.chmodSync(dst, 0o755);
  }
  ok(`Hooks → ${HOOKS_DST}`);

  info('Merging settings.json...');
  sh(`node "${path.join(REPO_DIR, 'scripts', 'merge-settings.js')}"`, { silent: true });
  ok('settings.json updated');

  info('Merging MCP servers...');
  sh(`node "${path.join(REPO_DIR, 'scripts', 'merge-mcp.js')}"`, { silent: true });
  ok('.claude.json updated');

  const claudeMd = path.join(HOME, '.claude', 'CLAUDE.md');
  const ruleSrc  = path.join(REPO_DIR, 'config', 'CLAUDE.md');
  let existing = '';
  try { existing = fs.readFileSync(claudeMd, 'utf8'); } catch { /* new */ }
  if (!existing.includes('lean-ctx-rules')) {
    fs.appendFileSync(claudeMd, '\n' + fs.readFileSync(ruleSrc, 'utf8'));
    ok('CLAUDE.md updated');
  } else {
    ok('CLAUDE.md already up-to-date');
  }

  fs.mkdirSync(CAVEMAN_CFG_DIR, { recursive: true });
  fs.copyFileSync(path.join(REPO_DIR, 'config', 'caveman-config.json'), path.join(CAVEMAN_CFG_DIR, 'config.json'));

  for (const flag of ['lean-ctx', 'crg', 'sym', 'mem']) {
    fs.writeFileSync(path.join(HOME, '.claude', `.${flag}-active`), 'on');
  }
  ok('Flag files initialized');
}

// ── step 9 — launch ───────────────────────────────────────────────────────
function launchClaude() {
  step('9/9', 'Launching Claude Code');
  console.log('');
  animatedBanner();
  console.log('');
  console.log(`  ${C.bold}${C.green}Ready. Starting Claude Code...${C.reset}`);
  console.log('');

  const passArgs = process.argv.slice(2).filter(a => a !== '--install' && a !== '--reinstall');
  const r = spawnSync('claude', passArgs, {
    stdio: 'inherit',
    env: { ...process.env, PATH: richPath() },
    shell: WIN,
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
  console.log(`  ${C.orange}[CAVEMAN:ULTRA]${C.reset}  65-75% output token savings`);
  console.log(`  ${C.green}[CTX:ON]${C.reset}        up to 99% file read token savings`);
  console.log(`  ${C.cyan}[CRG:ON]${C.reset}        8.2× code analysis savings`);
  console.log(`  ${C.cyan}[SYM:ON]${C.reset}        97% symbol lookup savings`);
  console.log(`  ${C.cyan}[MEM:folder]${C.reset}    persistent cross-session memory`);
  console.log('');
  console.log(`  ${C.bold}Toggle mid-session:${C.reset}`);
  console.log('  "caveman ultra/lite/off"  "ctx off/on"  "crg off/on"  "mem off/on"');
  console.log('');
  console.log(`  ${C.bold}${C.yellow}Restart Claude Code to activate.${C.reset}`);
  console.log('');
}

// ── main ──────────────────────────────────────────────────────────────────
const INSTALLED_FLAG = path.join(HOME, '.claude', '.claude-code-op-installed');
const args           = process.argv.slice(2);
const forceInstall   = args.includes('--install') || args.includes('--reinstall');
const alreadyDone    = fs.existsSync(INSTALLED_FLAG) && !forceInstall;

if (alreadyDone) {
  banner();
  launchClaude();
} else {
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
  fs.writeFileSync(INSTALLED_FLAG, new Date().toISOString());
  printSummary();
  launchClaude();
}
