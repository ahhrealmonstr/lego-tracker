import { describe, expect, it, beforeEach } from 'vitest';
import { nowIso, __resetClockForTests } from './clock';

describe('nowIso', () => {
  beforeEach(() => {
    __resetClockForTests();
  });

  it('never returns the same timestamp twice in a row', () => {
    // The bug this exists to prevent: `new Date().toISOString()` has millisecond
    // resolution, so two edits inside the same millisecond produced IDENTICAL
    // `updatedAt` values ~99.95% of the time. Reconciliation then treats them as
    // concurrent and `sync.ts` awards the tie to remote, silently discarding the
    // local edit.
    expect(nowIso()).not.toBe(nowIso());
  });

  it('is strictly increasing across a rapid burst', () => {
    const stamps = Array.from({ length: 1000 }, () => nowIso());

    expect(new Set(stamps).size).toBe(1000);
    for (let i = 1; i < stamps.length; i++) {
      expect(stamps[i] > stamps[i - 1]).toBe(true);
    }
  });

  it('produces valid ISO-8601 strings that parse back to the same instant', () => {
    const stamp = nowIso();

    expect(stamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(new Date(stamp).toISOString()).toBe(stamp);
  });

  it('tracks the wall clock rather than drifting away from it', async () => {
    const before = Date.now();
    nowIso();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const stamp = nowIso();

    // After real time advances, the stamp follows it instead of continuing to
    // increment from the synthetic counter.
    expect(new Date(stamp).getTime()).toBeGreaterThanOrEqual(before + 5);
    expect(new Date(stamp).getTime()).toBeLessThan(before + 5_000);
  });

  it('resets its internal high-water mark for test isolation', () => {
    const burst = Array.from({ length: 50 }, () => nowIso());
    const lastOfBurst = burst[burst.length - 1];

    __resetClockForTests();

    // Without the reset the high-water mark would keep the next stamp above the
    // burst; after it, the clock is free to return to wall time.
    expect(new Date(nowIso()).getTime()).toBeLessThanOrEqual(new Date(lastOfBurst).getTime());
  });
});
