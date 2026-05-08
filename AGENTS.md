# lego-tracker Knowledge Map

## Project Overview

**Brick Ledger** (lego-tracker) is a local-first LEGO collection tracker. It allows users to search a seeded LEGO catalog, manage their collection and wishlist, and track item-level details like build status, condition, and display location. The project is architected with a portable domain model to support a future iOS client.

## Repository Structure

- `apps/web/src/api/`: React UI components and application entry point (`main.tsx`).
- `apps/web/src/services/`: Browser-specific boundaries (e.g., `localStorage`, Barcode Detection API).
- `packages/core/src/domain/`: Pure business logic, catalog search, and collection management.
- `packages/core/src/services/`: External API integrations (Rebrickable, Supabase).
- `packages/core/src/types/`: Shared TypeScript contracts and interfaces.
- `apps/mobile/`: iOS client (React Native/Expo).
- `docs/`: Technical documentation, architecture guides, and user manuals.
- `.harness/`: Harness engineering metadata, learnings, and configuration.

## Development Workflow

1. **Local Development**: Run `npm run dev` to start the Vite development server.
2. **Architecture Compliance**: Ensure core logic stays in `src/domain` and is independent of browser/React APIs.
3. **Documentation**: Update `docs/` and `README.md` when adding new features or changing workflows.
4. **Validation**: Run `harness validate`, `npm run build`, and `npm run lint:md` before committing significant changes.
5. **CI Checks**: Run `npx harness ci check` to verify architecture, performance, and security constraints.

## Engineering Rules

### Markdown Consistency (ER-001)

**Rule**: All documentation must pass `npm run lint:md`.
**Mechanical Enforcement**: `markdownlint-cli` via `.markdownlint.json`.
**Why**: Ensures structural consistency (header levels, list indentation) for reliable parsing by AI agents and Harness tools.

## Documentation Index

- Main README: `README.md`
- Architecture: `docs/architecture.md`
- Setup: `docs/setup.md`
- User Guide: `docs/user-guide.md`

## Architecture

See `docs/architecture.md` for detailed architectural decisions and dependency diagrams.
