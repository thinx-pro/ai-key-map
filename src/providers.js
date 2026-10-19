// Key formats for AI providers. Patterns are built from parts so this file
// does not itself look like it contains keys to secret scanners.

const rx = (...parts) => new RegExp(parts.join(''), 'g');
const B = '(?![A-Za-z0-9_-])'; // right boundary
const L = '(?<![A-Za-z0-9_-])'; // left boundary

export const PROVIDERS = [
  {
    id: 'anthropic', name: 'Anthropic', rotate: 'https://console.anthropic.com/settings/keys',
    envNames: ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_API_KEY'],
    patterns: [
      { kind: 'API key', re: rx(L, 'sk-', 'ant-api\\d\\d-[A-Za-z0-9_-]{60,}', B), prefix: /^sk-ant-api\d\d-/ },
      { kind: 'admin key', re: rx(L, 'sk-', 'ant-admin\\d\\d-[A-Za-z0-9_-]{60,}', B), prefix: /^sk-ant-admin\d\d-/ },
      {
        kind: 'OAuth token (Claude subscription)', re: rx(L, 'sk-', 'ant-oat\\d\\d-[A-Za-z0-9_-]{40,}', B), prefix: /^sk-ant-oat\d\d-/,
        rotateNote: 'subscription token: sign out / revoke the session (e.g. `claude setup-token` again or log out in claude.ai settings)',
      },
    ],
  },
  {
    id: 'openai', name: 'OpenAI', rotate: 'https://platform.openai.com/api-keys',
    envNames: ['OPENAI_API_KEY', 'OPENAI_ADMIN_KEY', 'CODEX_API_KEY'],
    patterns: [
      { kind: 'project key', re: rx(L, 'sk-', 'proj-[A-Za-z0-9_-]{40,}', B), prefix: /^sk-proj-/ },
      { kind: 'service-account key', re: rx(L, 'sk-', 'svcacct-[A-Za-z0-9_-]{40,}', B), prefix: /^sk-svcacct-/ },
      { kind: 'admin key', re: rx(L, 'sk-', 'admin-[A-Za-z0-9_-]{40,}', B), prefix: /^sk-admin-/ },
      { kind: 'legacy user key', re: rx(L, 'sk-', '[A-Za-z0-9]{20}T3Blbk', 'FJ[A-Za-z0-9]{20}', B), prefix: /^sk-/ },
    ],
  },
  {
    id: 'openrouter', name: 'OpenRouter', rotate: 'https://openrouter.ai/settings/keys',
    envNames: ['OPENROUTER_API_KEY'],
    patterns: [{ kind: 'API key', re: rx(L, 'sk-', 'or-v1-[a-f0-9]{64}', B), prefix: /^sk-or-v1-/ }],
  },
  {
    id: 'google', name: 'Google (Gemini / AI Studio)', rotate: 'https://aistudio.google.com/app/apikey',
    envNames: ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'],
    patterns: [{ kind: 'API key', re: rx(L, 'AI', 'za[0-9A-Za-z_-]{35}', B), prefix: /^AIza/ }],
  },
  {
    id: 'groq', name: 'Groq', rotate: 'https://console.groq.com/keys', envNames: ['GROQ_API_KEY'],
    patterns: [{ kind: 'API key', re: rx(L, 'gs', 'k_[A-Za-z0-9]{48,}', B), prefix: /^gsk_/ }],
  },
  {
    id: 'xai', name: 'xAI', rotate: 'https://console.x.ai', envNames: ['XAI_API_KEY'],
    patterns: [{ kind: 'API key', re: rx(L, 'xa', 'i-[A-Za-z0-9]{70,}', B), prefix: /^xai-/ }],
  },
  {
    id: 'perplexity', name: 'Perplexity', rotate: 'https://www.perplexity.ai/settings/api', envNames: ['PERPLEXITY_API_KEY', 'PPLX_API_KEY'],
    patterns: [{ kind: 'API key', re: rx(L, 'pp', 'lx-[A-Za-z0-9]{40,}', B), prefix: /^pplx-/ }],
  },
  {
    id: 'huggingface', name: 'Hugging Face', rotate: 'https://huggingface.co/settings/tokens', envNames: ['HF_TOKEN', 'HUGGING_FACE_HUB_TOKEN', 'HUGGINGFACEHUB_API_TOKEN'],
    patterns: [{ kind: 'access token', re: rx(L, 'h', 'f_[A-Za-z0-9]{30,}', B), prefix: /^hf_/ }],
  },
  {
    id: 'replicate', name: 'Replicate', rotate: 'https://replicate.com/account/api-tokens', envNames: ['REPLICATE_API_TOKEN'],
    patterns: [{ kind: 'API token', re: rx(L, 'r', '8_[A-Za-z0-9]{30,}', B), prefix: /^r8_/ }],
  },
  {
    id: 'fireworks', name: 'Fireworks', rotate: 'https://fireworks.ai/account/api-keys', envNames: ['FIREWORKS_API_KEY'],
    patterns: [{ kind: 'API key', re: rx(L, 'f', 'w_[A-Za-z0-9]{20,}', B), prefix: /^fw_/ }],
  },
  {
    id: 'cerebras', name: 'Cerebras', rotate: 'https://cloud.cerebras.ai', envNames: ['CEREBRAS_API_KEY'],
    patterns: [{ kind: 'API key', re: rx(L, 'cs', 'k-[a-z0-9]{40,}', B), prefix: /^csk-/ }],
  },
  // Providers whose keys have no distinctive prefix: found only via a known variable name.
  { id: 'deepseek', name: 'DeepSeek', rotate: 'https://platform.deepseek.com/api_keys', envNames: ['DEEPSEEK_API_KEY'], patterns: [] },
  { id: 'mistral', name: 'Mistral', rotate: 'https://console.mistral.ai/api-keys', envNames: ['MISTRAL_API_KEY', 'CODESTRAL_API_KEY'], patterns: [] },
  { id: 'together', name: 'Together AI', rotate: 'https://api.together.ai/settings/api-keys', envNames: ['TOGETHER_API_KEY', 'TOGETHERAI_API_KEY'], patterns: [] },
  { id: 'cohere', name: 'Cohere', rotate: 'https://dashboard.cohere.com/api-keys', envNames: ['COHERE_API_KEY', 'CO_API_KEY'], patterns: [] },
  { id: 'moonshot', name: 'Moonshot (Kimi)', rotate: 'https://platform.moonshot.ai/console/api-keys', envNames: ['MOONSHOT_API_KEY', 'KIMI_API_KEY'], patterns: [] },
  { id: 'dashscope', name: 'Alibaba DashScope (Qwen)', rotate: 'https://bailian.console.aliyun.com', envNames: ['DASHSCOPE_API_KEY'], patterns: [] },
  { id: 'zhipu', name: 'Zhipu / Z.ai (GLM)', rotate: 'https://z.ai/manage-apikey/apikey-list', envNames: ['ZHIPUAI_API_KEY', 'ZAI_API_KEY', 'GLM_API_KEY'], patterns: [] },
  { id: 'voyage', name: 'Voyage AI', rotate: 'https://dashboard.voyageai.com', envNames: ['VOYAGE_API_KEY'], patterns: [] },
];

export const BY_ID = Object.fromEntries(PROVIDERS.map((p) => [p.id, p]));

const NAME_TO_PROVIDER = new Map();
for (const p of PROVIDERS) for (const n of p.envNames) NAME_TO_PROVIDER.set(n, p.id);
export const KNOWN_NAMES = [...NAME_TO_PROVIDER.keys()];
export const providerForName = (name) => NAME_TO_PROVIDER.get(String(name).toUpperCase()) || null;

// Values that are clearly not a real key.
export function isPlaceholder(v) {
  const s = String(v).trim();
  if (s.length < 16) return true;
  if (/^\$|\$\{|^<.*>$|^%|^\{\{|^env:|^op:\/\/|^vault:|^keychain:|^\(/.test(s)) return true;
  if (/your|example|placeholder|changeme|replace|insert|dummy|xxxx|\*\*\*\*|\.\.\.|…/i.test(s)) return true;
  if (/^(.)\1+$/.test(s)) return true;
  if (/\s/.test(s)) return true;
  return false;
}

export function mask(key, prefixRe) {
  const m = prefixRe ? String(key).match(prefixRe) : null;
  const head = m ? m[0] : String(key).slice(0, 3);
  return `${head}…${String(key).slice(-4)}`;
}
