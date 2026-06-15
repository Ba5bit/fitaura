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
export async function resetDbForTests(): Promise<void> {
  // Close the open connection first so deleteDatabase doesn't block.
  if (dbPromise) {
    try {
      const d = await dbPromise;
      d.close();
    } catch { /* ignore */ }
    dbPromise = null;
  }
  await new Promise<void>((res) => {
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
