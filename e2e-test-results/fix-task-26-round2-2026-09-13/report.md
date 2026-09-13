# FIX-Task-26 round 2 — on-device verification note (2026-09-13)

**Scope of this note:** what was proven on a real device for the three code changes below, what
could NOT be driven on-device, and the exact steps the next QA pass should follow for the one item
whose failure mode was *"the unit test passed but the real behaviour didn't"*.

**Device / env:** Android emulator `Medium_Phone_API_36.1` (API 36.1), staging Supabase
`drntwgporzabmxdqykrp`, Expo dev client bound to Metro `http://10.0.2.2:8082`, persona `test-buyer`.
Bundle was a **cold reload from Metro after the edits** (fresh bundle, not a cached one).

---

## 1. F1-b — wrong-password login now shows "Invalid email or password." ✅ VERIFIED ON-DEVICE

**Why on-device proof was mandatory here:** the whole finding was that a Tier-0-green unit test was
asserting an error shape the SDK never emits. A green test could not close this.

**Exact steps driven (reproducible):**

1. Cold-relaunch the dev client → tap the Metro `8082` server → wait for the bundle.
2. `adb shell am start -a android.intent.action.VIEW -d "p2pkidsmarketplace://qa-logout" com.sameralzubaidi.p2pmarketplace`
   → lands on `Landing` (log out first; `qa-login-as` only mounts in the authenticated stack).
3. Landing → **Log In**.
4. Email: `test-buyer@kidsmarketplace.test` · Password: any deliberately WRONG value → **Log In**.
5. **Screenshot before pressing anything else** (Android IME is invisible to the AX tree).

**Result (dialog, AX tree + screenshot):**

| Element | Value |
|---|---|
| Title | `Login Failed` |
| Body | **`Invalid email or password.`** ← the guide-asserted copy |
| Buttons | single `OK` (`login-failed-dialog-ok-button`) |

No LogBox overlay, no project ref / `cf-ray` / `sb-request-id` / cookie anywhere on screen — so the
Phase-0 leak remains closed **and** the specific wrong-password branch is now genuinely reachable.

**Evidence:** `screenshots/A-F1b-wrong-password-invalid-credentials.png`

**The real SDK shape this pins (auth-js 2.89.0, from the installed SDK's own constructors):**

```js
new AuthApiError('Invalid login credentials', 400, 'invalid_credentials')
// → { name: 'AuthApiError', status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' }
```

Note **HTTP 400 + a snake_case `error_code`** — *not* the 401/no-`code` shape the old test used.

---

## 2. X11-b — failed cart removal rollback + inline retry ⚠️ UNIT-TESTED ONLY (device leg blocked)

**Could not be induced on-device.** Arming airplane mode to force the write to fail does not reach
the cart's error path: the app's **global offline gate** (`offline-screen` / "No Internet
Connection") replaces the whole screen before/while the removal is attempted, so the rollback card
can never be observed — and turning the network off *after* opening the confirm dialog does not help,
because the failure is reported after the gate has already taken over the screen.

**Consequence:** items 2 + 4 are covered by 4 new unit cases that drive the **real** confirm-then-remove
path (the Alert's own Remove button) against a mocked failing `removeFromCart`:

- row is restored + `cart-remove-error-card` + `cart-remove-retry-button` appear
- the cart is **not** refetched after a failure (no surprise resurrection)
- no `cart_item_removed` analytics event on a failed removal
- Retry re-runs the same path and clears the card on success

**A device leg for this needs a QA toggle** (e.g. a session-local `cart_remove_failure` key,
mirroring `pref_save_failure`) — flagged as a follow-up, deliberately not added here.

---

## 3. Cart removal — success path regression check ✅ VERIFIED ON-DEVICE

Because the fix re-ordered the success path (analytics + refetch now run only after a persisted
write), the previously-PASSing X11 leg was re-driven to prove no regression:

1. Trade Basket with 2 items → trash icon on item 1 → confirm **Remove**.
2. **Result:** item gone; basket badge `2 → 1`; "Removes all **1** item from your trade basket";
   Subtotal/Total `$30.00 → $15.00`; CTA switched to `single-item-cta-button`;
   **no `cart-remove-error-card`** (correct — there was no failure).

This matches TRD-TC-M08's expected result ("removed item disappears, total updates") and X11's
badge-decrement expectation.

---

## Left-behind state (shared staging — for the next session)

| Item | State now | How to restore |
|---|---|---|
| `test-buyer` cart | **1 item** (was a 2-item bundle fixture; item `0d26f56a-…` removed for real) | `npm run qa:create-bundle-fixture -- --buyer test-buyer --seller test-seller --count 3` |
| `test-buyer` session | logged in on the emulator | — |
| Airplane mode | **off** (restored) | — |
| Dev client | running, bound to Metro `:8082` | — |

## Owed / NOT verified

- Cart **failure** leg (items 2 + 4) on-device — blocked by the offline gate (see §2).
- iOS leg — this pass was Android-only (R80 platform disclosure).
- F11 and B(c) were **deliberately not actioned** — they remain env-confounded and need a clean
  re-test on a recovered backend before any fix.
