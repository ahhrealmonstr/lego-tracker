# Contributing

## Development Setup

```bash
git clone https://github.com/ahhrealmonstr/lego-tracker.git
cd lego-tracker
npm install
cp .env.example .env   # fill in VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_REBRICKABLE_API_KEY
npm run web:dev
```

## Project Structure

```
apps/web/        — Vite + React web app
packages/core/   — Shared domain logic, types, and services
supabase/        — Edge Functions and database migrations
scripts/         — One-off admin scripts (seed-catalog)
docs/            — Architecture, user guide, roadmap
```

## Running Tests

```bash
npm test                     # all tests (core + web)
npm run typecheck            # TypeScript across all packages
npx vitest run               # core package tests only
npm run test -w apps/web     # web app tests only
```

## Pull Requests

1. Branch from `main`
2. One feature or fix per PR
3. All tests must pass — `npm test`
4. Typecheck must pass — `npm run typecheck`
5. Update `CHANGELOG.md` under `## Unreleased`

## Architecture

See [docs/architecture.md](docs/architecture.md) for layer boundaries and dependency rules.

The key constraint: `packages/core/src/domain/` must not import from `packages/core/src/services/`.
