// @vitest-environment jsdom
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
