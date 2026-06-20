import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { discoverCases } from './cases.ts';

let root: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'cases-'));
  // "alice": face only (jpg)
  mkdirSync(join(root, 'alice'));
  writeFileSync(join(root, 'alice', 'face.jpg'), Buffer.from([0xff, 0xd8, 0xff]));
  // "bob": face (png) + outfit (webp)
  mkdirSync(join(root, 'bob'));
  writeFileSync(join(root, 'bob', 'face.png'), Buffer.from([0x89, 0x50, 0x4e]));
  writeFileSync(join(root, 'bob', 'outfit.webp'), Buffer.from([0x52, 0x49, 0x46]));
  // "empty": no images — must be skipped
  mkdirSync(join(root, 'empty'));
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('discoverCases', () => {
  it('finds cases with face and/or outfit, skips empty folders, sorted', () => {
    const cases = discoverCases(root);
    expect(cases.map((c) => c.name)).toEqual(['alice', 'bob']);
  });

  it('detects modality + mime per image and loads base64', () => {
    const cases = discoverCases(root);
    const alice = cases.find((c) => c.name === 'alice')!;
    expect(alice.face?.mimeType).toBe('image/jpeg');
    expect(alice.outfit).toBeUndefined();
    expect(typeof alice.face?.data).toBe('string');
    const bob = cases.find((c) => c.name === 'bob')!;
    expect(bob.face?.mimeType).toBe('image/png');
    expect(bob.outfit?.mimeType).toBe('image/webp');
  });

  it('returns [] for a missing directory', () => {
    expect(discoverCases(join(root, 'nope'))).toEqual([]);
  });
});
