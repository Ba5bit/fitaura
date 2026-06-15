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
