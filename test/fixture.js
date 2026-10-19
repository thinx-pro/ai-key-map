// Builds a fake $HOME full of fake keys. Keys are generated at runtime so the
// repository never contains key-shaped strings.
import { mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';

const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const HEX = '0123456789abcdef';
// Deterministic so screenshots and tests are stable.
function gen(seed) {
  let x = seed;
  return (alphabet, n) => {
    let s = '';
    for (let i = 0; i < n; i++) { x = (x * 1103515245 + 12345) % 2147483648; s += alphabet[(x >>> 16) % alphabet.length]; }
    return s;
  };
}

export function fakeKeys(seed = 7) {
  const r = gen(seed);
  return {
    anthropic: 'sk-' + 'ant-api03-' + r(ALNUM, 93),
    anthropicAdmin: 'sk-' + 'ant-admin01-' + r(ALNUM, 93),
    openai: 'sk-' + 'proj-' + r(ALNUM, 120),
    openrouter: 'sk-' + 'or-v1-' + r(HEX, 64),
    gemini: 'AI' + 'za' + r(ALNUM, 35),
    groq: 'gs' + 'k_' + r(ALNUM, 52),
    deepseek: 'sk-' + r(HEX, 32),
    hf: 'h' + 'f_' + r(ALNUM, 34),
  };
}

function put(home, rel, content, mode) {
  const p = join(home, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
  if (mode) chmodSync(p, mode);
  return p;
}

export function makeHome(home, seed = 7) {
  const k = fakeKeys(seed);
  put(home, '.zshrc', `export PATH="$HOME/bin:$PATH"\nexport ANTHROPIC_API_KEY=${k.anthropic}\nexport OPENAI_API_KEY="${k.openai}"\nexport MISTRAL_API_KEY=your-key-here\n`, 0o644);
  put(home, '.zsh_history', `: 1729000000:0;ls\n: 1729000001:0;export OPENROUTER_API_KEY=${k.openrouter}\n: 1729000002:0;curl -H "x-api-key: ${k.anthropic}" https://api.anthropic.com/v1/models\n`, 0o600);
  put(home, '.config/opencode/opencode.json', JSON.stringify({ provider: { anthropic: { options: { apiKey: k.anthropic } }, openrouter: { options: { apiKey: k.openrouter } } } }, null, 2), 0o600);
  put(home, '.codex/auth.json', JSON.stringify({ OPENAI_API_KEY: k.openai }, null, 2), 0o600);
  put(home, 'Library/Application Support/Claude/claude_desktop_config.json', JSON.stringify({
    mcpServers: { search: { command: 'npx', args: ['some-mcp'], env: { GEMINI_API_KEY: k.gemini, DEEPSEEK_API_KEY: k.deepseek } } },
  }, null, 2), 0o644);
  put(home, '.aider.conf.yml', `model: deepseek/deepseek-chat\napi-key:\n  - groq=${k.groq}\n`, 0o600);
  // A project tree with a committed .env
  put(home, 'code/app/.git/HEAD', 'ref: refs/heads/main\n');
  put(home, 'code/app/.env', `DEEPSEEK_API_KEY=${k.deepseek}\nHF_TOKEN=${k.hf}\nOPENAI_API_KEY=\${OPENAI_API_KEY}\n`, 0o644);
  put(home, 'code/app/node_modules/x/.env', `ANTHROPIC_API_KEY=${k.anthropicAdmin}\n`);
  return k;
}
