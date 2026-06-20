import { readFileSync, existsSync } from 'node:fs';

type Env = Record<string, string | undefined>;

/** Minimal .env loader: KEY=VALUE lines into `env` (does not override existing keys). */
export function loadEnvFile(path: string, env: Env = process.env): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (k && env[k] === undefined) env[k] = v;
  }
}
