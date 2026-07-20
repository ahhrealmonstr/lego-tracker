import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('@lego-tracker/core', () => ({
  ensureAnonymousSession: vi.fn(),
  getSessionSnapshot: vi.fn(),
  linkEmailIdentity: vi.fn(),
}));

import { ensureAnonymousSession, getSessionSnapshot } from '@lego-tracker/core';
import { useAuth } from './useAuth';

const mockEnsure = vi.mocked(ensureAnonymousSession);
const mockSnapshot = vi.mocked(getSessionSnapshot);

beforeEach(() => vi.clearAllMocks());

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
});
