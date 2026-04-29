# Usability & QA Testing Playbook (Solo Dev Edition)

> **Owner:** Samer (solo)  
> **Goal:** Trustworthy, fast, repeatable verification that the app works end‑to‑end **before opening to friends & family**.  
> **Constraints:** $0 budget, no team, weekly cadence during active dev, full sweep per release.  
> **Audience:** You (future‑you reading this in 3 months).

---

## 0. Strategic context (read first — once)

### 0.1 The 3‑layer trust pyramid

```
       ┌──────────────────────────────────────┐
       │ L3  Manual + Maestro UI smoke        │  ~30–45 min, weekly
       │     (10 critical-path flows only)    │  Catches: real user paths, UX
       ├──────────────────────────────────────┤
       │ L2  Jest integration (real Supabase) │  ~5–8 min
       │     RLS, RPC, SP/fees, triggers      │  Catches: logic, data, contracts
       ├──────────────────────────────────────┤
       │ L1  Typecheck + lint + unit          │  ~60–90 sec, every save
       │                                      │  Catches: regressions, types
       └──────────────────────────────────────┘
```

**Why this shape:** Most bugs in this app are **data/logic bugs** (RLS, SP math, fees, state machines), not pixel bugs. Push effort into L1+L2, keep L3 lean.

### 0.2 Why Maestro is kept *small* (until UX refresh ships)

You're about to redesign screens. Every UI test you write today **breaks** when screens change. Therefore:

- **Now → UX refresh:** Maestro covers only the **10 highest-risk user paths** (signup, login, list item, buy, SP wallet, message, subscribe, logout). No more.
- **After UX refresh stabilizes:** expand Maestro to full 21 FLOW-IDs.
- **Logic/DB tests (L2)** don't care about UX — invest there now; they're permanent assets.

### 0.3 Anti-flake principles (Maestro past pain — fixed here)

Past Maestro issues (stuck, "screen mismatch") almost always trace to **one of these five**:

| Root cause | Fix (mandatory in this plan) |
|---|---|
| Text-based matchers (`tapOn: "Sign Up"`) | Use `id:` matchers only → `tapOn: { id: "signup-submit" }` |
| Missing `testID`/`accessibilityLabel` on components | One-time testID audit (Step 1.3) |
| No wait on async screens | `extendedWaitUntil` with explicit element + 15s timeout |
| Non-deterministic data state | Reseed staging before each run |
| Wrong start state (logged in vs out) | Every flow starts with `clearState` + `launchApp` |

If a flow ever fails twice in a row, **delete or quarantine it** — flaky tests poison trust faster than missing tests.

---

## 1. Phase 0 — Pre-flight (one-time, ~2 hours)

Goal: get the toolchain stable and reproducible. Do this **once**, never again.

### 1.1 Install Maestro (in case you reinstall later)

```bash
# macOS
curl -fsSL "https://get.maestro.mobile.dev" | bash
# Verify
maestro --version
```

If install fails, fallback:

```bash
brew tap mobile-dev-inc/tap
brew install maestro
```

### 1.2 Decommission Detox (keep config, drop from canonical path)

Don't run Detox anymore. It's not deleted (in case you revisit), just removed from your weekly/release commands.

```bash
# Verify nothing scheduled references Detox
cd p2p-kids-marketplace
grep -n "detox" package.json
```

Action: leave `detox.config.json` and `e2e:*` scripts in `package.json` untouched, but **never** call them in weekly/release flows. The orchestrator scripts (Step 2) will not invoke them.

### 1.3 testID audit — the single most important step

This kills 90% of Maestro flakiness.

For each of the **10 critical screens** (list below), open the file and confirm every interactive element (button, input, list row, modal CTA) has a stable `testID` AND `accessibilityLabel`.

**Critical screens to audit (do these first):**

| # | Flow | Screen file |
|---|---|---|
| 1 | Signup | `src/screens/SignupScreen.tsx` |
| 2 | Login | `src/screens/LoginScreen.tsx` |
| 3 | Onboarding (first run) | `src/screens/onboarding/*` |
| 4 | Item create | `src/screens/ItemCreateScreen.tsx` |
| 5 | Bulk listing | `src/screens/BulkListingCreateScreen.tsx` |
| 6 | Browse / discovery | `src/screens/home/*` |
| 7 | Item detail + buy | `src/screens/items/*`, `src/screens/trade/*` |
| 8 | SP wallet | `src/screens/sp/*` |
| 9 | Subscription purchase | `src/screens/subscription/*` |
| 10 | Messaging | `src/screens/messaging/*` |

**testID naming convention** (lock this in now):

```
<screen-short>-<element>-<action?>
```

Examples:
- `signup-email-input`
- `signup-submit-button`
- `item-create-photo-add-button`
- `wallet-balance-text`
- `wallet-redeem-cta`

**Rule:** Maestro flows MUST use `id:` matchers only. Reject any PR/edit that adds a Maestro flow using `tapOn: "<text>"`.

**Check command** (run this any time):

```bash
cd p2p-kids-marketplace
# Quick lint: any maestro flow using text-only tapOn instead of id:
grep -rn 'tapOn: "' .maestro/ ../.maestro/ || echo "Clean ✅"
```

If results appear → those flows are flake risks; fix them.

### 1.4 Staging seed/reset verified

You said you have test users. Confirm reset works:

```bash
cd p2p-kids-marketplace
npm run reset:staging    # cleans + reseeds
```

Expected: completes <60s, exit 0. If it fails, fix this **before** anything else — automation without deterministic state is theatre.

### 1.5 Android device for Maestro

```bash
adb devices
# expected: one device listed, "device" status (not "unauthorized")
```

If unauthorized → unlock phone, accept USB debugging prompt.

### 1.6 iOS simulator boot check

```bash
xcrun simctl list devices booted
# If none booted:
open -a Simulator
```

### 1.7 Phase 0 done?

Tick all of these before moving to Phase 1:

- [ ] `maestro --version` works
- [ ] `npm run reset:staging` succeeds <60s
- [ ] `adb devices` lists Android device
- [ ] iOS sim boots
- [ ] testID convention documented (this file)
- [ ] All 10 critical screens audited; missing testIDs added

---

## 2. Phase 1 — Build the trustworthy foundation (week 1)

Goal: replace ad‑hoc testing with three commands you trust.

### 2.1 Add the three release commands

Add to root-level `package.json` (create if missing) **OR** to `p2p-kids-marketplace/package.json` scripts section:

```json
{
  "scripts": {
    "tier0":          "npm run typecheck && npm run lint && npm run test:unit",
    "tier1":          "RUN_SUPABASE_E2E=true npm run test:integration",
    "tier2:reset":    "npm run reset:staging",
    "tier2:smoke:ios":     "maestro test .maestro/_critical/ --platform ios --format html --output .maestro/reports/$(date +%Y%m%d-%H%M)",
    "tier2:smoke:android": "maestro test .maestro/_critical/ --platform android --format html --output .maestro/reports/$(date +%Y%m%d-%H%M)",
    "weekly-check":   "npm run tier0 && npm run tier1",
    "release-check":  "npm run tier0 && npm run tier1 && npm run tier2:reset && npm run tier2:smoke:ios"
  }
}
```

> **Note:** verify each underlying script (`typecheck`, `lint`, `test:unit`, `test:integration`, `reset:staging`) actually exists in the same `package.json` before relying on these — the **Script Existence Rule** applies.

### 2.2 Create the "critical 10" Maestro folder

Move/copy the 10 highest-value flows into a frozen, curated folder so weekly/release runs don't drag in 47 untrusted flows.

```bash
mkdir -p p2p-kids-marketplace/.maestro/_critical
```

Copy in **only these 10** (rename if needed):

| File | Maps to FLOW-ID |
|---|---|
| `01-auth-signup.yaml` | FLOW-01 |
| `02-auth-login-logout.yaml` | FLOW-01 |
| `03-onboarding-skip.yaml` | FLOW-02 |
| `04-listing-create-single.yaml` | FLOW-04 |
| `05-listing-bulk-min.yaml` | FLOW-04 |
| `06-discovery-browse-search.yaml` | FLOW-06 |
| `07-trade-checkout-cash-only.yaml` | FLOW-08 |
| `08-sp-wallet-read.yaml` | FLOW-10 |
| `09-subscription-purchase-stub.yaml` | FLOW-12 |
| `10-messaging-send-receive.yaml` | FLOW-14 |

Everything else stays in `.maestro/` but is **NOT** part of `release-check`. They're "exploratory" tests, run ad‑hoc.

### 2.3 The critical-flow YAML template (anti-flake)

Every flow in `_critical/` must follow this skeleton:

```yaml
appId: com.yourapp.id
---
- clearState           # always start clean
- launchApp:
    arguments:
      e2eMode: true    # if your app reads this env to skip animations / use mock provider
- extendedWaitUntil:
    visible:
      id: "auth-welcome-title"
    timeout: 15000

- tapOn:
    id: "auth-welcome-signup-button"

- extendedWaitUntil:
    visible:
      id: "signup-email-input"
    timeout: 10000

- tapOn:
    id: "signup-email-input"
- inputText: "test+${output.timestamp}@example.com"

# ...continue with id: matchers only...

- assertVisible:
    id: "home-feed-list"
# Final assertion: did we land where we expected?
```

**Hard rules** (enforce by code review of yourself):

1. No `tapOn: "<text>"` — `id:` only.
2. Every screen transition wrapped in `extendedWaitUntil` with explicit timeout.
3. Every flow ends with an `assertVisible` of the destination screen — proves it didn't silently fail.
4. No `swipe`/`scroll` without an `assertVisible` first — gestures on wrong screen are silent failures.
5. No coordinate taps (`tapOn: { x:, y: }`) — ever.

### 2.4 Pin Maestro version

Avoid the "worked yesterday, broke today" trap.

```bash
maestro --version  # note current version, e.g. 1.39.0
```

Add to `docs/TESTING-PLAYBOOK.md` (this file): **Pinned Maestro version: `<your-version>`**. If a future install differs, suspect Maestro before suspecting your tests.

> **Pinned Maestro version:** _(fill in after running `maestro --version`)_

### 2.5 Phase 1 acceptance

- [ ] `npm run tier0` runs in <2 min, exits 0
- [ ] `npm run tier1` runs in <10 min, exits 0
- [ ] `_critical/` folder has exactly 10 yaml files
- [ ] Each yaml uses `id:` matchers only (grep test passes)
- [ ] One full `npm run release-check` finishes (even if some flows need fixing) — you have a baseline

---

## 3. Phase 2 — Weekly rhythm (~25–35 min)

Run **every Friday afternoon** (or whatever's habitual). If you skip it 2 weeks in a row, you've lost trust in the suite — fix it before the next feature.

### 3.1 The weekly checklist (copy this into a recurring calendar reminder)

```
□ git status clean (commit/stash WIP)
□ npm run tier0                          # ~2 min
□ npm run tier2:reset                    # ~30s
□ npm run tier1                          # ~5–8 min
□ npm run tier2:smoke:ios                # ~10–15 min
□ Manual session (Section 3.2)           # ~15 min
□ Log results in docs/test-log.md        # ~2 min
```

### 3.2 The 15-minute manual session (irreplaceable)

Automation finds breakage; **only humans find confusion.** Use this script, identical every week:

> Time yourself. If any task takes >2× expected, that's a UX flag — note it.

| # | Task | Expected time | What you're looking for |
|---|---|---|---|
| 1 | Sign up new user with random email | 30s | Confusing copy, slow loading, error states |
| 2 | Complete onboarding | 60s | Stuck steps, unclear next action |
| 3 | List one item with 3 photos | 90s | Photo upload UX, AI suggestions, category modal |
| 4 | Browse feed, open 3 listings, favorite 1 | 60s | Feed performance, image loads |
| 5 | Open a listing, attempt to buy (cash) | 90s | Checkout clarity, fees visible? |
| 6 | Open SP wallet | 30s | Balance correct? Pending vs available clear? |
| 7 | Send a message to another test user | 60s | Realtime delivery, who reads first |
| 8 | Subscribe to Kids Club+ (test card) | 60s | Stripe sheet, post-purchase tier reflection |
| 9 | Trigger one notification path | 60s | Push appears? Tap deep-links correctly? |
| 10 | Logout, kill app, relaunch | 30s | Clean unauth state |

After running, write **one line per task** in `docs/test-log.md`:

```markdown
## 2026-05-03 weekly

- T1 signup: 35s ✅
- T2 onboarding: 80s ⚠️ "Skip" copy unclear, considered going back
- T3 list item: 110s ✅
...
```

This log is gold during the UX refresh — you'll have a 6-week history of friction points.

### 3.3 What to do when something fails

| Failure | Action |
|---|---|
| Tier 0 fails | Fix immediately, don't proceed |
| Tier 1 fails | Open Supabase logs, fix RLS/RPC. Add a regression unit test before moving on. |
| Maestro flow fails 1× | Re-run once. If passes, log as "flaky". |
| Maestro flow fails 2× | **Quarantine** (move out of `_critical/`), open issue, fix or delete within 1 week. |
| Manual task surprises you | Note in test-log; if it's a bug, file it; if UX, save for redesign brief. |

---

## 4. Phase 3 — Per-release gate (~45 min)

Before any TestFlight / Play Store / friends-and-family build:

```bash
git checkout release-branch
npm run release-check
```

**Plus** the manual 15-min session on a **physical Android device** (not just simulator) and on **iOS simulator** at minimum. iPhone physical when you have it.

### 4.1 Release sign-off doc (paste this template into PR description)

```markdown
## Release X.Y.Z — Test Sign-off

- Commit: <sha>
- Tier 0: ✅ (2m 14s)
- Tier 1: ✅ (6m 48s)
- Maestro iOS critical: ✅ 10/10
- Maestro Android critical: ✅ 9/10  (10-messaging-send-receive flaky → quarantined)
- Manual session: ✅ (notes in test-log)
- Known issues: <list>
- Approved for release: yes/no
```

If anything is red → don't release. Period.

---

## 5. Phase 4 — UX refresh contingency

When the redesign starts, **expect Maestro flows to break**. Plan for it:

### 5.1 Before redesign starts

- [ ] Snapshot current `_critical/` flow names + FLOW-IDs into `docs/maestro-coverage.md`
- [ ] Tag testID convention as "frozen" — redesign must keep them
- [ ] Tier 1 (integration tests) is your safety net during redesign — **do not break those**

### 5.2 Rule for redesigned screens

Redesigned screens MUST:

1. Keep the same testIDs (UI changes, identifier doesn't).
2. If a testID truly must change, update the matching `_critical/` yaml in the **same PR**.
3. Run `tier0 + tier1` before merging the redesign PR.

### 5.3 After redesign per screen

- Run the 1 Maestro flow that touches that screen.
- If it fails: fix the flow (testID drift) in the same PR.
- Don't accumulate broken flows — every red flow you ignore reduces trust.

### 5.4 Post-full-redesign

- Expand `_critical/` from 10 → 20 flows (cover full FLOW-IDs 1–20)
- Add visual regression (Maestro screenshots) at that point — not before.

---

## 6. FLOW coverage matrix (current state)

Quick reference — what each tier covers per FLOW-ID. Fill this in after Phase 1.

| FLOW-ID | Name | L1 unit | L2 integration | L3 Maestro `_critical` | Manual weekly |
|---|---|---|---|---|---|
| 00 | Infra | – | ✅ | – | task 10 |
| 01 | Auth | ✅ | ✅ | ✅ 01,02 | task 1 |
| 02 | Profiles/Onboarding | ✅ | ✅ | ✅ 03 | task 2 |
| 03 | Node/ZIP | ✅ | ✅ | – | (covered by signup) |
| 04 | Listings | ✅ | ✅ | ✅ 04,05 | task 3 |
| 05 | Media | ✅ | ✅ | (in 04) | (in task 3) |
| 06 | Discovery | ✅ | ✅ | ✅ 06 | task 4 |
| 07 | Cart/Bundle | ⚠️ check | ⚠️ | – | – |
| 08 | Trade/Checkout | ✅ | ✅ | ✅ 07 | task 5 |
| 09 | Fees | ✅ | ✅ | – | – |
| 10 | SP wallet | ✅ | ✅ | ✅ 08 | task 6 |
| 11 | SP rules | ✅ | ✅ | – | – |
| 12 | Subscriptions | ✅ | ✅ | ✅ 09 | task 8 |
| 13 | Referrals | ⚠️ | ⚠️ | – | – |
| 14 | Messaging | ✅ | ✅ | ✅ 10 | task 7 |
| 15 | Safety/Mod | ✅ | ✅ | – | – |
| 16 | CPSC | ✅ | ✅ | – | – |
| 17 | Notifications | ✅ | ✅ | – | task 9 |
| 18 | Admin controls | ✅ | ✅ | – | (admin portal) |
| 19 | Analytics | ⚠️ | – | – | – |
| 20 | Audit | ✅ | – | – | – |

⚠️ = audit needed during Phase 1 — confirm coverage actually exists.

---

## 7. Troubleshooting Maestro (when it gets "stuck")

| Symptom | Most likely cause | Fix |
|---|---|---|
| "Element not found" then hangs | Text matcher, copy changed | Switch to `id:` |
| Test passes locally, fails on device | Timing — animations, network | Add `extendedWaitUntil` w/ 15s |
| App in wrong state at start | Previous test left state | Add `clearState` at top |
| Tap registered but nothing happens | Element under modal/overlay | Assert overlay is gone first |
| Can't find element you SEE on screen | Missing `testID` | Add testID to component |
| Maestro itself crashes | Version mismatch | Reinstall pinned version |
| Android "device offline" mid-run | USB sleep / cable | Use a short data cable, disable USB power saving |
| Flow runs differently between iOS/Android | Platform-specific UI (e.g. iOS dialogs) | Branch the yaml: `_critical/ios/`, `_critical/android/` |

### 7.1 Debug a single failing flow

```bash
maestro test .maestro/_critical/04-listing-create-single.yaml \
  --platform ios \
  --format html \
  --output /tmp/maestro-debug
open /tmp/maestro-debug/index.html
```

The HTML report includes a video + screenshot of every step. **Watch the video before changing anything** — usually the answer is obvious in 30 seconds.

### 7.2 Studio mode for authoring

```bash
maestro studio
```

Records taps as you do them, generates yaml. Use this for new flows — but **always** post-edit to replace text matchers with `id:` matchers.

---

## 8. What this plan deliberately does NOT include (and why)

| Excluded | Why | Revisit when |
|---|---|---|
| Detox | Solo dev can't maintain 2 E2E tools | Never (unless Maestro fails entirely) |
| Storybook + Chromatic | Visual regression is overkill pre-launch | Post-launch, post-UX-refresh |
| UserTesting / Maze / Useberry | $$$, you have no team to onboard panel | Once friends/family round needs structuring |
| Maestro Cloud | Local sim is enough for solo | When team grows past 2 |
| EAS Update dogfood channel | Useful but not a *test* mechanism | When friends/family round starts (push test builds in 60s) |
| Full 21-FLOW Maestro coverage | UX refresh will break it | After UX refresh ships |
| Per-PR CI on Maestro | Slow + flaky on CI runners; weekly local is enough | When you have a teammate or paying users |

---

## 9. Quick reference card (print this)

```
DAILY:           save → tier0 (auto via editor)
WEEKLY (Fri):    git stash → reset:staging → tier0 → tier1 → tier2:smoke:ios → manual 15min → log
PER RELEASE:     release-check → manual on iOS sim + Android device → sign-off
WHEN MAESTRO FAILS:  watch HTML video first. id-matcher? wait-until? clearState?
WHEN DOUBT:      tier1 (integration) is your truth. UI lies, DB doesn't.
```

---

## 10. Open questions / decisions to record here

Fill these as you go so future-you knows the "why":

- Pinned Maestro version: `_____`
- Test seller user (staging): `_____@_____`
- Test buyer user (staging): `_____@_____`
- Stripe test card preferred: `4242...`
- Reset staging command tested working on (date): `_____`
- First `release-check` baseline run (date, result): `_____`

---

**Last updated:** 2026-04-29  
**Next review:** after first full `release-check` run, or after UX refresh PR #1 lands.
