# FLOW-25: Legal & Settings — Manual Test Cases

**Module:** MODULE-15.1 UI Redesign  
**Feature:** Legal & Settings screens (Whisk design system)  
**Platforms:** iOS Simulator + Android Emulator  
**Prerequisite:** Signed-in user; published `privacy_policy`, `tos`, and `liability_disclaimer` rows in `platform_policies` table.

---

## TC-25-01: SettingsScreen — Grouped section headers rendered

**Given:** User is on the Profile tab  
**When:** User taps the Settings button  
**Then:**
- Screen title "Settings" is visible
- Four section headers appear: **NOTIFICATIONS**, **ACCOUNT**, **LEGAL**, **DANGER ZONE** (12px, gray, uppercase, on `#F7F7F7` background)
- Each section group is on a white `#FFFFFF` card with 1px `#F0F0F0` dividers

**iOS:** Pass / Fail  
**Android:** Pass / Fail

---

## TC-25-02: SettingsScreen — Phosphor Icons (no Ionicons)

**When:** Settings screen is visible  
**Then:**
- All row icons are Phosphor icons (no legacy `Ionicons` icon style visible)
- Green `#5DBB8E` tint on non-destructive rows
- Red `#E85D75` tint on Sign Out and Delete Account rows
- CaretRight `#999999` visible on every row

**iOS:** Pass / Fail  
**Android:** Pass / Fail

---

## TC-25-03: SettingsScreen — Sign Out row appears in Danger Zone

**When:** User scrolls to Danger Zone section  
**Then:**
- "Sign Out" row shows red label and `SignOut` Phosphor icon
- Pressing Sign Out shows confirmation dialog: **"Are you sure you want to sign out?"**
- Canceling dialog returns to Settings
- Confirming signs user out and redirects to Landing/Login

**iOS:** Pass / Fail  
**Android:** Pass / Fail

---

## TC-25-04: SettingsScreen — Delete Account row navigates to DeleteAccountScreen

**When:** User taps "Delete Account" row in Danger Zone section  
**Then:**
- `DeleteAccountScreen` opens
- testID `delete-account-screen` is present

**iOS:** Pass / Fail  
**Android:** Pass / Fail

---

## TC-25-05: PrivacyPolicyScreen — Loading state

**Given:** Network is slow or policy fetch pending  
**When:** PrivacyPolicyScreen loads  
**Then:**
- Loading spinner appears with text "Loading Privacy Policy..."
- No content is visible yet

**iOS:** Pass / Fail  
**Android:** Pass / Fail

---

## TC-25-06: PrivacyPolicyScreen — Content renders with updated typography

**When:** Policy loads successfully  
**Then:**
- Header: "Privacy Policy" in 20px, `#1A1A1A`, semibold
- "Last updated: [date]" in 13px, `#999999` (no version badge)
- Section headings in Markdown render at 17px semibold `#1A1A1A`
- Body text renders at 15px `#6B6B6B` with 24pt line height
- `CaretLeft` back button (Phosphor) replaces old `Ionicons arrow-back`

**iOS:** Pass / Fail  
**Android:** Pass / Fail

---

## TC-25-07: TermsOfServiceScreen — Content renders with updated typography

**When:** TOS loads successfully  
**Then:**
- Header: "Terms of Service" in 20px, semibold, `#1A1A1A`
- "Last updated: [date]" in 13px, `#999999`
- Body text 15px `#6B6B6B`, lineHeight 24
- `CaretLeft` back button (Phosphor)
- **No** old version badge visible

**iOS:** Pass / Fail  
**Android:** Pass / Fail

---

## TC-25-08: TermsOfServiceScreen — Accept/Decline footer (requireAcceptance=true)

**Given:** Screen opened with `requireAcceptance=true`  
**When:** Content loads  
**Then:**
- Green "I Accept" pill button (`#5DBB8E`, height 52, borderRadius 26)
- Gray "Decline" text link below
- Tapping "Decline" calls `navigation.goBack()`
- Tapping "I Accept" shows success and dismisses screen

**iOS:** Pass / Fail  
**Android:** Pass / Fail

---

## TC-25-09: LiabilityDisclaimerScreen — WarningCircle icon visible

**When:** Disclaimer loads  
**Then:**
- `WarningCircle` Phosphor icon 48px `#F59E0B` (fill) centered above title
- Title centered, 22px semibold `#1A1A1A`
- "Last updated: [date]" 13px `#999999` centered below title
- Body text 15px `#6B6B6B`, lineHeight 24
- **No blue notice box** at the bottom (removed in FLOW-25)
- **No accept/decline buttons** — scroll + back only

**iOS:** Pass / Fail  
**Android:** Pass / Fail

---

## TC-25-10: DeleteAccountScreen — Hero icon and heading

**When:** DeleteAccountScreen opens  
**Then:**
- `Trash` Phosphor icon 64px `#E85D75` centered
- Heading "Delete Account?" 24px semibold `#1A1A1A` centered
- Warning text 15px `#6B6B6B` centered lineHeight 22

**iOS:** Pass / Fail  
**Android:** Pass / Fail

---

## TC-25-11: DeleteAccountScreen — Consequences list

**When:** Screen renders  
**Then:**
- At least 5 consequence items visible
- Each item has a red `X` icon (14px `#E85D75`) + gray consequence text
- List is fully scrollable

**iOS:** Pass / Fail  
**Android:** Pass / Fail

---

## TC-25-12: DeleteAccountScreen — Password input

**When:** User views the input field  
**Then:**
- Input has filled background `#F0F0F0`, borderRadius 12, height 52
- `Lock` Phosphor icon (20px, `#6B6B6B`) on the left
- Placeholder text visible
- Input is `secureTextEntry` (dots not letters)

**iOS:** Pass / Fail  
**Android:** Pass / Fail

---

## TC-25-13: DeleteAccountScreen — Validation: empty password

**When:** User taps "Delete My Account" without entering password  
**Then:**
- Alert shown: "Password required — Please enter your password to confirm deletion."
- No RPC call made

**iOS:** Pass / Fail  
**Android:** Pass / Fail

---

## TC-25-14: DeleteAccountScreen — Cancel link

**When:** User taps "Cancel"  
**Then:**
- `navigation.goBack()` called
- Returns to Settings screen

**iOS:** Pass / Fail  
**Android:** Pass / Fail

---

## TC-25-15: DeleteAccountScreen — Delete button styling

**When:** Screen renders  
**Then:**
- "Delete My Account" button: `#E85D75` background, `borderRadius: 26`, height 52, full width
- Button label white 16px semibold
- While loading: shows `ActivityIndicator` and button is disabled

**iOS:** Pass / Fail  
**Android:** Pass / Fail

---

## Overall Regression Checks

| Check | Expected | iOS | Android |
|-------|----------|-----|---------|
| No Ionicons imports compile warnings | None | | |
| All Phosphor icons render without white box | ✓ | | |
| `npm run typecheck` exits 0 | ✓ | | |
| `npm run lint` exits 0 | ✓ | | |
| Unit tests pass (`npm run test:unit -- --testPathPattern=flow25`) | ✓ | | |

---

*Generated by Kids P2P App Builder agent — FLOW-25 implementation*
