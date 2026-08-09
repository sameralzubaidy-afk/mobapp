---
description: "Scan this entire chat for every 📦 Session Handoff block produced so far, collect all non-'none' 'Suggested to improve agent rules' entries, and apply each one to the correct file (Kids P2P App Builder.agent.md or the matching .github/instructions/*.instructions.md), following the repo's existing rule-consolidation conventions."
mode: "agent"
---

# Apply all Session Handoff rule suggestions from this chat

Scan the ENTIRE conversation history in this chat (not just the latest response) and collect the 📦 **Session Handoff** block from EVERY response that produced one — this session may contain several fixes, each with its own handoff.

1. Build a list of every `Suggested to improve agent rules:` entry found across all those handoffs, in order.
   - Drop any that say "none".
   - If two or more entries are essentially the same suggestion (same rule, worded differently), merge them into one before proceeding.
   - If the resulting list is empty, reply "No rule suggestions to apply." and stop — do not edit anything.
   - Otherwise, list out each distinct suggestion you found (one line each, with which fix/response it came from) before making any edits, so I can see what you're about to apply.
2. For EACH distinct suggestion, before adding anything:
   - Use `grep_search` across `.github/agents/Kids P2P App Builder.agent.md` AND all files in `.github/instructions/` for wording that already covers this case. Do NOT create a duplicate — if an existing rule already covers it, propose extending that rule's wording instead of adding a new one, per this repo's duplicate-identifier/duplicate-rule discipline.
3. Decide the correct destination for that suggestion:
   - **Cross-cutting** (applies across mobile + Edge Functions + SQL + admin portal — e.g. MCP policy, Session Handoff contract, hardening/regression tiers, duplicate-identifier policy) → stays directly in `Kids P2P App Builder.agent.md`.
   - **Postgres/migrations/RLS/RPC-specific** → `.github/instructions/supabase-sql.instructions.md`
   - **Edge Function-specific** (Deno/TypeScript, auth/RLS in functions, deploy hygiene) → `.github/instructions/edge-functions.instructions.md`
   - **Mobile client-specific** (screens/services/hooks, Realtime, caching, error parsing) → `.github/instructions/mobile-client.instructions.md`
   - **Navigation-specific** (routes, auth/onboarding stack boundaries, params) → `.github/instructions/navigation.instructions.md`
   - If it doesn't cleanly fit any of the above, ask before creating a new file or section.
4. If the target is one of the 4 instructions files:
   - Assign the next available `BP-N` number (check the Bug Prevention Rule Index in `Kids P2P App Builder.agent.md`'s appendix for the current highest BP number — increment for each new rule added in this same pass so numbers don't collide across multiple suggestions).
   - Add the full rule (Problem / Rule / example, matching the style of neighboring rules) to the target instructions file.
   - Add a one-line entry to that file's own "Rule Index" section at the top.
   - Add a matching one-line pointer entry to the "🛡️ Appendix: Bug Prevention Rule Library" Rule Index in `Kids P2P App Builder.agent.md`, in the same pointer format used for other split-out BP rules.
   - If the new rule maps to a recognizable bug symptom, also add or extend a "See also: BP-N" cross-reference under Section 9.2 in the main agent file.
5. If the target is the main agent file directly (cross-cutting):
   - Add it to the most relevant existing section (NON-NEGOTIABLE RULES, Hardening Protocol, or Section 13/14) instead of creating a new top-level section.
   - Prefer extending an existing rule's wording over adding a new standalone block if the topic overlaps.
6. After editing, report back a summary table covering ALL suggestions processed in this pass:
   - Which fix/response each suggestion came from.
   - Exactly which file(s) changed and the new rule's identifier (e.g., "added BP-44 to `mobile-client.instructions.md`" or "extended NON-NEGOTIABLE rule #7").
   - The one-line summary of the rule as it now appears in the relevant Rule Index.
   - Any suggestions you skipped because they duplicated an existing rule, and what you did instead (e.g., extended rule X).
7. Do not touch any other content in these files beyond the additions described above.
