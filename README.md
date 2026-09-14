# หอพร้อม — Dormitory Micro SaaS

Thai owner workspace for multiple dormitories, designed for monthly billing at 50–200 rooms.

## Run

Node.js 24 and pnpm 10.28.2. Existing dependencies and lockfile are preserved.

```sh
pnpm install
pnpm dev
```

Open http://localhost:3000. The current task preview runs at http://localhost:3100.

If this host's pnpm wrapper tries to reinstall dependencies while running scripts, invoke the installed tools directly:

```sh
node node_modules/next/dist/bin/next dev --webpack --port 3100
node node_modules/next/dist/bin/next build --webpack
node node_modules/next/dist/bin/next start
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src
node --test tests/*.test.ts
```

Webpack is selected because Turbopack's CSS worker fails to spawn on this Windows environment.

## Configuration

`.env.local` already points to Supabase project `fgxeqmxbqvwbkckomxyd` in Singapore. Required frontend/server variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `APP_URL`: set to the public HTTPS origin when deploying. Local form origin is used if omitted.

In Supabase Auth URL Configuration, set the final Site URL and allow `<APP_URL>/auth/callback` and `<APP_URL>/auth/callback?next=/reset-password` (or a narrowly scoped callback wildcard). Include the exact local development origin when testing email links. Configure a production email sender and verify signup confirmation and password-reset delivery with a real inbox before public launch. No email-confirmation or security setting was disabled.

Public bill reads and uploads run through the deployed **bill-gateway** Edge Function. It uses Supabase's injected `SUPABASE_SECRET_KEYS` server environment (with legacy service-role fallback). The Next.js server forwards the random bill token and upload; no admin key is put in Next.js client code or copied to the workstation.

The frontend has not been deployed to a public host. Use a Node-compatible Next.js host with the variables above. Localhost bill links are suitable for local tests; public LINE links require that deployment origin.

## Database and access model

Remote migrations already applied:

1. `dormitory_mvp` — reproducible source: `supabase/schema.sql`
2. `finite_amounts_and_bill_replacement` — source: `supabase/hardening.sql`

For a fresh Supabase project, apply these in order, deploy `supabase/functions/bill-gateway/index.ts`, and regenerate `src/types/database.ts`. Do not rerun the initial schema on the existing project.

All owner tables have RLS and owner indexes. Authenticated clients have **SELECT only** on those tables. Writes use the public invoker RPC `owner_command(op,p)`, backed by a non-exposed, security-definer function with explicit verified user/ownership checks. This boundary makes billing, edits, receipts, reversals, and event logs atomic and prevents direct API tampering with issued invoices. Its search path is fixed; anonymous execution is revoked.

Storage bucket `slips` is private. Owners can obtain short-lived read URLs only for their own prefix. The Edge Function validates a 256-bit bill token, expiry, status, upload size and file signature. `submit_slip` is service-role-only, locks the invoice, rechecks state, limits submissions to five/hour, and records submission/state/event atomically. Failed finalization removes the newly uploaded file.

## Product rules

- One current tenancy per room. Multiple properties per owner; no staff roles.
- Water is metered or flat per property. Rent and utility rates can be overridden per room; blank means inherit, zero is a real override.
- Recurring charges apply to all billed rooms in that property. Additional line items can be edited on drafts.
- A cycle is one calendar month. Default due date is day 1–28 of the following month.
- Only current tenants with complete readings are drafted. No prorating; adjust draft rent manually.
- Meter readings carry from the latest prior cycle. Saving earlier cycles is blocked if a later reading exists. Drafted rooms are locked until the draft is deleted.
- Amounts use decimal Postgres arithmetic, rounded per line to two places. Client estimates use integer/BigInt arithmetic at the same scales.
- Issued invoices preserve their property, tenant, room, payment instructions, line items, and total. An incorrect issued bill can be voided and replaced; only one non-void invoice per room/cycle is allowed.
- Overdue is derived from Bangkok's calendar date; pending slip review remains its own status while overdue counts still include it.
- Revenue is the total of currently confirmed paid invoices by Bangkok confirmation month, not invoice month. Reversals clear paid fields and append compensating audit events.
- Bill tokens expire after 18 months. Owners can rotate/renew links; old links stop working.
- Sharing opens native share where supported; otherwise it copies the message/link. It does not claim LINE delivery confirmation.

## Verification

```sh
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm check:supabase
```

Run `supabase/tests/mvp.sql` with a privileged SQL runner for transactional backend tests (fixtures rolled back). Gateway scripts require a disposable issued invoice with the expected QA amount and a running local app; they create synthetic slip records. See `docs/verification.md` for completed browser/API tests and remaining production configuration.

Partial payments, deposits, tax invoices, proration, OCR, automatic bank reconciliation, LINE OA delivery, and automated reminders are outside this MVP.
