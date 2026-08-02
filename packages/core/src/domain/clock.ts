/**
 * Monotonic timestamp source for anything that participates in reconciliation.
 *
 * `new Date().toISOString()` has millisecond resolution, so two mutations inside
 * the same millisecond produce IDENTICAL timestamps — measured at 1999/2000 for
 * back-to-back calls. Reconciliation (`domain/sync.ts`) compares with
 * `remote.updatedAt >= local.updatedAt`, awarding ties to remote, so a local edit
 * racing a remote write in the same millisecond was discarded 100% of the time.
 *
 * `nowIso()` guarantees each call within a process returns a strictly greater
 * value than the last. When the wall clock has advanced past the high-water mark
 * it is used directly; otherwise the mark advances by 1ms. Drift is bounded by
 * the burst length and self-corrects as soon as real time catches up.
 *
 * SCOPE: this fixes same-device ordering, which is the case that was reliably
 * losing data. Two *different* devices can still stamp the same millisecond
 * independently, and reconciliation will still award that tie to remote. Closing
 * that requires a per-device tiebreaker in the comparison — see the
 * `collection_events` log in docs/changes/provenance-data-model/proposal.md,
 * which supersedes last-write-wins for anything that matters.
 */

let highWaterMark = 0;

export function nowIso(): string {
  const wall = Date.now();
  const next = wall > highWaterMark ? wall : highWaterMark + 1;
  highWaterMark = next;
  return new Date(next).toISOString();
}

/**
 * Drop the high-water mark. Tests that assert on timestamps need this, otherwise
 * a burst in one test leaves the clock ahead of wall time for every test after it
 * — the module-state leak this codebase already guards against in
 * `services/supabase.ts`.
 */
export function __resetClockForTests(): void {
  highWaterMark = 0;
}
