# Solo Scan dual-model comparison harness

Runs the same photos through `gemini-2.5-flash` and `gemini-3.5-flash` with the exact
production prompt/schema and emits a side-by-side HTML report.

## Add test cases

Create one folder per case under `eval/cases/`:

```
eval/cases/alice/face.jpg
eval/cases/bob/face.png
eval/cases/bob/outfit.webp
eval/cases/coat/outfit.jpg      # outfit-only is fine
```

`face.*` and/or `outfit.*` (`.jpg` `.jpeg` `.png` `.webp`). Either or both. The
`cases/` and `out/` folders are gitignored — test photos never get committed.

## Run

bash:

```bash
GEMINI_API_KEY=<2.5 key> GEMINI_API_KEY_35=<3.5 key> npm run scan:compare
```

PowerShell:

```powershell
$env:GEMINI_API_KEY="<2.5 key>"; $env:GEMINI_API_KEY_35="<3.5 key>"; npm run scan:compare
```

`GEMINI_API_KEY_35` falls back to `GEMINI_API_KEY` if unset. Output lands in
`eval/out/<timestamp>/report.html` (open in a browser) and `results.json`.

## Test the harness

```bash
npm run scan:compare:test
```
