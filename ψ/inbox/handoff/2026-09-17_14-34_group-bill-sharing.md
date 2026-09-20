# Handoff: RoomReady — one group link for all dormitory bills

**Date**: 2026-09-17 14:34 Asia/Bangkok
**Source**: /forward, summarized from this conversation and verified git status
📡 Session: 01a0ae00-89b4-7fc0-92d9-6ddd78fac3e5 | Micro SaaS
**Repository**: D:/MB/Micro SaaS
**Remote**: https://github.com/Watthana65022128/horprom.git
**Branch / HEAD**: main / 44ca664 (add all room)
**Vault**: D:/MB/Micro SaaS/ψ (ordinary directory, no symlink)

## User Intent and Decisions

- User asked why payment QR was missing. Live data at investigation: นฤมลแมนชั่น had 6 invoices and no QR object; หอพักอารี had a QR but no invoices. Explained QR is property-specific; upload/save QR separately in the correct property's settings. Did not copy another property's payment QR.
- Discussed reducing manual sharing for 50 rooms, LINE OA quotas, and landing page content. Neither LINE OA integration nor a landing page was implemented.
- User chose manual posting of ONE shared property link to the existing LINE group.
- No tenant password/login. User explicitly accepts others with the link seeing each room's amounts and payment status.
- Directory displays room labels only; selected bill shows charges/status. No tenant names, contact details, slip images, invoice bearer tokens, or internal event history in the group response.
- Prominent Thai note required: pay only for your own room and verify room number/amount before transferring/uploading.
- Stable link across months, latest issued month by default, older months selectable; owner can rotate link. Individual private bill links remain independent.

## What We Implemented

- Owner billing workflow: แชร์และรับชำระ → แชร์บิลลงกลุ่ม. Modal prepares copyable LINE text/link, opens tenant preview, and confirms link rotation.
- Lazy, opt-in 256-bit random property link, owner-authenticated server action, owner-scoped RLS.
- /h/[token] directory with month selection, room search, numeric room ordering and responsive two-column mobile layout.
- /h/[token]/[invoiceId] sanitized bill with room warning, payment QR, statuses รอชำระ / รอตรวจสอบ / ชำระแล้ว and room-specific upload button.
- /api/h/[token]/[invoiceId]/slip forwards uploads through the existing bill gateway.
- Extracted shared TenantBill component; existing /b/[token] private route retains tenant identity and previous behavior.
- Paid group bills hide payment instructions/QR and upload controls.
- Extended bill-gateway with group_token plus optional invoice_id. Validates link, property AND owner, invoice expiry, and non-draft/non-void status before data/storage access. Directory paginates 1,000 records at a time and returns only id, room_name, month.
- submit_group_slip service-role-only invoker RPC locks the property link through finalization and calls existing submit_slip. Rotation invalidates old group access, including finalization of in-flight uploads. Repeated uploads append new slip objects; owner still confirms payments.
- Group pages have noindex/nofollow metadata; gateway retains private/no-store headers.
- README documents flow, privacy tradeoff, deployment, tests and public-host prerequisite.
- Used Supabase, Supabase Postgres best practices, frontend-design. No subagents.

## Live Backend State — Already Applied, Do Not Reapply Blindly

Project: fgxeqmxbqvwbkckomxyd
- Migration applied via Supabase MCP: property_group_bills, version 20260917071003.
- CLI originally created 20260917070113; local filename was renamed to match the actual remote migration history.
- Canonical local migration: supabase/migrations/20260917071003_property_group_bills.sql.
- bill-gateway deployed and ACTIVE as version 3, verify_jwt=false with custom random-token authorization (same setting as previous version).
- Tables/RPC: public.property_bill_links; public.submit_group_slip(text,uuid,text).
- Security advisor reported no new RLS findings; pre-existing leaked-password protection warning remains unrelated.
- No real property group link was created during tests. Owners create links through the new button.

## Validation and Limits

Passed:
- node --test tests/*.test.ts — 23 tests total, including 11 new gateway cases.
- next typegen and tsc --noEmit.
- ESLint src tests scripts.
- next build --webpack.
- git diff --check.
- supabase/tests/group-bills.sql against real Supabase, inside BEGIN/ROLLBACK: owner creation/rotation, stable repeated creation, other-owner denial, anonymous access denial, service-only finalization, revoked link rejection, cross-property rejection, and preservation of earlier slips.
- Deployed gateway read-only smoke: invalid/unknown group and invalid individual token return 404 and private/no-store.
- Headless Chrome against production preview with LOCAL MOCKED UPSTREAM: 50 rooms, mobile overflow, search, months, selected room/amount, notices, upload status refresh, paid state, back navigation, invalid link and no client JS errors.
- Visual inspection of mobile directory screenshot completed.

Limits:
- Browser QA did NOT exercise live payment data or authenticated owner's sharing modal end-to-end. Owner authorization/upsert behavior was covered in SQL checks; UI code compiled/linted.
- Auto-review rejected proposed committed QA users/50 invoices in the real database. Nothing from that rejected request was created. Do not retry that approach without explicit authorization. We used local mocked upstream instead and retained rolled-back live SQL tests.
- Native/browser tools and unprivileged shell failed with Windows sandbox setup errors. Escalated exec_command worked. apply_patch was unreliable; edits used temporary Node scripts invoked through PowerShell.
- No public frontend deployment was performed. localhost links will not work for tenants on other devices/networks.

## Local Test Artifacts / Cleanup

- .tmp/group-browser-mock.cjs: fetch mock for local production preview only.
- .tmp/group-browser-test.cjs: headless Playwright flow, with .tmp/browser-tools/node_modules/playwright.
- Screenshots: .tmp/group-rooms-mobile.png, .tmp/group-bill-mobile.png, .tmp/group-rooms-desktop.png.
- .tmp/group-live-check.cjs: read-only deployed gateway check.
- .tmp/implement-group.cjs: transient editing helper; do not rerun blindly.
- Mock preview on port 3101 was stopped after QA. Existing user server on port 3000 was left untouched.
- .tmp/ and supabase/.temp/ are gitignored.
- No commit, push, PR, or issue was created. gh CLI was unavailable; issue flow skipped per forward skill.

## Key Files

- src/components/share-property-bills.tsx
- src/app/group-bill-actions.ts
- src/components/group-bill-rooms.tsx
- src/components/tenant-bill.tsx
- src/components/room-payment-notice.tsx
- src/components/slip-upload.tsx
- src/app/h/[token]/*
- src/app/api/h/[token]/[invoiceId]/slip/route.ts
- src/lib/group-bill.ts
- supabase/functions/bill-gateway/index.ts
- supabase/migrations/20260917071003_property_group_bills.sql
- supabase/tests/group-bills.sql
- tests/group-bill-gateway.test.ts

## Pending

- [ ] Review and commit the completed group-sharing changes when requested; do not stage vault files.
- [ ] Verify owner copy-link and rotate-link flows in an authorized test environment before public rollout.
- [ ] Choose a public frontend host/domain and deploy when authorized; ensure generated shared links use the public origin.
- Missing QR for นฤมลแมนชั่น still requires the correct owner-supplied QR upload.
- Landing page and LINE OA remain ideas discussed, not implementation commitments.

## Next Session

- [ ] Run /recap and inspect current git diff plus this handoff before making further changes.
- [ ] Coordinate owner acceptance testing for one shared bill link, without creating persistent production QA accounts.

## Uncommitted Files

```text

```
