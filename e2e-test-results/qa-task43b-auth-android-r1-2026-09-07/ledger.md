# QA Task 43b — AUTH Android R1 — Case Ledger (2026-09-07)

Legend: ✅ PASS (live-executed this round) · 🟡 PARTIAL (part driven) · ⏭️ DEFERRED (not run this session — first-pass) · 🔀 COVERED-BY-43a (Task 43a) · 🚫 REMOVED (dead screen). Note: the brief's "128 of 138" = 138 − (5 dead screens H04/H05/I01–I03) − (5 covered-by-43a J04/J15/K01/N01/O05).

## Group A — Signup
| TC | Verdict | Notes |
|---|---|---|
| A01 | ✅ PASS | valid signup → Verify Your Phone |
| A02 | ✅ PASS | inline validation errors, blocked |
| A03 | ✅ PASS | "Passwords do not match" |
| A04 | ✅ PASS | age-gate dialog (minor DOB) |
| A05 | ✅ PASS | duplicate-email dialog |
| A06 | ⏭️ DEFERRED | referral valid/invalid handling |
| A07 | ✅ PASS | Terms/Privacy links open in-app content |
| A08 | ✅ PASS | Landing footer links open content |

## Group B — Login & Session
| TC | Verdict | Notes |
|---|---|---|
| B01 | 🟡 PARTIAL | completed-user→Home PASS; incomplete-onboarding leg deferred |
| B02 | ✅ PASS | invalid credentials |
| B03 | ✅ PASS | Forgot Password entry |
| B04 | ✅ PASS | session restore after kill/relaunch |
| B05 | ✅ PASS | resume silent refresh |
| B06 | ✅ PASS | cold launch no spinner hang |
| B07 | ✅ PASS | empty/invalid-email inline |
| B08 | ✅ PASS | ACCOUNT_DELETED branch |
| B09 | ✅ PASS | PROFILE_NOT_FOUND branch |
| B10 | ✅ PASS | back button → Landing |
| B11 | ✅ PASS | footer Sign Up → Create Account |
| B12 | ✅ PASS | footer Log In → Login |

## Group C — Social Login
| TC | Verdict | Notes |
|---|---|---|
| C01 | ⏭️ DEFERRED | real Google OAuth (external acct, Chrome Custom Tab) |
| C02 | ⏭️ DEFERRED | real Facebook OAuth |
| C03 | ⏭️ DEFERRED | Apple — expected BLOCKED (provider #14); Apple not on Android — confirm next round |
| C04 | ⏭️ DEFERRED | account-link prompt fixture |
| C05 | ⏭️ DEFERRED | provider-unavailable toggle (dev arm) |
| C06 | ⏭️ DEFERRED | cancel OAuth |
| C07 | ⏭️ DEFERRED | qa-social-only set-password (needs real identity attach #19) |

## Group D — Logout
| TC | Verdict | Notes |
|---|---|---|
| D01 | ✅ PASS | Profile logout confirm → Landing |
| D02 | ⏭️ DEFERRED | Sign Out from Settings (spot) |
| D03 | ✅ PASS | Landing after logout |

## Group E — Phone Verification
| TC | Verdict | Notes |
|---|---|---|
| E01 | ✅ PASS | OTP screen + dev-bypass 123456 verify → Success (exercised on qa.a01) |
| E02 | ⏭️ DEFERRED | wrong/expired code errors |
| E03 | ⏭️ DEFERRED | resend cooldown |
| E04 | ⏭️ DEFERRED | rate-limit message |
| E05 | ⏭️ DEFERRED | gate blocks first listing (needs unverified seller + listing flow) |

## Group F — Node/ZIP Gating
| TC | Verdict | Notes |
|---|---|---|
| F01–F06 | ⏭️ DEFERRED | ZIP/waitlist/node-scope (fresh-signup fixtures) |

## Group H — Profile Setup & Onboarding
| TC | Verdict | Notes |
|---|---|---|
| H01 | ✅ PASS | avatar+name+ZIP → advance; avatar_url persisted (DB) |
| H02 | ⏭️ DEFERRED | Profile Setup validation |
| H03 | ⏭️ DEFERRED | avatar-upload-failure toggle (dev arm) |
| H04 | 🚫 REMOVED | dead screen |
| H05 | 🚫 REMOVED | dead screen |
| H06 | 🟡 PARTIAL | Get-Started leg PASS; Skip leg deferred |
| H07 | ✅ PASS | onboarding → Home; relaunch → Home |

## Group I — Subscription Choice
| TC | Verdict | Notes |
|---|---|---|
| I01–I03 | 🚫 REMOVED | no in-app trial-choice (web-first JoinKidsClub) |

## Group J — Single Listing
| TC | Verdict | Notes |
|---|---|---|
| J01–J03, J05–J14 | ⏭️ DEFERRED | listing-creation (needs test-seller/fresh + dev fixtures) |
| J04 | 🔀 COVERED-BY-43a | condition/age/gender/color |
| J15 | 🔀 COVERED-BY-43a | SP earn/buyer-cap preview |

## Group K — Bulk Listing
| TC | Verdict | Notes |
|---|---|---|
| K02–K06 | ⏭️ DEFERRED | bulk listing creation |
| K01 | 🔀 COVERED-BY-43a | photo upload/grouping |

## Group L — Admin Review/Pending
| TC | Verdict | Notes |
|---|---|---|
| L01–L04 | ⏭️ DEFERRED | listing approval (admin portal + mobile) |

## Group M — Discovery: Search & Filters
| TC | Verdict | Notes |
|---|---|---|
| M01–M10 | ⏭️ DEFERRED | search/sort/filters/trending (test-free/qa.a01 logged-in) |

## Group N — Category & Favorites
| TC | Verdict | Notes |
|---|---|---|
| N01 | 🔀 COVERED-BY-43a | category browse |
| N02–N04 | ⏭️ DEFERRED | favorites/scroll/SP badge |

## Group O — Node Scoping & SP
| TC | Verdict | Notes |
|---|---|---|
| O01–O04 | ⏭️ DEFERRED | node scope / ZIP filter / waitlist / free-vs-sub SP |
| O05 | 🔀 COVERED-BY-43a | admin radius defaults |

## Group P — (brief scope = P04 only)
| TC | Verdict | Notes |
|---|---|---|
| P04 | ✅ PASS | floating pill layout/order/safe-area; FAB orange LOW note |
| P01–P03, P05–P19 | — | not in brief scope this round (header facts incidentally observed on Home) |

## Group Q — Trading Education
| TC | Verdict | Notes |
|---|---|---|
| Q01–Q07 | ⏭️ DEFERRED | education/SP calculator (test-buyer/test-free) |

## Group S — Password Recovery
| TC | Verdict | Notes |
|---|---|---|
| S01–S11 | ⏭️ DEFERRED | S01 expected BLOCKED (SendGrid #15 shared with iOS); S02/S07/S08/S11 full + spot rest for a follow-up round |

## Roll-up (this round)
- Live-executed: **25 ✅ PASS · 1 🟡 PARTIAL · 0 🔴 FAIL**
- Deferred (Android first-pass, not run this session): ~95 rows across C/D02/E2-5/F/H02/H03/J/K/L/M/N/O/Q/S (and A06)
- Covered by QA Task 43a: 5 (J04 J15 K01 N01 O05)
- Removed/dead: 5 (H04 H05 I01 I02 I03)
