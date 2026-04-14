#!/usr/bin/env node
// Claude Code Op — combined statusline
// Line 1: [CAVEMAN:ULTRA] [CTX:ON] [CRG:ON] [SYM:ON] [MEM:folder]  [⚠ LIMIT 5h:72% → ULTRA]
// Line 2: Model | context bar | 5h rate | 7d rate | $cost
// Auto-switches caveman to ultra when any rate limit >= 60%.

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const HOME = os.homedir();

function flag(p)  { try { return fs.readFileSync(p, 'utf8').trim(); } catch(e) { return 'on'; } }
function badge(label, state, onColor, offColor) {
  return state === 'off'
    ? `\x1b[38;5;${offColor}m[${label}:OFF]\x1b[0m`
    : `\x1b[38;5;${onColor}m[${label}:ON]\x1b[0m`;
}

let raw = '';
process.stdin.on('data', d => raw += d);
process.stdin.on('end', () => {
  let data = {};
  try { data = JSON.parse(raw); } catch(e) {}

  const cwd    = (data.workspace && data.workspace.current_dir) || data.cwd || '';
  const folder = path.basename(cwd) || '';
  const model  = (data.model && data.model.display_name) || '';

  // Context window bar
  const pct      = Math.floor((data.context_window && data.context_window.used_percentage) || 0);
  const BAR_W    = 8;
  const filled   = Math.floor(pct * BAR_W / 100);
  const barColor = pct >= 90 ? 31 : pct >= 70 ? 33 : 32;
  const bar      = `\x1b[${barColor}m${'█'.repeat(filled)}${'░'.repeat(BAR_W - filled)}\x1b[0m`;

  // Rate limits (Pro/Max only)
  const rl     = data.rate_limits || {};
  const fiveH  = rl.five_hour  && rl.five_hour.used_percentage  != null ? Math.round(rl.five_hour.used_percentage)  : null;
  const sevenD = rl.seven_day  && rl.seven_day.used_percentage  != null ? Math.round(rl.seven_day.used_percentage)  : null;

  // ── Auto-caveman ultra at 60% rate limit ─────────────────────────────
  const cavemanFlagPath = path.join(HOME, '.claude', '.caveman-active');
  const currentCavemanMode = flag(cavemanFlagPath);
  const rateLimitHigh = (fiveH !== null && fiveH >= 60) || (sevenD !== null && sevenD >= 60);
  let autoUltra = false;
  if (rateLimitHigh && currentCavemanMode !== 'ultra' && currentCavemanMode !== 'off') {
    try { fs.writeFileSync(cavemanFlagPath, 'ultra'); } catch {}
    autoUltra = true;
  }

  // Session cost
  const cost    = (data.cost && data.cost.total_cost_usd) || 0;
  const costStr = cost > 0 ? `\x1b[33m$${cost.toFixed(3)}\x1b[0m` : '';

  // ── Line 1: badges ────────────────────────────────────────────────────
  const parts1 = [];

  // Caveman badge
  const effectiveMode = autoUltra ? 'ultra' : (currentCavemanMode || 'ultra');
  if (effectiveMode !== 'off') {
    const label = `CAVEMAN:${effectiveMode.toUpperCase()}`;
    parts1.push(`\x1b[38;5;172m[${label}]\x1b[0m`);
  }

  parts1.push(badge('CTX', flag(path.join(HOME, '.claude', '.lean-ctx-active')), 35, 240));
  parts1.push(badge('CRG', flag(path.join(HOME, '.claude', '.crg-active')),      33, 240));
  parts1.push(badge('SYM', flag(path.join(HOME, '.claude', '.sym-active')),     135, 240));

  const memState = flag(path.join(HOME, '.claude', '.mem-active'));
  parts1.push(
    memState === 'off'
      ? '\x1b[38;5;240m[MEM:OFF]\x1b[0m'
      : `\x1b[38;5;205m[MEM:${folder || 'ON'}]\x1b[0m`
  );

  // Warn when auto-ultra triggered
  if (autoUltra) {
    const which = fiveH >= 60 ? `5h:${fiveH}%` : `7d:${sevenD}%`;
    parts1.push(`\x1b[1;31m[⚠ LIMIT ${which} → ULTRA]\x1b[0m`);
  }

  process.stdout.write(parts1.join(' ') + '\n');

  // ── Line 2: model | context | limits | cost ───────────────────────────
  const parts2 = [];
  if (model)           parts2.push(`\x1b[36m${model}\x1b[0m`);
  if (pct > 0)         parts2.push(`${bar} ${pct}%`);
  if (fiveH  !== null) parts2.push(`5h:${fiveH >= 60 ? '\x1b[31m' : ''}${fiveH}%\x1b[0m`);
  if (sevenD !== null) parts2.push(`7d:${sevenD >= 60 ? '\x1b[31m' : ''}${sevenD}%\x1b[0m`);
  if (costStr)         parts2.push(costStr);
  if (parts2.length)   process.stdout.write(parts2.join(' | '));
});
