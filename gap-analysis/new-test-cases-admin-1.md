# STAGING — New Test Cases (Admin Portal — Batch 5a)

> **STATUS: DRAFT — DO NOT MERGE into the canonical file without explicit per-batch approval.**
> **Target canonical file:** `cross-checked-and-consolidated/MODULE-ADMIN-PORTAL-MANUAL-TESTING.md`
> **Drafted:** 2026-08-13 · grounded against current source (`p2p-kids-admin/src/app/users/page.tsx`, `listings/page.tsx` + `components/ListingSearch.tsx`, `categories/page.tsx` + `components/*`, `referrals/page.tsx` + `configuration-tab.tsx`, `reviews/page.tsx` — read this session via exploration).
> **Entry format:** matches this file's convention — `### TC-XXX · Description`, then `**Ref:**`, `**Actors:**`, `**Objective:**`, `**Steps:**`, `**Expected Result:**`. A `**Surfaces: admin, mobile**` line is added to cases that verify behavior across both surfaces (this is the first introduction of the `Surfaces:` convention into this library).
> **Merge instructions:** append `B06–B08` to Group B, `C06–C12` to Group C, `D05–D11` to Group D, `N03–N04` to Group N, `Q04–Q06` to Group Q, in both index and body.

---

## Index addendum (rows to add to the `Test Case Index` table)

| Group | TC# | Description |
|---|---|---|
| **B — User Management** | TC-B06 | Reset Password action |
| | TC-B07 | Unsuspend action |
| | TC-B08 | Sort By / Sort Order |
| **C — Listings, Items & Flagged** | TC-C06 | Force Delete |
| | TC-C07 | Pause |
| | TC-C08 | Approve |
| | TC-C09 | Request Edits |
| | TC-C10 | Reject |
| | TC-C11 | Select-all / selection counter (no bulk execute — flag) |
| | TC-C12 | Individual filter controls |
| **D — Categories** | TC-D05 | Icon / badge upload |
| | TC-D06 | SP spending cap % |
| | TC-D07 | SP redemption cap |
| | TC-D08 | Drag-and-drop reorder |
| | TC-D09 | Bulk actions (Activate / Deactivate / Delete / Export CSV) |
| | TC-D10 | Delete category + guards |
| | TC-D11 | Suggestion Approve / Merge / Reject |
| **N — Referrals Admin** | TC-N03 | 5 SP fields + 3 toggles |
| | TC-N04 | "Missing configuration" warning |
| **Q — Review Moderation** | TC-Q04 | Status filter dropdown |
| | TC-Q05 | Sort-by dropdown |
| | TC-Q06 | Search input |

---

## Group B — User Management (additions)

### TC-B06 · Reset Password action

**Ref:** /users · POST `/api/admin/users/{id}/reset-password`
**Actors:** test-admin
**Surfaces:** admin, mobile

**Objective:** Verify the admin can send a password-reset email to a user.

**Steps:**
1. Open **/users**, open a user's **User Detail** modal, and click **Reset Password**.
2. Confirm the reset email.

**Expected Result:**
- A confirm appears: `Send password reset email to:\n{email}\n\nAre you sure?`
- On confirm, a success alert shows the API message or `Password reset email sent successfully`.
- The user receives a reset email whose link opens the mobile `Reset Password` flow (see AUTH TC-S11).

### TC-B07 · Unsuspend action

**Ref:** /users · POST `/api/admin/users/{id}/unsuspend`
**Actors:** test-admin
**Surfaces:** admin, mobile

**Objective:** Verify an admin can unsuspend a suspended account.

**Steps:**
1. On **/users**, open a **suspended** user's detail modal and click **Unsuspend User**.
2. Enter an unsuspension reason and confirm.

**Expected Result:**
- A prompt `Enter unsuspension reason:` then a confirm `Are you sure you want to unsuspend this user?…`.
- Success: `User unsuspended successfully`; the account status returns to active.
- The user can log into the mobile app again.

### TC-B08 · Sort By / Sort Order

**Ref:** /users · GET `/api/admin/users?...&sort_by&sort_order`
**Actors:** test-admin

**Objective:** Verify the sort controls reorder the user list.

**Steps:**
1. On **/users**, change **Sort By** (Registered Date / SP Balance / Trade Count / Name / Email) and **Sort Order** (Desc / Asc).

**Expected Result:**
- The list reorders according to the selected field and direction; the change is reflected in the API request (`sort_by`, `sort_order`).

---

## Group C — Listings, Items & Flagged (additions)

### TC-C06 · Force Delete

**Ref:** /listings · RPC `admin_force_delete_listing`
**Actors:** test-admin
**Surfaces:** admin, mobile

**Objective:** Verify force-deleting a listing.

**Steps:**
1. On **/listings**, open a listing's **Listing Details** modal and click **🗑 Force Delete**.
2. Enter a reason and click **Confirm Delete**.

**Expected Result:**
- The confirm form shows `Reason for deletion:`; on confirm the listing is removed.
- The listing disappears from discovery/search in the mobile app (no longer purchasable).

### TC-C07 · Pause

**Ref:** /listings · RPC `admin_pause_listing`
**Actors:** test-admin
**Surfaces:** admin, mobile

**Objective:** Verify pausing a listing.

**Steps:**
1. In a listing's details modal, click **⏸ Pause Listing**.
2. Enter a reason and click **Confirm Pause**.

**Expected Result:**
- The confirm form shows `Reason for pausing:`; the listing status changes to paused.
- The mobile app reflects the paused state (item not purchasable until unpaused).

### TC-C08 · Approve

**Ref:** /listings · RPC `admin_approve_listing`
**Actors:** test-admin
**Surfaces:** admin, mobile

**Objective:** Verify approving a pending listing.

**Steps:**
1. Open a **Pending** listing's details modal and click **✅ Approve Listing**.
2. Optionally add admin notes and click **Confirm Approval**.

**Expected Result:**
- The action is only available for `pending` status; confirm form shows `Admin Notes (optional):`.
- On confirm the listing becomes available and appears in the mobile app's discovery feed.

### TC-C09 · Request Edits

**Ref:** /listings · POST `/api/admin/items/{id}/status` `{status:'needs_edits'}`
**Actors:** test-admin
**Surfaces:** admin, mobile

**Objective:** Verify requesting edits on a pending/flagged listing.

**Steps:**
1. Open a `pending` or `flagged` listing and click **✍️ Request Edits**.
2. Enter a decision note and click **Confirm Request Edits**.

**Expected Result:**
- Confirm form shows `Decision Note (required for Request Edits):` (required).
- The listing moves to **Needs Edits**; the seller sees the edit request in the mobile app.

### TC-C10 · Reject

**Ref:** /listings · POST `/api/admin/items/{id}/status` `{status:'rejected'}`
**Actors:** test-admin
**Surfaces:** admin, mobile

**Objective:** Verify rejecting a listing.

**Steps:**
1. Open a `pending` or `flagged` listing and click **⛔ Reject Listing**.
2. Enter a decision note and click **Confirm Reject**.

**Expected Result:**
- Confirm form shows `Decision Note (required for Reject):` (required).
- The listing moves to **Rejected**; the mobile app reflects the rejected state.

### TC-C11 · Select-all / selection counter (no bulk execute — flag)

**Ref:** /listings · `ListingSearch`
**Actors:** test-admin

**Objective:** Document the selection UI and the absence of a bulk-action executor.

**Steps:**
1. On **/listings**, click the select-all checkbox and individual row checkboxes.
2. Observe the selection line and **Clear selection**.

**Expected Result:**
- A `Selected on this page: N` counter and a **Clear selection** link appear; select-all (aria-label `Select all listings on this page`) toggles all rows on the page.
- **Flag:** there is **no bulk-action dropdown/execute button** on the Listings page — bulk actions exist only on Categories. Selection currently has no downstream action.

### TC-C12 · Individual filter controls

**Ref:** /listings · RPC `admin_search_listings_v2`
**Actors:** test-admin

**Objective:** Verify the individual filter controls drive the search.

**Steps:**
1. On **/listings**, set **Search by Item Name**, **Seller Email**, **Status**, **Category**, and toggle **SP-Eligible Only**, then click **Search**.

**Expected Result:**
- Results update according to each filter (status options include All/Available/Pending/Needs Edits/Rejected/Flagged/Sold/Draft/Deleted).
- The request passes `p_query`, `p_status`, `p_sp_eligible`, `p_category`, `p_seller_email` (with the legacy fallback signature when category/email are absent).

---

## Group D — Categories (additions)

### TC-D05 · Icon / badge upload

**Ref:** /categories · POST `/api/admin/categories/upload-icon`
**Actors:** test-admin
**Surfaces:** admin, mobile

**Objective:** Verify the icon and bonus-badge upload fields.

**Steps:**
1. In the category form, open the **Icon & Badge** tab.
2. Set an icon (emoji/name), upload a custom icon (`.png/.svg`), and upload a bonus badge icon.

**Expected Result:**
- Fields render: `Icon (Emoji or Icon Name)`, `Custom Icon Upload` (accepts .png/.svg), `Bonus Badge Icon Upload`.
- On save the upload is posted via `upload-icon`; the icon/badge appears on the category (and, for icons, in the mobile app category UI).

### TC-D06 · SP spending cap %

**Ref:** /categories · CategoryForm SP Config
**Actors:** test-admin
**Surfaces:** admin, mobile

**Objective:** Verify the SP Spending Cap slider.

**Steps:**
1. In the category form **SP Config** tab, set **SP Spending Cap (%)** (range 50%–80%) and save.

**Expected Result:**
- The slider is bounded 50%–80%; the saved cap reflects in the `Live Preview (for $50 item)`.
- The cap is applied in the mobile checkout/offer flow for that category.

### TC-D07 · SP redemption cap

**Ref:** /categories · CategoryForm SP Config
**Actors:** test-admin
**Surfaces:** admin, mobile

**Objective:** Verify the SP Redemption Cap input.

**Steps:**
1. In **SP Config**, set **SP Redemption Cap (SP per item, optional)** and save.

**Expected Result:**
- The numeric value saves; the `Live Preview` reflects it; the mobile app caps SP usage per item at the configured value.

### TC-D08 · Drag-and-drop reorder

**Ref:** /categories · POST `/api/admin/categories/reorder` (or RPC `reorder_categories`)
**Actors:** test-admin

**Objective:** Verify drag-to-reorder persists category order.

**Steps:**
1. On **/categories**, drag a category row by its drag handle to a new position.

**Expected Result:**
- The row reorders; the new order is saved via the reorder endpoint and persists after reload.

### TC-D09 · Bulk actions (Activate / Deactivate / Delete / Export CSV)

**Ref:** /categories · `BulkActionsDropdown`
**Actors:** test-admin

**Objective:** Verify the bulk-action dropdown.

**Steps:**
1. Select multiple categories and open **Bulk Actions**.

**Expected Result:**
- Menu shows **Activate**, **Deactivate** (with `(hides items)` suffix), **Delete** (disabled → `(some have items)`), and **Export CSV**.
- Activate/Deactivate apply to all selected; Delete is blocked when any selected category has items.

### TC-D10 · Delete category + guards

**Ref:** /categories · DELETE `/api/admin/categories/{id}`
**Actors:** test-admin

**Objective:** Verify category deletion and its guards.

**Steps:**
1. Try deleting a category that still has items; then delete an empty category; then try deleting **Other**.

**Expected Result:**
- With items → `Cannot delete: {n} items still assigned to this category.`
- Empty → confirm `Delete category "{name}"? This action cannot be undone.` then deletes.
- **Other** → `Cannot delete the "Other" category — it is required by the system.`

### TC-D11 · Suggestion Approve / Merge / Reject

**Ref:** /categories · `/api/admin/category-suggestions/{id}/approve|merge|reject`
**Actors:** test-admin

**Objective:** Verify the suggestion moderation actions.

**Steps:**
1. On the **Suggestions** tab, try **Approve**, **Merge** (with an existing category), and **Reject** on suggestions.

**Expected Result:**
- Approve modal: `Approve & Create Category` creates the category.
- Merge modal: requires `Select Existing Category *` (default `-- Select a category --`) then `Merge Suggestion`.
- Reject modal: `Admin Note (optional)` then `Reject Suggestion`.
- Each updates the suggestion queue.

---

## Group N — Referrals Admin (additions)

### TC-N03 · 5 SP fields + 3 toggles

**Ref:** /referrals · `SPConfigService`
**Actors:** test-admin
**Surfaces:** admin, mobile

**Objective:** Verify the current referral SP configuration fields and toggles.

**Steps:**
1. Open **/referrals → Configuration** and enumerate the fields.

**Expected Result:**
- Five SP number fields: `Referrer SP Bonus (First Trade)`, `Referee SP Bonus (First Trade)`, `Referrer SP Bonus (First Listing)`, `Referee SP Bonus (First Listing)`, `Starter Pack Bonus (All Users)`.
- Three toggles: `🎯 First Trade Bonus Active`, `📝 First Approved Listing Bonus Active`, `🌐 Entire Referral Program Active`.
- Each saves via `PATCH /api/admin/sp-config` and shows `Successfully updated {key}`.
- Awarded amounts in the mobile app reflect these values.
- **Flag:** existing TC-N01 references fields not present on this page (trial-extension days / max referrals / expiry days) — pre-existing drift.

### TC-N04 · "Missing configuration" warning

**Ref:** /referrals · `REQUIRED_KEYS`
**Actors:** test-admin

**Objective:** Verify the missing-keys warning.

**Steps:**
1. Open **/referrals → Configuration** while one or more required `sp_config` keys are absent.

**Expected Result:**
- Amber banner reads `Missing configuration: {comma-separated keys}` plus `These referral settings are not present in the database. Add them below, or the referral program will fail loudly until they are configured.`
- The banner clears once the keys are configured.

---

## Group Q — Review Moderation (additions)

### TC-Q04 · Status filter dropdown

**Ref:** /reviews · `Status:`
**Actors:** test-admin

**Objective:** Verify the status filter.

**Steps:**
1. On **/reviews**, change the **Status:** filter.

**Expected Result:**
- Options: `All Statuses` / `Pending Review` / `Reviewed` / `Visible` / `Hidden`; the list filters accordingly.

### TC-Q05 · Sort-by dropdown

**Ref:** /reviews · `Sort by:`
**Actors:** test-admin

**Objective:** Verify the sort-by control.

**Steps:**
1. On **/reviews**, change **Sort by:**.

**Expected Result:**
- Options: `Most Reports` / `Newest Review` / `Oldest Review`; the list reorders accordingly.

### TC-Q06 · Search input

**Ref:** /reviews · `Search:`
**Actors:** test-admin

**Objective:** Verify the search input.

**Steps:**
1. On **/reviews**, type into **Search:** (placeholder `Search by review, reviewer, reviewee, reason, reporter...`).

**Expected Result:**
- Results filter to matching rows; a no-match state shows `No reviews match your filters`.
