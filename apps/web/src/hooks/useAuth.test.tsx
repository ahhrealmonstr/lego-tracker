import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('@lego-tracker/core', () => ({
  ensureAnonymousSession: vi.fn(),
  getSessionSnapshot: vi.fn(),
  linkEmailIdentity: vi.fn(),
  onSessionChange: vi.fn(),
}));

import { ensureAnonymousSession, getSessionSnapshot, onSessionChange } from '@lego-tracker/core';
import { useAuth } from './useAuth';

const mockEnsure = vi.mocked(ensureAnonymousSession);
const mockSnapshot = vi.mocked(getSessionSnapshot);
const mockOnSessionChange = vi.mocked(onSessionChange);

beforeEach(() => {
  vi.clearAllMocks();
  mockOnSessionChange.mockReturnValue(() => {});
});

describe('useAuth', () => {
  it('bootstraps an anon session and reports backed-up', async () => {
    mockSnapshot
      .mockReturnValueOnce({ userId: null, isAnonymous: false })
      .mockReturnValue({ userId: 'anon-1', isAnonymous: true });
    mockEnsure.mockResolvedValue({ ok: true, userId: 'anon-1', isAnonymous: true });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.sessionReady).toBe(true));
    expect(result.current.userId).toBe('anon-1');
    expect(result.current.isAnonymous).toBe(true);
    expect(result.current.backupState).toBe('backed-up');
  });

  it('fails open to error state without crashing (SC9)', async () => {
    mockSnapshot.mockReturnValue({ userId: null, isAnonymous: false });
    mockEnsure.mockResolvedValue({ ok: false, reason: 'anon-disabled' });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.sessionReady).toBe(true));
    expect(result.current.backupState).toBe('error');
  });

  it('reflects an account-link return, preserving the uid (SC5)', async () => {
    mockSnapshot.mockReturnValue({ userId: 'anon-1', isAnonymous: true });
    mockEnsure.mockResolvedValue({ ok: true, userId: 'anon-1', isAnonymous: true });
    let emit: ((s: { userId: string | null; isAnonymous: boolean }) => void) | undefined;
    mockOnSessionChange.mockImplementation((cb) => {
      emit = cb;
      return () => {};
    });

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.sessionReady).toBe(true));
    expect(result.current.isAnonymous).toBe(true);

    // Magic-link return completes the link: same uid, no longer anonymous.
    act(() => emit?.({ userId: 'anon-1', isAnonymous: false }));

    expect(result.current.isAnonymous).toBe(false);
    expect(result.current.userId).toBe('anon-1');
  });

  it('unsubscribes from session changes on unmount', async () => {
    mockSnapshot.mockReturnValue({ userId: 'anon-1', isAnonymous: true });
    mockEnsure.mockResolvedValue({ ok: true, userId: 'anon-1', isAnonymous: true });
    const unsub = vi.fn();
    mockOnSessionChange.mockReturnValue(unsub);

    const { unmount, result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.sessionReady).toBe(true));
    unmount();
    expect(unsub).toHaveBeenCalledTimes(1);
  });
});
