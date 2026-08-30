# Dev Task 65 — QA Toolkit Round 3 (Small) — Decision & Outcome Report (2026-08-30)

Run: `dev-task-65-qa-toolkit-r3-2026-08-30`

Two small, targeted friction points from QA Task 7's decision log. No toolkit overhaul (Rounds 1–2 were structural; this round is 2 fixes).

---

## Item 1 — Documented/Scripted Path for Admin-Config Writes in QA Fixtures

### What was built
A `qa:admin-config-set` helper script at `p2p-kids-marketplace/scripts/qa/admin-config-set.mjs`, wired as `npm run qa:admin-config-set` in `p2p-kids-marketplace/package.json`.

It uses the **same legitimate path the admin portal itself uses** — no lockdown bypass:

- Calls `public.upsert_admin_config_setting` — the exact shared BP-48 write RPC the admin portal's settings pages call (with an admin JWT) and the `/config` hub API route calls (with service_role).
- Authenticates with `SUPABASE_SERVICE_ROLE_KEY` from `.env`/`.env.staging` — the same credential the admin portal's server-side API routes use (`p2p-kids-admin/src/app/api/admin/config/route.ts`).
- The RPC's own guard (`current_setting('role')='service_role'` OR `admin_has_role(auth.uid())`) still applies and passes legitimately — nothing is re-granted or weakened.

**Verified live 2026-08-30 (grants confirmed via DB):**
- `upsert_admin_config_setting(text,text,admin_config_category,text,boolean,boolean,uuid)` → `SECURITY DEFINER`, granted to `{postgres, authenticated, service_role}` (DT-59).
- `secure_upsert_admin_config(text,text,uuid)` → granted to `{postgres, service_role}` **only** (DT-56a).
- `admin_config_category` enum: `subscription, swap_points, fees, sms, email, moderation, safety, analytics, feature_flags, payout_fees, referral, trade, tax, health`.

### CLI surface
```
npm run qa:admin-config-set -- get --key <k>                 # read one key
npm run qa:admin-config-set -- list [--category <cat>]       # list keys
npm run qa:admin-config-set -- set --key <k> --value <v> [--category <cat>]
        [--data-type <t>] [--is-active true|false] [--is-secret true|false]
        [--admin-id <uuid>] [--dry-run]
```
Defaults: `category=feature_flags`, `data-type=string`, `is-active=true`, `is-secret=false`, `admin-id=null` (null preserves the previous `updated_by` editor per DT-59's COALESCE). `set` auto-reads the row back and asserts the stored value matches.

### Verification evidence (constraint: actually used + DB read-back, not just written)
Ran the exact key QA Task 7 N01 could NOT write via MCP SQL (`cart_min_value_cents`):

1. `get --key cart_min_value_cents` → stored `"0"`, `category=feature_flags`, `data_type=number`, `is_active=true`, `updated_by=1a546991…` (samer@samer.com, from QA Task 7's admin-portal write).
2. `set --key cart_min_value_cents --value 7777 --category feature_flags --data-type number`
   - RPC returned the written row (`out_value="7777"`, `out_updated_at=2026-08-30T17:14:24Z`).
   - Auto read-back from `admin_config` matched (`value="7777"`) → **DB read-back confirms the change.**
3. Restore `set --key cart_min_value_cents --value 0 …` → read-back `"0"`, `updated_at` bumped to 17:14:32.
4. **Independent DB corroboration** (`mcp_supabase_execute_sql`): `SELECT … FROM admin_config WHERE key='cart_min_value_cents'` → `value='0'`, `updated_at=17:14:32`, `updated_by=1a546991…` (editor preserved). **Two-source corroborated (§6.1), zero residue.**
5. `list --category feature_flags` → 33 rows (read path works). `--dry-run` → prints the RPC call without executing (no write).

### Documentation
- Playbook §5.44 "Standing rules — Legitimate `admin_config` write paths for QA fixtures (DEV-TASK-65, 2026-08-30) — R37" (`.github/instructions/QA-Test-Agent.instructions.md`): the three legitimate paths (helper / settings-page UI / admin-portal API `PATCH :3001/api/admin/config` with `x-admin-secret`), the blocked paths (MCP SQL → `P0001`, `secure_upsert_admin_config` via anon), and the zero-residue restore discipline.
- Full usage + legitimate/blocked-path notes in the script header.
- Repo memory `dev-task-65-qa-toolkit-r3-2026-08-30.md` + `qa-test-agent.md` standing-rules log updated.

---

## Item 2 — Accepted-Verdict Convention for VoiceOver Swipe-Gesture Testing

### Investigation (option a — attempted for real before concluding)
Tried to drive a genuine VoiceOver interaction on a disposable fixture (iOS 26.1 sim, iPhone 17 Pro Max, app + Home/Trade Basket as the fixture). Evidence: `evidence/dt65-vo-*.png`.

| # | Attempt | Result |
|---|---|---|
| 1 | **Tool inventory** — activated every mobile-mcp category | Gesture vocabulary is **raw coordinate touches only** (single tap / double-tap / long-press / swipe / type). **No VoiceOver-specific tool exists**: no rotor control, no focus-next/previous, no "activate focused element", no utterance/feedback capture. |
| 2 | **Enable via plist** — `com.apple.Accessibility VoiceOverTouchEnabled=1` + SpringBoard kickstart + full `simctl shutdown/boot` | **VoiceOver NOT live**: a single mobile-mcp tap still LAUNCHED the Photos app (`dt65-vo-04-after-tap.png`); VoiceOver would intercept a single tap as a focus gesture, not activate. Key alone is insufficient on iOS 26.1. |
| 3 | **Gesture while key set** — one-finger mobile-mcp swipe on Home | Produced a **normal Home page-flip** (Calendar/Maps page 2, `dt65-vo-03-after-swipe.png`), NOT VoiceOver focus navigation → synthetic touches bypass the VoiceOver gesture interpreter. |
| 4 | **Enable via Settings UI** — Settings → Accessibility | The **VoiceOver row is not exposed in the mobile-mcp AX tree** (tree starts at "Hover Text" y435; the Vision-header/VoiceOver region is omitted); OCR/pixel-locating the row was unreliable (taps at the row's y did not navigate). The canonical enable path is not reliably drivable either. |
| 5 | **Observability gap (decisive)** | Even IF VoiceOver were enabled and a swipe/double-tap routed through it, **no available tool reads the VoiceOver cursor/focus position or its spoken utterances**. `mobile_list_elements_on_screen` reports the AX hierarchy (what VoiceOver CAN see) but not the VoiceOver cursor. Without observing the cursor/utterance, no assertion about a VoiceOver gesture's effect is possible → driving without observability cannot produce a testable verdict. |
| 6 | **Alternatives** | Maestro/WebDriverAgent (`maestro-driver-iosUITests-Runner` on the sim; XCUITest under the hood) expose no VoiceOver rotor/focus/utterance APIs; `xcrun simctl` has no VoiceOver control. None close the gap. |

### Decision
**Option (a) is infeasible with the current tooling** — the gap is two-fold: (i) no gesture routing/observation through VoiceOver, and (ii) no observability of the VoiceOver cursor/utterance. **Chose option (b):** formally document the accepted, named verdict class.

### Accepted verdict class (implemented)
- Playbook §5.45 "Standing rules — Accepted verdict class for VoiceOver swipe-gesture testing (DEV-TASK-65, 2026-08-30) — R38" (`.github/instructions/QA-Test-Agent.instructions.md`):
  - **Verdict class name (use verbatim):** `AX-tree-exposure-verified, VoiceOver-swipe-interaction-not-directly-testable`
  - **Verified leg (required each time):** elements ARE exposed in the iOS AX hierarchy via `mobile_list_elements_on_screen` (the AX tree is exactly what VoiceOver sees). This is the meaningful, assertable part of an AX fix.
  - **Not-directly-testable leg (accepted, no re-litigation):** the VoiceOver gesture interaction model (cursor swipes, double-tap activation, rotor, spoken feedback) cannot be driven or observed by any available tool. Bounded re-attempts are capped — do not burn calls re-driving VoiceOver gestures.
  - **Labelling:** use the class name as the verdict in §8.1 item 3 and in the §8.2 roll-up (counted under the accepted class, not PARTIAL/FAIL); state the untested leg explicitly in `Known Gaps / Not Tested`. Do NOT mark such cases FAIL/PARTIAL purely for the undrivable gesture leg, and do NOT imply the gesture leg was tested by marking PASS.
- §8.1 item 3 verdict list extended with the class name.
- Repo memory `dev-task-65-qa-toolkit-r3-2026-08-30.md` + `qa-test-agent.md` updated.

### Simulator state left behind (clean)
- Accessibility prefs restored from backup (`com.apple.Accessibility.plist.bak-1788110120` — removes the `VoiceOverTouchEnabled` key written during the investigation), confirmed via `defaults read` (key gone).
- Simulator rebooted; app relaunched and verified functional (logged-in Home "Good afternoon, Test", Norwalk Central, full AX tree present).
- No app data, seed data, or code/config touched outside this task's files.

---

## Files changed (this task only)
- `p2p-kids-marketplace/scripts/qa/admin-config-set.mjs` (new — helper)
- `p2p-kids-marketplace/package.json` (npm script `qa:admin-config-set`)
- `.github/instructions/QA-Test-Agent.instructions.md` (§5.44 R37 + §5.45 R38 + §8.1 verdict list)
- `e2e-test-results/dev-task-65-qa-toolkit-r3-2026-08-30/` (report + evidence)
- Repo memory: `dev-task-65-qa-toolkit-r3-2026-08-30.md`, `qa-test-agent.md`

## Known Gaps / Not Tested
- Item 2a: VoiceOver swipe-interaction behavior (cursor movement, double-tap activation, rotor) was NOT directly driven — no tool can observe it; the verdict class covers AX-tree exposure only (per the accepted convention).
- Item 1: the helper was verified with a `number`-typed key (`cart_min_value_cents`); `is-secret=true` and `admin-id` writes were not live-tested (signature verified against the RPC), and path C (admin-portal API `x-admin-secret`) was documented but not invoked live (requires the portal secret + running portal).
