# Solo Scan dual-model comparison harness

Runs the same photos through `gemini-2.5-flash` and `gemini-3.5-flash` with the exact
production prompt/schema and emits a side-by-side HTML report.

## Web UI (easiest)

1. Put your key(s) in a local `.env` file: copy `.env.example` to `.env` and fill in
   `GEMINI_API_KEY` (and optionally `GEMINI_API_KEY_35`). `.env` is gitignored.
2. Start the server:

   ```bash
   npm run scan:compare:serve
   ```

3. Open `http://localhost:5178`, upload a face photo (outfit optional), hit **Compare**.
   Both models run and the 2.5-vs-3.5 report renders right in the page. No folders needed.

The startup log shows ✓/✗ for each model's key so you know what's wired.

## Batch mode (folders)

For comparing many photos at once, use folders instead of the web UI.

### Add test cases

Create one folder per case under `eval/cases/`:

```
eval/cases/alice/face.jpg
eval/cases/bob/face.png
eval/cases/bob/outfit.webp
eval/cases/coat/outfit.jpg      # outfit-only is fine
```

`face.*` and/or `outfit.*` (`.jpg` `.jpeg` `.png` `.webp`). Either or both. The
`cases/` and `out/` folders are gitignored — test photos never get committed.

### Run

With keys in `.env` (see Web UI step 1):

```bash
npm run scan:compare
```

Or pass keys inline — bash:

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
