---
project: lego-tracker
version: 1.0.0
last_synced: 2026-06-18 (M6 done)
last_manual_edit: 2026-05-18
status: in-progress
---

# Brick Ledger Roadmap

## Engineering Foundation

- **Summary**: Finalizing the Harness engineering setup and project structure.
- **Status**: in-progress
- **Milestone**: M1
- **Tasks**:
  - [x] Fix CI check noise and architectural baselines
  - [x] Complete `AGENTS.md` for Harness validation
  - [x] Initialize `docs/roadmap.md`

## Oracle Test Persona Integration

- **Summary**: Install Oracle as a Claude Code plugin with four test personas
  (test-author, test-reviewer, framework-advisor, flake-hunter). Document usage
  in AGENTS.md. No CLI or CI gate in this iteration.
- **Status**: done
- **Milestone**: Current Work
- **Spec**: docs/changes/oracle-integration/proposal.md
- **Tasks**:
  - [x] Install Oracle plugin via Claude Code marketplace
  - [x] Add Oracle section to AGENTS.md
  - [x] Smoke test all four personas

## Catalog Expansion

- **Summary**: Integrated Rebrickable API and Supabase-backed catalog caching. Barcode lookup now chains seed catalog → Supabase cache → Rebrickable with auto-caching and full UI feedback. Bulk CSV seed pipeline seeds 27k sets with resolved theme names on demand.
- **Status**: done
- **Milestone**: M2
- **Tasks**:
  - [x] Integrate external catalog API (e.g., Rebrickable)
  - [x] Implement catalog caching/mirroring in Supabase
  - [x] Enhance barcode lookup with real-world catalog matching
  - [x] Bulk CSV import pipeline — seed catalog_cache from Rebrickable sets.csv + themes.csv (`npm run seed-catalog`)

## Data Portability & Sync

- **Summary**: Implemented JSON/CSV export and basic cloud sync via Supabase.
- **Status**: done
- **Milestone**: M3
- **Tasks**:
  - [x] Export collection to JSON/CSV
  - [x] Basic cloud sync with Supabase
  - [x] Multi-device state reconciliation

## UI Polish

- **Summary**: Warm palette, dark mode via CSS custom properties, parts grid layout, mobile panel switching with back navigation.
- **Status**: done
- **Milestone**: M4
- **Tasks**:
  - [x] Audit spacing — tighten sidebar padding, reduce card border-radius uniformity, add consistent vertical rhythm
  - [x] Typography — size/weight hierarchy for set names vs metadata vs labels
  - [x] Stat cards — subtle shadow + surface-alt background
  - [x] Item list — shadow lift on hover + translateY transition
  - [x] Detail panel — large image with shadow-lg, padding, soft background
  - [x] Badge/pill styling — gold-tinted price pill, neutral status pill
  - [x] Dark mode fine-tuning — CSS custom properties, verified contrast, warm palette
  - [x] Responsive polish — mobile panel switching (list ↔ detail) with ← Back nav

## Pick-a-Brick Parts List Export

- **Summary**: Per-set parts list view with CSV and BSX export. Parts fetched from Rebrickable on first view, cached in Supabase. Full-set and per-bag export supported.
- **Status**: done
- **Milestone**: M5
- **Tasks**:
  - [x] Parse and store per-bag part assignments alongside set part data (Rebrickable bag field) — `set_parts` table + `cacheSetParts`
  - [x] Build parts-list view on set info page showing part image, number, color, quantity, grouped by bag — `PartsList` component
  - [x] Export full set parts list as Pick-a-Brick–compatible CSV (DesignNumber, ColorName, Quantity)
  - [x] Add per-bag export filter — CSV and BSX buttons on each bag row
  - [x] Support XML/BrickLink BSX export format (`partsToBSX` with `<ColorName>` fallback)

## In-App Building Instructions

- **Summary**: Instructions section in detail panel — fetches available booklets from LEGO's CDN via a Supabase Edge Function, shows download cards per booklet, links to LEGO.com. In-app PDF viewer and per-step part tracking deferred (LEGO PDFs are 100MB+, no cross-origin access, no structured step data).
- **Status**: done
- **Milestone**: M5
- **Tasks**:
  - [x] Source instruction PDFs via LEGO's instructions page (Edge Function scrapes page, extracts PDF links)
  - [x] Provide PDF download button per booklet (Part 1 of N, Part 2 of N, etc.)
  - [x] Surface instructions entry point from set info page — "Building Instructions" section with LEGO.com ↗ fallback
  - [ ] Render instructions step-by-step — deferred (CORS + 100MB+ file sizes make in-app PDF viewer impractical)
  - [ ] Track current step per set — deferred (depends on in-app viewer)
  - [ ] Record parts consumed per step — deferred (no structured step data from LEGO)

## Missing-Parts List from Instructions

- **Summary**: Mark individual parts as missing directly from the parts list. Missing parts appear in a dedicated section with CSV/BSX export. Stored in OwnedLegoItem.missingPartsList alongside the collection.
- **Status**: done
- **Milestone**: M6
- **Tasks**:
  - [x] Allow manual marking/unmarking of parts as missing from the parts grid
  - [x] Aggregate missing parts into a set-level missing-parts list
  - [x] Expose missing-parts list on the set info page alongside the full parts list
  - [x] Remove parts from the missing list via trash icon
  - [x] Export missing-parts list as CSV and BrickLink BSX
  - [ ] Per-step "mark as missing" during instruction playback — deferred (in-app viewer not yet built)
  - [ ] Deep-link from missing list to instruction step — deferred (depends on in-app viewer)

## iOS Client

- **Summary**: Expanding to mobile using the shared domain model.
- **Status**: backlog
- **Milestone**: M7
- **Tasks**:
  - [ ] Initialize iOS project (Swift/Compose Multiplatform)
  - [ ] Port shared domain types and validation logic
  - [ ] Native camera barcode scanning integration
