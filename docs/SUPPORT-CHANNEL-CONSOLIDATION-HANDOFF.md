# Support-Channel Consolidation — Decisions + Implementation Handoff

**Date:** 2026-08-26
**Repo:** `kids_marketplace_app/` (mobile `p2p-kids-marketplace/`, admin `p2p-kids-admin/`, Supabase backend)
**Status:** APPROVED + IMPLEMENTED (backend deployed to staging; mobile/admin/QA/docs code changes applied — pending Tier-0 verification)
**Companion docs:** `docs/decision-log.md` (decisions) · `/memories/session/plan.md` (execution plan) · `/memories/repo/support-consolidation-handoff.md` (this spec, mirrored)

> This document is the single source of truth for WHAT we built and WHY. Use it to review, verify, or continue the work without re-doing discovery.

---

## 1. Approved decisions (2026-08-26)

- **D1 — No raw support-email surfaces.** Users must NEVER see a "send email to support" message or a support email address when they need help. Every support/contact affordance routes to the in-app **Contact Support** form.
- **D2 — Logged-out users can submit tickets.** Contact Support reachable logged-out (new Login + Signup entry points); guest submissions REQUIRE a **"Your email (so we can reply)"** field → nullable `contact_email`; `support_messages.user_id` nullable; anon INSERT RLS.
- **D3 — Suspended users get support too** (ContactSupport registered in the suspended branch).
- **D4 — QA agent rule (approved):** per-screen back-button/header compliance + "no raw support-email surfaces" checks added to QA instructions §6.4.
- **D5 — Admin review + REPLY page built.** Reply = stored row (`support_message_replies`) + emailed to the user (guest `contact_email` / profile email) via `send-email` Edge Function (`support_reply` type).
- **D6 — Optional phone on guest tickets** → nullable `contact_phone`, shown in admin detail.
- **D7 — Manual-test coverage updated** in `cross-checked-and-consolidated/` (guest tickets, admin reply, no-raw-email, per-screen back-button).

## 2. What was implemented

### Backend (staging `drntwgporzabmxdqykrp` — APPLIED + VERIFIED)
- **Migration `20260826000002_support_messages_anon_contact`** (`supabase/migrations/20260826000002_support_messages_anon_contact.sql`): `user_id` DROP NOT NULL; `+contact_email`; `+contact_phone` (+CHECK ≤20); XOR check `support_messages_guest_contact_email_check`; anon INSERT policy `support_messages_insert_anon` (`user_id IS NULL AND contact_email IS NOT NULL`). Verified: columns + policies present.
- **Migration `20260826000003_support_message_replies`** (`supabase/migrations/20260826000003_support_message_replies.sql`): `support_message_replies` (id, support_message_id FK, admin_id, reply_text 1..5000, created_at); RLS service-role ALL; indexes. Verified.
- **Edge Function `send-email` v27 (DEPLOYED, verify_jwt=true):** added `support_reply` to the type union + `validTypes`, a `processSupportReplyEmail` plain-HTML handler (HTML-escaped, no SendGrid template needed — resolves open item #1), and the switch case. Deployed with the repo file in sync.

### Mobile (`p2p-kids-marketplace/src`) — code applied
- `screens/support/ContactSupportScreen.tsx`: `isGuest=!session`; guest-only "YOUR EMAIL (SO WE CAN REPLY)" (required) + "PHONE (OPTIONAL)"; guest payload `{user_id:null, contact_email, contact_phone, subject, message}`; removed logged-out gate + email fallback + dead styles.
- `navigation/AppNavigator.tsx`: `ContactSupport` registered in the **suspended branch** (fragment) + **unauth branch** (after Login/Signup).
- `screens/auth/LoginScreen.tsx`: "Need help? Contact Support" link (`login-contact-support-link`); `ACCOUNT_DELETED` copy no email.
- `screens/auth/SignupScreen.tsx`: "Need help? Contact Support" link (`signup-contact-support-link`).
- `screens/help/HelpScreen.tsx`: footer → "Contact Support" link (`help-contact-support-link`).
- `screens/profile/EditProfileScreen.tsx`: `?` icons → `navigate('ContactSupport')` (no email Alert; `SUPPORT_CONTACT_EMAIL` removed).
- `screens/subscription/MySubscriptionScreen.tsx`: "Get Help" → `navigate('ContactSupport')` (Alert import removed).
- `screens/auth/SuspendedAccountScreen.tsx`: "Contact Support" secondary button (`suspended-contact-support-button`); email text/styles removed.
- `services/auth.ts`: deleted-account copy no email.
- `constants/legal.ts` + `constants/email.ts`: canonicalized internally (`support@p2pkidsmarketplace.com`), internal-only.

### Admin portal (`p2p-kids-admin`) — code applied
- `src/app/api/support/route.ts` + `src/app/api/support/[id]/route.ts`: include `contact_email`/`contact_phone`; guest enrichment `{name:'Guest', email, phone, is_guest:true}`; profile join guarded for null user_id; detail response now includes the reply thread (`replies`).
- NEW `src/app/api/support/[id]/reply/route.ts`: `verifyAdminAuth`; insert `support_message_replies` (`admin_id` from auth); mark read; invoke `send-email` (`support_reply`, `isCritical:true`, **matching** service-role `apikey`+`Authorization` headers — avoids the B02 401); reply stored even if email fails.
- `src/app/support/page.tsx`: `is_guest` type + "Guest" pill; `x-admin-secret` header added to list + mark-as-read fetches (BP-49 — the support module was header-less and would 401).
- `src/app/support/[id]/page.tsx`: types for guest fields + `replies`; guest shown as "Guest (not logged in)"; **reply thread** + **reply composer** (textarea, `btn-support-reply`, char count, error/warning states, thread refresh); `x-admin-secret` headers on all fetches.

### QA instructions (`.github/instructions/QA-Test-Agent.instructions.md` §6.4)
- Added **per-screen header/back-button check** (canonical `AppHeader` detail: 40×40 round `#F4F4F4`, `CaretLeft` 24 `#1A1A1A` regular, icon-only, hitSlop ≥8, "Go back", `back-button` testID; title 17/700 centered; bell+chat right; green/undersized/labeled/stacked = deviation).
- Added **no raw support-email surfaces** check (`support@`/`admin-support@`/`mailto:`/"email us" on any rendered screen = deviation; only allowed email input is the guest reply field).

### Docs
- `docs/decision-log.md` (D1–D7 + channel map + excluded scope + open items).
- This handoff file.

## 3. Pending (now DONE — see Verification below)

All previously-pending items were applied in the same session:
- **Unit-test updates** for `ContactSupportScreen.test.tsx` (removed the 2 email-fallback assertions; added logged-out renders email+phone fields, logged-in renders neither, no email text, guest missing-email validation). **30/30 PASS.**
- **Manual-test guide updates (D7)** applied in `cross-checked-and-consolidated/`:
  - Account guide: `ACC-TC-B10` (locked-field affordance → navigates, no email), `ACC-TC-H05` (guest leg rewrite, no email fallback), `ACC-TC-I01` (footer → Contact Support link), + NEW `ACC-TC-H06` (no-raw-email sweep) + `ACC-TC-H07` (logged-out Login/Signup entry).
  - TradeFlow guide: `TRD-TC-U02/U04` — added Edit Profile + explicit per-screen back-button criteria.
  - Admin guide: Group S — guest-ticket notes in `ADM-TC-S01/S02` + NEW `ADM-TC-S03` (reply stored + emailed).
- **Verification (Tier 0):** `yarn typecheck` PASS (mobile + `npx tsc --noEmit` admin); changed-file lint 0 errors (4 pre-existing warnings); Jest 30/30 (ContactSupport) + 50/50 (EditProfile/Login/Signup/AppNavigator); grep gate for `support@|admin-support@|email us|mailto:` clean (only internal constants + test assertions + one comment false-positive remain).

## 4. Verification notes
- Pre-deploy SQL checks were run (columns + policies confirmed for both tables).
- Deploy order was migration-first, then EF — compliant with the backward-compat rule.
- Grep expectation after all edits: `support@`/`admin-support@`/`email us`/`mailto:` should remain ONLY in `src/constants/email.ts` + `src/constants/legal.ts` (internal config) and the guest reply field label; the dead `src/screens/LoginScreen.tsx` duplicate still contains `admin-support@` (documented dead code).

## 5. Excluded scope
Moderation pipelines (disputes, issue reports, review reports, category flags) · dead `src/screens/LoginScreen.tsx` · in-app "view your replies" UI (email is the channel) · SendGrid template (plain-HTML used).

## 6. Open items
1. ~~SendGrid template for `support_reply`~~ — resolved (plain-HTML).
2. Guests can't read back tickets in-app (no anon SELECT) — email is the reply channel; confirmed acceptable.
