# Per-Account On-Device Vault (IndexedDB) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scope all on-device generation data (photos, current result, history) per account using IndexedDB, with a 14-day created-time expiry, a guest→login hand-off, and no practical history cap — so one account's data is never visible to another on the same browser.

**Architecture:** A new async IndexedDB layer (`generationDb.ts`) holds two stores keyed by account (`<userId>` or `guest`): `results` (indexed by account, ~uncapped with a 100 safety trim) and `session` (current photos + open-result pointer). `GenerationProvider` becomes async-backed, reads the account from `AccountContext`, exposes a new `hydrated` flag, and migrates the legacy global localStorage blob once into the guest namespace. Pure helpers (`isExpired`, `trimToCap`, `mergeGuestIntoAccount`) are unit-tested; the DB wrapper is tested with `fake-indexeddb`.

**Tech Stack:** TypeScript, React 18, IndexedDB (native), Vitest + jsdom, `fake-indexeddb` (new devDep).

**Test commands** (run from `apps/web`):
- Single file: `npx vitest run src/state/<file>.test.ts`
- Full suite: `npm test`
- Typecheck: `npm run typecheck`

**Note:** Tasks 1–4 leave the app in an intermediate state (the provider isn't rewired until Task 4). Per-task we run the relevant **vitest** file; the full `typecheck`/`test`/`build` gate is Task 6.

---

### Task 1: Pure helpers, types, and constants in `generationDb.ts`

**Files:**
- Create: `apps/web/src/state/generationDb.ts`
- Test: `apps/web/src/state/generationDb.helpers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/state/generationDb.helpers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  accountKeyFor, isExpired, trimToCap, mergeGuestIntoAccount,
  MAX_AGE_DAYS, type GenerationResult, type AccountData,
} from './generationDb';

const DAY = 86_400_000;
// Minimal GenerationResult stub — only the fields the helpers touch.
const res = (id: string, producedAt: string, name?: string): GenerationResult =>
  ({ receipt: { generationId: id }, producedAt, name } as unknown as GenerationResult);
const acct = (key: string, results: GenerationResult[], face = null, outfit = null, currentResultId: string | null = null): AccountData =>
  ({ session: { accountKey: key, face, outfit, currentResultId }, results });

describe('generationDb helpers', () => {
  it('accountKeyFor falls back to guest', () => {
    expect(accountKeyFor('u1')).toBe('u1');
    expect(accountKeyFor(null)).toBe('guest');
  });

  it('isExpired uses created-time and the 14-day window', () => {
    const now = Date.parse('2026-06-15T00:00:00.000Z');
    expect(isExpired('2026-06-15T00:00:00.000Z', now)).toBe(false);
    expect(isExpired(new Date(now - 13 * DAY).toISOString(), now)).toBe(false);
    expect(isExpired(new Date(now - 15 * DAY).toISOString(), now)).toBe(true);
    expect(MAX_AGE_DAYS).toBe(14);
    // Unparseable timestamps are kept (not expired).
    expect(isExpired('not-a-date', now)).toBe(false);
  });

  it('trimToCap keeps the newest N by producedAt', () => {
    const list = [res('a', '2026-06-01T00:00:00Z'), res('b', '2026-06-03T00:00:00Z'), res('c', '2026-06-02T00:00:00Z')];
    expect(trimToCap(list, 2).map((r) => r.receipt.generationId)).toEqual(['b', 'c']);
  });

  it('mergeGuestIntoAccount: guest scan overrides current, history merges + de-dupes', () => {
    const account = acct('u1', [res('old', '2026-06-01T00:00:00Z')], { url: 'acctFace' }, null, 'old');
    const guest = acct('guest', [res('g1', '2026-06-10T00:00:00Z')], { url: 'guestFace' }, { url: 'guestFit' }, 'g1');
    const merged = mergeGuestIntoAccount(account, guest);
    expect(merged.session.face).toEqual({ url: 'guestFace' }); // guest overrides
    expect(merged.session.outfit).toEqual({ url: 'guestFit' });
    expect(merged.session.currentResultId).toBe('g1');
    expect(merged.session.accountKey).toBe('u1');
    expect(merged.results.map((r) => r.receipt.generationId)).toEqual(['g1', 'old']); // newest first, both kept
  });

  it('mergeGuestIntoAccount keeps account values when guest is empty', () => {
    const account = acct('u1', [res('old', '2026-06-01T00:00:00Z')], { url: 'acctFace' }, null, 'old');
    const guest = acct('guest', []);
    const merged = mergeGuestIntoAccount(account, guest);
    expect(merged.session.face).toEqual({ url: 'acctFace' });
    expect(merged.session.currentResultId).toBe('old');
    expect(merged.results.map((r) => r.receipt.generationId)).toEqual(['old']);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx vitest run src/state/generationDb.helpers.test.ts`
Expected: FAIL — module `./generationDb` does not exist.

- [ ] **Step 3: Create `generationDb.ts` with types, constants, and pure helpers**

Create `apps/web/src/state/generationDb.ts`:

```ts
// apps/web/src/state/generationDb.ts
import type { FullGenerationResult } from '@fitaura/shared';

/** A baked, cropped photo ready to drop into a card (data URL, on-device). */
export interface UploadedPhoto {
  url: string;
}

export interface GenerationResult extends FullGenerationResult {
  /** When this generation was produced (device-local history; the expiry clock). */
  producedAt: string;
  /** Optional user-given name for the vault (defaults to the generation id). */
  name?: string;
}

/** The per-account "current scan" pointer record. */
export interface SessionRecord {
  accountKey: string;
  face: UploadedPhoto | null;
  outfit: UploadedPhoto | null;
  currentResultId: string | null;
}

/** A whole account's on-device state (session + history, newest first). */
export interface AccountData {
  session: SessionRecord;
  results: GenerationResult[];
}

/** One stored generation row. */
interface StoredResult {
  id: string; // `${accountKey}::${generationId}`
  accountKey: string;
  result: GenerationResult;
}

export const MAX_AGE_DAYS = 14;
export const SAFETY_CAP = 100;

const DB_NAME = 'fitaura';
const DB_VERSION = 1;
const RESULTS = 'results';
const SESSION = 'session';
const LEGACY_KEY = 'fitaura.state';

/** Storage namespace for a user (guest when signed out). */
export const accountKeyFor = (userId: string | null): string => userId ?? 'guest';

/** A generation is expired when its creation time is older than the window. */
export function isExpired(producedAt: string, now: number, maxAgeDays = MAX_AGE_DAYS): boolean {
  const t = Date.parse(producedAt);
  if (Number.isNaN(t)) return false; // keep rows we can't date
  return now - t > maxAgeDays * 86_400_000;
}

const byNewest = (a: GenerationResult, b: GenerationResult) =>
  Date.parse(b.producedAt) - Date.parse(a.producedAt);

/** Newest `cap` results by produced time. */
export function trimToCap(results: GenerationResult[], cap = SAFETY_CAP): GenerationResult[] {
  return [...results].sort(byNewest).slice(0, cap);
}

const emptySession = (accountKey: string): SessionRecord => ({
  accountKey, face: null, outfit: null, currentResultId: null,
});

/** Fold a guest's pending scan + results into the account they signed into.
 * The guest's just-made face/outfit/current result override the account's
 * current scan; histories merge (de-duped by generationId) and cap. */
export function mergeGuestIntoAccount(account: AccountData, guest: AccountData): AccountData {
  const session: SessionRecord = {
    accountKey: account.session.accountKey,
    face: guest.session.face ?? account.session.face,
    outfit: guest.session.outfit ?? account.session.outfit,
    currentResultId: guest.session.currentResultId ?? account.session.currentResultId,
  };
  const guestIds = new Set(guest.results.map((r) => r.receipt.generationId));
  const results = trimToCap([
    ...guest.results,
    ...account.results.filter((r) => !guestIds.has(r.receipt.generationId)),
  ]);
  return { session, results };
}

// --- IndexedDB wrapper added in Task 2 ---
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run src/state/generationDb.helpers.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/state/generationDb.ts apps/web/src/state/generationDb.helpers.test.ts
git commit -m "feat(web): per-account vault — types + pure helpers"
```

---

### Task 2: IndexedDB wrapper in `generationDb.ts`

**Files:**
- Modify: `apps/web/src/state/generationDb.ts` (append the wrapper)
- Modify: `apps/web/package.json` (add `fake-indexeddb` devDependency)
- Test: `apps/web/src/state/generationDb.test.ts`

- [ ] **Step 1: Add the `fake-indexeddb` dev dependency**

Run (from repo root):
```bash
npm install -D fake-indexeddb --workspace @fitaura/web
```
Expected: `fake-indexeddb` appears under `devDependencies` in `apps/web/package.json`.

- [ ] **Step 2: Write the failing test**

Create `apps/web/src/state/generationDb.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadAccount, putResult, deleteResult, renameResultDb, putSession,
  pruneExpired, moveAccountData, migrateLegacyLocalStorage, resetDbForTests,
  type GenerationResult,
} from './generationDb';

const DAY = 86_400_000;
const res = (id: string, producedAt: string, name?: string): GenerationResult =>
  ({ receipt: { generationId: id }, verdict: 'normie', producedAt, name } as unknown as GenerationResult);

beforeEach(async () => {
  await resetDbForTests();
  localStorage.clear();
});

describe('generationDb (IndexedDB)', () => {
  const NOW = Date.parse('2026-06-15T00:00:00.000Z');

  it('isolates results per account', async () => {
    await putResult('a', res('r1', '2026-06-14T00:00:00Z'));
    await putResult('b', res('r2', '2026-06-14T00:00:00Z'));
    const a = await loadAccount('a', NOW);
    const b = await loadAccount('b', NOW);
    expect(a.results.map((r) => r.receipt.generationId)).toEqual(['r1']);
    expect(b.results.map((r) => r.receipt.generationId)).toEqual(['r2']);
  });

  it('pruneExpired removes >14-day rows and loadAccount clears a dangling current pointer', async () => {
    await putResult('a', res('fresh', new Date(NOW - 2 * DAY).toISOString()));
    await putResult('a', res('stale', new Date(NOW - 20 * DAY).toISOString()));
    await putSession('a', { accountKey: 'a', face: null, outfit: null, currentResultId: 'stale' });
    const surviving = await pruneExpired('a', NOW);
    expect(surviving.map((r) => r.receipt.generationId)).toEqual(['fresh']);
    const loaded = await loadAccount('a', NOW);
    expect(loaded.results.map((r) => r.receipt.generationId)).toEqual(['fresh']);
    expect(loaded.session.currentResultId).toBeNull(); // pointed at the pruned row
  });

  it('deleteResult and renameResultDb mutate a single account', async () => {
    await putResult('a', res('r1', '2026-06-14T00:00:00Z'));
    await renameResultDb('a', 'r1', 'My Verdict');
    expect((await loadAccount('a', NOW)).results[0].name).toBe('My Verdict');
    await deleteResult('a', 'r1');
    expect((await loadAccount('a', NOW)).results).toHaveLength(0);
  });

  it('moveAccountData hands guest data to the account, then clears guest', async () => {
    await putResult('guest', res('g1', '2026-06-14T00:00:00Z'));
    await putSession('guest', { accountKey: 'guest', face: { url: 'gf' }, outfit: null, currentResultId: 'g1' });
    await moveAccountData('guest', 'u1', NOW);
    const u = await loadAccount('u1', NOW);
    expect(u.results.map((r) => r.receipt.generationId)).toEqual(['g1']);
    expect(u.session.face).toEqual({ url: 'gf' });
    expect(u.session.currentResultId).toBe('g1');
    const g = await loadAccount('guest', NOW);
    expect(g.results).toHaveLength(0);
    expect(g.session.face).toBeNull();
  });

  it('migrateLegacyLocalStorage imports the old blob into guest once, then removes it', async () => {
    localStorage.setItem('fitaura.state', JSON.stringify({
      face: { url: 'f' }, outfit: { url: 'o' },
      result: res('leg', '2026-06-14T00:00:00Z'),
      history: [res('leg', '2026-06-14T00:00:00Z'), res('leg2', '2026-06-13T00:00:00Z')],
    }));
    await migrateLegacyLocalStorage(NOW);
    const g = await loadAccount('guest', NOW);
    expect(g.results.map((r) => r.receipt.generationId).sort()).toEqual(['leg', 'leg2']);
    expect(g.session.face).toEqual({ url: 'f' });
    expect(g.session.currentResultId).toBe('leg');
    expect(localStorage.getItem('fitaura.state')).toBeNull(); // removed
  });
});
```

- [ ] **Step 3: Run the test, verify it fails**

Run: `npx vitest run src/state/generationDb.test.ts`
Expected: FAIL — `loadAccount` etc. are not exported yet.

- [ ] **Step 4: Append the IndexedDB wrapper to `generationDb.ts`**

Replace the `// --- IndexedDB wrapper added in Task 2 ---` marker line at the end of
`apps/web/src/state/generationDb.ts` with:

```ts
// --- IndexedDB wrapper ---

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(RESULTS)) {
        const store = db.createObjectStore(RESULTS, { keyPath: 'id' });
        store.createIndex('by_account', 'accountKey', { unique: false });
      }
      if (!db.objectStoreNames.contains(SESSION)) {
        db.createObjectStore(SESSION, { keyPath: 'accountKey' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function db(): Promise<IDBDatabase> {
  if (!dbPromise) dbPromise = openDb();
  return dbPromise;
}

function reqDone<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => {
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error);
  });
}

const resultId = (accountKey: string, generationId: string) => `${accountKey}::${generationId}`;

async function getResults(d: IDBDatabase, accountKey: string): Promise<GenerationResult[]> {
  const idx = d.transaction(RESULTS, 'readonly').objectStore(RESULTS).index('by_account');
  const rows = (await reqDone(idx.getAll(accountKey))) as StoredResult[];
  return rows.map((r) => r.result);
}

/** Reset the in-memory store between tests. */
export function resetDbForTests(): Promise<void> {
  dbPromise = null;
  return new Promise((res) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = req.onerror = req.onblocked = () => res();
  });
}

export async function putSession(accountKey: string, session: SessionRecord): Promise<void> {
  const d = await db();
  const tx = d.transaction(SESSION, 'readwrite');
  tx.objectStore(SESSION).put({ ...session, accountKey });
  await txDone(tx);
}

export async function putResult(accountKey: string, result: GenerationResult): Promise<void> {
  const d = await db();
  const tx = d.transaction(RESULTS, 'readwrite');
  tx.objectStore(RESULTS).put({ id: resultId(accountKey, result.receipt.generationId), accountKey, result });
  await txDone(tx);
  // Enforce the safety cap (separate tx so the read above has committed).
  const all = await getResults(d, accountKey);
  if (all.length > SAFETY_CAP) {
    const keep = new Set(trimToCap(all).map((r) => r.receipt.generationId));
    const tx2 = d.transaction(RESULTS, 'readwrite');
    const store = tx2.objectStore(RESULTS);
    for (const r of all) {
      if (!keep.has(r.receipt.generationId)) store.delete(resultId(accountKey, r.receipt.generationId));
    }
    await txDone(tx2);
  }
}

export async function deleteResult(accountKey: string, generationId: string): Promise<void> {
  const d = await db();
  const tx = d.transaction(RESULTS, 'readwrite');
  tx.objectStore(RESULTS).delete(resultId(accountKey, generationId));
  await txDone(tx);
}

export async function renameResultDb(accountKey: string, generationId: string, name: string): Promise<void> {
  const d = await db();
  const id = resultId(accountKey, generationId);
  const row = (await reqDone(d.transaction(RESULTS, 'readonly').objectStore(RESULTS).get(id))) as StoredResult | undefined;
  if (!row) return;
  const next: StoredResult = { ...row, result: { ...row.result, name: name.trim() || undefined } };
  const tx = d.transaction(RESULTS, 'readwrite');
  tx.objectStore(RESULTS).put(next);
  await txDone(tx);
}

/** Delete expired rows for an account; return the survivors. */
export async function pruneExpired(accountKey: string, now: number, maxAgeDays = MAX_AGE_DAYS): Promise<GenerationResult[]> {
  const d = await db();
  const all = await getResults(d, accountKey);
  const expired = all.filter((r) => isExpired(r.producedAt, now, maxAgeDays));
  if (expired.length) {
    const tx = d.transaction(RESULTS, 'readwrite');
    const store = tx.objectStore(RESULTS);
    for (const r of expired) store.delete(resultId(accountKey, r.receipt.generationId));
    await txDone(tx);
  }
  return all.filter((r) => !isExpired(r.producedAt, now, maxAgeDays));
}

/** Load an account's session + history, pruning expired rows and clearing a
 * dangling current-result pointer. */
export async function loadAccount(accountKey: string, now: number): Promise<AccountData> {
  const d = await db();
  const sessRaw = (await reqDone(d.transaction(SESSION, 'readonly').objectStore(SESSION).get(accountKey))) as SessionRecord | undefined;
  const session = sessRaw ? { ...sessRaw, accountKey } : emptySession(accountKey);
  const results = trimToCap(await pruneExpired(accountKey, now));
  if (session.currentResultId && !results.some((r) => r.receipt.generationId === session.currentResultId)) {
    session.currentResultId = null;
    await putSession(accountKey, session);
  }
  return { session, results };
}

export async function clearAccount(accountKey: string): Promise<void> {
  const d = await db();
  const results = await getResults(d, accountKey);
  const tx = d.transaction([RESULTS, SESSION], 'readwrite');
  const rs = tx.objectStore(RESULTS);
  for (const r of results) rs.delete(resultId(accountKey, r.receipt.generationId));
  tx.objectStore(SESSION).delete(accountKey);
  await txDone(tx);
}

/** One-time guest→account hand-off at login: merge guest data into the account,
 * then clear the guest namespace. No-op once guest is empty. */
export async function moveAccountData(fromKey: string, toKey: string, now: number): Promise<void> {
  const from = await loadAccount(fromKey, now);
  const hasData = from.results.length || from.session.face || from.session.outfit || from.session.currentResultId;
  if (!hasData) return;
  const to = await loadAccount(toKey, now);
  const merged = mergeGuestIntoAccount({ ...to, session: { ...to.session, accountKey: toKey } }, from);
  const d = await db();
  const tx = d.transaction(RESULTS, 'readwrite');
  const store = tx.objectStore(RESULTS);
  for (const r of merged.results) {
    store.put({ id: resultId(toKey, r.receipt.generationId), accountKey: toKey, result: r });
  }
  await txDone(tx);
  await putSession(toKey, { ...merged.session, accountKey: toKey });
  await clearAccount(fromKey);
}

/** One-time import of the legacy global `fitaura.state` localStorage blob into the
 * guest namespace, then delete it (reclaims quota; idempotent thereafter). */
export async function migrateLegacyLocalStorage(now: number): Promise<void> {
  let raw: string | null = null;
  try { raw = localStorage.getItem(LEGACY_KEY); } catch { return; }
  if (!raw) return;
  let parsed: { face?: UploadedPhoto | null; outfit?: UploadedPhoto | null; result?: GenerationResult | null; history?: GenerationResult[] };
  try { parsed = JSON.parse(raw); } catch { try { localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ } return; }

  const history = Array.isArray(parsed.history) ? parsed.history : [];
  const result = parsed.result ?? null;
  const combined = result && !history.some((h) => h.receipt.generationId === result.receipt.generationId)
    ? [result, ...history]
    : history;
  const all = trimToCap(combined.filter((r) => !isExpired(r.producedAt, now)));

  const d = await db();
  if (all.length) {
    const tx = d.transaction(RESULTS, 'readwrite');
    const store = tx.objectStore(RESULTS);
    for (const r of all) store.put({ id: resultId('guest', r.receipt.generationId), accountKey: 'guest', result: r });
    await txDone(tx);
  }
  await putSession('guest', {
    accountKey: 'guest',
    face: parsed.face ?? null,
    outfit: parsed.outfit ?? null,
    currentResultId: result?.receipt.generationId ?? null,
  });
  try { localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
}
```

- [ ] **Step 5: Run the test, verify it passes**

Run: `npx vitest run src/state/generationDb.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/state/generationDb.ts apps/web/src/state/generationDb.test.ts apps/web/package.json package-lock.json
git commit -m "feat(web): per-account vault — IndexedDB wrapper + fake-indexeddb tests"
```

---

### Task 3: Expose `userId` from `AccountContext`

**Files:**
- Modify: `apps/web/src/features/account/AccountContext.tsx`

- [ ] **Step 1: Add `userId` to the context type**

In the `AccountContextValue` interface (after `signedIn: boolean;`, around line 42), add:

```ts
  /** Stable account id used to namespace on-device storage (null when signed out). */
  userId: string | null;
```

- [ ] **Step 2: Add `userId` to the value object + memo deps**

In the `useMemo` value object (around line 291, after `signedIn,`), add `userId,`. Then in
the dependency array at the bottom of the `useMemo` (around line 319, after `signedIn,`), add
`userId,`.

- [ ] **Step 3: Verify typecheck of the file's package**

Run (from `apps/web`): `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/account/AccountContext.tsx
git commit -m "feat(web): expose userId from AccountContext for storage scoping"
```

---

### Task 4: Rewrite `GenerationProvider` on IndexedDB (async + `hydrated`)

**Files:**
- Rewrite: `apps/web/src/state/generation.tsx`

**Note:** No unit test here — this is integration glue over the Task 1–2 functions (already
tested) and pure delegation. It's verified by `typecheck` + the full suite + the manual smoke
in Task 6.

- [ ] **Step 1: Replace the contents of `generation.tsx`**

Replace the entire file `apps/web/src/state/generation.tsx` with:

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { runSoloScan, type SoloScanOutcome } from '../services/soloScanService';
import { useAccount } from '../features/account/AccountContext';
import {
  accountKeyFor, loadAccount, putResult, putSession, deleteResult, renameResultDb,
  moveAccountData, migrateLegacyLocalStorage, trimToCap,
  type UploadedPhoto, type GenerationResult,
} from './generationDb';

// Re-export the shared types so existing consumers keep importing them from here.
export type { UploadedPhoto, GenerationResult } from './generationDb';

/** The retake fields, derived from the service outcome so the two can't drift. */
export type RetakeInfo = Omit<Extract<SoloScanOutcome, { kind: 'retake' }>, 'kind'>;

type RunOutcome =
  | { ok: true; result: GenerationResult }
  | { ok: false; reason: 'missing_photos' }
  | { ok: false; reason: 'retake'; retake: RetakeInfo }
  | { ok: false; reason: 'error'; message: string };

interface GenerationContextValue {
  face: UploadedPhoto | null;
  outfit: UploadedPhoto | null;
  result: GenerationResult | null;
  bothPhotosReady: boolean;
  /** Recent on-device results for the current account (newest first). */
  history: GenerationResult[];
  /** False until the current account's on-device data has loaded from IndexedDB. */
  hydrated: boolean;
  setFace: (photo: UploadedPhoto | null) => void;
  setOutfit: (photo: UploadedPhoto | null) => void;
  runGeneration: () => Promise<RunOutcome>;
  startNewScan: () => void;
  openResult: (generationId: string) => boolean;
  removeResult: (generationId: string) => void;
  renameResult: (generationId: string, name: string) => void;
}

const GenerationContext = createContext<GenerationContextValue | null>(null);

export function GenerationProvider({ children }: { children: ReactNode }) {
  const { userId } = useAccount();
  const accountKey = accountKeyFor(userId);

  const [face, setFaceState] = useState<UploadedPhoto | null>(null);
  const [outfit, setOutfitState] = useState<UploadedPhoto | null>(null);
  const [history, setHistory] = useState<GenerationResult[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const result = useMemo(
    () => history.find((h) => h.receipt.generationId === currentId) ?? null,
    [history, currentId],
  );

  // Latest snapshot for callbacks that run after an await (avoids stale closures).
  const stateRef = useRef({ face, outfit, history, currentId, accountKey });
  stateRef.current = { face, outfit, history, currentId, accountKey };

  // Tracks the previous account so a guest→login transition can be detected.
  // undefined = first run (no hand-off); null = was guest; string = was signed in.
  const prevUserId = useRef<string | null | undefined>(undefined);

  // Hydrate on mount and on account switch; run the one-time legacy migration and
  // the guest→login hand-off. Degrades to in-memory if IndexedDB is unavailable.
  useEffect(() => {
    let active = true;
    setHydrated(false);
    void (async () => {
      try {
        await migrateLegacyLocalStorage(Date.now());
        if (prevUserId.current === null && userId) {
          await moveAccountData('guest', accountKey, Date.now());
        }
        const data = await loadAccount(accountKey, Date.now());
        if (!active) return;
        setFaceState(data.session.face);
        setOutfitState(data.session.outfit);
        setCurrentId(data.session.currentResultId);
        setHistory(data.results);
      } catch {
        // IndexedDB blocked/unavailable — keep whatever is in memory.
      } finally {
        if (active) {
          prevUserId.current = userId;
          setHydrated(true);
        }
      }
    })();
    return () => { active = false; };
  }, [accountKey, userId]);

  const persistSession = useCallback((next: Partial<{ face: UploadedPhoto | null; outfit: UploadedPhoto | null; currentResultId: string | null }>) => {
    const s = stateRef.current;
    void putSession(s.accountKey, {
      accountKey: s.accountKey,
      face: next.face !== undefined ? next.face : s.face,
      outfit: next.outfit !== undefined ? next.outfit : s.outfit,
      currentResultId: next.currentResultId !== undefined ? next.currentResultId : s.currentId,
    });
  }, []);

  const setFace = useCallback((photo: UploadedPhoto | null) => {
    setFaceState(photo);
    persistSession({ face: photo });
  }, [persistSession]);

  const setOutfit = useCallback((photo: UploadedPhoto | null) => {
    setOutfitState(photo);
    persistSession({ outfit: photo });
  }, [persistSession]);

  const bothPhotosReady = !!face && !!outfit;

  const runGeneration = useCallback<GenerationContextValue['runGeneration']>(async () => {
    const s = stateRef.current;
    if (!s.face || !s.outfit) return { ok: false, reason: 'missing_photos' };

    const outcome = await runSoloScan(s.face.url, s.outfit.url);
    if (outcome.kind === 'retake') {
      return { ok: false, reason: 'retake', retake: { faceUsable: outcome.faceUsable, outfitUsable: outcome.outfitUsable, instruction: outcome.instruction } };
    }
    if (outcome.kind === 'error') {
      return { ok: false, reason: 'error', message: outcome.message };
    }

    const now = new Date().toISOString();
    const base = outcome.result;
    // Use the photos actually scanned (captured before the await) for card images.
    const cur = stateRef.current;
    const result: GenerationResult = {
      ...base,
      producedAt: now,
      face: { ...base.face, card: { ...base.face.card, imageUrl: cur.face?.url ?? null } },
      outfit: { ...base.outfit, card: { ...base.outfit.card, imageUrl: cur.outfit?.url ?? null } },
      receipt: { ...base.receipt, generatedAt: now },
    };

    await putResult(cur.accountKey, result);
    void putSession(cur.accountKey, { accountKey: cur.accountKey, face: cur.face, outfit: cur.outfit, currentResultId: result.receipt.generationId });
    setHistory((prev) => trimToCap([result, ...prev.filter((h) => h.receipt.generationId !== result.receipt.generationId)]));
    setCurrentId(result.receipt.generationId);
    return { ok: true, result };
  }, []);

  const startNewScan = useCallback(() => {
    setFaceState(null);
    setOutfitState(null);
    persistSession({ face: null, outfit: null });
  }, [persistSession]);

  const openResult = useCallback((generationId: string) => {
    const s = stateRef.current;
    if (!s.history.some((h) => h.receipt.generationId === generationId)) return false;
    setCurrentId(generationId);
    persistSession({ currentResultId: generationId });
    return true;
  }, [persistSession]);

  const removeResult = useCallback((generationId: string) => {
    const s = stateRef.current;
    setHistory((prev) => prev.filter((h) => h.receipt.generationId !== generationId));
    if (s.currentId === generationId) {
      setCurrentId(null);
      persistSession({ currentResultId: null });
    }
    void deleteResult(s.accountKey, generationId);
  }, [persistSession]);

  const renameResult = useCallback((generationId: string, name: string) => {
    const clean = name.trim();
    setHistory((prev) => prev.map((r) => (r.receipt.generationId === generationId ? { ...r, name: clean || undefined } : r)));
    void renameResultDb(stateRef.current.accountKey, generationId, clean);
  }, []);

  const value = useMemo<GenerationContextValue>(
    () => ({
      face, outfit, result, bothPhotosReady, history, hydrated,
      setFace, setOutfit, runGeneration, startNewScan, openResult, removeResult, renameResult,
    }),
    [face, outfit, result, bothPhotosReady, history, hydrated, setFace, setOutfit, runGeneration, startNewScan, openResult, removeResult, renameResult],
  );

  return <GenerationContext.Provider value={value}>{children}</GenerationContext.Provider>;
}

export function useGeneration(): GenerationContextValue {
  const ctx = useContext(GenerationContext);
  if (!ctx) throw new Error('useGeneration must be used within a GenerationProvider');
  return ctx;
}
```

- [ ] **Step 2: Typecheck**

Run (from `apps/web`): `npm run typecheck`
Expected: no errors. (`generation.tsx` still exports `GenerationResult`/`UploadedPhoto`, so
`SoloMode.tsx`'s `import { ..., type GenerationResult }` keeps resolving.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/state/generation.tsx
git commit -m "feat(web): async IndexedDB-backed GenerationProvider with hydrated flag"
```

---

### Task 5: Gate consumers on `hydrated`

**Files:**
- Modify: `apps/web/src/features/result/Result.tsx:44-50`
- Modify: `apps/web/src/features/scan/Scan.tsx:109,139-141,150-151`
- Modify: `apps/web/src/features/vault/SoloMode.tsx:153,172,262`

- [ ] **Step 1: Result — don't redirect home until hydrated**

In `apps/web/src/features/result/Result.tsx`, change the destructure (line 44) and the
redirect effect (lines 47-50):

```tsx
  const { result, startNewScan, hydrated } = useGeneration();
```

```tsx
  // No result yet → back to the start. Wait for hydration so a reload at /result
  // doesn't bounce home before IndexedDB has loaded the current result.
  useEffect(() => {
    if (hydrated && !result) navigate('/', { replace: true });
  }, [hydrated, result, navigate]);
```

(Leave the `if (!result) return null;` at line 174 as-is — it renders nothing while
hydrating.)

- [ ] **Step 2: Scan — don't redirect or kick off generation until hydrated**

In `apps/web/src/features/scan/Scan.tsx`, change the destructure (line 109):

```tsx
  const { face, outfit, bothPhotosReady, runGeneration, hydrated } = useGeneration();
```

Change the photos guard (lines 139-141):

```tsx
  // Guard: a scan needs both confirmed photos (after hydration, so a reload here
  // doesn't bounce to the upload page before IndexedDB loads).
  useEffect(() => {
    if (hydrated && !bothPhotosReady) navigate('/scan', { replace: true });
  }, [hydrated, bothPhotosReady, navigate]);
```

In the generation-kickoff effect, add a hydration guard as the first line of the effect body
(before `if (!bothPhotosReady || startedRef.current) return;`, line 151):

```tsx
    if (!hydrated) return;
```

and add `hydrated` to that effect's dependency array (line 187), e.g. change
`[bothPhotosReady, signedIn, ...]` to `[hydrated, bothPhotosReady, signedIn, canScan, spendForScan, runGeneration, refundScan, openPaywall, navigate]`.

- [ ] **Step 3: SoloMode — don't flash the empty state before hydration**

In `apps/web/src/features/vault/SoloMode.tsx`, change the destructure (line 153):

```tsx
  const { history, startNewScan, openResult, removeResult, renameResult, hydrated } = useGeneration();
```

Change `hasResults` (line 172) to require hydration:

```tsx
  const hasResults = hydrated && history.length > 0;
```

Then guard the empty-state branch so it only shows once loaded. Change the closing of the
results conditional (the `) : (` before the empty state, around line 311) so the empty state
is suppressed while not hydrated — replace the `) : (` … empty-state opening with:

```tsx
      ) : !hydrated ? (
        <div className="vlt-empty" style={{ minHeight: 160 }} aria-busy="true" />
      ) : (
```

(The existing empty-state block and its closing `)` stay unchanged.)

- [ ] **Step 4: Typecheck**

Run (from `apps/web`): `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/result/Result.tsx apps/web/src/features/scan/Scan.tsx apps/web/src/features/vault/SoloMode.tsx
git commit -m "feat(web): gate result/scan/vault on hydration to avoid async flicker"
```

---

### Task 6: Full verification + manual smoke

- [ ] **Step 1: Typecheck both workspaces**

Run (from repo root): `npm run typecheck`
Expected: no errors.

- [ ] **Step 2: Full web test suite**

Run (from `apps/web`): `npm test`
Expected: all suites PASS, including the two new `generationDb*` files and the existing
scoring/credits/etc. suites.

- [ ] **Step 3: Production build**

Run (from repo root): `npm run build`
Expected: succeeds (pre-existing chunk-size warning is fine).

- [ ] **Step 4: Manual smoke (dev server)**

Run (from repo root): `npm run dev`, then verify:
1. Sign in as account A, run/scan, confirm a result saves and shows in the vault.
2. Reload `/result` and `/vault` — data persists, no bounce to home (the hydration gate).
3. Log out, log in as account B — B does **not** see A's photos/results.
4. Log back in as A — A's data is back.
5. As a guest, upload photos then sign up/in — the photos carry into the account.
6. (Expiry spot-check) In DevTools console, confirm `loadAccount` prunes: not required to
   wait 14 days — the `generationDb` unit test already covers the 14-day boundary.

- [ ] **Step 5: Commit any smoke fixups (if needed)**

```bash
git add -A && git commit -m "fix(web): per-account vault smoke fixes" || echo "nothing to commit"
```

---

## Self-Review notes

- **Spec coverage:** per-account scoping (T2 isolation + T4 keying); IndexedDB store w/
  results+session (T1/T2); async provider + `hydrated` (T4) + consumer gates (T5);
  guest→login hand-off (`moveAccountData`/`mergeGuestIntoAccount`, T1/T2/T4); logout-keeps-data
  (falls out of namespacing — verified in T6 smoke 3–4); 14-day created-time expiry
  (`isExpired`/`pruneExpired`, T1/T2 + load in T4); SAFETY_CAP 100 (T1/T2); legacy migration
  to guest (T2/T4); `userId` exposure (T3); `fake-indexeddb` devDep (T2); tests (T1/T2). All
  spec sections mapped.
- **Stays global (per spec):** `fitaura.tab`, `fitaura.freeScanUsed`, and the Result-page
  `fitaura.paper`/`fitaura.stickerOn` prefs — untouched, still via `useLocalStorage`.
- **Type consistency:** `accountKeyFor`, `loadAccount`, `putResult`, `putSession`,
  `deleteResult`, `renameResultDb`, `pruneExpired`, `moveAccountData`,
  `migrateLegacyLocalStorage`, `trimToCap`, `mergeGuestIntoAccount`, and the
  `UploadedPhoto`/`GenerationResult`/`SessionRecord`/`AccountData` types are defined in Task
  1–2 and used with identical signatures in Task 4. `hydrated` added to the context in T4 and
  consumed in T5. `GenerationResult`/`UploadedPhoto` re-exported from `generation.tsx` so
  `SoloMode.tsx` keeps compiling.
- **No edge-function / Supabase change** — this is frontend-only, so a `git push` (Vercel)
  ships it; no `functions deploy` needed.
