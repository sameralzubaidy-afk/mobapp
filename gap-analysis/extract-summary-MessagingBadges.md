# Candidate Extraction Summary — Messaging/Badges Group

**Phase 2.2c** | **26 files processed**

## File Inventory

| # | File | Domain | Has UI Cases? |
|---|---|---|---|
| 1 | MSG-001-MANUAL-TESTING-GUIDE.md | Real-time chat DB/RLS | Mostly SQL |
| 2 | MSG-002-MANUAL-TEST-GUIDE.md | Conversations list | Yes |
| 3 | MSG-003-Manual-Test-Cases.md | Image sharing in chat | Yes |
| 4 | MSG-004-MANUAL-TESTING-GUIDE.md | Message expiration (30-day) | Mix |
| 5 | MSG-005-MANUAL-TESTING-GUIDE.md | Auto-delete expired messages | Mostly SQL/cron |
| 6 | MSG-005-COMPLETE-VERIFICATION-MANUAL.md | Expired message cleanup verification | SQL/cron |
| 7 | MSG-006-009-MANUAL-TESTING-GUIDE.md | Push + email notifications + delivery | Mix |
| 8 | MSG-006-009-MANUAL-TESTING-GUIDE-UPDATED.md | Same as above (updated) | Mix |
| 9 | MSG-006-009-COMPLETE-TESTING-GUIDE.md | MSG-006→009 combined | Mix |
| 10 | MSG-002-UNREAD-TEST-GUIDE.md | Unread badge fix verification | Fix check |
| 11 | MODULE-15.1-FLOW-14-MANUAL-TESTING.md | Messaging screen redesign | Yes |
| 12 | BADGE-008-MANUAL-TESTING-GUIDE.md | ID badge schema | SQL |
| 13 | BADGE-009-MANUAL-TESTING-GUIDE.md | ID badge upload flow | Yes |
| 14 | BADGE-010-MANUAL-TESTING-GUIDE.md | Admin ID badge queue | Yes |
| 15 | BADGE-011-MANUAL-TESTING-GUIDE.md | ID badge notifications | Mix |
| 16 | BADGE-012-MANUAL-TESTING-GUIDE.md | Admin configurable messages | Admin |
| 17 | BADGE-013-MANUAL-TESTING-GUIDE.md | ID badge status on profile | Yes |
| 18 | BADGES-V2-005-MANUAL-TESTING-GUIDE.md | Admin badge config | Admin |
| 19 | BADGES-V2-006-MANUAL-TESTING-GUIDE.md | Badge icon storage | Mix |
| 20 | BADGES-V2-007-MANUAL-TESTING-GUIDE.md | Admin badge management UI | Admin |
| 21 | BADGES-V2-008-009-MANUAL-TESTING.md | Retroactive awarding + sandbox | Mix |
| 22 | BADGES-V2-008-MANUAL-TESTING-GUIDE.md | Retroactive triggers | SQL |
| 23 | manual_test_badges_v2_001.md | Schema & types | SQL |
| 24 | manual_test_badges_v2_002.md | Auto badge triggers | SQL |
| 25 | manual_test_badges_v2_003.md | Trade milestone badges | SQL |
| 26 | manual_test_badges_v2_004.md | Badge display UI + leaderboard | Yes |

## Key Findings

1. **MSG-006-009 has 3 variants** — COMPLETE-TESTING-GUIDE is most comprehensive, others are subsets
2. **MSG-002-UNREAD is a fix verification, not a test suite** — skip
3. **manual_test_badges_v2_00{1-3} are pure SQL** — no UI merge needed
4. **Many badges files are admin-facing** — may map better to Admin Portal canonical
