---
description: "PRUNE + VALIDATE the agent rule library. Scan .github/agents/ and .github/instructions/ for rules declared 'superseded'/'replaced' whose old text was never deleted, for referenced file paths that don't exist on disk, and for BP-N / R-N numbering gaps or duplicates; then PROPOSE near-duplicate merges for human sign-off. Run periodically — after roughly every 10 sessions, or monthly, whichever comes first — so the rule files stop growing unboundedly."
mode: "agent"
---

# Consolidate, prune, and validate the agent rule library

This is the mirror image of `.github/prompts/apply-handoff-rule-suggestion.prompt.md`.

- `apply-handoff-rule-suggestion` only ever **ADDS** rules (one suggestion → one rule, appended with a new number).
- **This prompt only ever PRUNES and VALIDATES.** It adds nothing new. Its job is to stop the rule files from silently accumulating dead text, broken pointers, and duplicate numbers.

**Golden rule: never delete or merge rule text without showing the evidence and getting Samer's explicit go-ahead.** Report first, act second. The only changes this prompt applies unilaterally are ones the user confirms in this session.

Target files:

- `.github/agents/Kids P2P App Builder.agent.md`
- `.github/agents/QA-Test-Agent.agent.md`
- `.github/instructions/supabase-sql.instructions.md`
- `.github/instructions/edge-functions.instructions.md`
- `.github/instructions/mobile-client.instructions.md`
- `.github/instructions/navigation.instructions.md`
- `.github/instructions/QA-Test-Agent.instructions.md`

---

## Step 1 — Superseded-but-not-deleted text

1. Grep all target files for wording that declares one rule replaces another:
   ```
   grep -rn -iE "supersede|superseded|replaces an? (existing|earlier)|covered by .*BP-|merged into BP-|dup of BP-|renamed from a duplicate" .github/agents/ .github/instructions/
   ```
2. For every hit, read the superseding rule **and** the rule it claims to replace.
3. Classify:
   - **CLEAN** — the superseded text was actually deleted (only a tombstone/pointer remains).
   - **STALE DUPLICATE** — both versions still exist; the old one is now dead text that a future session will read and obey. **These are the defects.**
4. For each STALE DUPLICATE, build the merge proposal: old number → target number, the current/complete version, any clause in the old version that is NOT in the new one (that clause is the only thing worth folding in), and the exact edits you would make.
5. Present the list. **Do not merge until Samer confirms each one.**
6. When a merge is confirmed: delete the superseded text, fold in any unique clause, and leave a one-line tombstone in both Rule Indexes (e.g. `BP-77: RETIRED (merged into BP-41, <date>) — historical citations refer to BP-41`) so the hundreds of historical `BP-N` citations in `e2e-test-results/**` and `docs/**` stay decodable.

## Step 2 — Verify every referenced path actually exists

1. Extract every path referenced anywhere in `.github/agents/**` and `.github/instructions/**`:
   ```
   grep -rohE "(/memories/[A-Za-z0-9._/-]+|\.github/[A-Za-z0-9._/-]+|[A-Za-z0-9._-]+/[A-Za-z0-9._/-]+\.(md|sql|ts|tsx|json|mjs|sh|yml))" .github/agents/ .github/instructions/ | sort -u
   ```
2. Check each one with `test -e` / `ls`.
3. **`/memories/...` is NOT the repo's `memories/` folder.** It resolves to the VS Code memory store at
   `~/Library/Application Support/Code/User/workspaceStorage/<hash>/GitHub.copilot-chat/memory-tool/memories/`.
   Check `/memories/repo/<file>` there. **Never** "fix" a `/memories/repo/...` reference by copying files into the repo's `memories/` folder — that folder is an unrelated, drifted mirror.
4. **`/memories/session/...` paths are always broken from a later session** — session memory is per-conversation (each session gets its own UUID directory). A durable rules file must never cite one. If you find one whose content still exists in an old session directory, promote it to `/memories/repo/<same-name>.md` and repoint the citation to repo scope.
5. Report every missing path in a table: `referenced path → exists? (Y/N) → where it now lives / what it should point at`. Fix only the ones with an unambiguous correct target; list the rest as "needs real content from Samer" — **never invent the missing content**.

## Step 3 — Numbering sanity (BP-N and R-N)

1. List every rule id in appearance order per file:
   ```
   grep -noE "\bBP-[0-9]+\b" .github/agents/Kids\ P2P\ App\ Builder.agent.md
   grep -oE "\*\*R[0-9]{1,3} [—-]" .github/instructions/QA-Test-Agent.instructions.md
   ```
   Also collect ids that appear only in a section heading (e.g. `### 5.74 … — R93`) and sub-rule forms (`R62a`), or you will report false gaps.
2. Report: duplicates (the same number defined twice), gaps (a number referenced but never defined), and out-of-order appearances.
3. **Do NOT renumber.** A full renumber from BP-1 would invalidate `BP-N` citations in **277+ files outside `.github/`** — `e2e-test-results/**` QA evidence archives, `docs/**`, `Prompts/**`, `docx/**` — which are append-only historical records and must not be rewritten. If a renumber is genuinely wanted, it needs (a) a coordinated decision, (b) an alias/legacy-number mapping table published in the appendix, and (c) a sweep of the external citations as a separate, explicitly-approved task. Report this trade-off every time instead of doing it.
4. Cross-reference integrity **can** be fixed without renumbering: a citation pointing at a rule that no longer exists (or at a section number that was never created) is a plain defect — list it and propose the correct target.

## Step 3b — Section-number integrity (`§N.M`)

Rule numbers are only half the picture: the QA playbook is cited by **section** number far more often than by rule id, and a section can be cited that was never created, or rewritten so it now holds a different rule than the citation implies.

1. Extract every `§N.M` citation from `.github/agents/**` and `.github/instructions/**`.
2. For each, confirm a heading with **that exact identifier** exists in the file it names. (Real defect found 2026-09-12: the QA agent file cited "§5.61 R58–R60" for two months, but **no §5.61 had ever been written** — the numbering jumped 5.60 → 5.62.)
3. Extract the section identifiers actually present and look for true duplicates:
   ```bash
   grep -oE "^### [0-9]+\.[0-9]+[a-z]?" .github/instructions/QA-Test-Agent.instructions.md | sort | uniq -d
   ```
   **Capture the optional trailing letter.** Sections legitimately come in `X` + `Xb` pairs (`5.47`/`5.47b`, `5.51`/`5.51b`, `5.67`/`5.67b`). A pattern like `^### 5\.[0-9]+` truncates `5.47b` to `5.47` and reports every one of those pairs as a duplicate section — **that is a false positive of the grep, not a defect** (hit on 2026-09-12 and retracted).
4. Also check for a citation pointing at a section that has since been **overwritten to hold a different rule**: R79 was codified into §5.70 on 2026-09-07, then §5.70 was rewritten for R80 on 2026-09-08 and the R79 text was silently lost while `mobile-client.instructions.md` kept citing it.
5. Report: true duplicates, missing sections (cited but never created), and citations whose section now holds a different rule.
6. Do **NOT** renumber or rename a section without an explicit decision — section numbers are cited from other files, so a rename is a breaking change.

## Step 4 — Near-duplicate proposals (never silent)

1. Group rules by topic across all files (deploy hygiene, notification copy, money units, test isolation, RLS, keyboard/AX handling, …).
2. Flag any group where two rules say substantially the same thing in different words at different dates — i.e. the same failure would be prevented by either one.
3. **Propose** the merge: surviving id, absorbed id, what is unique in the absorbed version, and where the unique clause would live.
4. Never merge or delete a rule silently. Duplicated QA operational facts (Android IME behaviour, simulator quirks, AX-tree quirks) are hard-won from real sessions — a merge that drops one leaves the next round to rediscover it. **List, then wait.**

## Step 5 — Report

End with a single report containing:

- **Merges applied** (confirmed this session): old id → surviving id, one line each.
- **Merges proposed, not applied**: the list, awaiting sign-off.
- **Broken paths**: table from Step 2.
- **Numbering**: duplicates / gaps / out-of-order, with false positives explicitly excluded.
- **Unchanged**: a one-line confirmation of what you verified as healthy.
- **The next periodic run**: state the trigger date/session count so the next session knows when this is due.

## Rules for running this prompt

- Read a file's current content before editing it.
- Use the repo's existing conventions; do not restyle neighbouring text.
- This prompt may only **delete** confirmed-superseded text and **fix** broken pointers. It must not invent rules, rewrite history in `e2e-test-results/**`, or renumber.
- If a Step produces nothing, say so explicitly ("Step 3: no duplicates, no gaps") — a silent no-op reads like a skipped step.
