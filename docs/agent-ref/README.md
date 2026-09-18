# docs/agent-ref

On-demand reference material for the Kids P2P App Builder (Dev) agent. It was moved verbatim out of `.github/agents/Kids P2P App Builder.agent.md` (Phase D, 2026-09-18) so that file stays small: agents read the always-loaded core on every request, so every line there costs quality on every task.

These files are **not auto-loaded**. The Builder core links to each one where it matters ("read X before doing Y"). Edit them in place; do not copy text back into the agent file.

| File | When to read it |
|---|---|
| `troubleshooting.md` | Before investigating any bug or QA finding (Section 9.1 discipline, 9.2 symptom-to-rule map, 9.3 steps) |
| `bp-index.md` | To find a Bug Prevention rule by number; add one line here for every new BP rule |
| `mcp-and-tooling.md` | Before any Supabase MCP call or edge-function deploy; when a Supabase MCP call returns `Unauthorized`; before driving a simulator/device |
| `dev-addenda.md` | When tightening grants or money math, when a fix did not persist, when a regression tier is blocked, or before filing an environment anomaly |
| `validation-checklists.md` | Before handoff: subscription gating, Swap Points math, DB/RLS, Edge Function, mobile, testing checklists |
| `build-hygiene.md` | Before responding to any `.tsx` change (JSX checklist); Prettier and admin layout rules |
| `copy-and-doc-claims.md` | When a fix changes user-facing copy or corrects a doc's "this is safe" claim |
| `requirements-docs.md` | To pick which `docx/` spec governs a task |
| `repo-modules-examples.md` | Repo layout details, docs folder standard, module prompt list, module map, example prompts |
| `flow-list-legacy.md` | History only. `docs/flow-registry.md` is the authoritative flow list |

Rules for this folder: no credentials; keep it reference-only (behavior rules that must always apply belong in the agent core or a domain `.instructions.md`); add new rules only through `.github/prompts/apply-handoff-rule-suggestion.prompt.md`.
