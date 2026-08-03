# Cloud Backup — Live Verification Checklist

Everything below was **unit-verified with mocks** in the PR (#12). These steps confirm the
success criteria that can only be exercised against a **real Supabase project** — `SC2, SC3, SC4,
SC5, SC8`. Do Part A once, then walk Parts B–F in a browser.

Record results in the table at the bottom.

---

## Part A — One-time hosted setup (prerequisites)

- [ ] **A1. Enable anonymous sign-ins.** Supabase Dashboard → **Authentication → Sign In / Providers → Anonymous sign-ins → ON**. (Matches `supabase/config.toml:171` `enable_anonymous_sign_ins = true`.)
- [ ] **A2. Configure redirect URLs for magic-link return.** Dashboard → **Authentication → URL Configuration**. The app calls `linkEmailIdentity` with `emailRedirectTo = window.location.origin`, so **every origin you use must be allow-listed** or the magic link is rejected — allow-list both:
  - **Local**: `http://localhost:5173`.
  - **Deployed app origin** (the Netlify production URL) — set it as the **Site URL** and add it to the **redirect allow-list**. Easy to forget: verifying on localhost passes while production silently rejects the magic link.
- [ ] **A3. Email delivery.** For SC5 you need a magic-link email to actually arrive. Either configure **custom SMTP** (Dashboard → Authentication → Emails/SMTP), or use the built-in email (low rate limits — fine for one test). Confirm you can receive at the test address.
- [ ] **A4. Confirm RLS is present** (should already be, no change needed): Dashboard → **Database → Policies** → `user_collection` has `USING (auth.uid() = user_id)`.
- [ ] **A5. Local env.** In `apps/web`, ensure `.env` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` pointing at this project (no `.env` exists yet — create one). Start the app: `npm run web:dev` (Vite, default `http://localhost:5173`). Open **DevTools → Console + Application/Storage** and keep the **Supabase Dashboard → SQL Editor** handy.
- [ ] **A6. Deploy env (for production, not just local verification).** The same `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` must be set in the **deploy environment** (Netlify build settings) — they are baked in at build time, so a deploy missing them ships a non-functional backup. Confirm they're present in the Netlify site's environment variables and trigger a rebuild if you add them.

> Handy SQL (SQL Editor): recent collection rows —
> `select user_id, count(*) from user_collection group by user_id order by 2 desc;`
> Anonymous users — `select id, is_anonymous, email, created_at from auth.users order by created_at desc limit 5;`

---

## Part B — SC1 / SC9: session bootstraps + fail-open

- [ ] **B1 (SC1).** Load the app fresh (clear site data first for a true cold start). In Console run
  `JSON.parse(localStorage.getItem('sb-<project-ref>-auth-token') ? 'true':'false')` — or simply check **Application → Local Storage** for a `sb-…-auth-token` entry. Expected: a session exists.
  - Cross-check in SQL: a new `auth.users` row with `is_anonymous = true` appeared.
- [ ] **B2.** Backup indicator shows **"Backed up"** (not a spinner that never resolves).
- [ ] **B3 (SC9 fail-open).** DevTools → **Network → Offline**, then hard-reload. Expected: the app **still loads and is fully usable** on local data; the indicator shows **"Offline — will back up when online"** or **"Backup failed"** — it must **not** hang on "initializing" or crash. Set Network back to **Online**.

## Part C — SC2: sync actually persists (the core proof)

- [ ] **C1.** Add a set to your collection in the UI (search → add), and note its set number.
- [ ] **C2.** In SQL Editor: `select set_number, user_id, updated_at from user_collection order by updated_at desc limit 5;`
  Expected: a row for the set you just added, whose `user_id` equals the anon user's id from B1.
- [ ] **C3.** Edit a field on that set (e.g. condition/location). Re-query — `updated_at` advanced and the field persisted. *(This is the criterion that was silently broken before this feature — confirm it's real now.)*

## Part D — SC3: survives reload

- [ ] **D1.** With the set from Part C present, do a full **page reload**.
- [ ] **D2.** Expected: the same anonymous session resumes (same `auth.users` id — no new anon row in SQL), the collection is intact, indicator returns to **"Backed up"**. No data change.

## Part E — SC4: recovers from in-app/local loss

- [ ] **E1.** In Console, simulate local loss **without** touching the session:
  `localStorage.removeItem('brick-ledger.collection.v1'); localStorage.removeItem('brick-ledger.sync-queue.v1');`
  (Do **not** clear the `sb-…-auth-token` — that's the session.)
- [ ] **E2.** Reload the app.
- [ ] **E3.** Expected: the collection is **restored from the cloud** (your Part C set reappears) via `reconcile` pulling `user_collection` for your uid. This proves the backup is genuinely recoverable, not just written.

## Part F — SC5: linking preserves identity (recovery against full wipe)

- [ ] **F1.** While anonymous, the **"Secure my backup"** affordance is visible (it's gated on `isAnonymous`). Click it, enter your test email, submit. Expected: a "check your email" confirmation, no error.
- [ ] **F2.** Before clicking the email link, note the anon user id (SQL from B1).
- [ ] **F3.** Open the magic link from the inbox. It should return to the app origin (per A2) and complete linking.
- [ ] **F4.** Expected after return: the **"Secure my backup"** affordance is **gone** (`isAnonymous === false`); in SQL the **same** `auth.users` id now has your `email` set (and/or `is_anonymous = false`) — **id unchanged**, so all `user_collection` rows are still owned by you.
- [ ] **F5 (the real payoff).** Now simulate a full device wipe: **clear all site data** (Application → Clear storage), reload, and use the magic-link / email sign-in for the same address. Expected: your collection comes back — the linked identity recovered data an anonymous-only session would have orphaned.
- [ ] **F6 (negative check for `email-taken`).** Optional: try linking a second anon session to the same email; expect the typed `email-taken` message, not a crash.

## Part G — SC8: truthful status transitions (live)

- [ ] **G1.** DevTools → **Network → Offline**. Expected indicator: **"Offline — will back up when online"**.
- [ ] **G2.** Make a change while offline (add/edit a set). It stays local.
- [ ] **G3.** Set Network → **Online**. Expected: indicator transitions **"Backing up…" → "Backed up"**, and the offline change now appears in `user_collection` (SQL).
- [ ] **G4 (error + Retry).** Optional: with the app open, temporarily point `VITE_SUPABASE_URL` at a bad host (or block the Supabase domain in DevTools) and trigger a sync. Expected: **"Backup failed — <reason>"** with a working **Retry** button (not a generic blank failure).

---

## Results

| Criterion | Part | Pass? | Notes |
| ----------- | ------ | ------- | ------- |
| SC1 session bootstraps | B1–B2 | ☐ | |
| SC9 fail-open | B3 | ☐ | |
| SC2 sync persists | C1–C3 | ☐ | |
| SC3 survives reload | D1–D2 | ☐ | |
| SC4 recovers local loss | E1–E3 | ☐ | |
| SC5 linking preserves identity | F1–F5 | ☐ | |
| SC8 truthful status | G1–G4 | ☐ | |

**If anything fails:** capture the Console error + the relevant `auth.users` / `user_collection` SQL
snapshot and open an issue referencing `docs/changes/cloud-backup/proposal.md`. Most likely culprits:
A1 not enabled (SC1/SC2 fail silently — sync no-ops), A2 redirect not allow-listed (SC5 magic link
rejected), or SMTP unconfigured (F1 email never arrives).
