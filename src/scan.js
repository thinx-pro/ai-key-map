// Read-only, offline scan. Never returns a full key: only a masked form and a
// short SHA-256 fingerprint so copies of the same key can be grouped.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep, basename } from 'node:path';
import { PROVIDERS, BY_ID, KNOWN_NAMES, providerForName, isPlaceholder, mask } from './providers.js';

export const fingerprint = (key) => createHash('sha256').update(key).digest('hex').slice(0, 12);

// Files under $HOME where AI keys usually end up. [relative path, category, label]
export const HOME_FILES = [
  ['.zshrc', 'shell', 'zsh rc'], ['.zshenv', 'shell', 'zsh env'], ['.zprofile', 'shell', 'zsh profile'],
  ['.bashrc', 'shell', 'bash rc'], ['.bash_profile', 'shell', 'bash profile'], ['.profile', 'shell', 'profile'],
  ['.config/fish/config.fish', 'shell', 'fish config'],
  ['.zsh_history', 'history', 'zsh history'], ['.bash_history', 'history', 'bash history'],
  ['.local/share/fish/fish_history', 'history', 'fish history'], ['.python_history', 'history', 'python history'],
  ['.node_repl_history', 'history', 'node REPL history'],
  ['.env', 'dotenv', '~/.env'], ['.env.local', 'dotenv', '~/.env.local'],
  ['.claude.json', 'agent', 'Claude Code'], ['.claude/settings.json', 'agent', 'Claude Code settings'],
  ['.claude/settings.local.json', 'agent', 'Claude Code local settings'],
  ['.codex/auth.json', 'agent', 'Codex auth'], ['.codex/config.toml', 'agent', 'Codex config'],
  ['.config/opencode/opencode.json', 'agent', 'OpenCode config'], ['.local/share/opencode/auth.json', 'agent', 'OpenCode auth'],
  ['.aider.conf.yml', 'agent', 'aider config'], ['.continue/config.json', 'agent', 'Continue'], ['.continue/config.yaml', 'agent', 'Continue'],
  ['.continue/.env', 'agent', 'Continue env'],
  ['.cursor/mcp.json', 'mcp', 'Cursor MCP'], ['.gemini/settings.json', 'agent', 'Gemini CLI'], ['.gemini/.env', 'agent', 'Gemini CLI env'],
  ['.config/goose/config.yaml', 'agent', 'Goose'], ['.config/crush/crush.json', 'agent', 'Crush'],
  ['.config/aichat/config.yaml', 'agent', 'aichat'], ['.config/fabric/.env', 'agent', 'fabric'],
  ['.config/zed/settings.json', 'editor', 'Zed settings'],
  ['Library/Application Support/Code/User/settings.json', 'editor', 'VS Code settings'],
  ['.config/Code/User/settings.json', 'editor', 'VS Code settings'],
  ['Library/Application Support/Claude/claude_desktop_config.json', 'mcp', 'Claude Desktop MCP'],
  ['.config/Claude/claude_desktop_config.json', 'mcp', 'Claude Desktop MCP'],
  ['Library/Application Support/io.datasette.llm/keys.json', 'agent', 'llm CLI keys'],
  ['.config/io.datasette.llm/keys.json', 'agent', 'llm CLI keys'],
  ['.npmrc', 'other', 'npmrc'], ['.netrc', 'other', 'netrc'],
];

const PROJECT_FILE = /(^\.env(\..+)?$|\.env$|^\.?mcp\.json$|^(settings|config|secrets?|credentials)(\.[\w-]+)?\.(json|ya?ml|toml|ini)$|^docker-compose.*\.ya?ml$|^\.envrc$)/i;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.venv', 'venv', '__pycache__', 'target', '.cache', 'vendor', '.turbo']);
const SYNCED = /(\/Dropbox\/|\/Library\/Mobile Documents\/|\/iCloud Drive\/|\/OneDrive|\/Google Drive\/|\/My Drive\/|\/Library\/CloudStorage\/)/;
const MAX_BYTES = 2_000_000;

// NAME = value / "NAME": "value" / NAME: value / --name value is out of scope.
const ASSIGN = new RegExp(
  `["']?\\b(${KNOWN_NAMES.join('|')})\\b["']?[ \\t]*(?:=|:)[ \\t]*["']?([^\\s"'\`,;}#]+)`,
  'gi',
);

function lineOf(text, index) {
  let n = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
}

export function scanText(text, source) {
  const found = [];
  const seenAt = new Set();
  for (const p of PROVIDERS) {
    for (const pat of p.patterns) {
      pat.re.lastIndex = 0;
      let m;
      while ((m = pat.re.exec(text))) {
        const key = m[0];
        seenAt.add(m.index);
        found.push({
          provider: p.id, kind: pat.kind, fingerprint: fingerprint(key), masked: mask(key, pat.prefix),
          via: 'format', ...source, line: source.line ?? lineOf(text, m.index),
        });
      }
    }
  }
  // Prefix-less keys, found through the variable they are assigned to.
  ASSIGN.lastIndex = 0;
  let a;
  while ((a = ASSIGN.exec(text))) {
    const name = a[1].toUpperCase();
    const value = a[2];
    const valueAt = a.index + a[0].lastIndexOf(value);
    if (seenAt.has(valueAt)) continue; // already matched by format
    const provider = providerForName(name);
    if (!provider || isPlaceholder(value)) continue;
    if (found.some((f) => f.fingerprint === fingerprint(value))) continue;
    found.push({
      provider, kind: `${name} value`, fingerprint: fingerprint(value), masked: mask(value),
      via: 'variable', variable: name, ...source, line: source.line ?? lineOf(text, a.index),
    });
  }
  return found;
}

function inGitTree(file) {
  let d = dirname(file);
  for (let i = 0; i < 40; i++) {
    if (existsSync(join(d, '.git'))) return d;
    const up = dirname(d);
    if (up === d) return null;
    d = up;
  }
  return null;
}

function fileRisks(path, category, st) {
  const risks = [];
  if (category === 'history') risks.push('shell history');
  if (process.platform !== 'win32' && (st.mode & 0o077)) risks.push(`group/world-readable file (mode ${(st.mode & 0o777).toString(8)})`);
  if (SYNCED.test(path)) risks.push('cloud-synced folder');
  const repo = inGitTree(path);
  if (repo && category !== 'history') risks.push('inside a git work tree (check it is gitignored)');
  return risks;
}

function scanFile(abs, display, category, label) {
  let st;
  try { st = statSync(abs); } catch { return []; }
  if (!st.isFile() || st.size > MAX_BYTES || st.size === 0) return [];
  let text;
  try { text = readFileSync(abs, 'utf8'); } catch { return []; }
  const risks = fileRisks(abs, category, st);
  return scanText(text, { where: 'file', path: display, category, label, risks });
}

function walk(root, out, limits) {
  let entries;
  try { entries = readdirSync(root, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (limits.files >= limits.maxFiles) return;
    const p = join(root, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name) || e.isSymbolicLink()) continue;
      if (p.split(sep).length - limits.baseDepth > limits.maxDepth) continue;
      walk(p, out, limits);
    } else if (e.isFile() && PROJECT_FILE.test(e.name)) {
      limits.files++;
      out.push(p);
    }
  }
}

export function scan({ home, dirs = [], env = process.env, includeEnv = true, includeHistory = true, maxDepth = 6, maxFiles = 20000 }) {
  const findings = [];
  const tilde = (p) => (home && (p === home || p.startsWith(home + sep)) ? '~' + p.slice(home.length) : p);
  const scanned = [];
  if (home) {
    for (const [rel, category, label] of HOME_FILES) {
      if (!includeHistory && category === 'history') continue;
      const abs = join(home, rel);
      if (!existsSync(abs)) continue;
      scanned.push(tilde(abs));
      findings.push(...scanFile(abs, tilde(abs), category, label));
    }
  }
  for (const d of dirs) {
    const files = [];
    walk(d, files, { files: 0, maxFiles, maxDepth, baseDepth: d.split(sep).length });
    for (const f of files) {
      scanned.push(tilde(f));
      findings.push(...scanFile(f, tilde(f), 'project', basename(f)));
    }
  }
  if (includeEnv) {
    for (const [name, value] of Object.entries(env)) {
      if (!value) continue;
      const hits = scanText(`${name}=${value}`, { where: 'env', path: `$${name}`, category: 'env', label: 'environment of this shell', risks: [], line: 0 });
      for (const h of hits) h.risks = ['inherited by every process started from this shell, including agents'];
      findings.push(...hits);
    }
  }
  return { findings, scanned };
}

// Group findings: provider → distinct key → places.
export function group(findings) {
  const keys = new Map();
  for (const f of findings) {
    const k = keys.get(f.fingerprint) || {
      fingerprint: f.fingerprint, provider: f.provider, providerName: BY_ID[f.provider].name, kind: f.kind,
      masked: f.masked, rotate: BY_ID[f.provider].rotate, places: [],
    };
    if (f.via === 'format') { k.kind = f.kind; k.masked = f.masked; }
    if (!k.places.some((p) => p.path === f.path && p.line === f.line)) {
      k.places.push({ path: f.path, line: f.line, where: f.where, category: f.category, label: f.label, risks: f.risks });
    }
    keys.set(f.fingerprint, k);
  }
  const list = [...keys.values()];
  for (const k of list) {
    k.risks = [...new Set(k.places.flatMap((p) => p.risks))];
    k.score = k.places.length + k.risks.length * 2 + (/admin/.test(k.kind) ? 3 : 0);
  }
  return list.sort((a, b) => b.score - a.score || a.provider.localeCompare(b.provider));
}

export function relativeTo(base, p) {
  return relative(base, p) || '.';
}
