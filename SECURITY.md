# Security Policy

## Reporting a Vulnerability

Please do **not** open a public GitHub issue for security vulnerabilities.

Report vulnerabilities by emailing **b.stevenski.eng@pm.me** with:

- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept
- Any suggested mitigations

You will receive a response within 48 hours. If the issue is confirmed, a fix will be prioritised and you will be credited in the release notes (unless you prefer anonymity).

## Scope

This project is a personal LEGO collection tracker. Key security considerations:

- **Supabase anon key** — intentionally public; Row-Level Security enforces data isolation
- **Rebrickable API key** — client-side, rate-limited, read-only catalog access
- **Service role key** — used only in the `scripts/seed-catalog.ts` admin script; never bundled into the web app

## Supported Versions

| Version | Supported |
| ------- | --------- |
| main    | ✓         |
