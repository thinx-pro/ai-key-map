import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { scan, group, scanText, fingerprint } from '../src/scan.js';
import { isPlaceholder, mask } from '../src/providers.js';
import { makeHome, fakeKeys } from './fixture.js';

const BIN = fileURLToPath(new URL('../bin/ai-key-map.js', import.meta.url));

function withHome(fn) {
  const home = mkdtempSync(join(tmpdir(), 'akm-'));
  try { return fn(home, makeHome(home)); } finally { rmSync(home, { recursive: true, force: true }); }
}

function cli(args) {
  return new Promise((res) => {
    execFile(process.execPath, [BIN, ...args], { env: { PATH: process.env.PATH, NO_COLOR: '1' } }, (err, stdout, stderr) => res({ code: err ? err.code : 0, stdout, stderr }));
  });
}

test('finds every fake key and groups copies by fingerprint', () => withHome((home, k) => {
  const { findings } = scan({ home, dirs: [join(home, 'code')], includeEnv: false });
  const keys = group(findings);
  const byProv = Object.fromEntries(keys.map((x) => [x.provider, x]));
  assert.ok(byProv.anthropic, 'anthropic');
  assert.equal(byProv.anthropic.places.length, 3); // .zshrc, history, opencode
  assert.equal(byProv.anthropic.fingerprint, fingerprint(k.anthropic));
  assert.equal(byProv.openai.places.length, 2); // .zshrc, codex
  assert.equal(byProv.openrouter.places.length, 2); // history, opencode
  assert.equal(byProv.google.places.length, 1);
  assert.equal(byProv.groq.places.length, 1);
  assert.equal(byProv.deepseek.places.length, 2); // claude desktop + project .env (found by variable name)
  assert.equal(byProv.huggingface.places.length, 1);
  assert.equal(keys.length, 7);
}));

test('ignores placeholders, ${VAR} references and node_modules', () => withHome((home, k) => {
  const { findings } = scan({ home, dirs: [join(home, 'code')], includeEnv: false });
  assert.ok(!findings.some((f) => f.provider === 'mistral'));
  assert.ok(!findings.some((f) => f.fingerprint === fingerprint(k.anthropicAdmin)));
  assert.ok(!findings.some((f) => /node_modules/.test(f.path)));
}));

test('flags risks: history, group/world-readable, git work tree', () => withHome((home) => {
  const keys = group(scan({ home, dirs: [join(home, 'code')], includeEnv: false }).findings);
  const ant = keys.find((x) => x.provider === 'anthropic');
  assert.ok(ant.risks.includes('shell history'));
  assert.ok(ant.risks.some((r) => /group\/world-readable file \(mode 644\)/.test(r)));
  const hf = keys.find((x) => x.provider === 'huggingface');
  assert.ok(hf.risks.some((r) => r.startsWith('inside a git work tree')));
  assert.equal(hf.places[0].path, '~/code/app/.env');
  assert.equal(hf.places[0].line, 2);
}));

test('--no-history and env scanning', () => withHome((home, k) => {
  const noHist = scan({ home, includeEnv: false, includeHistory: false }).findings;
  assert.ok(!noHist.some((f) => f.category === 'history'));
  const env = scan({ home: null, env: { GROQ_API_KEY: k.groq, PATH: '/usr/bin' } }).findings;
  assert.equal(env.length, 1);
  assert.equal(env[0].path, '$GROQ_API_KEY');
}));

test('never outputs a full key (text, json, markdown)', async () => {
  const home = mkdtempSync(join(tmpdir(), 'akm-'));
  const k = makeHome(home);
  try {
    const md = join(home, 'r.md');
    const t = await cli(['--home', home, '--dir', join(home, 'code'), '--no-env', '--md', md]);
    const j = await cli(['--home', home, '--dir', join(home, 'code'), '--no-env', '--json']);
    const { readFileSync } = await import('node:fs');
    const mdText = readFileSync(md, 'utf8');
    for (const key of Object.values(k)) {
      for (const out of [t.stdout, j.stdout, mdText]) {
        assert.ok(!out.includes(key), 'full key leaked');
        assert.ok(!out.includes(key.slice(0, key.length - 4)), 'key minus 4 chars leaked');
      }
    }
    assert.match(t.stdout, /7 distinct key\(s\) in 12 place\(s\)/);
    assert.match(t.stdout, /rotation checklist/);
    assert.match(t.stdout, /console\.anthropic\.com/);
    assert.equal(JSON.parse(j.stdout).summary.keys, 7);
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test('exit codes: --fail-on-find, clean home, bad option', async () => {
  const empty = mkdtempSync(join(tmpdir(), 'akm-'));
  try {
    const clean = await cli(['--home', empty, '--no-env', '--fail-on-find']);
    assert.equal(clean.code, 0);
    assert.match(clean.stdout, /No AI provider keys found/);
    makeHome(empty);
    const r = await cli(['--home', empty, '--no-env', '--fail-on-find']);
    assert.equal(r.code, 1);
    assert.equal((await cli(['--nope'])).code, 2);
    assert.match((await cli(['--help'])).stdout, /read-only|Read-only/);
  } finally { rmSync(empty, { recursive: true, force: true }); }
});

test('helpers', () => {
  const k = fakeKeys(3);
  assert.equal(mask(k.openai, /^sk-proj-/), 'sk-proj-…' + k.openai.slice(-4));
  assert.ok(isPlaceholder('your-api-key-here'));
  assert.ok(isPlaceholder('${OPENAI_API_KEY}'));
  assert.ok(isPlaceholder('op://vault/openai/credential'));
  assert.ok(!isPlaceholder(k.deepseek));
  // empty value must not swallow the next line (found on a real machine: .env.example files)
  const src = { where: 'file', path: 'x', category: 'project', label: 'x', risks: [] };
  assert.equal(scanText('OPENAI_API_KEY=\nDATABASE_URL=postgres://user:pw@localhost:5432/appdb\n', src).length, 0);
  assert.equal(scanText('DEEPSEEK_API_KEY=\n' + k.deepseek + '\n', src).length, 0);
  // a format key assigned to an unrelated variable is still found, once
  const hits = scanText(`FOO=${k.groq}`, { where: 'file', path: 'x', category: 'project', label: 'x', risks: [] });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].provider, 'groq');
});
