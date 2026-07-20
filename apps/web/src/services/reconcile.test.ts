import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@lego-tracker/core', () => ({
  loadCollectionFromCloud: vi.fn(),
  reconcileCollection: vi.fn((_local, items) => items),
  syncCollectionToCloud: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./storage', () => ({
  loadCollection: vi.fn(() => []),
  saveCollection: vi.fn(),
}));

vi.mock('./syncQueue', () => ({
  loadSyncQueue: vi.fn(() => []),
  clearSyncQueue: vi.fn(),
}));

import { loadCollectionFromCloud } from '@lego-tracker/core';
import { reconcile } from './reconcile';

const mockLoadFromCloud = vi.mocked(loadCollectionFromCloud);

type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void };

function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>(res => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reconcile single-flight guard', () => {
  it('runs the underlying reconcile exactly once for concurrent triggers (SC6)', async () => {
    const d = deferred<{ items: []; tombstoneIds: [] }>();
    mockLoadFromCloud.mockReturnValueOnce(d.promise);

    // Two concurrent triggers (interval + online + manual can overlap).
    const first = reconcile();
    const second = reconcile();

    // Both callers share the same in-flight promise.
    expect(first).toBe(second);
    expect(mockLoadFromCloud).toHaveBeenCalledTimes(1);

    d.resolve({ items: [], tombstoneIds: [] });
    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBeUndefined();

    // Still exactly one underlying run across both concurrent callers.
    expect(mockLoadFromCloud).toHaveBeenCalledTimes(1);
  });

  it('resets the guard so a later reconcile runs again', async () => {
    mockLoadFromCloud.mockResolvedValue({ items: [], tombstoneIds: [] } as never);

    await reconcile();
    expect(mockLoadFromCloud).toHaveBeenCalledTimes(1);

    await reconcile();
    expect(mockLoadFromCloud).toHaveBeenCalledTimes(2);
  });
});
