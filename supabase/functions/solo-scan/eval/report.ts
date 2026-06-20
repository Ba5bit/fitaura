import type { SoloScanAIOutput } from 'shared/solo-scan/schema.ts';
import type { FullGenerationResult, ScoreItem } from 'shared/result.ts';
import type { CaseResult, InlineImage, ModelOutcome, RunResult, ScanInput } from './types.ts';

const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

type Analysis = Record<string, { rating: number | null; confidence: number; evidence: string }>;

function scoreGrid(analysis: Analysis): string {
  const rows = Object.entries(analysis)
    .map(
      ([k, v]) =>
        `<tr><td class="k">${esc(k)}</td><td class="n">${v.rating ?? '—'}</td><td class="ev">${esc(v.evidence)}</td></tr>`,
    )
    .join('');
  return `<table class="scores">${rows}</table>`;
}

function colHead(o: ModelOutcome): string {
  return `<div class="model">${esc(o.modelId)}</div>`;
}

/** Rows of a ScoreItem[] (uses displayValue when present, e.g. "27 y.o."). */
function scoreRows(items: ScoreItem[]): string {
  return items
    .map((s) => `<tr><td class="k">${esc(s.label)}</td><td class="n">${esc(s.displayValue ?? s.value)}</td></tr>`)
    .join('');
}

/** The final assembled result — what the live product would actually render. */
function assembledCard(o: ModelOutcome): string {
  if (o.assembleError) {
    return `<div class="card-col empty">${colHead(o)}assembly failed: ${esc(o.assembleError)}</div>`;
  }
  const a: FullGenerationResult | null = o.assembled;
  if (!a) return `<div class="card-col empty">${colHead(o)}no result (${esc(o.error ?? 'schema invalid')})</div>`;

  const faceBlock = a.face
    ? `<div class="ab-block">
        <div class="ab-h">FACE · ${esc(a.face.card.verdict[0])} <b>${esc(a.face.card.verdict[1])}</b></div>
        <div class="muted">${esc(a.face.card.index)}</div>
        <table class="scores">${scoreRows(a.face.card.scores)}</table>
        <div class="traits">${a.face.analysis.breakdown
          .map((t) => `<span>${esc(t.label)} <b>${t.value}</b> ${esc(t.descriptor)}</span>`)
          .join('')}</div>
      </div>`
    : '';

  const np = a.outfit?.card.nameplate;
  const outfitBlock = a.outfit
    ? `<div class="ab-block">
        <div class="ab-h">OUTFIT · ${esc(a.outfit.card.caption)}</div>
        <div class="muted">Overall ${esc(a.outfit.card.overallScore)}${np ? ` · &ldquo;${esc(np.name)}&rdquo;` : ''}</div>
        <table class="scores">${scoreRows(a.outfit.card.scores)}</table>
        <div class="tags">${a.outfit.analysis.tags
          .map((t) => `<span class="tag ${t.tone}">${esc(t.label)}</span>`)
          .join('')}</div>
      </div>`
    : '';

  const r = a.receipt;
  const receiptBlock = `<div class="ab-block">
      <div class="ab-h">RECEIPT</div>
      <table class="scores">${r.rows
        .map((row) => `<tr><td class="k">${esc(row.label)}</td><td class="n">${esc(row.value)}</td></tr>`)
        .join('')}</table>
      <div class="punch">&ldquo;${esc(r.finalPunchline)}&rdquo;</div>
      <div class="muted">${esc(r.summary)}</div>
    </div>`;

  return `<div class="card-col assembled">${colHead(o)}
    <div class="chip ${esc(a.verdict)}">${esc(a.chip)} · <span class="g">${esc(a.gender)}</span></div>
    ${faceBlock}${outfitBlock}${receiptBlock}
  </div>`;
}

function faceCard(o: ModelOutcome): string {
  if (!o.parsed) return `<div class="card-col empty">${colHead(o)}${esc(o.error ?? 'schema invalid')}</div>`;
  const p = o.parsed;
  const v = p.faceCopy.verdictLine;
  const pr = p.presentation;
  return `<div class="card-col">${colHead(o)}
    <div class="title">${esc(v.lead)} <b>${esc(v.punch)}</b></div>
    <div class="row"><span>strongest</span>${esc(p.faceCopy.strongestPoint)}</div>
    <div class="row"><span>improvement</span>${esc(p.faceCopy.improvement)}</div>
    <div class="row"><span>summary</span>${esc(p.faceCopy.summary)}</div>
    <div class="present">gender ${esc(pr.gender)} (${esc(pr.genderConfidence)}) · age ${esc(pr.ageEstimate ?? '—')} · icon ${esc(pr.recognizedIcon ?? '—')}</div>
    ${scoreGrid(p.faceAnalysis)}
  </div>`;
}

function outfitCard(o: ModelOutcome): string {
  if (!o.parsed) return `<div class="card-col empty">${colHead(o)}${esc(o.error ?? 'schema invalid')}</div>`;
  const p = o.parsed;
  const n = p.outfitNameplate;
  const dossier = n.dossier.map((d) => `<li><b>${esc(d.label)}</b> ${esc(d.value)}</li>`).join('');
  return `<div class="card-col">${colHead(o)}
    <div class="nameplate" style="border-color:${esc(n.accentHex)}">
      <div class="eyebrow">${esc(n.eyebrow)}</div>
      <div class="name">${esc(n.name)} <span class="swatch" style="background:${esc(n.accentHex)}"></span></div>
      <div class="tagline">${esc(n.tagline)} · <i>${esc(n.lane)}</i></div>
      <ul class="dossier">${dossier}</ul>
    </div>
    <div class="row"><span>works</span>${esc(p.outfitCopy.works)}</div>
    <div class="row"><span>hurts</span>${esc(p.outfitCopy.hurts)}</div>
    <div class="row"><span>verdict</span>${esc(p.outfitCopy.verdict)}</div>
    <div class="row"><span>caption</span>${esc(p.outfitCopy.captionLine)}</div>
    ${scoreGrid(p.outfitAnalysis)}
  </div>`;
}

function banksTable(outcomes: ModelOutcome[]): string {
  const fields: Array<[string, (p: SoloScanAIOutput) => string[] | string]> = [
    ['faceArchetypeCandidates', (p) => p.contentSelection.faceArchetypeCandidates],
    ['outfitCaptionCandidates', (p) => p.contentSelection.outfitCaptionCandidates],
    ['stickerCandidates', (p) => p.contentSelection.stickerCandidates],
    ['contentTags', (p) => p.contentSelection.contentTags],
    ['metricCandidates', (p) => p.receiptContent.metricCandidates],
    ['punchlineCandidates', (p) => p.receiptContent.punchlineCandidates],
    ['punchlineText', (p) => p.receiptContent.punchlineText],
  ];
  const head = `<tr><th>bank</th>${outcomes.map((o) => `<th>${esc(o.modelId)}</th>`).join('')}</tr>`;
  const rows = fields
    .map(([label, get]) => {
      const cells = outcomes
        .map((o) => {
          if (!o.parsed) return '<td>—</td>';
          const val = get(o.parsed);
          return `<td>${Array.isArray(val) ? val.map(esc).join('<br>') : esc(val)}</td>`;
        })
        .join('');
      return `<tr><td class="k">${esc(label)}</td>${cells}</tr>`;
    })
    .join('');
  return `<table class="banks">${head}${rows}</table>`;
}

function metaFooter(o: ModelOutcome): string {
  const mark = o.schemaValid ? '✓' : '✗';
  const err = o.error ? ` · ${esc(o.error)}` : '';
  return `<span class="meta">${esc(o.modelId)} · schema ${mark} · ${o.latencyMs}ms · ${o.usage.total} tok · $${o.costUsd}${err}</span>`;
}

function imageStrip(input?: ScanInput): string {
  if (!input) return '';
  const fig = (i: InlineImage | undefined, label: string) =>
    i ? `<figure><img src="data:${esc(i.mimeType)};base64,${i.data}"><figcaption>${label}</figcaption></figure>` : '';
  return `<div class="imgs">${fig(input.face, 'face')}${fig(input.outfit, 'outfit')}</div>`;
}

function caseSection(c: CaseResult, input?: ScanInput): string {
  return `<section class="case">
    <h2>${esc(c.name)}</h2>
    ${imageStrip(input)}
    <h3>Final result — assembled (current system)</h3>
    <div class="cards">${c.outcomes.map(assembledCard).join('')}</div>
    <h3 class="raw-h">Raw Gemini output — the &ldquo;why&rdquo;</h3>
    <h4>Face Card</h4>
    <div class="cards">${c.outcomes.map(faceCard).join('')}</div>
    <h4>Outfit Card</h4>
    <div class="cards">${c.outcomes.map(outfitCard).join('')}</div>
    <h4>Banks</h4>
    ${banksTable(c.outcomes)}
    <div class="metas">${c.outcomes.map(metaFooter).join('')}</div>
  </section>`;
}

const STYLE = `
  body { font: 14px/1.5 -apple-system, system-ui, sans-serif; margin: 24px; color: #111; background: #fafafa; }
  header h1 { margin: 0 0 4px; }
  header p { color: #666; margin: 0 0 24px; }
  .case { background: #fff; border: 1px solid #e3e3e3; border-radius: 12px; padding: 16px 20px; margin-bottom: 28px; }
  .imgs { display: flex; gap: 12px; }
  .imgs img { height: 160px; border-radius: 8px; border: 1px solid #ddd; }
  figure { margin: 0; }
  figcaption { color: #888; font-size: 12px; text-align: center; }
  .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .card-col { border: 1px solid #eee; border-radius: 10px; padding: 12px; background: #fcfcfc; }
  .card-col.empty { color: #b00; font-weight: 600; }
  .model { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 6px; }
  .title { font-weight: 800; font-size: 18px; margin-bottom: 8px; }
  .title b { color: #c026d3; }
  .row { margin: 2px 0; } .row span { display: inline-block; min-width: 92px; color: #888; }
  .present { color: #555; font-size: 12px; margin: 8px 0; }
  .nameplate { border-left: 4px solid; padding: 4px 10px; margin-bottom: 8px; }
  .nameplate .name { font-weight: 800; font-size: 16px; }
  .swatch { display: inline-block; width: 12px; height: 12px; border-radius: 3px; vertical-align: middle; }
  .eyebrow, .tagline { color: #666; font-size: 12px; }
  .dossier { margin: 6px 0 0; padding-left: 16px; font-size: 12px; color: #555; }
  table { border-collapse: collapse; width: 100%; margin-top: 8px; font-size: 12px; }
  .scores td { border-top: 1px solid #f0f0f0; padding: 2px 6px; }
  .scores .n { text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; }
  .scores .ev { color: #777; }
  .banks th, .banks td { border: 1px solid #eee; padding: 4px 8px; vertical-align: top; }
  .banks .k { font-weight: 700; }
  .metas { margin-top: 10px; display: flex; gap: 16px; flex-wrap: wrap; }
  .meta { color: #555; font-size: 12px; }
  h4 { margin: 14px 0 6px; font-size: 13px; color: #71717a; text-transform: uppercase; letter-spacing: .05em; }
  .raw-h { margin-top: 22px; color: #a1a1aa; font-size: 14px; border-top: 1px dashed #e4e4e7; padding-top: 14px; }
  .card-col.assembled { background: #fff; border-color: #d4d4d8; }
  .chip { display: inline-block; font-weight: 800; font-size: 12px; letter-spacing: .03em; padding: 3px 10px; border-radius: 999px; background: #f4f4f5; margin-bottom: 8px; }
  .chip .g { font-weight: 600; color: #71717a; text-transform: capitalize; }
  .chip.green_flag { background: #dcfce7; color: #166534; }
  .chip.red_flag { background: #fee2e2; color: #991b1b; }
  .ab-block { margin: 8px 0; padding-top: 6px; border-top: 1px solid #f0f0f0; }
  .ab-h { font-weight: 800; font-size: 13px; margin-bottom: 2px; }
  .ab-h b { color: #c026d3; }
  .muted { color: #71717a; font-size: 12px; margin-bottom: 4px; }
  .traits { display: flex; flex-wrap: wrap; gap: 4px 10px; font-size: 11px; color: #555; margin-top: 4px; }
  .traits b { color: #111; }
  .tags { margin-top: 6px; display: flex; gap: 6px; flex-wrap: wrap; }
  .tag { font-size: 11px; padding: 1px 8px; border-radius: 999px; }
  .tag.good { background: #dcfce7; color: #166534; }
  .tag.bad { background: #fee2e2; color: #991b1b; }
  .punch { font-weight: 700; margin-top: 6px; }
  .totals { display: flex; gap: 18px; flex-wrap: wrap; margin-top: 8px; font-size: 13px; }
  .tot { background: #f4f4f5; padding: 4px 10px; border-radius: 8px; }
`;

export interface ModelTotals {
  modelId: string;
  generations: number;
  tokens: number;
  costUsd: number;
}

/** Per-model totals across every case in a run (for the cost comparison). */
export function summarizeCost(run: RunResult): ModelTotals[] {
  return run.models.map((modelId) => {
    let tokens = 0;
    let costUsd = 0;
    let generations = 0;
    for (const c of run.cases) {
      const o = c.outcomes.find((x) => x.modelId === modelId);
      if (o) {
        tokens += o.usage.total;
        costUsd += o.costUsd;
        generations += 1;
      }
    }
    return { modelId, generations, tokens, costUsd: Number(costUsd.toFixed(6)) };
  });
}

function totalsBar(run: RunResult): string {
  const rows = summarizeCost(run)
    .map(
      (t) =>
        `<span class="tot"><b>${esc(t.modelId)}</b> — ${t.generations} gen · ${t.tokens.toLocaleString('en-US')} tok · <b>$${t.costUsd.toFixed(4)}</b> (≈ $${(t.costUsd / Math.max(t.generations, 1)).toFixed(4)}/gen)</span>`,
    )
    .join('');
  return `<div class="totals">${rows}</div>`;
}

/** Render the full comparison report. `inputs` supplies the per-case images. */
export function renderReport(run: RunResult, inputs: ScanInput[]): string {
  const byName = new Map(inputs.map((i) => [i.name, i]));
  const sections = run.cases.map((c) => caseSection(c, byName.get(c.name))).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Solo Scan — 2.5 vs 3.5</title><style>${STYLE}</style></head>
<body><header><h1>Solo Scan — 2.5 vs 3.5</h1>
<p>${esc(run.startedAt)} · ${run.models.map(esc).join(' | ')}</p>
${totalsBar(run)}</header>
${sections}</body></html>`;
}
