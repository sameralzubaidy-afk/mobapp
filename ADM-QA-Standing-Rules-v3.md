# ADM QA Standing Rules (v3) — Effective for All Admin Portal QA Tasks

ADM-R1 through ADM-R4 unchanged from v2 (full E2E UI→DB→backend; mobile-impacting config cross-surface E2E for forward-looking cases; `prompt()`-driven actions BLOCKED-on-tooling; single-field-edit discipline on settings forms).

## ADM-R5 — New: Mobile-Impact E2E Is Mandatory for a PASS Verdict, Not Optional

Ratified 2026-09-04 per explicit owner instruction, following QA Task 31's self-caught coverage gap. Any admin action whose effect reaches a mobile screen or a mobile user — per the guide's own `Surfaces: admin, mobile` declaration on that test case — **cannot be marked PASS on admin-portal-plus-DB verification alone.** The mobile leg must actually be driven (admin action → observe the effect on-device, same session) before a PASS is recorded. If the mobile leg cannot be driven this round (fixture gap, tooling gap, etc.), the verdict is **PARTIAL with "mobile leg owed" stated explicitly** — never a bare PASS.

This applies broadly, not just to categories (the case that surfaced it): categories (active-state, SP multiplier, icon, ordering, caps), nodes/radius/waitlist, wallet freeze/suspend/balance, config toggles with client-visible effects, policy publish, moderation actions, subscription status changes, badge awards, and any future admin surface with a declared mobile impact.

## ADM-R6 — New: Native Dialog Handling Technique

For the embedded browser driver: native `confirm()`/`prompt()` dialogs are most reliably handled by overriding `window.confirm`/`window.prompt` via `page.evaluate` before triggering the action, so the app's own UI handler still runs the real mutation — rather than racing a separate accept/dismiss call against the dialog's appearance. Proven reliable on the category delete flow in QA Task 31. Use this as the default technique going forward for any admin action gated behind a native dialog (distinct from ADM-R3's fully-BLOCKED `prompt()`-for-reason-entry cases, which still can't be driven at all).

---

# How This Gets Applied

Every future ADM QA task prompt references all six rules (ADM-R1 through R6) by name — this file is the single source of truth. Do not restate them in full in each new task prompt.
