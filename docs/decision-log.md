# Decision Log — Kids P2P Marketplace

## 2026-08-26 — Support-Channel Consolidation + Admin Reply + QA Rule (Approved by Samer)

**Context:** The app surfaced 4 different support email addresses and 2 alert-only "contact support" paths; the only real form (`ContactSupportScreen` → `support_messages`) was auth-gated and unreachable logged-out; the admin support surface was read + mark-as-read only (no reply). The Edit Profile back button also deviated from the design system and was missed by QA's sampled header checks.

### Decisions (D1–D7)

- **D1 — No raw support-email surfaces.** Users must never see a "send email to support" message or a support email address when they need help. Every support/contact affordance routes to the in-app **Contact Support** form.
- **D2 — Logged-out users can submit tickets.** Contact Support is reachable logged-out (new Login + Signup entry points) and accepts guest submissions. Guest submissions REQUIRE a **"Your email (so we can reply)"** field → new nullable `contact_email`; `support_messages.user_id` becomes nullable; new anon INSERT RLS policy.
- **D3 — Suspended users get support too.** The Suspended Account screen gets a **Contact Support** button (route registered in the suspended branch).
- **D4 — QA agent rule (approved).** Add explicit **per-screen back-button/header compliance** + **"no raw support-email surfaces"** checks to the QA agent instructions (§6.4).
- **D5 — Build an admin review + REPLY page.** Reply = stored row (`support_message_replies`) + emailed to the user (guest `contact_email` / profile email) via `send-email` Edge Function (new `support_reply` type, plain-HTML, no SendGrid template needed).
- **D6 — Optional phone on guest tickets.** Logged-out form adds an optional **"PHONE (OPTIONAL)"** field → new nullable `contact_phone`; surfaced in the admin detail page.
- **D7 — Update manual-test coverage** in `cross-checked-and-consolidated/` (guest tickets, admin reply, no-raw-email, per-screen back-button).

### Consolidated support channels (all → Contact Support form → `support_messages` → admin `/support`)
- ContactSupportScreen (guest email required + phone optional; email fallback removed)
- Education Help footer (was `support@p2pkidsmarketplace.com` text)
- Edit Profile `?` icons (was `admin-support@kidsmarketplace.app` Alert)
- My Subscription "Get Help" (was `admin-support@kidsmarketplace.app` Alert)
- Suspended Account (was `admin-support@kidsmarketplace.app` text)
- Login deleted-account error + `services/auth.ts` (was `admin-support@kidsmarketplace.app`)
- Login/Signup: new "Need help? Contact Support" links (logged-out entry)
- `constants/legal.ts` + `constants/email.ts` canonicalized internally

### Excluded scope (intentionally NOT changed)
- Content-moderation pipelines: trade disputes, trade issue reports, review reports, category flags — separate admin surfaces.
- `src/screens/LoginScreen.tsx` root duplicate (dead code per `docs/flow-registry.md`).
- In-app "view your support replies" UI for users (email is the reply channel; future enhancement).

### Open items
1. ~~SendGrid template for `support_reply`~~ — resolved: plain-HTML email body (same pattern as `change_email`/ID-badge emails), no template ID required.
2. Guests cannot read back their ticket in-app (no anon SELECT policy) — email is the reply channel; confirmed acceptable.
