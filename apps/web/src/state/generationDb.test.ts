// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadAccount, putResult, deleteResult, renameResultDb, putSession,
  pruneExpired, moveAccountData, migrateLegacyLocalStorage, resetDbForTests,
  clearAccount, putBattle, loadBattles, deleteBattle, renameBattleDb,
  SAFETY_CAP,
  type GenerationResult, type SavedBattle,
} from './generationDb';

const DAY = 86_400_000;
const res = (id: string, producedAt: string, name?: string): GenerationResult =>
  ({ receipt: { generationId: id }, verdict: 'normie', producedAt, name } as unknown as GenerationResult);
const bat = (id: string, producedAt: string, name?: string): SavedBattle =>
  ({ battleId: id, producedAt, name, mode: 'both', nameA: 'A', nameB: 'B', imgs: {},
     result: { mode: 'both', face: null, fit: null, copy: {} } } as unknown as SavedBattle);

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

  it('enforces SAFETY_CAP: inserting more than 100 results keeps only the newest 100', async () => {
    // Produce 102 results with strictly increasing producedAt, all within 14 days,
    // so expiry doesn't interfere. Result i is dated NOW - (102 - i) minutes ago,
    // meaning result 0 is oldest and result 101 is newest.
    const total = SAFETY_CAP + 2; // 102
    for (let i = 0; i < total; i++) {
      const producedAt = new Date(NOW - (total - i) * 60_000).toISOString();
      await putResult('cap-test', res(`r${i}`, producedAt));
    }
    const loaded = await loadAccount('cap-test', NOW);
    // Only SAFETY_CAP results should survive.
    expect(loaded.results.length).toBe(SAFETY_CAP);
    // The two oldest (r0 and r1) must have been dropped.
    const ids = new Set(loaded.results.map((r) => r.receipt.generationId));
    expect(ids.has('r0')).toBe(false);
    expect(ids.has('r1')).toBe(false);
    // The newest result must still be present.
    expect(ids.has(`r${total - 1}`)).toBe(true);
  });
});

describe('generationDb — Friend vs Friend battles', () => {
  const NOW = Date.parse('2026-06-15T00:00:00.000Z');

  it('isolates battles per account, newest first', async () => {
    await putBattle('a', bat('b1', new Date(NOW - 2 * DAY).toISOString()));
    await putBattle('a', bat('b2', new Date(NOW - 1 * DAY).toISOString()));
    await putBattle('u1', bat('b3', '2026-06-14T00:00:00Z'));
    expect((await loadBattles('a', NOW)).map((b) => b.battleId)).toEqual(['b2', 'b1']);
    expect((await loadBattles('u1', NOW)).map((b) => b.battleId)).toEqual(['b3']);
  });

  it('prunes battles older than 14 days', async () => {
    await putBattle('a', bat('fresh', new Date(NOW - 2 * DAY).toISOString()));
    await putBattle('a', bat('stale', new Date(NOW - 20 * DAY).toISOString()));
    expect((await loadBattles('a', NOW)).map((b) => b.battleId)).toEqual(['fresh']);
  });

  it('deleteBattle and renameBattleDb mutate a single battle', async () => {
    await putBattle('a', bat('b1', '2026-06-14T00:00:00Z'));
    await renameBattleDb('a', 'b1', 'Maya vs Theo');
    expect((await loadBattles('a', NOW))[0].name).toBe('Maya vs Theo');
    await deleteBattle('a', 'b1');
    expect(await loadBattles('a', NOW)).toHaveLength(0);
  });

  it('clearAccount wipes battles alongside results', async () => {
    await putResult('u1', res('r1', '2026-06-14T00:00:00Z'));
    await putBattle('u1', bat('b1', '2026-06-14T00:00:00Z'));
    await clearAccount('u1');
    expect((await loadAccount('u1', NOW)).results).toHaveLength(0);
    expect(await loadBattles('u1', NOW)).toHaveLength(0);
  });
});
