#!/usr/bin/env node
// UserPromptSubmit — toggle code-review-graph (CRG) and symdex (SYM) on/off.
// "crg off" / "graph off"  → disable CRG
// "sym off" / "symdex off" → disable SYM

const fs = require('fs'), path = require('path'), os = require('os');
const HOME     = os.homedir();
const CRG_FLAG = path.join(HOME, '.claude', '.crg-active');
const SYM_FLAG = path.join(HOME, '.claude', '.sym-active');
function writeFlag(p, val) { try { fs.writeFileSync(p, val); } catch(e) {} }

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  let prompt = '';
  try { prompt = (JSON.parse(input).prompt || '').toLowerCase(); } catch(e) { process.exit(0); }

  const CRG_OFF = [/disable (crg|code.review.graph|graph)/,/turn off (crg|code.review.graph|graph)/,/(crg|code.review.graph|graph) off/,/stop (crg|graph analysis)/];
  const CRG_ON  = [/enable (crg|code.review.graph|graph)/,/turn on (crg|code.review.graph|graph)/,/(crg|code.review.graph|graph) on/,/use (crg|code.review.graph|graph)/];
  const SYM_OFF = [/disable (sym|symdex|symbol index)/,/turn off (sym|symdex|symbol)/,/(sym|symdex) off/,/stop (sym|symdex)/];
  const SYM_ON  = [/enable (sym|symdex|symbol index)/,/turn on (sym|symdex|symbol)/,/(sym|symdex) on/,/use (sym|symdex)/];

  const msgs = [];
  if (CRG_OFF.some(p => p.test(prompt))) { writeFlag(CRG_FLAG,'off'); msgs.push('CODE-REVIEW-GRAPH DISABLED.'); }
  else if (CRG_ON.some(p => p.test(prompt))) { writeFlag(CRG_FLAG,'on'); msgs.push('CODE-REVIEW-GRAPH ENABLED.'); }
  if (SYM_OFF.some(p => p.test(prompt))) { writeFlag(SYM_FLAG,'off'); msgs.push('SYMDEX DISABLED.'); }
  else if (SYM_ON.some(p => p.test(prompt))) { writeFlag(SYM_FLAG,'on'); msgs.push('SYMDEX ENABLED.'); }
  if (msgs.length) process.stdout.write(msgs.join('\n'));
  process.exit(0);
});
