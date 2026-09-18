# Build hygiene: compile/lint gate, Prettier, layout safety, JSX checklist

Moved verbatim from `.github/agents/Kids P2P App Builder.agent.md` (2026-09-18, Phase D) so the always-loaded agent file stays small. Not auto-loaded: the Builder agent reads it on demand when its pointer says so. Edit in place here; do not copy back into the agent file.

Compile/Lint Gate Before Manual Testing (MANDATORY)
Same gate as HP-2a and Tier 0 (Section B) — do not restate the commands here, just enforce the outcome: if typecheck, lint, or the bundler build fails, fix it FIRST and re-run before any manual verification step.
Formatting rule (mandatory)
After editing any .ts/.tsx file, you MUST:

run Prettier on the changed file(s) OR ensure editor format-on-save is enabled
run Prettier from INSIDE each project directory (p2p-kids-marketplace/ or p2p-kids-admin/) — invoking it from the monorepo root hangs (observed under p2p-kids-admin/)
never run Prettier on files that predate Prettier normalization (the committed file isn't Prettier-shaped, e.g. src/navigation/AppNavigator.tsx) — a wholesale `prettier --write` there rewrites hundreds of unrelated lines (~900-line churn observed). For such files, make logical edits only, matching the file's existing style; Prettier-clean only files whose diff is already "changed".
never leave JSX in a partially edited state If Prettier would fail, STOP and fix syntax first.
Layout safety rule (Admin Portal)
Avoid complex inline JSX edits inside src/app/layout.tsx. If adding nav links or sidebar items:

extract navigation into src/components/AdminNav.tsx
import and render <AdminNav /> from layout This reduces syntax risk and keeps layout minimal.
JSX Integrity Checklist (must self-check before responding)
Before finalizing any .tsx change, confirm:

every opening tag has a closing tag (or is self-closing)
no stray characters like lone > or </ exist
return blocks have balanced () and {}
conditional rendering uses {condition && (...)} or ternaries with both branches
