#!/usr/bin/env node
// UserPromptSubmit — toggle claude-mem on/off.
// "mem off" / "memory off" → pause memory capture
// "mem on"  / "memory on"  → resume memory capture

const fs = require('fs'), path = require('path'), os = require('os');
const FLAG = path.join(os.homedir(), '.claude', '.mem-active');
function writeFlag(v) { try { fs.writeFileSync(FLAG, v); } catch(e) {} }

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  let prompt = '';
  try { prompt = (JSON.parse(input).prompt || '').toLowerCase(); } catch(e) { process.exit(0); }
  const OFF = [/disable mem(ory)?/,/mem(ory)? off/,/turn off mem/,/stop mem/];
  const ON  = [/enable mem(ory)?/,/mem(ory)? on/,/turn on mem/,/use mem/];
  if (OFF.some(p => p.test(prompt))) { writeFlag('off'); process.stdout.write('CLAUDE-MEM DISABLED: Memory capture paused.'); }
  else if (ON.some(p => p.test(prompt))) { writeFlag('on'); process.stdout.write('CLAUDE-MEM ENABLED: Memory capture active.'); }
  process.exit(0);
});
