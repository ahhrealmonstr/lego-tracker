---
project: lego-tracker
version: 1.0.0
last_synced: 2026-05-18
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

- **Summary**: Integrated Rebrickable API and Supabase-backed catalog caching. Barcode lookup now chains seed catalog → Supabase cache → Rebrickable with auto-caching and full UI feedback.
- **Status**: done
- **Milestone**: M2
- **Tasks**:
  - [x] Integrate external catalog API (e.g., Rebrickable)
  - [x] Implement catalog caching/mirroring in Supabase
  - [x] Enhance barcode lookup with real-world catalog matching

## Data Portability & Sync

- **Summary**: Implemented JSON/CSV export and basic cloud sync via Supabase.
- **Status**: done
- **Milestone**: M3
- **Tasks**:
  - [x] Export collection to JSON/CSV
  - [x] Basic cloud sync with Supabase
  - [x] Multi-device state reconciliation

## Pick-a-Brick Parts List Export

- **Summary**: Generate and export Lego Pick-a-Brick–compatible parts lists from any set info page, with optional per-bag breakdowns.
- **Status**: backlog
- **Milestone**: M5
- **Tasks**:
  - [ ] Parse and store per-bag part assignments alongside set part data (Rebrickable bag field)
  - [ ] Build parts-list view on set info page showing element ID, color, quantity, and bag number
  - [ ] Export full set parts list as Pick-a-Brick–compatible CSV (element ID, color, quantity columns)
  - [ ] Add per-bag export filter so users can download a list for a single bag
  - [ ] Support XML/BrickLink BSX export format as a secondary option

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
