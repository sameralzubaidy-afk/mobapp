---
description: "Apply the 2026-09-12 agent/instructions audit findings: fix broken /memories references, remove committed credentials, rename the space-prefixed docx file, clean up dead files, finish migrating the BP rule appendix out of the main agent file, renumber/dedupe rules, and create a standing consolidation prompt so the agent files stop growing unboundedly."
mode: "agent"
---

# Apply agent/instructions audit fixes

You are working in this repo's own `.github/agents/` and `.github/instructions/` files — the files that define how you (and the QA Test Agent) behave. An external review of these files found concrete, fixable problems. Work through the phases below IN ORDER. **Stop and report back after Phase 1** before touching Phase 2–4 — those phases edit the core rules that shape every future session, and Samer should sign off before that happens.

Follow this repo's own standing conventions while doing this work: read a file's current content before editing it, use `git mv`/`git rm` (not manual delete+recreate) so history is preserved, grep the whole repo for references before renaming/removing anything, and close your final reply with the same 📦 Session Handoff block format already required in `Kids P2P App Builder.agent.md`.

---

## Phase 0 — Safe mechanical fixes

1. **Rename the space-prefixed docx file.**
   - Current path: `docx/ Solution Architecture & Implementation Plan.md` (leading space).
   - `git mv` it to `docx/Solution Architecture & Implementation Plan.md` (no leading space).
   - Grep the ENTIRE repo (not just `docx/`) for the old string, including the leading space, e.g.:
     `grep -rn "Solution Architecture & Implementation Plan" --include="*.md" --include="*.ts" --include="*.tsx"`
   - Update every reference you find to the corrected path.
   - In `Kids P2P App Builder.agent.md`, find the "File Path Normalization (MANDATORY)" section that exists specifically to work around this bug. Since the underlying file is now fixed, simplify that section to state the file is correctly named — do not delete the general "filenames must not have leading/trailing spaces" principle, only the now-obsolete workaround instructions tied to this specific file.

2. **Remove the committed staging admin password.**
   - In `.github/copilot-instructions.md`, find the "Admin portal login (browser-based manual verification)" section containing the plaintext email/password.
   - Check whether `p2p-kids-admin/.env.local` (or equivalent) is listed in `.gitignore`. If not, add it.
   - Add `ADMIN_STAGING_EMAIL` and `ADMIN_STAGING_PASSWORD` entries to a gitignored local env file (create `p2p-kids-admin/.env.local.example` with placeholder values, committed, so the convention is documented — but the REAL values only go in the gitignored `.env.local`, never committed).
   - Replace the credential block in `copilot-instructions.md` with a pointer, e.g.: "Staging admin login: see `p2p-kids-admin/.env.local` (gitignored, not committed) for `ADMIN_STAGING_EMAIL` / `ADMIN_STAGING_PASSWORD`. Never hardcode or log these."
   - In your final report, flag explicitly that the OLD password is still recoverable from git history (renaming/moving it doesn't erase history) and recommend Samer rotate that staging admin password — do not attempt a git history rewrite yourself.

3. **Delete the stray CI backup file.**
   - `git rm .github/workflows/monorepo-ci.yml.bak` — first confirm nothing references it (`grep -rn "monorepo-ci.yml.bak"`), then remove it.

4. **Fix the dead agent-folder file.**
   - `.github/agents/embed your Figma designs later (step-by-step)` has no file extension and no agent frontmatter, so it is NOT loaded as an agent — it's a manual walkthrough doc sitting in the wrong folder.
   - `git mv` it to `docs/figma-embedding-guide.md` (add the `.md` extension; keep its content as-is unless it's incomplete, in which case note what's missing rather than inventing content).

Report back what changed in each of the 4 steps above (files touched, commands run, grep results) before continuing.

---

## Phase 1 — Fix broken `/memories/` references (QA agent)

1. Grep `.github/instructions/QA-Test-Agent.instructions.md` and `.github/agents/QA-Test-Agent.agent.md` for every path under `/memories/repo/` and `/memories/session/`.
2. For each distinct referenced path, check with `test -e` / `ls` whether it actually exists in the repo's `memories/` folder.
3. For every path that does NOT exist, do one of the following — prefer (a):
   - **(a) Extract, don't invent:** A lot of these files' intended content is already duplicated inline as dated addendum bullets inside `QA-Test-Agent.instructions.md` (e.g. locator conventions, keyboard-suppression notes, test-account registry facts scattered across the dated `§5.x` entries). Where you can identify the source material for a given missing file (e.g. `/memories/repo/simulator-keyboard-suppression.md` ← the Android IME / keyboard-suppression bullets), extract and consolidate that material into the missing file, then trim the now-redundant inline copy from the instructions file down to a one-line pointer (matching how other BP rules already point to instructions files).
   - **(b) Stub + flag:** If no real source material exists for a referenced file, create it with a short header (`# <topic> — TBD`) and one sentence describing what it's supposed to contain, and list it explicitly in your final report as "needs real content from Samer" — do not fabricate conventions or test-account details.
4. Re-verify: after your edits, every `/memories/...` path referenced anywhere in the QA agent's files must resolve to a real file. Confirm this with a final grep + existence check pass and show the result.
5. Produce a table in your reply: referenced path → existed before (Y/N) → action taken (extracted / stubbed / already existed).

**STOP HERE and report. Wait for explicit go-ahead before Phase 2 — it restructures the rules that govern every future coding session.**

---

## Phase 2 — Finish migrating the BP rule appendix out of the main agent file

1. In `Kids P2P App Builder.agent.md`, locate the "🛡️ Appendix: Bug Prevention Rule Library" section.
2. Some BP-N rules there are already one-line pointers (e.g. "BP-19: ... — full text moved to `.github/instructions/edge-functions.instructions.md`"). Others still carry their full text inline. For every BP rule that is STILL inline:
   - Route it to the correct instructions file using the same routing logic already defined in `.github/prompts/apply-handoff-rule-suggestion.prompt.md` (Postgres/RLS/RPC → `supabase-sql.instructions.md`; Edge Functions → `edge-functions.instructions.md`; mobile screens/services/hooks → `mobile-client.instructions.md`; routes/nav → `navigation.instructions.md`; truly cross-cutting rules stay in the main agent file).
   - Move the full rule text (Problem / Rule / example) to that file, matching the style of the rules already there.
   - Replace the inline version in the main agent file with a one-line pointer, exactly matching the format used by the rules that are already pointers.
   - Add a one-line entry to the destination file's own "Rule Index" at the top.
3. Do not renumber anything yet — that's Phase 3. Just complete the move so every BP rule in the main agent file is a pointer, none are still inline full-text blocks.
4. After finishing, confirm by grepping the main agent file's appendix section: every `BP-N:` line should end in "— full text moved to `.github/instructions/...`" with no exceptions.

---

## Phase 3 — Renumber and de-duplicate

1. List every `BP-N` rule across the main agent file and all four instructions files, in the numeric order they currently appear. Note that the current order is NOT sequential (e.g. `BP-44, 45, 46, 48, 47, 49` appear out of order) — this is expected, you're about to fix it.
2. Identify true duplicates or superseded rules — especially anywhere the text says "supersedes", "replaces", or restates an existing rule under a new number. For each one found:
   - Confirm which version is the current/complete one.
   - Merge into a single rule, deleting the superseded text entirely (don't leave both versions in the file).
   - List every merge you make in your final report (old BP numbers → merged into which).
3. Renumber all BP rules sequentially from BP-1 upward, in the order they now appear across the files. Update every cross-reference to a renumbered rule — in-file "See also: BP-N" mentions, and each instructions file's own Rule Index, and the main agent file's Appendix Rule Index — so nothing points to a stale number.
4. Do the equivalent numbering sanity pass for the QA agent's `R-N` rules in `QA-Test-Agent.instructions.md` — but be conservative here: these encode hard-won operational facts from real QA sessions (e.g. Android IME behavior, simulator quirks). Only renumber for sequencing; do NOT merge/delete any R-rule without first listing the candidate duplicates and getting explicit confirmation that they're truly redundant.

---

## Phase 4 — Create a standing consolidation prompt (prevents this from recurring)

Create `.github/prompts/consolidate-agent-rules.prompt.md`, using the same frontmatter/style as `.github/prompts/apply-handoff-rule-suggestion.prompt.md`, whose job is the mirror image of that prompt: where `apply-handoff-rule-suggestion` only ever ADDS rules, this new prompt PRUNES and VALIDATES. It should instruct a future agent run to:

1. Scan all files in `.github/agents/` and `.github/instructions/` for rules whose wording says "supersedes"/"replaces" an earlier rule, and verify the superseded text was actually removed (not just marked as superseded while both copies remain).
2. Verify every file path referenced anywhere in `.github/agents/**` or `.github/instructions/**` (`/memories/...`, `docx/...`, `docs/...`, `Prompts/...`, etc.) actually exists on disk; report any that don't, the same way Phase 1 above did.
3. Check that `BP-N` and `R-N` numbering across all files is sequential with no gaps or duplicate numbers.
4. Identify near-duplicate rules (same topic, different wording, added at different times) and PROPOSE merges — list them for human sign-off, never silently merge or delete.
5. Note in the file's own description that it should be run periodically (suggest: after every ~10 sessions, or monthly, whichever comes first) so the rule files stop growing unboundedly the way they have been.

---

## Final report format

After each phase (and mandatory pause after Phase 1), give:
- What changed (files touched, one line each)
- Exact grep/verification commands run + their results
- Anything you flagged instead of fixing outright (missing content, ambiguous merges) and why
- The standard 📦 Session Handoff block per `Kids P2P App Builder.agent.md`'s existing contract
