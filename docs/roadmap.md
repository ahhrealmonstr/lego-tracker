---
project: lego-tracker
version: 1.0.0
last_synced: 2026-06-04 (M5 done)
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

- **Summary**: Fetch, display, and step through official Lego building instructions inside the app; also offer PDF download for offline use.
- **Status**: backlog
- **Milestone**: M5
- **Tasks**:
  - [ ] Source instruction PDFs via Lego's public CDN and/or Rebrickable instructions endpoint
  - [ ] Render instructions step-by-step (page-turn / swipe navigation) using a PDF viewer component
  - [ ] Track current step per set so users can resume where they left off
  - [ ] Record which parts are "consumed" at each step to power the missing-parts workflow
  - [ ] Provide PDF download button for offline/print use
  - [ ] Surface instructions entry point from set info page and collection list

## Missing-Parts List from Instructions

- **Summary**: As users follow in-app instructions, detect and export a Pick-a-Brick–compatible list of any parts they mark as missing or skip.
- **Status**: backlog
- **Milestone**: M6
- **Tasks**:
  - [ ] Add per-step "mark as missing" action during instruction playback
  - [ ] Aggregate missing parts across all steps into a set-level missing-parts list
  - [ ] Expose missing-parts list on the set info page alongside the full parts list
  - [ ] Allow manual addition/removal of parts from the missing list without replaying instructions
  - [ ] Export missing-parts list as Pick-a-Brick–compatible CSV and BrickLink BSX
  - [ ] Deep-link from the missing-parts list back to the relevant instruction step

## iOS Client

- **Summary**: Expanding to mobile using the shared domain model.
- **Status**: backlog
- **Milestone**: M7
- **Tasks**:
  - [ ] Initialize iOS project (Swift/Compose Multiplatform)
  - [ ] Port shared domain types and validation logic
  - [ ] Native camera barcode scanning integration
