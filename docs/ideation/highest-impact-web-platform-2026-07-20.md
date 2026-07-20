---
topic: highest-impact web-platform work to stabilize the core flows
generated_at: 2026-07-20T10:53:03Z
strategy_grounded: true
strategy_path: STRATEGY.md
count_requested: 10
count_generated: 10
ranking_formula: '(impact × confidence) ÷ effort; strategy-alignment tiebreaker (max +0.75) applied only when |Δbase_score| ≤ 0.05'
---

# Ideation: highest-impact web-platform work to stabilize the core flows

## Inputs

- Topic: highest-impact web-platform work to stabilize the core flows
- Generated: 2026-07-20T10:53:03Z
- Strategy grounding: enabled — STRATEGY.md present & valid; anchored tracks: Web platform stabilization, Collection & provenance data model, Build lifecycle & backlog, Export & missing-parts interoperability, AI-assisted building
- Count: 10 requested / 10 generated
- Grounding scan: `apps/web` (Vite + React 18 single-screen SPA), `packages/core`, Supabase. Candidates anchored to concrete files/gaps found in a repo scan (see per-idea file references).

## Ranked candidates

### 1. Add error / retry / empty states to all async fetch flows — score: 9.00

- Premise: Add `catch` + a shared error/retry UI to catalog search, parts fetch, and instructions fetch so failures surface as retryable states instead of unhandled rejections and permanent spinners.
- Persona: An adult hobbyist collector searching to add a set who currently hits a silent failure.
- Complexity: low
- Impact / Confidence / Effort: H / H / L — base score 9.00
- Strategy alignment: +0.75 (track: Web platform stabilization + references Target problem "broken core flows") — recorded, not applied (nearest neighbor Δ = 3.00 > 0.05) — final score 9.00
- Files: `apps/web/src/app/App.tsx:74` (search, no `catch`), `apps/web/src/hooks/useInstructions.ts:25` (no `.catch`), `apps/web/src/hooks/useSetParts.ts` (parts fetch); `packages/core/src/services/rebrickable.ts:92` (re-throws `RateLimitError`).
- Strongest objection: Rate-limit/API failures are rare in single-user personal use, so this hardens paths that seldom break — polish, not a stability crisis, and fails to matter if the real instability is elsewhere (sync).
- Objection answered: no — accepted as a known downside.

### 2. Honor `Retry-After`: backoff + auto-retry on Rebrickable calls — score: 6.00

- Premise: Consume the already-parsed `retryAfter` value to back off and auto-retry rate-limited catalog/parts requests instead of discarding it.
- Persona: A collector bulk-adding many sets who trips Rebrickable's rate limit.
- Complexity: medium
- Impact / Confidence / Effort: M / H / L — base score 6.00
- Strategy alignment: +0.75 (track: Web platform stabilization + references Our approach "reliability of the data spine") — cluster tie at 6.00, equal bonus with #3/#4, generation order preserved — final score 6.00
- Files: `packages/core/src/services/rebrickable.ts:26-31,48` (`retryAfter` parsed then discarded).
- Strongest objection: Only bites under heavy bulk usage the current single user rarely reaches; premature optimization for scale you don't have yet.
- Objection answered: no — accepted as a known downside.

### 3. Single-flight guard on `reconcile()` — score: 6.00

- Premise: Add an in-flight guard so overlapping interval/online/manual reconciles cannot interleave load/save on the same localStorage collection.
- Persona: Any user with the app open across network flaps.
- Complexity: low-medium
- Impact / Confidence / Effort: M / H / L — base score 6.00
- Strategy alignment: +0.75 (track: Web platform stabilization + references Our approach "multi-device integrity") — cluster tie at 6.00 — final score 6.00
- Files: `apps/web/src/hooks/useSync.ts:35-39` (interval restart on every `online`), `apps/web/src/services/reconcile.ts:15` (queue cleared only after full resolve).
- Strongest objection: The race is dormant until auth exists — with sync a silent no-op today, there is nothing to interleave, so this guards a code path that is not live (see #5).
- Objection answered: no — accepted as a known downside.

### 4. Harden `localStorage` writes against quota / serialization failure — score: 6.00

- Premise: Wrap `setItem` in try/catch with a user-visible "couldn't save locally" fallback so a quota-exceeded throw does not silently drop the collection.
- Persona: A power collector with a large collection plus cached parts.
- Complexity: low
- Impact / Confidence / Effort: M / H / L — base score 6.00
- Strategy alignment: +0.75 (track: Web platform stabilization + references Target problem "provenance data must not be lost") — cluster tie at 6.00 — final score 6.00
- Files: `apps/web/src/services/storage.ts`, `apps/web/src/services/syncQueue.ts:21` (unguarded `setItem`), propagates into `apps/web/src/app/App.tsx:70-72` save effect.
- Strongest objection: Browser quota (5–10 MB) is generous; a JSON collection will not approach it for a long time, so the guarded failure may never fire in practice.
- Objection answered: no — accepted as a known downside.

### 5. Stand up Supabase auth so multi-device sync actually works — score: 4.50

- Premise: Add an auth flow (magic-link / OAuth) so `loadCollectionFromCloud` and `syncCollectionToCloud` have a user and cloud sync stops silently no-op'ing.
- Persona: The multi-device collector whose sync indicator currently does nothing.
- Complexity: medium
- Impact / Confidence / Effort: H / H / M — base score 4.50
- Strategy alignment: +0.75 (track: Web platform stabilization + references Our approach "single tool across the lifecycle") — recorded, not applied (nearest neighbor Δ ≥ 1.50) — final score 4.50
- Files: `packages/core/src/services/supabase.ts:124-125,150-151` (early-return with no user), `apps/web/src/services/reconcile.ts:7` (silent no-op); no auth UI anywhere in `apps/web/src`.
- Strongest objection: You said you will "most likely have the laptop out anyway" — if you do not actually need multi-device, this resurrects a flow you may not want and adds login friction to a personal tool. The honest alternative may be to remove the dead sync UI, not build auth.
- Objection answered: no — accepted as a known downside.

### 6. Web component + hook test harness — score: 3.00

- Premise: Stand up React Testing Library coverage for the `App` state machine, `DetailPanel`, and the hooks (`useSync`, `useSetParts`, `useInstructions`), starting with add/edit/build/missing-parts and the async loading/error branches.
- Persona: You, the developer, wanting confidence to refactor without regressions (directly serves the "prove confidence" strategy metric).
- Complexity: medium-high
- Impact / Confidence / Effort: H / H / H — base score 3.00
- Strategy alignment: +0.75 (track: Web platform stabilization + references Key metric "prove confidence") — cluster tie at 3.00, bonus applied to order the cluster — final score 3.00 (ranked above #9)
- Files: `apps/web/src/**` has zero UI/hook tests (only 3 service tests); `data-testid` attributes present throughout suggest tests were planned. `jsdom` + `@vitejs/plugin-react` already installed.
- Strongest objection: `App.tsx` is a fast-moving 267-line single file; tests written against it now may be brittle and need rewriting as the UI evolves — high effort, possibly short-lived.
- Objection answered: no — accepted as a known downside.

### 7. Type the Supabase boundary — score: 3.00

- Premise: Generate/define row types for the Supabase tables and type the row mappers so schema drift fails at compile time instead of silently at runtime.
- Persona: The developer guarding against a migration silently breaking sync.
- Complexity: medium
- Impact / Confidence / Effort: M / H / M — base score 3.00
- Strategy alignment: +0.75 (track: Web platform stabilization + references Our approach "provenance data spine integrity") — cluster tie at 3.00 — final score 3.00
- Files: `packages/core/src/services/supabase.ts` (`mapRowToItem`, `mapRowToOwnedItem`, `data as any[]`, `as any` on delete builder at `:189`).
- Strongest objection: Only pays off when the schema changes; it is static-safety insurance, not user-visible stability, and `supabase gen types` can be added later cheaply.
- Objection answered: no — accepted as a known downside.

### 8. Extract `CatalogService` to fix the RR-010 layer violation — score: 3.00

- Premise: Extract the Rebrickable/Supabase orchestration out of `domain/catalog.ts` into a `CatalogService` so the domain layer stops importing services.
- Persona: The developer keeping the provenance-data spine clean as it grows.
- Complexity: medium
- Impact / Confidence / Effort: M / H / M — base score 3.00
- Strategy alignment: +0.75 (track: Collection & provenance data model + references Our approach "attaches to that spine") — cluster tie at 3.00 — final score 3.00
- Files: `packages/core/src/domain/catalog.ts:2-3` (imports `services/rebrickable` + `services/supabase`), rule in `docs/architecture.md:49-51`, tracked as RR-010 in `docs/changes/release-readiness-m6/proposal.md:23,73,92`.
- Strongest objection: Pure refactor with zero user-facing value; the debt is documented and inert, and deferring it further costs almost nothing today.
- Objection answered: no — accepted as a known downside.

### 9. Add an ESLint / TS-lint gate to CI — score: 3.00

- Premise: Introduce a `typescript-eslint` config and wire a lint step into CI, since the root `lint` script only runs markdownlint today — there is no JS/TS lint gate at all.
- Persona: The developer preventing quality drift.
- Complexity: low-medium
- Impact / Confidence / Effort: M / H / M — base score 3.00
- Strategy alignment: +0.5 (track: Web platform stabilization only; does not reference Target problem or Our approach) — cluster tie at 3.00, lower bonus ranks it last in the cluster — final score 3.00 (ranked below #6/#7/#8)
- Files: root `package.json` (`lint` = markdownlint only), `.github/workflows/ci.yml` (no lint step, no coverage threshold).
- Strongest objection: Linting catches style/patterns, not the runtime failure modes that actually threaten core flows; foundational hygiene, but it will not itself stabilize a single user flow.
- Objection answered: no — accepted as a known downside.

### 10. Unify the duplicate missing-parts model — score: 2.00

- Premise: Collapse the parallel freeform `missingParts` textarea and structured `missingPartsList` into one source of truth so contradictory data cannot feed the export-ready list.
- Persona: A builder logging missing parts that feed BrickLink/BSX exports.
- Complexity: medium
- Impact / Confidence / Effort: M / M / M — base score 2.00
- Strategy alignment: +0.75 (track: Export & missing-parts interoperability + references Key metric "missing-parts capture accuracy") — recorded, no adjacent tie within 0.05 — final score 2.00
- Files: `apps/web/src/components/DetailPanel.tsx:135,157-172` (two independently editable representations).
- Strongest objection: The freeform notes may hold nuance the structured model cannot represent (e.g., "cracked, not missing"); collapsing them risks losing information — migration is riskier than it looks.
- Objection answered: no — accepted as a known downside.

## Ranking notes

- Base score = `(impact × confidence) ÷ effort` with `low/medium/high → 1/2/3`.
- Strategy-alignment tiebreaker (max +0.75) is applied ONLY within tied clusters where `|Δbase_score| ≤ 0.05`; outside a tie window the base score wins and the bonus is recorded for transparency only.
- Cluster at 6.00 (#2, #3, #4): all earn +0.75 equally → generation order preserved.
- Cluster at 3.00 (#6, #7, #8, #9): #6/#7/#8 earn +0.75 and rank above #9 (+0.5), which advances a track but not the Target problem or Our approach.
- Dependency signal worth carrying into brainstorming: #3 (single-flight reconcile) and arguably #2 are partly dormant until #5 (auth) makes cloud sync live. #5 itself carries an open product question — build auth vs. remove the dead sync UI.
