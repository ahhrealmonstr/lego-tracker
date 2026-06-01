# Plan: Oracle Test Persona Integration

**Date:** 2026-05-31 | **Spec:** docs/changes/oracle-integration/proposal.md |
**Tasks:** 4 | **Time:** ~20 min | **Integration Tier:** small

## Goal

Install Oracle's four AI test personas as a Claude Code plugin and document them
in `AGENTS.md` so any team member can discover and invoke them.

## Observable Truths (Acceptance Criteria)

1. `/plugin install oracle` completes without error in a Claude Code session for
   this project.
2. All four personas (`oracle-test-author`, `oracle-test-reviewer`,
   `oracle-framework-advisor`, `oracle-flake-hunter`) respond when invoked in
   Claude Code.
3. `AGENTS.md` contains a `## Oracle Test Personas` section and
   `npm run lint:md` exits 0.

## Uncertainties

- `[ASSUMPTION]` `/plugin install oracle` works after marketplace add (without
  `@oracle` qualifier). Issue
  [#173](https://github.com/bri-stevenski/oracle-test-ai-agent/issues/173)
  filed upstream. Fallback: use `oracle@oracle` if the short form fails.
- `[DEFERRABLE]` `apps/web/tests/` directory — created on first Playwright test
  generation, not needed now.

## File Map

```text
MODIFY AGENTS.md
```

## Tasks

### Task 1: Install Oracle plugin

**Depends on:** none | **Files:** none | **Category:** integration

`[checkpoint:human-action]` This step must be performed interactively inside
Claude Code. Claude cannot execute plugin commands.

1. In Claude Code, run:

   ```text
   /plugin marketplace add https://github.com/bri-stevenski/oracle-test-ai-agent
   ```

2. Then run:

   ```text
   /plugin install oracle
   ```

   If this fails with "plugin not found", try:

   ```text
   /plugin install oracle@oracle
   ```

3. Confirm all four personas appear in Claude Code's available commands:
   `oracle-test-author`, `oracle-test-reviewer`, `oracle-framework-advisor`,
   `oracle-flake-hunter`.

4. Report back: did `/plugin install oracle` work or did the fallback
   `oracle@oracle` form succeed? (Needed to resolve upstream issue #173.)

---

### Task 2: Add Oracle Test Personas section to AGENTS.md

**Depends on:** Task 1 | **Files:** `AGENTS.md`

1. Open `AGENTS.md` (currently `AGENTS.md:1-44`).

2. Append the following section verbatim at the end of `AGENTS.md`. The section
   heading is `## Oracle Test Personas`. Content:

   - Intro line: "Oracle is installed as a Claude Code plugin providing four AI
     test personas. No API key or additional configuration is required."
   - Sub-heading `### Installation` with a note that if personas are not
     available, run `/plugin marketplace add` then `/plugin install oracle`.
   - Sub-heading `### Personas` with a table of four rows:
     - `oracle-test-author` — generate Vitest or Playwright tests from natural
       language — target: `packages/core/src/` (Vitest) or `apps/web/tests/`
       (Playwright)
     - `oracle-test-reviewer` — review existing tests for quality and coverage
       gaps — target: any test file
     - `oracle-framework-advisor` — recommend Vitest vs Playwright based on
       what is being tested — call before authoring when the right layer is
       unclear
     - `oracle-flake-hunter` — identify flaky or brittle tests — target:
       `packages/core/src/**/*.test.ts`
   - Sub-heading `### Test File Placement` noting Vitest tests go alongside
     source in `packages/core/src/domain/` and `packages/core/src/services/`;
     Playwright tests go in `apps/web/tests/` (created on first E2E
     generation).

3. Run: `npm run lint:md`

4. Fix any lint issues, then run: `harness validate`

5. Commit:

   ```text
   docs(agents): add Oracle test personas section
   ```

---

### Task 3: Smoke test personas

**Depends on:** Task 1, Task 2 |
**Files:** none | **Category:** integration

`[checkpoint:human-verify]` Verify each persona responds correctly.

1. Invoke `oracle-framework-advisor` with a domain prompt:

   ```text
   Should I use Vitest or Playwright to test the catalog search function
   in packages/core/src/domain/catalog.ts?
   ```

   **Expected:** Recommends Vitest (pure domain logic, no browser required).

2. Invoke `oracle-framework-advisor` with a UI prompt:

   ```text
   Should I use Vitest or Playwright to test the Add to Collection flow
   in the web app?
   ```

   **Expected:** Recommends Playwright (browser UI interaction).

3. Invoke `oracle-test-author` with a domain prompt:

   ```text
   Write a Vitest test for the searchCatalog function in
   packages/core/src/domain/catalog.ts
   ```

   **Expected:** Returns a valid `.test.ts` file using `describe`/`it` blocks
   compatible with the existing test style in `packages/core/src/domain/catalog.test.ts`.

4. Run any generated test: `npx vitest run packages/core/src/domain/catalog.test.ts`

   **Expected:** Exits 0.

5. Confirm Observable Truths 1–3 are all met. If any fail, note which and
   return for diagnosis.

---

### Task 4: Update roadmap status

**Depends on:** Task 3 | **Files:** `docs/roadmap.md` | **Category:** integration

1. Open `docs/roadmap.md`.

2. Update the Oracle integration entry status from `planned` to `done` and check
   off all tasks:

   ```markdown
   - **Status**: done
   - **Tasks**:
     - [x] Install Oracle plugin via Claude Code marketplace
     - [x] Add Oracle section to AGENTS.md
     - [x] Smoke test all four personas
   ```

3. Run: `harness validate`

4. Commit:

   ```text
   chore(roadmap): mark Oracle integration done
   ```
