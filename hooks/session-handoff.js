#!/usr/bin/env node
// Stop hook — auto-generates .claude-state.md from recent claude-mem observations.
// Injected at next session start by project-init.js for seamless continuity.
// User can also say "save state" / "write handoff" → Claude writes richer version.

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const http = require('http');

const HOME    = os.homedir();
const cwd     = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const outFile = path.join(cwd, '.claude-state.md');

// Read port from claude-mem settings
let PORT = 37777;
try {
  const s = JSON.parse(fs.readFileSync(path.join(HOME, '.claude-mem', 'settings.json'), 'utf8'));
  if (s.CLAUDE_MEM_WORKER_PORT) PORT = parseInt(s.CLAUDE_MEM_WORKER_PORT, 10);
} catch {}

function get(url) {
  return new Promise((res) => {
    const req = http.get(url, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => { try { res(JSON.parse(d)); } catch { res(null); } });
    });
    req.on('error', () => res(null));
    req.setTimeout(3000, () => { req.destroy(); res(null); });
  });
}

async function main() {
  // Only overwrite if no next-steps section was manually written
  // (preserve human-written state)
  if (fs.existsSync(outFile)) {
    try {
      const existing = fs.readFileSync(outFile, 'utf8');
      if (existing.includes('## Next steps') && !existing.includes('_Fill in')) {
        // User already wrote next steps — don't overwrite
        process.exit(0);
      }
    } catch {}
  }

  const data = await get(`http://127.0.0.1:${PORT}/api/observations?limit=20`);
  const date = new Date().toISOString().slice(0, 10);
  const proj = path.basename(cwd);

  const lines = [
    `# Session State — ${date}`,
    `> Auto-generated. Edit freely — injected at next session start (~200 tokens).`,
    `> Say **"save state"** to have Claude write richer context + next steps.`,
    '',
    `## Project`,
    proj,
    '',
  ];

  if (data && data.items && data.items.length > 0) {
    const items = data.items.slice(0, 12);

    // Dedupe and extract files from observations
    const files = [...new Set(
      items
        .flatMap(o => {
          const paths = [];
          if (o.file_path) paths.push(o.file_path);
          if (o.tool_input) {
            try {
              const inp = typeof o.tool_input === 'string' ? JSON.parse(o.tool_input) : o.tool_input;
              if (inp.file_path) paths.push(inp.file_path);
              if (inp.path) paths.push(inp.path);
            } catch {}
          }
          return paths;
        })
        .map(f => {
          try { return path.relative(cwd, f); } catch { return f; }
        })
        .filter(f => f && !f.startsWith('..') && f.length < 80)
    )].slice(0, 8);

    // Build work summary from observation titles/summaries
    const workItems = items
      .map(o => o.title || o.summary || o.content || '')
      .filter(Boolean)
      .slice(0, 10);

    if (workItems.length) {
      lines.push('## Last session work');
      for (const w of workItems) {
        const clean = w.replace(/\n/g, ' ').slice(0, 120);
        lines.push(`- ${clean}`);
      }
      lines.push('');
    }

    if (files.length) {
      lines.push('## Active files');
      for (const f of files) lines.push(`- \`${f}\``);
      lines.push('');
    }
  } else {
    lines.push('## Last session work');
    lines.push('_No observations recorded — say "save state" next time for full context._');
    lines.push('');
  }

  lines.push('## Next steps');
  lines.push('_Fill in before ending session, or say "save state" to have Claude write this._');
  lines.push('');
  lines.push('## Key context');
  lines.push('_Decisions, gotchas, and context for next session._');

  try {
    fs.writeFileSync(outFile, lines.join('\n'));
    process.stdout.write(`✓ Session state saved → ${path.relative(HOME, outFile)}`);
  } catch { /* silent */ }

  process.exit(0);
}

main();
