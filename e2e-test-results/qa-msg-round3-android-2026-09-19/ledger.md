# Ledger — MSG Round 3 (Android) · 2026-09-19

Device: `Medium_Phone_API_36.1` (adb `emulator-5554`) · HEAD `69211387` · Metro `:8082` (cold reloaded, R79-1c) · admin `:3001`
Run: `e2e-test-results/qa-msg-round3-android-2026-09-19/` · screenshots 01–43

## Case verdicts (this round)

| # | TC | Verdict | Platform | Source of truth |
|---|---|---|---|---|
| 1 | MSG-TC-A04 | ⏸ BLOCKED (concurrent actor) | Android | no 2nd client / no message-injection helper |
| 2 | MSG-TC-A05 | ⏸ BLOCKED (concurrent actor) | Android | ditto |
| 3 | MSG-TC-A06 | ✅ PASS | Android | screenshots 11–14 + `messages` row `5963d7ad` (`message_type='image'`, real `chat-images` object) |
| 4 | MSG-TC-B04 | ✅ PASS | Android | screenshot 34 (`badge-celebration-modal`, "First Trade") |
| 5 | MSG-TC-C01 | ✅ PASS | Android | screenshots 15–19 + `reviews` `63ec7a89` (5★, comment verbatim) |
| 6 | MSG-TC-C02 | ✅ PASS | Android | screenshot 16 ("Rating Required …") |
| 7 | MSG-TC-C03 | ✅ PASS | Android | screenshots 20–22 + `reviews` `7df77b3d` (`is_anonymous=true`) + "Anonymous User" on the public profile |
| 8 | MSG-TC-C04 | ✅ PASS | Android | `Skip for Now` → no `reviews` row for the trade |
| 9 | MSG-TC-C05 | ✅ PASS (bonus) | Android | screenshot 22 (4.5 / (2 reviews) / distribution) |
| 10 | MSG-TC-C06 | ✅ PASS | Android | screenshots 35–38 + `review_reports` `f56f9321` (spam) + `report_count=1` |
| 11 | MSG-TC-E02 | ✅ PASS | Android(admin) | "Request approved successfully" + DB approved/`reviewed_by`/screenshot NULL/1 notif |
| 12 | MSG-TC-E03 | ✅ PASS | Android(admin) | "Please select a rejection reason" → "Request rejected successfully" + DB rejected |
| 13 | MSG-TC-E05 | ✅ PASS | Android(admin) | "✓ Saved successfully" + DB `message_text`/`updated_at` persisted + reverted |
| 14 | MSG-TC-E06 | ✅ PASS | Android(admin) | `admin_notifications` `id_badge_submission` → `entity_id` = request; queue auto-showed the row |
| 15 | MSG-TC-F03 | ✅ PASS | Android | screenshot 24 (native share sheet, code + link + dynamic bonus text) |
| 16 | MSG-TC-G01 | ✅ PASS | Android | screenshot 39 (status message + preview + rejection reason) |
| 17 | MSG-TC-G02 | 🟡 PARTIAL | Android | screenshot 41 ("Appeal Reason Too Short") + 43 (edit-first guard) |
| 18 | MSG-TC-H02 | ✅ PASS | Android(admin) | confirm dialog → DB `available` + `approved_at` + seller notifications |

## FIX-Task-66 verification (Part C)

| Item | Verdict | Source of truth |
|---|---|---|
| F2 badge clears on "Mark all read" | ✅ VERIFIED | screenshots 01–04 + DB unread 2→0 |
| F3 Save Quiet Hours clear of the FAB + tappable | ✅ VERIFIED | screenshots 26/27 ("Saved / Quiet hours have been updated.") |
| F6 chat input above the keyboard | ✅ VERIFIED | screenshot 09 |
| F7 header unread count vs ≤100-trade limit | ✅ VERIFIED (accurate today; latent limit named) | badge 3 = DB 3 (all trades) = top-100 subset; 275 trades |
| Items 12–13 bottom clearance (4 screens) | ✅ VERIFIED (1 caveat: tail *text* rows under the pill) | screenshots 25/26/28 |
| A08 chips on the `in_progress` trade | ✅ VERIFIED | screenshot 07 |
| A06 seeded media → image-send E2E | ✅ VERIFIED | screenshots 11–14 + DB |
| Invalid Date sanity check | ✅ VERIFIED | `count(*)` = 0 + the live notification body omits the date clause (screenshot 02) |

## Config writes / reverts

| Key | Write | Revert | Read-back |
|---|---|---|---|
| `moderation_appeal_max_attempts` | 3 → 1 (13:11:28Z) | 1 → 3 | ✅ both legs |
| `moderation_appeal_window_days` | 14 → 1 (13:11:35Z) | 1 → 14 | ✅ both legs |

## Fixtures built / consumed

| Fixture | Action | Cleanup |
|---|---|---|
| test-seller-2 ID request `6beb3023` | created (D02 camera capture → submit) → approved (E02) | consumed (real decision) |
| test-free ID request `6b94858b` | rejected (E03, `unclear_photo`) | consumed |
| test-seller-2 "Science Kit" `0fe228ee` | `--state rejected` (G01/G02) | ✅ reset to `available` |
| test-seller "QA Canned Cancelled-Trade Item" `0dca235c` | `--state flagged` (H02) → approved | ✅ now `available` |
| trade `b66ad08c…` chat | +1 image message (A06) | none (harmless) |
| trade `9c901926` / `25beb9dc` | +1 review each (C01/C03) | none (intended test data) |
| reviews `7df77b3d` | reported spam (C06) | left reported (a real moderation-queue row; see report §6) |

## Findings

| ID | Sev | Title | Evidence |
|---|---|---|---|
| N1 | MED | Referral share/copy link uses the unregistered `kidsclub://` scheme | screenshot 24 + `referralCodeV2.ts:151` + manifest/plist/\`app.json\` grep |
| N2 | LOW–MED | Quick-reply chip row overflows; `+ More` off-viewport; 3rd chip label clipped | screenshot 07 + `qa:ocr` chip band |
| N3 | LOW | "Review undefined" screen title during the eligibility check | deep-link entry, C01/C03 |
| N4 | DOC-DRIFT | G02 appeal expectations (empty-reason alert unreachable; undocumented edit-first gate) | screenshots 41/43 |
| — | — | Near-miss killed (no defect): 3 admin notifications/submission = per-admin fan-out (3 admins) | `count(*)` + distinct `admin_id` |
| — | — | Near-miss killed (no defect): tail *text* under the pill at max scroll ≠ a control-occlusion regression | max-scroll re-check |

## Not reached (explicit)

G03 · G04 · G06/G07 mobile legs · G09 on-device · F06 · F07 · F08 · H03 drive · H04 · H05 · H06 · A04/A05 (structural) · A06 upload-failure limb
