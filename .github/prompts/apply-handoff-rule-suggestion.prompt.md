---
description: "Rule intake for BOTH agents. Scan this chat for Dev (📦 Session Handoff) and QA (📋 QA Session Handoff) 'Suggested to improve agent rules' entries, triage each as RULE / FACT / INCIDENT, and file it in exactly ONE correct place, small, with a script-issued id, inside the file size budget. Run once per chat after the handoff(s)."
mode: "agent"
---

# Apply rule suggestions from this chat (Dev + QA)

Goal: every new rule lands in one right place, stays short, and never grows a file past its budget. The agent files are read on every request, so **every added line costs quality on every future task.** When in doubt, do not add.

## Step 0 - Collect

Scan the WHOLE chat for:
- `📦 Session Handoff` blocks, field `Suggested to improve agent rules:` -> source **Dev**
- `📋 QA Session Handoff` blocks, field `Suggested to Improve Agent Rules:` -> source **QA**
- any rule the user states directly in chat -> source of the agent it is about

Drop entries that say "none". Merge same-topic entries. If nothing is left, reply "No rule suggestions to apply." and stop without editing. Otherwise list each one line (source + which handoff) before editing.

## Step 1 - Triage each entry

| Kind | What it is | Where it goes |
|---|---|---|
| **RULE** | A behavior every future session must follow | Steps 2-6 |
| **FACT** | An environment/tool quirk (a keyboard behavior, a simulator flag, a tool bug) | One bullet in the matching note in `docs/agent-memory/` (for QA: `simulator-keyboard-suppression.md` or the closest topic note). Not rule text |
| **INCIDENT** | The story of what happened (dates, task ids, screenshots) | Only inside the one-line changelog entry (Step 5). Never inside a rule |

Admit a RULE only if it prevented, or would have prevented, a real defect or 10+ wasted tool calls, AND it is not already covered. Money, security, data-loss and privacy lessons are admitted immediately. Any other first sighting: add a row to `docs/agent-memory/rule-candidates.md` and stop for that entry; if it is already in that file, raise its count and promote it to RULE (second sighting).

## Step 2 - Extend before adding

Search `.github/agents/`, `.github/instructions/` and the QA playbook for wording that already covers it, and check the tombstones (`RETIRED`, `UNASSIGNED`). If a rule covers it, **rewrite that rule in place** to include the new case. Do not append a dated "extension" paragraph. Never reuse a retired id; never open a second rule for a topic a tombstone points elsewhere.
If the new rule replaces an old one, do not leave both: propose the merge and wait for confirmation.

## Step 3 - Route (pick exactly one home)

| It is | Home | Id |
|---|---|---|
| Dev, applies to mobile + backend + admin | `Kids P2P App Builder.agent.md` body (non-negotiables / hardening section), only as a one-line edit to an existing rule where possible | none |
| Dev, Postgres / migrations / RLS / RPC | `supabase-sql.instructions.md` | BP-N |
| Dev, Edge Functions | `edge-functions.instructions.md` | BP-N |
| Dev, mobile screens / services / hooks | `mobile-client.instructions.md` | BP-N |
| Dev, navigation | `navigation.instructions.md` | BP-N |
| Dev, admin portal (`p2p-kids-admin/src/**`; the admin app is a git submodule, rules for the submodule's own repo do not go here) | `admin-portal.instructions.md` | BP-N |
| QA, how to drive or judge a test | the QA playbook section that owns the topic (`QA-Test-Agent.instructions.md`, or its platform module if one exists) | R-N |
| Never | `QA-Test-Agent.agent.md` and the appendix of the Builder file (both are role/scope/pointer only; the appendix holds one-line pointers for BP rules) | - |

If no row fits, ask before creating a file or section.

## Step 4 - Get ids from the script

Never pick an id by hand:
`node scripts/agent-rules/next-id.mjs BP` (Dev rule), `... R` (QA rule), `... S` (new QA section number - avoid; prefer extending a section).
Take one id per new rule and run it again after writing so two rules never share a number.

## Step 5 - Write once, small

Rule body, max ~8 lines:

```
## BP-N: <short title>          (QA: **R-N - <short title>.**)
**Rule:** <imperative, 1-2 sentences>
**Why:** <one line> (<incident/task id>)
**Check:** <one line: how to tell it was followed>
```

Not allowed in a rule: incident narratives ("Real evidence ..."), dates of sessions, screenshots, "see also" chains, restating another rule. Put evidence in the changelog line.

Then, in this order:
1. Add one index line (max 150 chars) to that file's own Rule Index. For BP rules also add the one-line pointer in the Builder appendix index (`- BP-N - title - full text in <file>`), and a "See also" under Section 9.2 only if it maps to a recognizable bug symptom (one line).
2. Append ONE line to `docs/agent-memory/rule-changelog.md`: `date | id | file | summary (max 120 chars) | source task`.
3. If the rule cites a longer evidence note, write it to `docs/agent-memory/<topic>.md`. No credentials, ever (README in that folder).

## Step 6 - Budget gate (must pass before you report)

Run `npm run agent-rules:check` from the repo root. Required: **0 FAIL**.
- If the target file is over its size baseline, do NOT force it through and do NOT raise the baseline in `scripts/agent-rules/budgets.json`. Propose a **make-room swap**: name two existing rules in that file to merge or shorten (show the proposed wording) so the net size does not grow, and wait for the user's yes. Only lowering a baseline (`node scripts/agent-rules/check.mjs --ratchet`) is allowed.
- Any dead path, unresolved `§5.x` citation or duplicate BP body definition the check reports must be fixed before you finish.

## Step 7 - Report

One table, one row per suggestion: source (Dev/QA) | kind (RULE/FACT/INCIDENT/deferred) | action (added / extended in place / merge proposed / candidate) | file | id | index line as written.
Then: the pasted `agent-rules:check` summary line, remaining size budget for each file touched, and any suggestion skipped and why.

## Guardrails

- Touch nothing outside the additions above. No renumbering, no restyling of neighbors, no pruning (pruning is `consolidate-agent-rules.prompt.md`; run it about every 10 sessions or monthly).
- Do not add anything to `.github/agents/*.agent.md` except an edit to an existing Builder rule.
- If you are unsure about the kind or the home, ask one question instead of guessing.
