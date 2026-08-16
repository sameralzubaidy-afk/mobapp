# 📦 Archived — `misc/` manual-testing & historical docs (2026-08-13)

**Superseded by `cross-checked-and-consolidated/`** as of the Phase 7.5 repoint
on 2026-08-13. **Historical reference only** — do not treat anything in this
folder as canonical or live.

## Why this folder exists

- The **6 canonical manual-testing guides** (namespaced with module prefixes
  `AUTH-TC-*`, `SUB-TC-*`, `TRD-TC-*`, `ACC-TC-*`, `ADM-TC-*`, `MSG-TC-*`) now
  live in **`cross-checked-and-consolidated/`** at the repo root.
- All active automation was repointed to that location on 2026-08-13:
  `test-automation/trade-flow-v2/manifest.json`, `run-tradeflow-suite.mjs`,
  `RUNBOOK.md`, `scripts/smoke/dispute-evidence.mjs`, `docs/flow-registry.md`,
  the `.github/instructions/*` and `.github/agents/*` files, plus the active
  Detox/explainer/spec docs that referenced the guides.
- This folder preserves the older `misc/` copies of the guides and one-off
  implementation/deployment notes for historical reference. **Nothing here is
  read by active tooling or automation.**

## Known residuals (still reference this old path — deliberately not edited)

- Internal `misc./` cross-references inside the canonical guides themselves
  (`cross-checked-and-consolidated/MODULE-ADMIN-PORTAL-MANUAL-TESTING.md` ×3,
  `MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` ×1) and one app-source comment
  (`supabase/functions/initiate-payout/index.ts`) — left untouched because this
  task forbade editing the 6 canonical guides and app source. A follow-up
  path-swap pass is recommended.
- Historical records that intentionally describe the old state:
  `cross-checked-and-consolidated/CONSOLIDATION-MANIFEST.md`,
  `gap-analysis/canonical-index-*.md`, `scripts/archive-absorbed.sh`,
  `scripts/merge-tc-docs.mjs`, session memory, and past `reports/` artifacts.
