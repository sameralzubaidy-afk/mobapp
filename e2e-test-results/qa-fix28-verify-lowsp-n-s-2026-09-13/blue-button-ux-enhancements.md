# Blue (`#007AFF`) primary/card affordance — UX enhancement adds, per screen

**Companion to:** `report.md` finding **F11** (MED) in this folder.
**Scope:** the blue `#007AFF` / `#0066FF` **filled card/button + accent** family **only**. Nothing else from the round is in here.
**Framing:** these are written as **UX enhancements** (improvements to make the product better) rather than as defects — but note the palette half of each one is a **BP-82 violation** (`mobile-client.instructions.md` rule 31 lists `#0066CC`/`#007AFF`/`#93C5FD` as forbidden "iOS system blue" leakage), so the token swaps are *fixes*, and the interaction/model suggestions are the genuine enhancement part.

**Why this file exists:** the round's first pass missed this class entirely (report F12) because the AX tree never reports colour and the playbook's standing off-brand sweep (§5.63 R62b) only greps `#4A7C59|#4D4D4D|#808080` — it **cannot** see `#007AFF`. Re-run the sweep with the **full BP-82 list** (§ D below).

---

## A. Screens with a FILLED blue primary (the "blue card/button" class)

### A1 · Edit Listing — "+ Add Photo"  · **ON-DEVICE PROVEN**  · highest priority

| | |
|---|---|
| **Surface** | `EditListingScreen` → `src/components/molecules/ImagePickerGrid.tsx:403-412` (`addPhotoButton`) |
| **Current** | Full-width (`975×127 px`) filled **`#007AFF`** button, white label, iOS-style 8 px radius. Pixel scan: **97.48 % blue / 0.00 % green**. |
| **Problem it creates** | It renders directly above the green `#5DBB8E` "Save Changes" (**94.10 % green / 0.00 % blue**) ⇒ **two competing primaries in two different palettes on one long form**. The eye reads the *photo* affordance as the page's main action and the real submit as a secondary. |
| **UX enhancement — ADD** | 1. **Demote it to a secondary-outline dropzone**, not a filled primary: white/neutral surface, `1.5 px` dashed border in the brand primary at ~40 % opacity, 12 px radius, **primary-green `+` glyph and label** (`#5DBB8E`), body-weight text. 2. **Centre it in the form's flow** with the same 20–24 px horizontal page gutter as every other field. 3. Keep the helper line ("Add up to 5 photos. The first photo is the cover image.") directly beneath, 8 px gap, `#6B6B6B`. 4. Give the empty state a **photo-frame illustration** so the control reads as "drop photos here", not "submit". 5. Result: the form has **exactly one** filled primary — the green **Save Changes**. |
| **Tokens** | `#5DBB8E` (primary/pressed `#4DAA7A`) for the glyph/label/border tint; neutrals `#1A1A1A` / `#6B6B6B`; radius 12; radius/spacing on the 4 px base scale. |
| **Verify** | `npm run qa:badge-scan -- --img <shot> --region 53,1034,975,127 --token blue007AFF,rmin=0,rmax=70,gmin=90,gmax=165,bmin=215,bmax=255 --token green5DBB8E,rmin=60,rmax=130,gmin=160,gmax=215,bmin=110,bmax=175` → expect **blue 0 px / green > 0**; and the same scan over Save Changes still green. |

### A2 · Edit Listing — photo-source modal ("Add Photo" → Camera / Library)

| | |
|---|---|
| **Surface** | same component, `ImagePickerGrid.tsx:355` (`modalOption` fill) + `:257` (`ActivityIndicator color="#007AFF"`) |
| **Current** | Both the Camera and Library rows are **filled blue**; the upload spinner is blue. |
| **UX enhancement — ADD** | Make the two choices **secondary-outline rows with a leading branded icon**, and let **only the recommended one** (Library) carry a primary tint. Change the spinner to `#5DBB8E`. Add a one-line consequence hint per option ("Camera — takes a new photo", "Library — choose existing") so the choice is self-explanatory. |
| **Tokens** | `#5DBB8E` primary for the single emphasised row; outline/secondary for the other; `#1A1A1A` / `#6B6B6B` text tiers. |
| **Verify** | Open the modal, screenshot, colour-scan the two row regions — expect ≤1 primary-filled, and **no `#007AFF` anywhere**. |

### A3 · Admin / QA Dashboard — "Run Mid-Trade Subscription Check"  · source-confirmed rendered (`AdminDashboardScreen.tsx:95`)

| | |
|---|---|
| **Surface** | `src/screens/admin/AdminDashboardScreen.tsx:198-206` (`styles.button`, with `buttonDisabled: backgroundColor '#A0CFFF'`) |
| **Current** | Classic legacy filled blue button + light-blue disabled state; the screen also uses a `#007AFF` icon at `:75`. |
| **UX enhancement — ADD** | Swap the fill to the brand primary (`#5DBB8E`; disabled = primary at ~50 % opacity, or `#ABDAC4`, which is the documented disabled-primary treatment); swap the `:75` icon to `#5B8FB9` (the **documented info** colour) since it's conveying information, not action. As an enhancement, add a short "what this does" caption under the button so a non-engineer can tell it's a maintenance action. |
| **Tokens** | `#5DBB8E` / disabled `#ABDAC4`; info `#5B8FB9`. |
| **Verify** | Screenshot; colour-scan the button region — expect green, 0 blue; grep the file for `#007AFF` → 0 hits. |

---

## B. The single highest-leverage add (do this first)

**Add one token-driven variant instead of fixing screens one at a time.**

- `ImagePickerGrid.tsx` is imported by **exactly one live screen** (`EditListingScreen.tsx:37`) — so **A1 + A2 are ONE component fix**, and it entirely removes the only *user-facing* filled-blue primary proven in the app.
- Enhancement: give the component a `variant="primary" | "secondary"` prop defaulting to **secondary**, and source its colours from the theme (`src/theme/colors.ts`) rather than literal hex. Then no future caller can re-introduce blue.
- Same shape for `AdminDashboardScreen` (A3) — replace the hand-rolled `styles.button` with the shared `ui/Button` atom so it inherits the brand primary, disabled state, and pressed state for free.
- **Acceptance for B:** `ImagePickerGrid.tsx` and `AdminDashboardScreen.tsx` contain **zero literal hex**; both render through shared tokens.

---

## C. Blue ACCENTS in the same family (not a filled card — still BP-82 violations)

These are **not** "blue cards", but they're the same forbidden token, and they're cheap to include while the sweep is open. Frame them as polish, not rework.

| Screen / surface | Location | Current | Enhancement — ADD |
|---|---|---|---|
| Item Detail | `screens/home/ItemDetailScreen.tsx:1872` | `color: '#007AFF'` (text/icon accent) | Recolour to the semantic that matches its meaning: **`#5B8FB9`** if informational, **`#5DBB8E`** if it's an action/link. |
| Listing create/edit — price step | `components/listing/PriceSuggestionCard.tsx:224/263/272` (link text), `:229/254` (borders), `:130` (spinner) | blue link text + blue card borders + blue spinner | Make it a **branded suggestion card**: `#5B8FB9` info border/background tint for the card, primary-green text button for "Use this price", green spinner. Bonus enhancement: state the saving explicitly ("Suggested: $24 — buyers at this price sell 2× faster") so the card earns its space. |
| Discover filters | `components/discovery/CategoryFilterChip.tsx:107` (border) + `:125` (label) | blue chip border + blue label | Use the documented selected-chip treatment (primary tint + primary text) — note **BP-56** already mandates `ds` tokens on Discover, so this is also a token-source bug. |
| Trade Initiation | `screens/trade/TradeInitiationScreen.tsx:980` | 20×20 round **blue "i" badge** (`infoIcon`) | Recolour to **info `#5B8FB9`**; keep the size/position. |
| Stripe card sheet | `hooks/usePaymentSheet.ts:122` (`primary: '#007AFF'`) | the iOS-system-blue `primary` handed to Stripe's PaymentSheet appearance | **Likely intentional** (Stripe's own surface). Recommend leaving it, or setting it to `#5DBB8E` for brand continuity — **product decision, not a QA fix.** |

---

## D. No action required (do NOT file these) — closes the scope

| Item | Why |
|---|---|
| `src/components/atoms/Button/index.tsx:14` (`#0066FF`) | **Dead** — no file imports `Button` from `@/components/atoms`/`../../atoms/Button` (only `ListingImage`, `AcceptsSpBadge`, `SortDropdown`, `Avatar` are imported from there). Recommend deleting the file as cleanup. |
| `src/screens/LoginScreen.tsx:320/346/355` | **Orphaned** — `AppNavigator.tsx:19` routes `@/screens/auth/LoginScreen`. Not reachable. |
| `src/screens/SignupScreen.tsx:480/506` | **Orphaned** — `AppNavigator.tsx:20` routes `@/screens/auth/SignupScreen`. Not reachable. |
| `src/screens/auth/LoginScreen.old.tsx`, `SignupScreen.old.tsx` | Explicitly dead (`.old`). |
| `screens/seller/SellerEarningsScreen.tsx` (`#808080`/`#4D4D4D`) | Known dead screen (BP-82 note: no active navigation). |
| `screens/listing/MyListingsScreen.tsx:975/1029` | **Already fixed** (FIX-Task-26 item 7, QA F10) — these are explanatory comments, not live hex. |
| `src/assets/onboarding/README.md:33` | Documentation example, not shipped UI. |

> ⚠️ **Keep the orphan/dead distinction in the write-up.** Three of the source hits are not reachable, which is exactly why this list needed file-by-file liveness checking rather than a raw grep count — a source-only sweep would have reported 8+ "broken screens" when the real user-facing count is **1 confirmed + 1 internal + accents**.

---

## E. Systemic adds (so this class can't hide again)

1. **Add the full forbidden-hex list to the QA standing sweep.** Replace §5.63 **R62b**'s bare `#4A7C59|#4D4D4D|#808080` with BP-82 rule 7's list:
   `#4CAF50|#E53935|#29B6F6|#0066CC|#007AFF|#93C5FD|#D97706|#111827|#6B7280|#D1D5DB|#4A7C59|#4D4D4D|#808080`
2. **Add a colour-scan step to the UX pass:** on every screen visited, any **full-width filled button/card** is a colour-scan target (`npm run qa:badge-scan`), because the AX tree cannot report colour. One scan per screen, ~1 call.
3. **Add a CI guard:** run the same grep in the mobile lint/test job so a literal hex cannot land in `src/` at all (this is the only mechanism that scales past reviewer attention).
4. **Add a shared "primary button" component with a single `variant` API** and forbid literal hex in component stylesheets; then the fix is structural rather than per-screen.

---

## F. Per-screen acceptance checklist

| # | Screen | Add | Done when |
|---|---|---|---|
| A1 | Edit Listing | "+ Add Photo" → secondary-outline dropzone, green glyph/label | `qa:badge-scan` on `{53,1034,975,127}` = **0 blue**, >0 green; Save Changes still the only filled primary |
| A2 | Edit Listing (photo modal) | One emphasised option; green spinner; consequence hints | 0 `#007AFF` in the file; screenshot shows ≤1 primary-filled row |
| A3 | Admin/QA Dashboard | Button → `ui/Button` brand primary; icon → `#5B8FB9` | 0 `#007AFF` in the file; disabled state uses the documented disabled-primary |
| B | `ImagePickerGrid` + `AdminDashboardScreen` | Token-driven variants; no literal hex | grep for `#` in both files' styles → 0 hits |
| C | Item Detail, PriceSuggestionCard, CategoryFilterChip, TradeInitiation | Recolour accents to `#5B8FB9` / `#5DBB8E` per meaning | full BP-82 grep → 0 live hits |
| D | dead/orphan files | delete or relocate | BP-82 grep → 0 hits total |
| E1 | QA playbook | R62b → full hex list | playbook updated |
| E2 | QA runs | colour-scan every filled button | recorded per screen in the next report |
