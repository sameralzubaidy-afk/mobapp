# Ledger — `qa-p2-remainder-groupL-2026-09-12`

Manual tally (R71 fallback — the session transcript was not mined; desk work isolated from device execution per R71-fallback).

## Counts by channel

| Channel | Calls | Notes |
|---|---|---|
| Device (mobile-mcp) | ~78 | includes the ~10-call cold dev-client start and the picker exploration |
| Read-only SQL (Supabase) | ~24 | incl. 4 write-scoped RPC calls on disposable residue + 1 trigger/function introspection set |
| Terminal | ~11 | 3 fixture scripts, adb diagnostics ×2, tracker reconciliation, AX-file greps |
| Browser (admin Playwright) | 2 | the item-2 lock reproduction (both runs) |
| Desk (reads/greps/memory) | ~15 | playbook, 2 guides, tracker, memory |
| **Total** | **~130** | |

## Verdict-item cost

- Verdict-items ≈ **12** ⇒ ≈ **10.8 blended** calls/verdict.
- Device-only verdicts (O2-C04, O07, O1-C07, item 3, item 6) ≈ 5 ⇒ ≈ **15.6 device calls/verdict**.

## Isolated (NOT counted against device verdicts)

- Cold dev-client start: ~4 min wall-clock / ~10 poll calls (F9-class harness cost, not app cost).
- Picker exploration: ~14 calls (3 picker entries + collections) to establish the F3 limitation.
- Tracker surgery + report writing: desk.

## Write operations performed (full disclosure)

| Target | Write | Reversible? |
|---|---|---|
| `tax_records` of `3265ec84` | `rpc_mark_tax_collected` ×2, `rpc_refund_tax_with_status` ×2 (via SQL) | Disposable harness residue; left `partially_refunded` — **flagged for cleanup** |
| `trades` `472ef43a` | created by a real UI offer (Stripe auth hold) | Cancel via `cancel-trade` or let it auto-complete 2026-09-16 |
| `trades` `472ef43a` | accepted via `transactions-update` EF (seller JWT) | n/a |
| `items` `bef903a8` | created via the real Bulk Upload flow | pending review — delete/ignore |
| `qa-first-trade` persona `…017` + item `f24968b7` | created by the sanctioned `qa:r41-first-trade -- create` | `npm run qa:r41-first-trade -- reset` |
| Android media store | `qa:android-seed-media` push (12 assets already registered) | idempotent |
| Admin browser session | lock-hold test forced a timeout redirect ⇒ **signed out** | re-login; no config writes |

**No** app source, migrations, `.env`, or `admin_config` writes. **No** `git push`. **No** route stubs left registered (`page.unrouteAll` + `context().unrouteAll` called; lock-holder page closed).
