import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

vi.mock('../services/reconcile', () => ({
  reconcile: vi.fn(),
}));

import { reconcile } from '../services/reconcile';
import { useSync } from './useSync';

const mockReconcile = vi.mocked(reconcile);

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true, writable: true });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockReconcile.mockResolvedValue(undefined);
  setOnline(true);
});

afterEach(() => {
  setOnline(true);
});

describe('useSync session gating', () => {
  it('does not reconcile after mount when sessionReady is false', async () => {
    renderHook(() => useSync(false));
    // give any effects a chance to run
    await Promise.resolve();
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('reconciles once when sessionReady becomes true', async () => {
    const { rerender } = renderHook(({ ready }: { ready: boolean }) => useSync(ready), {
      initialProps: { ready: false },
    });
    expect(mockReconcile).not.toHaveBeenCalled();

    rerender({ ready: true });
    await waitFor(() => expect(mockReconcile).toHaveBeenCalledTimes(1));
  });

  it('reports offline and does not reconcile when navigator is offline', async () => {
    setOnline(false);
    const { result } = renderHook(() => useSync(true));
    await waitFor(() => expect(result.current.status).toBe('offline'));
    expect(mockReconcile).not.toHaveBeenCalled();
  });
});

describe('useSync typed error surfacing (SC7)', () => {
  it('surfaces a distinguishable error reason from the thrown error', async () => {
    mockReconcile.mockRejectedValueOnce(new Error('rate-limited'));
    const { result } = renderHook(() => useSync(true));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorReason).toBe('rate-limited');
  });

  it('clears the error reason on a subsequent successful run', async () => {
    mockReconcile.mockRejectedValueOnce(new Error('rate-limited'));
    const { result } = renderHook(() => useSync(true));
    await waitFor(() => expect(result.current.errorReason).toBe('rate-limited'));

    mockReconcile.mockResolvedValueOnce(undefined);
    await act(async () => {
      result.current.triggerSync();
    });

    await waitFor(() => expect(result.current.status).toBe('idle'));
    expect(result.current.errorReason).toBeNull();
  });

  it('falls back to "unknown" for a non-Error rejection', async () => {
    mockReconcile.mockRejectedValueOnce('boom');
    const { result } = renderHook(() => useSync(true));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorReason).toBe('unknown');
  });
});
