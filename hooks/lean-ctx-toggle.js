#!/usr/bin/env node
// UserPromptSubmit — toggle lean-ctx file compression on/off.
// "ctx off" / "use normal file read" → disables ctx_read rules
// "ctx on"  / "use lean-ctx"        → re-enables

const fs = require('fs'), path = require('path'), os = require('os');
const flagPath = path.join(os.homedir(), '.claude', '.lean-ctx-active');

function writeFlag(val) { try { fs.writeFileSync(flagPath, val); } catch(e) {} }

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  let prompt = '';
  try { prompt = (JSON.parse(input).prompt || '').toLowerCase(); } catch(e) { process.exit(0); }

  const OFF = [/use normal file read/,/normal file read/,/disable (lean.?ctx|ctx)/,/turn off (lean.?ctx|ctx)/,/stop (lean.?ctx|ctx)/,/use native read/,/lean.?ctx off/,/ctx off/];
  const ON  = [/use lean.?ctx/,/enable (lean.?ctx|ctx)/,/turn on (lean.?ctx|ctx)/,/lean.?ctx on/,/ctx on/,/use ctx/];

  if (OFF.some(p => p.test(prompt))) {
    writeFlag('off');
    process.stdout.write('LEAN_CTX DISABLED: Use native Read/Grep/Glob. Ignore ctx_read rules until re-enabled.');
  } else if (ON.some(p => p.test(prompt))) {
    writeFlag('on');
    process.stdout.write('LEAN_CTX ENABLED: Use ctx_read, ctx_search, ctx_tree per CLAUDE.md rules.');
  }
  process.exit(0);
});
