# RoomReady — Dormitory Micro SaaS

Thai landing page and owner workspace for one dormitory per account, with monthly billing for up to 200 rooms. Trial: 60 days / 50 rooms (Starter capacity). Starter: ฿199 / 50 rooms; Standard: ฿299 / 100 rooms; Pro: ฿399 / 200 rooms.

## Run

Node.js 24 and pnpm 10.28.2. Existing dependencies and lockfile are preserved.

```sh
pnpm install
pnpm dev
```

Open http://localhost:3000 for the landing page and /dashboard for the authenticated workspace. The subscription task preview runs at http://localhost:3102.

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

In Supabase Auth URL Configuration, set the final Site URL and allow `<APP_URL>/auth/callback` and `<APP_URL>/auth/callback?next=/reset-password` (or a narrowly scoped callback wildcard). Include the exact local development origin when testing email links. Email confirmation remains disabled for the initial public launch. Password recovery is unavailable until a production email sender is configured; the signup and forgot-password pages disclose this limitation.

Public bill reads and uploads run through the deployed **bill-gateway** Edge Function. It uses Supabase's injected `SUPABASE_SECRET_KEYS` server environment (with legacy service-role fallback). The Next.js server forwards the random bill token and upload; no admin key is put in Next.js client code or copied to the workstation.

The frontend is deployed on Vercel at https://roomready-navy.vercel.app from the `RoomReady` GitHub repository. Production uses the variables above, and Supabase Auth Site URL and callback allow list point to this origin. Localhost bill links are suitable for local tests; public LINE links use the deployment origin.

## Database and access model

Remote migrations already applied:

1. `dormitory_mvp` — reproducible source: `supabase/schema.sql`
2. `finite_amounts_and_bill_replacement` — source: `supabase/hardening.sql`

For a fresh Supabase project, apply these in order, deploy `supabase/functions/bill-gateway/index.ts`, and regenerate `src/types/database.ts`. Do not rerun the initial schema on the existing project.

All owner tables have RLS and owner indexes. Authenticated clients have **SELECT only** on those tables. Writes use the public invoker RPC `owner_command(op,p)`, backed by a non-exposed, security-definer function with explicit verified user/ownership checks. This boundary makes billing, edits, receipts, reversals, and event logs atomic and prevents direct API tampering with issued invoices. Its search path is fixed; anonymous execution is revoked.

Storage bucket `slips` is private. Owners can obtain short-lived read URLs only for their own prefix. The Edge Function validates a 256-bit bill token, expiry, status, upload size and file signature. `submit_slip` is service-role-only, locks the invoice, rechecks state, limits submissions to five/hour, and records submission/state/event atomically. Failed finalization removes the newly uploaded file.

## Product rules

- One current tenancy per room. One property per owner; package limits count every room across the account. Platform admins approve monthly subscriptions; they do not get owner billing permissions.
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

## Subscriptions and landing page

Apply `supabase/migrations/20260920143225_owner_subscriptions.sql` after all earlier schema/hardening/migration files. This migration is already applied to the configured project. Owners request plans at `/subscription`; platform admins review at `/admin/subscriptions`. There is no automatic billing or payment verification. See [subscription operations](docs/subscriptions.md) for admin setup, expiry rules, test commands, and rollback guidance.

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

## Payment QR images

Owners can save, replace or remove JPG, PNG or WebP images (up to 2 MB) in property settings after creating the property. QR uploads save separately from the property form. The latest QR for a property appears on all its bill links, including existing bills; payment text and amounts remain invoice snapshots. Tenants can open/save the original image for their banking app, then submit a slip as before.

For a fresh project, apply `supabase/migrations/20260915142646_owner_payment_qr_storage.sql` and then `supabase/migrations/20260915143024_qualify_payment_qr_object_path.sql` after the schema and hardening scripts above, then deploy the updated bill-gateway. The migration and gateway version 2 have been applied to the configured project. Images live at `payment-qr/<owner-id>/<property-id>/qr` in a private bucket. RLS checks user and property ownership. Tenant image URLs are signed after bill-token validation and expire within one hour or at the bill-token expiry, whichever is earlier. Already issued image URLs remain usable until expiry. QR contents are not decoded and payment is not automatically confirmed.

## Group bill sharing

In the monthly billing workflow, open **แชร์และรับชำระ → แชร์บิลลงกลุ่ม**, then copy the prepared message into the dormitory LINE group. The /h/<token> link stays the same across months and opens the latest issued billing month. Tenants can select a month, search for their room, view payment details, and submit a slip without signing in.

This is opt-in per property: a cryptographically random link is created when the owner first opens group sharing. Anyone with that link can see each room's charges and payment status. The directory shows only room labels; the group gateway omits tenant names, contact details, private invoice tokens, slip images, and event history. Free-text payment instructions and charge labels are visible, so they should not contain tenant personal information. The owner can rotate the group link; previous group URLs stop working, including slip finalization started before rotation. Existing individual bill links remain independent.

Tenant pages prominently warn users to pay only for their own room and label the upload button with the selected room. Uploading appends a new slip and leaves the bill awaiting owner review. Paid group bills hide payment instructions and upload controls. Existing upload limits still apply.

For a fresh backend, apply supabase/migrations/20260917071003_property_group_bills.sql and deploy the updated bill-gateway. The configured project has this migration and gateway version 3. The group endpoint uses group_token and optional invoice_id; it rechecks the property boundary on every request. submit_group_slip is service-role-only and locks the link while finalizing.

Verification: node --test tests/*.test.ts includes group gateway isolation and privacy checks; supabase/tests/group-bills.sql exercises ownership, link rotation, and append-only submissions inside a rolled-back transaction. Browser QA covered 50 rooms, search, month selection, upload, paid state, and invalid links using a local mocked upstream, with no live tenant payments changed. A public HTTPS application origin is still required before sharing usable links with tenants outside the local network.
