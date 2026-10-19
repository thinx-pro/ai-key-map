import { BY_ID } from './providers.js';

const useColor = () => !process.env.NO_COLOR && (process.env.FORCE_COLOR || process.stdout.isTTY);
const paint = (code) => (s) => (useColor() ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const c = { bold: paint('1'), dim: paint('2'), red: paint('31'), green: paint('32'), yellow: paint('33'), cyan: paint('36'), magenta: paint('35') };

const where = (p) => (p.where === 'env' ? `${p.path} ${c.dim('(env)')}` : `${p.path}${p.line ? c.dim(':' + p.line) : ''}`);

export function summarize(keys) {
  const places = keys.reduce((n, k) => n + k.places.length, 0);
  const inHistory = keys.filter((k) => k.places.some((p) => p.category === 'history')).length;
  const exposed = keys.filter((k) => k.risks.some((r) => /readable|git|cloud/.test(r))).length;
  const providers = [...new Set(keys.map((k) => k.provider))];
  return { keys: keys.length, places, inHistory, exposed, providers };
}

export function text(keys, { scannedCount, home, env = true }) {
  const s = summarize(keys);
  const out = [];
  out.push(`${c.bold('ai-key-map')} ${c.dim('· read-only, offline · keys are never printed in full')}`);
  out.push(c.dim(`scanned ${scannedCount} file(s)${env ? ' + environment' : ''}${home ? ` · home ${home}` : ''}`));
  out.push('');
  if (!keys.length) {
    out.push(c.green('No AI provider keys found in the scanned locations.'));
    out.push(c.dim('Not scanned: keychains / password managers, other users, project trees (use --dir).'));
    return out.join('\n') + '\n';
  }
  for (const k of keys) {
    const copies = k.places.length;
    const head = `${c.bold(k.providerName)} ${c.dim(k.kind)}  ${c.cyan(k.masked)}  ${c.dim('#' + k.fingerprint)}`;
    out.push(`${head}  ${copies > 1 ? c.yellow(`${copies} copies`) : c.dim('1 copy')}`);
    for (const p of k.places) {
      const r = p.risks.length ? '  ' + p.risks.map((x) => (/history|readable|git|cloud/.test(x) ? c.red(x) : c.yellow(x))).join(c.dim(', ')) : '';
      out.push(`  ${c.dim('·')} ${where(p)} ${c.dim('— ' + p.label)}${r}`);
    }
    out.push('');
  }
  out.push(c.bold(`${s.keys} distinct key(s) in ${s.places} place(s) across ${s.providers.length} provider(s)`)
    + (s.inHistory ? c.red(` · ${s.inHistory} in shell history`) : '')
    + (s.exposed ? c.red(` · ${s.exposed} in readable/synced/git locations`) : ''));
  out.push('');
  out.push(c.cyan('rotation checklist'));
  for (const k of keys) {
    const p = BY_ID[k.provider];
    out.push(`  ${c.bold('□')} ${p.name} ${k.masked}: revoke at ${p.rotate}`);
    const files = k.places.filter((x) => x.where === 'file' && x.category !== 'history').map((x) => x.path);
    const envs = k.places.filter((x) => x.where === 'env').map((x) => x.path);
    const hist = k.places.filter((x) => x.category === 'history').map((x) => x.path);
    if (files.length) out.push(`      then update: ${[...new Set(files)].join(', ')}`);
    if (envs.length) out.push(`      restart shells / agents that inherited ${[...new Set(envs)].join(', ')}`);
    if (hist.length) out.push(`      delete the line(s) from ${[...new Set(hist)].join(', ')} (rotating first makes the old copy harmless)`);
    const pat = Object.values(p.patterns || []).find((x) => x.kind === k.kind);
    if (pat && pat.rotateNote) out.push(`      note: ${pat.rotateNote}`);
  }
  out.push('');
  out.push(c.dim('Links are the providers\' key pages as of 2026-10; they may move. Fingerprints let you match copies without revealing keys.'));
  return out.join('\n') + '\n';
}

export function markdown(keys, { scannedCount }) {
  const s = summarize(keys);
  const lines = [
    '# ai-key-map report',
    '',
    `${s.keys} distinct key(s) in ${s.places} place(s); ${s.inHistory} in shell history; ${s.exposed} in readable/synced/git locations. Scanned ${scannedCount} file(s) + environment.`,
    '',
    '| provider | kind | key | fingerprint | places | risks |',
    '|---|---|---|---|---|---|',
  ];
  for (const k of keys) {
    lines.push(`| ${k.providerName} | ${k.kind} | \`${k.masked}\` | \`${k.fingerprint}\` | ${k.places.map((p) => `\`${p.path}${p.line ? ':' + p.line : ''}\``).join('<br>')} | ${k.risks.join('; ') || '–'} |`);
  }
  lines.push('', '## Rotation checklist', '');
  for (const k of keys) lines.push(`- [ ] ${k.providerName} \`${k.masked}\`: revoke at ${k.rotate}, then update ${k.places.length} place(s)`);
  return lines.join('\n') + '\n';
}
