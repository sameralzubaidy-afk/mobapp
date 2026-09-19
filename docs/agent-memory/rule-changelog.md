# Rule changelog

One line per rule added, extended, merged or retired. Written by `.github/prompts/apply-handoff-rule-suggestion.prompt.md`. History before 2026-09-18 lives in `qa-test-agent.md` (QA) and `agent-rule-updates-*.md` (Dev).

Format: `date | id | file | summary (max 120 chars) | source task`

| Date | Id | File | Summary | Source |
|---|---|---|---|---|
| 2026-09-18 | R78-2 | .github/instructions/QA-Test-Agent.instructions.md | Extended: re-verify a row's BLOCKED reason by grepping the artefact it names, at SCOPE time | MSG Round 1 (qa-msg-round1-2026-09-18) |
| 2026-09-18 | R62c | .github/instructions/QA-Test-Agent.instructions.md | Extended: a badge-scan 0% on an all-gray region is never a negative — re-check with inspect-screen histogram | FIX-Task-65 (qa-msg-round1-2026-09-18) |
| 2026-09-19 | §9.1i | docs/agent-ref/troubleshooting.md | Added: size a data defect by COUNTING the whole set, never from the sample query that demonstrated it | FIX-Task-66 (2026-09-18) |
| 2026-09-19 | — | docs/agent-ref/mcp-and-tooling.md | Added: a deployment can be STALE — check the deployed revision before hypothesising a hidden writer | FIX-Task-66 (2026-09-18) |
| 2026-09-19 | — | .github/agents/Kids P2P App Builder.agent.md | Swapped: compressed the §9.1 title index in place to make room for 9.1i (net size shrink) | FIX-Task-66 (2026-09-18) |
