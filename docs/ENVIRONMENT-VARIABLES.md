# Environment Variables Reference

This document lists every environment variable referenced by the Kids P2P
Marketplace codebase, the app it belongs to, whether it is safe to expose to
clients, and what it does.

## Classification Rules

| Class | Prefix(es) | Where it lives | Examples |
|---|---|---|---|
| **Public** | `EXPO_PUBLIC_*`, `NEXT_PUBLIC_*` | Bundled into client app/browser JS | Supabase URL, anon key, Stripe publishable key |
| **Server-only** | _(no client prefix)_ | Edge Function secrets, Next.js server runtime, CI | Service role keys, secret API keys, webhook secrets |

**Hard rules (enforced by PROD-012 audit):**
- ❌ NEVER prefix a true secret with `EXPO_PUBLIC_` or `NEXT_PUBLIC_`. It will be readable on every device/browser.
- ❌ NEVER commit a real value to git. `.env.example` files contain placeholders only.
- ✅ Rotate secrets immediately if a leak is suspected.

---

## Mobile App (`p2p-kids-marketplace`)

### Public (bundled into device app)
| Variable | Required | Description |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL. |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key (RLS-scoped). |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | Stripe publishable key (safe by Stripe design). |
| `EXPO_PUBLIC_STRIPE_REDIRECT_BASE_URL` | Yes | Public landing host for Stripe onboarding redirects. |
| `EXPO_PUBLIC_SENTRY_DSN` | Prod | Sentry DSN (no auth — write-only). |
| `EXPO_PUBLIC_CDN_URL` | Opt | CDN base URL for images. |
| `EXPO_PUBLIC_ENVIRONMENT` | Yes | `development` / `staging` / `production`. |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | Build | EAS project id. |
| `EXPO_PUBLIC_DEV_SMS_BYPASS` | Dev | Bypass SMS in dev only (must be unset in prod). |
| `EXPO_PUBLIC_ENABLE_REALTIME` | Opt | Feature flag. |
| `EXPO_PUBLIC_FROM_EMAIL` | Opt | Display "from" email used by client previews. |
| `EXPO_PUBLIC_REPLY_TO_EMAIL` | Opt | Display reply-to. |
| `EXPO_PUBLIC_SMS_API_URL` | Opt | AWS SNS proxy URL (no key bundled). |
| `EXPO_PUBLIC_PRIVACY_POLICY_URL` | Opt | Override for hosted Privacy Policy. |
| `EXPO_PUBLIC_TERMS_OF_SERVICE_URL` | Opt | Override for hosted Terms of Service. |

### Server-only (Edge Functions, EAS secrets, CI)
| Variable | Where used | Description |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions | Full DB access (RLS bypass). |
| `STRIPE_SECRET_KEY` | Edge Functions | Stripe REST calls. |
| `STRIPE_WEBHOOK_SECRET` | Edge Function `subscriptions-webhook` | Stripe webhook signature verification. |
| `STRIPE_WEBHOOK_SUBSCRIPTIONS_SECRET` | Edge Function | Stripe subscription webhooks signature. |
| `SUBSCRIPTION_WEB_SECRET` | Edge Function `create-checkout-session` + `p2p-kids-web` | Shared secret between the web app and the checkout EF (`x-web-secret` header). MUST match on both sides. |
| `SUBSCRIPTION_BIND_TOKEN_SECRET` | Edge Function `create-checkout-session`/`link-subscription-account` | HMAC one-time bind token over email (R7 pre-account linking). |
| `SUBSCRIPTION_WEB_URL` | Edge Function `create-checkout-session` | Base for Stripe success/cancel URLs; default `https://passitup.com`. Set to the deployed web origin for the target env. |
| `SENDGRID_API_KEY` | Edge Function `send-email/` | SendGrid REST API key. **NEVER prefix with EXPO_PUBLIC_** (PROD-012 fix). |
| `SENDGRID_TEMPLATE_*` | Edge Function `send-email/` | Dynamic template IDs (not secret, but server-only by convention). |
| `TWILIO_ACCOUNT_SID` | Edge Function `sms-send/` | Twilio account SID. |
| `TWILIO_AUTH_TOKEN` | Edge Function `sms-send/` | Twilio auth token. |
| `TWILIO_FROM_NUMBER` | Edge Function `sms-send/` | Twilio sender number. |
| `AWS_SNS_API_GATEWAY_KEY` | Lambda | SNS proxy API key. |
| `AWS_SNS_API_GATEWAY_URL` | Lambda | SNS proxy URL. |
| `EXPO_TOKEN` | CI / EAS | EAS build authentication. CI secret only. |
| `SENTRY_AUTH_TOKEN` | CI | Sentry release uploads. |
| `SUPABASE_PURGE_ENDPOINT` | Cloudflare worker | Cache purge endpoint. |
| `SUPABASE_PURGE_X_API_KEY` | Cloudflare worker | Cache purge auth. |

---

## Admin Portal (`p2p-kids-admin`)

### Public (bundled into browser JS)
| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key. |
| `NEXT_PUBLIC_ADMIN_UI_SECRET` | Opt | **Admin UI auth token** — by spec design (PROD-012) this is allowed on the client because it gates admin UI routes only; it is rotated regularly and is not a true credential. Server routes also accept the server-only `ADMIN_UI_SECRET` via the `verifyAdminAuth()` middleware (see PROD-010). |
| `NEXT_PUBLIC_CDN_URL` | Opt | CDN base URL. |
| `NEXT_PUBLIC_ADMIN_API_URL` | Opt | Admin API base URL. |

### Server-only (Next.js API routes, CI)
| Variable | Where used | Description |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | API routes / scripts | Admin DB operations. |
| `ADMIN_UI_SECRET` | API routes via `verifyAdminAuth()` | Canonical admin API auth (PROD-010). |
| `STRIPE_SECRET_KEY` | API routes | Stripe admin operations. |
| `SENDGRID_API_KEY` | API routes | Admin-initiated emails. |

### Forbidden in the admin portal (would leak)
- `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_SENDGRID_API_KEY`
- `NEXT_PUBLIC_TWILIO_AUTH_TOKEN`

(If any of these are ever set, the admin portal MUST refuse to start.)

---

## Supabase Edge Functions

All Edge Functions read secrets from `supabase secrets set ...`. See
`supabase/functions/<name>/README.md` for each function's required vars.

Common:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Provider keys (`STRIPE_SECRET_KEY`, `SENDGRID_API_KEY`, `TWILIO_AUTH_TOKEN`,
  `FCM_*`, etc.) as needed by each function.

---

## PROD-012 Audit Verification Commands

Run from repo root:

```sh
# P0: must return 0 lines (excluding documentation strings)
grep -rnE "NEXT_PUBLIC_[A-Z_]*(SERVICE_ROLE|PRIVATE|PASSWORD)" \
  p2p-kids-admin/src 2>/dev/null

grep -rnE "EXPO_PUBLIC_[A-Z_]*(SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|API_KEY)" \
  p2p-kids-marketplace/src 2>/dev/null
```

Both commands should return no rows. `NEXT_PUBLIC_ADMIN_UI_SECRET` is the
single intentional exception (UI auth token, not a credential).

---

## Supabase Auth SMTP (GoTrue password-reset / recovery emails) — SendGrid relay

> **Why this exists (2026-09-07):** staging password-reset email delivery regressed
> between 2026-08-16 (PASS) and 2026-08-23 (BLOCKED — "Error sending recovery
> email"; GitHub `sameralzubaidy-afk/mobapp` #15). This is **hosted Supabase Auth
> dashboard config** (project `drntwgporzabmxdqykrp`), NOT a repo/.env setting —
> there is no local SMTP config anywhere (supabase/config.toml has no `[auth]`
> mailer; GoTrue auth mail is separate from the `send-email` Edge Function path).
> This section records the working settings so reconfiguration is a copy-paste
> job instead of a re-discovery.

**Provider: SendGrid SMTP relay** (public documented settings — no secret here):

| Setting | Value |
|---|---|
| Host | `smtp.sendgrid.net` |
| Port | `587` (TLS/STARTTLS; `465` SSL and `25` also supported) |
| Username | `apikey` (literal) |
| Password | the full `SENDGRID_API_KEY` (mail-send scope) — read from `p2p-kids-marketplace/.env(.staging)` `SENDGRID_API_KEY`; never store the literal in docs |
| From email | a **Verified Sender** on the SendGrid account (test sender e.g. `noreply@<verified-domain>`) |
| From name | e.g. `Pass It Up` |

**Where to apply (Supabase dashboard → Authentication → Settings on project
`drntwgporzabmxdqykrp`):**
1. **SMTP settings** → enable custom SMTP → host/port/username(`apikey`)/password(SendGrid key)/from — or use the built-in sender.
2. **URL Configuration** → `site_url` (the app/web root) and confirm **Additional Redirect URLs** include the deep link GoTrue puts in the recovery email: `p2pkidsmarketplace://reset-password` (AUTH-TC-S01 asserts the reset link uses this scheme).

**Verification after applying:** run a real Forgot Password to the documented real
test inbox (`samer.alzubaidi82@gmail.com`) — success state in-app, an `email_logs`
row (or the provider's event feed), and the delivered email carries the
`p2pkidsmarketplace://reset-password` link — then re-run AUTH-TC-S01 on-device.
(S08/S11 already PASS via the server-side mint harness `admin-trigger-password-reset`
and are independent of SMTP.)
