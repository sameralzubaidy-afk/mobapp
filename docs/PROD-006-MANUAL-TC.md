# PROD-006 — TypeScript `noImplicitAny` — Manual Test Cases

**Module:** MODULE-15.5 — PROD-006
**Type:** Build-gate / static analysis. **No manual UI test cases required.**

---

## Acceptance Gate (Tier 0)

The "manual test" is running these two commands locally:

```bash
cd p2p-kids-marketplace
npx tsc --noEmit
# Expected: exit 0, no "error TS" lines

npm run test:unit
# Expected: Test Suites: 220 passed, Tests: 2826 passed
```

Both must PASS. If either fails, the task is NOT done.

---

## What Changed

- `p2p-kids-marketplace/tsconfig.json`: `"noImplicitAny": false` → `true`.
- `p2p-kids-marketplace/package.json`: added `@types/uuid` to `devDependencies`.
- Type annotations added across 25+ files in `src/` (services, contexts,
  hooks, screens, navigation) to satisfy `noImplicitAny`. No runtime behavior
  changed — annotations only.

Categories of fixes applied (no `: any` used anywhere):

| Pattern | Example |
|---|---|
| Realtime payload | `(payload: RealtimePostgresChangesPayload<Message>) => ...` |
| Realtime status | `(status: string) => ...` |
| Supabase `.select` array callbacks | Inline `type Row = { ... }` then `(r: Row) => ...` |
| Presence binding | `({ newPresences }: { newPresences: unknown[] })` |
| Dynamic indexing | `(theme.colors.warning as Record<number, string>)?.[700]` |

---

## Smoke (Optional Manual)

To convince yourself nothing broke at runtime, run any one happy-path flow in
the simulator and confirm no redbox:

1. Launch app: `cd p2p-kids-marketplace && npx expo start --ios`.
2. Log in with a known test account.
3. Open Chat — confirm messages still arrive in realtime (FLOW-14).
4. Open Wallet — confirm SP balance renders (FLOW-10).
5. Open Conversations list — confirm last-message preview updates (FLOW-14).

If any of those redbox or fail to render, file a P0 — likely a missed nullable
in one of the inline row types.

---

## Rollback

```bash
git revert <prod-006 commit-sha>
```

Reverts `tsconfig.json` flag and all type annotations together. No DB or
runtime behavior changes are involved, so rollback is fully safe and
reversible.
