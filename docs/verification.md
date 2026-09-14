# Verification — 2026-09-14

## Automated checks

- TypeScript and ESLint: passed.
- Production build: passed using Next.js 16.3.4 with webpack. Turbopack could not spawn its CSS worker on this Windows host; dev/build scripts use webpack.
- Unit tests: decimal line rounding, missing/zero/decreasing meter readings, and Bangkok overdue derivation passed.
- Supabase connection check: passed.
- Transactional SQL tests in `supabase/tests/mvp.sql`: passed. Creates 200 occupied rooms, saves readings, generates 200 drafts, rejects duplicate generation, verifies 4,382.21 baht arithmetic, edits drafts, issues bills, tests immutable snapshots, confirms/reverses payments, rejects double confirmation and direct financial writes, checks room overrides, flat water, missing readings, previous-reading consistency, cross-owner denial, and anonymous denial. Entire fixture is rolled back.
- Public gateway: invalid token, expired token, spoofed image, >5 MB file, successful PNG submission, replacement, review state, paid-bill upload rejection, anonymous invoice access, and direct public storage access tested.

## Browser checks against real Supabase

Using a disposable QA account and synthetic records:

1. Logged in through the real server action.
2. Created a property with default rates, account instructions, and a recurring charge.
3. Added four rooms in one form.
4. Moved a test tenant into room 101.
5. Entered decimal water readings and electric readings; saved the batch.
6. Created and issued a draft totaling 4,382.21 baht.
7. Submitted/replaced synthetic PNGs through the actual upload endpoint.
8. Opened owner slip review, confirmed payment through the UI, and verified dashboard revenue of 4,382.21 baht, zero outstanding, three vacant rooms, and 25% occupancy.
9. Checked the tenant bill's paid state and an expired link.
10. Inspected desktop and 390px mobile layouts. Mobile meter entries are stacked cards; document width equals viewport width.

The 200-room test covers the backend batch operation; a timed 200-room human-entry usability study has not been performed. LINE delivery was not sent to a real recipient. Email delivery/confirmation/password-reset round trips require an inbox and the final deployment's Auth redirect configuration; those were not verified end-to-end.

Supabase security advisor reports no application schema/RLS warnings. One project Auth setting remains: leaked-password protection is disabled. Review the setting before production.
