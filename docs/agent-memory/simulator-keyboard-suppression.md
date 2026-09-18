# iOS Simulator software-keyboard suppression (verified 2026-08-11)

## Problem
During Maestro runs the on-screen keyboard covers form fields, blocks ScrollView
scrolling, and makes coordinate taps land on keyboard keys (corrupting fields) —
the dominant source of signup/test friction.

## What WORKS (the only reliable on/off switch)
- **Cmd+K** in the Simulator, or menu **I/O > Keyboard > Toggle Software Keyboard**.
- Send programmatically:
  ```
  osascript -e 'tell application "Simulator" to activate' \
            -e 'delay 1' \
            -e 'tell application "System Events" to keystroke "k" using command down'
  ```
  (needs macOS Accessibility permission for the calling process).
- Once toggled OFF, the keyboard stays hidden across field focus AND app relaunch
  (same simulator session); Maestro `inputText` still types correctly.
- It is a TOGGLE (non-idempotent) and its state is IN-MEMORY: resets to "shown"
  on device/Simulator restart. So apply it exactly once right after a fresh boot
  (fresh boot = keyboard shown → one toggle deterministically hides it).

## What does NOT work on Xcode 26 / iOS 26.1 (do not rely on these)
- `defaults write com.apple.iphonesimulator ConnectHardwareKeyboard -bool true`
  (global host pref) — keyboard still appears, even after full Simulator.app restart.
- Device pref `AutomaticMinimizationEnabled` in
  `<device>/data/Library/Preferences/com.apple.keyboard.preferences.plist` — no effect.
- `simctl` has no keyboard subcommand (`simctl ui` only has appearance/contrast/content_size).

## Codified
`test-automation/trade-flow-v2/scripts/preflight-setup.sh` step 2b: on a FRESH
simulator boot sends Cmd+K to hide the keyboard. Controlled by
`TFV2_HIDE_KEYBOARD` (default 1; set 0 to keep keyboard visible). Only applies on
fresh boot to stay deterministic.

## Observed deviation (2026-08-23, Group F/G run)
During the Group F/G run (iPhone 17 Pro Max sim), Cmd+K (via osascript to Simulator)
DID hide the keyboard at that instant, BUT it re-showed on every subsequent field
focus (name field, then ZIP field, then email/password on login). The documented
"stays hidden across field focus AND app relaunch (same simulator session)" did NOT
hold — each new text field focus re-presented the software keyboard. Practical
pattern that worked: re-apply Cmd+K immediately before each submit/tap that needs an
unoccluded button, and always re-list the tree (or OCR) to confirm the keyboard is
actually gone before tapping below-fold buttons. Treat the "persistent off" claim as
unreliable per-session and verify each time.

## Existing .maestro flows
They call `hideKeyboard` 50+ times (flaky on this app's custom TextInputs) and
comment "hideKeyboard fails on iOS simulators with custom TextInput components".
With the keyboard globally hidden, those calls become harmless no-ops and the
"Class 1 Element Not Tappable" workarounds become unnecessary — suppression is a
net win, no flow depends on the keyboard being visible.

## CORRECTION (2026-09-10, FIX-Task-12) — `hideKeyboard` is a HARD FAILURE, not a no-op
Empirically disproved the "harmless no-op" claim above. On iPhone 16 Pro E2E
(iOS 26.5, dev-client build, keyboard already hidden by preflight Cmd+K),
`- hideKeyboard` immediately after typing into LoginScreen's custom TextInput
**aborts the whole flow**:
`Couldn't hide the keyboard. This can happen if the app uses a custom input or
doesn't expose a standard dismiss action.` (Maestro 2.6.1)
It only appeared to be a no-op before because the TradeFlowV2 flow never got
past the Expo dev launcher, so the login step was never reached.

**Working replacement pattern (apply to every TFV2 flow/helper):**
```yaml
- runFlow:
    when:
      visible:
        id: "keyboard-done-button"
    commands:
      - tapOn:
          id: "keyboard-done-button"
      - waitForAnimationToEnd
```
`keyboard-done-button` is the app's own QA dismiss control
(`src/components/shared/KeyboardDoneAccessory.tsx`, InputAccessoryView "Done",
AX-exposed per BP-53). Conditional ⇒ it can never abort the flow; when the
software keyboard (and therefore the accessory bar) is suppressed it is a no-op.
Fixed in: `helpers/tfv2-login-seller.yaml`, `helpers/tfv2-login-buyer.yaml`,
`helpers/tfv2-dismiss-system-dialogs.yaml`,
`module-15.1.2-full-trade-flow-v2.yaml`. The remaining ~45 `hideKeyboard` calls
in other `.maestro` flows carry the same latent hard-failure — flag for a sweep.
