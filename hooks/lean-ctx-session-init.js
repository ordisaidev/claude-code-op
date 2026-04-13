#!/usr/bin/env node
// SessionStart — reset lean-ctx to ON every new session.
const fs = require('fs'), path = require('path'), os = require('os');
const flagPath = path.join(os.homedir(), '.claude', '.lean-ctx-active');
try { fs.writeFileSync(flagPath, 'on'); } catch(e) {}
process.stdout.write('OK');
