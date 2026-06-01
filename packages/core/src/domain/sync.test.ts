import { describe, it, expect } from 'vitest';
import { reconcileCollection } from './sync';
import type { OwnedLegoItem } from '../types/lego';

function makeItem(id: string, updatedAt: string, overrides: Partial<OwnedLegoItem> = {}): OwnedLegoItem {
  return {
    id,
    type: 'set',
    number: '10305',
    name: 'Test Set',
    theme: 'Icons',
    year: 2022,
    pieceCount: 100,
    retired: false,
    estimatedValue: 99.99,
    imageUrl: 'http://example.com/img.jpg',
    status: 'collection',
    acquiredQuality: 'new',
    savedBox: true,
    buildStatus: 'not-started',
    displayLocation: '',
    notes: '',
    missingParts: '',
    quantity: 1,
    addedAt: '2024-01-01T00:00:00.000Z',
    updatedAt,
    ...overrides,
  };
}

describe('reconcileCollection', () => {
  it('uses remote item when remote updatedAt is newer', () => {
    const local = [makeItem('a', '2024-01-01T00:00:00.000Z', { notes: 'local' })];
    const remote = [makeItem('a', '2024-01-02T00:00:00.000Z', { notes: 'remote' })];
    const result = reconcileCollection(local, remote, []);
    expect(result).toHaveLength(1);
    expect(result[0].notes).toBe('remote');
  });

  it('keeps local item when local updatedAt is strictly newer', () => {
    const local = [makeItem('a', '2024-01-03T00:00:00.000Z', { notes: 'local' })];
    const remote = [makeItem('a', '2024-01-02T00:00:00.000Z', { notes: 'remote' })];
    const result = reconcileCollection(local, remote, []);
    expect(result[0].notes).toBe('local');
  });

  it('remote wins on equal updatedAt (tie-break)', () => {
    const ts = '2024-01-01T00:00:00.000Z';
    const local = [makeItem('a', ts, { notes: 'local' })];
    const remote = [makeItem('a', ts, { notes: 'remote' })];
    const result = reconcileCollection(local, remote, []);
    expect(result[0].notes).toBe('remote');
  });

  it('adds remote item that has no local copy', () => {
    const local: OwnedLegoItem[] = [];
    const remote = [makeItem('new-item', '2024-01-01T00:00:00.000Z')];
    const result = reconcileCollection(local, remote, []);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('new-item');
  });

  it('preserves local-only item not present in remote', () => {
    const local = [makeItem('local-only', '2024-01-01T00:00:00.000Z')];
    const remote: OwnedLegoItem[] = [];
    const result = reconcileCollection(local, remote, []);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('local-only');
  });

  it('removes local item that appears in tombstoneIds', () => {
    const local = [makeItem('a', '2024-01-01T00:00:00.000Z')];
    const result = reconcileCollection(local, [], ['a']);
    expect(result).toHaveLength(0);
  });

  it('tombstone beats a locally-newer edit (tombstone applied first)', () => {
    const local = [makeItem('a', '2024-01-10T00:00:00.000Z', { notes: 'edited locally' })];
    const result = reconcileCollection(local, [], ['a']);
    expect(result).toHaveLength(0);
  });

  it('returns empty array when both local and remote are empty', () => {
    expect(reconcileCollection([], [], [])).toEqual([]);
  });

  it('handles multiple items correctly', () => {
    const local = [
      makeItem('a', '2024-01-01T00:00:00.000Z', { notes: 'local-a' }),
      makeItem('b', '2024-01-03T00:00:00.000Z', { notes: 'local-b-newer' }),
      makeItem('c', '2024-01-01T00:00:00.000Z', { notes: 'local-only' }),
    ];
    const remote = [
      makeItem('a', '2024-01-02T00:00:00.000Z', { notes: 'remote-a-newer' }),
      makeItem('b', '2024-01-01T00:00:00.000Z', { notes: 'remote-b' }),
      makeItem('d', '2024-01-01T00:00:00.000Z', { notes: 'remote-only' }),
    ];
    const result = reconcileCollection(local, remote, []);
    const byId = Object.fromEntries(result.map(i => [i.id, i]));
    expect(byId['a'].notes).toBe('remote-a-newer');
    expect(byId['b'].notes).toBe('local-b-newer');
    expect(byId['c'].notes).toBe('local-only');
    expect(byId['d'].notes).toBe('remote-only');
  });
});
