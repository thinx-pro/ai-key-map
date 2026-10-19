#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { scan, group } from '../src/scan.js';
import { text, markdown, summarize } from '../src/report.js';
import { PROVIDERS } from '../src/providers.js';

const VERSION = '0.1.0';
const HELP = `ai-key-map ${VERSION}
Where do your AI provider keys live on this machine? Read-only, offline, keys never printed.
Groups copies of the same key (by SHA-256 fingerprint) and prints a rotation checklist.

Usage
  npx github:thinx-pro/ai-key-map [options]

Options
  --dir PATH        Also scan a project tree for .env / config / mcp.json files (repeatable)
  --home PATH       Home directory to scan (default: your home)
  --no-env          Skip the current environment variables
  --no-history      Skip shell / REPL history files
  --json            JSON output (masked keys + fingerprints only)
  --md FILE         Also write a Markdown report
  --fail-on-find    Exit 1 if any key is found (for CI / pre-commit on a project tree)
  --providers       List supported providers and exit
  -h, --help        Show help
  -v, --version     Show version

What is scanned
  shell rc files, shell/REPL history, ~/.env, configs of Claude Code, Codex, OpenCode, aider,
  Continue, Cursor MCP, Gemini CLI, Goose, Crush, aichat, fabric, Zed, VS Code, Claude Desktop,
  the llm CLI, plus the current process environment. Nothing is sent anywhere.
`;

function parse(argv) {
  const o = { dirs: [], home: homedir(), env: true, history: true, json: false, md: '', failOnFind: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      return argv[++i];
    };
    switch (a) {
      case '-h': case '--help': o.help = true; break;
      case '-v': case '--version': o.version = true; break;
      case '--dir': o.dirs.push(resolve(val())); break;
      case '--home': o.home = resolve(val()); break;
      case '--no-env': o.env = false; break;
      case '--no-history': o.history = false; break;
      case '--json': o.json = true; break;
      case '--md': o.md = val(); break;
      case '--fail-on-find': o.failOnFind = true; break;
      case '--providers': o.providers = true; break;
      default: throw new Error(`unknown option: ${a} (see --help)`);
    }
  }
  return o;
}

let o;
try {
  o = parse(process.argv.slice(2));
} catch (e) {
  console.error(`ai-key-map: ${e.message}`);
  process.exit(2);
}
if (o.help) { process.stdout.write(HELP); process.exit(0); }
if (o.version) { console.log(VERSION); process.exit(0); }
if (o.providers) {
  for (const p of PROVIDERS) {
    const how = p.patterns.length ? p.patterns.map((x) => x.kind).join(', ') : `by variable: ${p.envNames.join(', ')}`;
    console.log(`${p.name.padEnd(28)} ${how}`);
  }
  process.exit(0);
}

const { findings, scanned } = scan({ home: o.home, dirs: o.dirs, includeEnv: o.env, includeHistory: o.history });
const keys = group(findings);
if (o.json) {
  console.log(JSON.stringify({ tool: 'ai-key-map', version: VERSION, summary: summarize(keys), scanned, keys }, null, 2));
} else {
  process.stdout.write(text(keys, { scannedCount: scanned.length, home: o.home === homedir() ? '~' : o.home, env: o.env }));
}
if (o.md) writeFileSync(o.md, markdown(keys, { scannedCount: scanned.length }));
process.exitCode = o.failOnFind && keys.length ? 1 : 0;
