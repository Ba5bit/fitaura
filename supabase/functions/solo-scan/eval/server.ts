import { createServer } from 'node:http';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { MODELS, resolveKey } from './models.ts';
import { runModel } from './compare.ts';
import { renderReport } from './report.ts';
import { loadEnvFile } from './env.ts';
import type { CaseResult, InlineImage, ModelOutcome, RunResult, ScanInput } from './types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
type Env = Record<string, string | undefined>;

export interface CompareRequest {
  name?: string;
  face?: InlineImage;
  outfit?: InlineImage;
}

/** Run one uploaded case through every model and return the rendered report HTML. */
export async function handleCompare(req: CompareRequest, env: Env): Promise<string> {
  const input: ScanInput = { name: req.name?.trim() || 'upload', face: req.face, outfit: req.outfit };
  if (!input.face && !input.outfit) throw new Error('Provide a face and/or outfit image.');
  const outcomes: ModelOutcome[] = [];
  for (const cfg of MODELS) {
    const apiKey = resolveKey(cfg, env);
    if (!apiKey) {
      throw new Error(`Missing API key for ${cfg.id}: set ${cfg.keyEnv} (or GEMINI_API_KEY) in eval/.env`);
    }
    outcomes.push(await runModel(cfg, input, apiKey));
  }
  const caseResult: CaseResult = {
    name: input.name,
    hasFace: !!input.face,
    hasOutfit: !!input.outfit,
    outcomes,
  };
  const run: RunResult = { startedAt: new Date().toISOString(), models: MODELS.map((m) => m.id), cases: [caseResult] };
  return renderReport(run, [input]);
}

const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Per-model key presence banner for the page. */
function keyStatus(env: Env): string {
  return MODELS.map((m) => {
    const ok = !!resolveKey(m, env);
    return `<span class="key ${ok ? 'ok' : 'no'}">${ok ? '✓' : '✗'} ${esc(m.id)} <code>${esc(m.keyEnv)}</code></span>`;
  }).join('');
}

function page(env: Env): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Solo Scan — 2.5 vs 3.5</title>
<style>
  body { font: 15px/1.5 -apple-system, system-ui, sans-serif; margin: 0; color: #111; background: #f4f4f5; }
  header { padding: 20px 24px; background: #fff; border-bottom: 1px solid #e4e4e7; }
  h1 { margin: 0 0 8px; font-size: 20px; }
  .keys { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; }
  .key { padding: 2px 8px; border-radius: 999px; }
  .key.ok { background: #dcfce7; color: #166534; }
  .key.no { background: #fee2e2; color: #991b1b; }
  .key code { font-size: 11px; }
  form { display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap; padding: 16px 24px; }
  label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #555; }
  input[type=text] { padding: 6px 8px; border: 1px solid #d4d4d8; border-radius: 6px; font-size: 14px; }
  button { padding: 9px 18px; border: 0; border-radius: 8px; background: #111; color: #fff; font-weight: 600; cursor: pointer; }
  button:disabled { opacity: .5; cursor: default; }
  #status { padding: 0 24px 12px; color: #555; min-height: 20px; }
  iframe#out { width: 100%; height: 78vh; border: 0; border-top: 1px solid #e4e4e7; background: #fff; }
</style></head>
<body>
<header>
  <h1>Solo Scan — 2.5 vs 3.5</h1>
  <div class="keys">${keyStatus(env)}</div>
</header>
<form id="f">
  <label>Case name<input id="name" type="text" value="upload"></label>
  <label>Face photo<input id="face" type="file" accept="image/jpeg,image/png,image/webp"></label>
  <label>Outfit photo (optional)<input id="outfit" type="file" accept="image/jpeg,image/png,image/webp"></label>
  <button id="go" type="submit">Compare</button>
</form>
<div id="status"></div>
<iframe id="out" title="comparison report"></iframe>
<script>
  var form = document.getElementById('f');
  var frame = document.getElementById('out');
  var statusEl = document.getElementById('status');
  var go = document.getElementById('go');
  function readImg(input) {
    return new Promise(function (resolve, reject) {
      var file = input.files && input.files[0];
      if (!file) return resolve(undefined);
      var fr = new FileReader();
      fr.onload = function () {
        var m = /^data:(.+);base64,(.*)$/.exec(String(fr.result));
        if (!m) return reject(new Error('Could not read ' + file.name));
        resolve({ mimeType: m[1], data: m[2] });
      };
      fr.onerror = function () { reject(new Error('Could not read ' + file.name)); };
      fr.readAsDataURL(file);
    });
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    go.disabled = true;
    statusEl.textContent = 'Comparing… running both models, a few seconds each.';
    Promise.all([readImg(document.getElementById('face')), readImg(document.getElementById('outfit'))])
      .then(function (imgs) {
        if (!imgs[0] && !imgs[1]) { statusEl.textContent = 'Pick a face and/or outfit image first.'; return; }
        var body = { name: document.getElementById('name').value, face: imgs[0], outfit: imgs[1] };
        return fetch('/compare', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
          .then(function (r) { return r.text().then(function (t) { return { ok: r.ok, t: t }; }); })
          .then(function (res) {
            if (!res.ok) { statusEl.textContent = 'Error: ' + res.t; return; }
            statusEl.textContent = 'Done.';
            frame.srcdoc = res.t;
          });
      })
      .catch(function (err) { statusEl.textContent = 'Error: ' + err.message; })
      .then(function () { go.disabled = false; });
  });
</script>
</body></html>`;
}

const MAX_BODY = 45_000_000; // ~45 MB JSON; base64 images inflate ~4/3 over their byte size

function startServer(env: Env, port: number) {
  const server = createServer((req, res) => {
    if (req.method === 'GET' && (req.url === '/' || req.url === '')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(page(env));
      return;
    }
    if (req.method === 'POST' && req.url === '/compare') {
      let body = '';
      let aborted = false;
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > MAX_BODY) {
          aborted = true;
          res.writeHead(413, { 'content-type': 'text/plain' });
          res.end('Image too large.');
          req.destroy();
        }
      });
      req.on('end', async () => {
        if (aborted) return;
        try {
          const html = await handleCompare(JSON.parse(body) as CompareRequest, env);
          res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
          res.end(html);
        } catch (e) {
          res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
          res.end(String(e instanceof Error ? e.message : e));
        }
      });
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  });
  server.listen(port, () => {
    console.log(`\n  Solo Scan compare  →  http://localhost:${port}\n`);
    for (const m of MODELS) {
      console.log(`  ${resolveKey(m, env) ? '✓' : '✗'} ${m.id}  (${m.keyEnv})`);
    }
    console.log('\n  Upload a photo in the browser. Ctrl+C to stop.\n');
  });
}

// CLI entry — only runs when invoked directly (not when imported by tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  loadEnvFile(join(HERE, '.env'));
  startServer(process.env, Number(process.env.PORT) || 5178);
}
