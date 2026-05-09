---
project: lego-tracker
version: 1.0.0
last_synced: 2026-05-06
last_manual_edit: 2026-05-06
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

## Catalog Expansion

- **Summary**: Integrated Rebrickable API and Supabase-backed catalog caching.
- **Status**: in-progress
- **Milestone**: M2
- **Tasks**:
  - [x] Integrate external catalog API (e.g., Rebrickable)
  - [x] Implement catalog caching/mirroring in Supabase
  - [ ] Enhance barcode lookup with real-world catalog matching

## Data Portability & Sync

- **Summary**: Implemented JSON/CSV export and basic cloud sync via Supabase.
- **Status**: in-progress
- **Milestone**: M3
- **Tasks**:
  - [x] Export collection to JSON/CSV
  - [x] Basic cloud sync with Supabase
  - [ ] Multi-device state reconciliation

## iOS Client

- **Summary**: Expanding to mobile using the shared domain model.
- **Status**: backlog
- **Milestone**: M4
- **Tasks**:
  - [ ] Initialize iOS project (Swift/Compose Multiplatform)
  - [ ] Port shared domain types and validation logic
  - [ ] Native camera barcode scanning integration
