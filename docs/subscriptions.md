# RoomReady subscriptions

Implemented 2026-09-20. Landing page at /, workspace at /dashboard, owner plan requests at /subscription, admin approval at /admin/subscriptions. Old /?tab=... workspace bookmarks redirect to /dashboard with their query parameters.

## Entitlements
- One owner account can create one property. Trial begins at signup: 60 days, 30 rooms.
- Starter: 199 THB/month, 50 rooms. Standard: 299 THB/month, 100 rooms. Pro: 399 THB/month, 200 rooms. Every plan includes the same features.
- Rooms count regardless of occupancy. Counters are updated atomically by PostgreSQL triggers, including batch inserts/deletes; failed transactions roll back both data and counters.
- Existing excess data is preserved by migrations and downgrades, but cannot be expanded above the current account quota.
- Expired owners can read existing records and request renewal. Server checks, database triggers, and restrictive Storage policies deny owner writes. Public tenant submission of existing valid bills remains available.
- A paid package uses its paid expiry even if the original trial has time left.
- Requests never grant quotas. Repeated identical pending requests are idempotent; requesting another plan cancels/replaces the pending request.
- An admin confirms receipt of payment outside this app. Approval adds one calendar month: same active plan extends its expiry, otherwise starts from approval. Changing plans starts a new month without automatic proration.
- Approval is single-use per request, locks the subscription/request, and appends actor, old/new plan, timestamps and expiry to subscription_events. No actual bank verification is performed.

## Bootstrap the platform administrator
After cleanup, signup creates an ordinary trial account. No user is automatically made administrator. A trusted project operator must choose the administrator and set the role through Supabase Auth's Admin API or SQL Editor (replace the email with the intended administrator's verified email):

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"role":"platform_admin"}'::jsonb
where email = 'YOUR_ADMIN_EMAIL';
```

This is a privileged operation; do not run it for an unverified identity or a public signup automatically. Sign in and open /admin/subscriptions. Admin checks read the current auth.users row, so user_metadata changes cannot grant privileges and role removal takes effect immediately without waiting for JWT refresh. Removing the platform_admin role revokes directory/approval access.

## Verification
```sh
pnpm test
pnpm lint
pnpm typecheck
pnpm build
npm install --prefix .tmp/db-tools --no-audit --no-fund @electric-sql/pglite
node scripts/test-subscriptions.mjs
```

The isolated PostgreSQL suite loads the actual schema, hardening and migrations, then exercises existing 200-room billing, group sharing, legacy preservation, trial boundaries, the 30-room trial and 50/100/200 paid limits, bulk rollback, read isolation, denied direct entitlement writes, malicious user metadata, admin directory/approval denial, valid approvals/renewals, single-use approval, downgrade, expiry, and QR access.

Browser/API QA covered landing at desktop/390px/320px, FAQ, signup and login redirects, owner plan requests, admin denial, and two simultaneous inserts with only one room remaining. Privileged admin actions are tested in isolated PostgreSQL; live promotion and paid-plan approval of the QA account were not authorized by automatic review and were not executed.

## Security review
Supabase advisors reported no new RLS or function issues. The existing project-level [leaked-password protection setting](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains disabled; this change did not modify Auth configuration.

## Deployment and rollback
The 2026-09-28 pricing update sets Starter/Standard/Pro to 199/299/399 THB per month. `20260928073914_increase_starter_room_limit_to_50.sql` has been applied to the configured Supabase project: Starter now allows 50 rooms, Standard and Pro remain at 100 and 200, and trial stays at 60 days / 30 rooms. Existing subscriptions, properties and rooms are preserved. The isolated suite verifies the 50th room succeeds, the 51st fails, and an over-quota batch rolls back both rooms and counters.
The 60-day trial change is in `20260927132440_extend_trial_to_60_days.sql` and has been applied to the configured Supabase project. It extended the two existing accounts still on the original 30-day trial, changed the default, and updated the signup trigger. Verify frontend copy before releasing it.
The original subscription migration was applied to the configured Supabase project. The frontend is deployed at https://roomready-navy.vercel.app. Public homepage is indexable; authenticated and bill pages retain noindex from the root layout.
Rollback the frontend and quota feature together. Keep subscription/request/event records for audit; do not delete them to roll back. Restore prior mutation guards/policies using a reviewed forward migration if reverting entitlements. Removing enforcement while keeping new pricing visible would misrepresent the product.
The user requested deletion of all existing test data; that cleanup is operational, separate from the migration, and is not replayed on future deployments.

## Completed test-data reset
On 2026-09-20, the user explicitly requested deletion of all existing test data and approved a 10-minute, four-object Storage cleanup capability. Removed the four test objects through the Storage API, immediately dropped both temporary RLS policies, revoked sessions and deleted the three inventoried test accounts. Database verification returned zero accounts, subscriptions, storage objects, properties, rooms and invoices, with zero temporary cleanup policies. No platform-admin role was granted. Local disposable QA credential/session files were removed. At the time, new users could sign up for a fresh 30-day trial; an administrator must still be explicitly designated by the project operator as described above.
The two remote maintenance migrations (temporary_scoped_test_storage_cleanup and revoke_temporary_test_storage_cleanup) are a completed one-off operation, not part of future application setup.
