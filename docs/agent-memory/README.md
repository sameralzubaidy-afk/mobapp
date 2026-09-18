# docs/agent-memory

Durable notes that the Dev agent (Kids P2P App Builder) and the QA Test Agent read or cite. They used to live only in VS Code's private memory store, which is not version-controlled or backed up. This folder is now the canonical home; `.github/agents/**` and `.github/instructions/**` cite these repo paths.

## What is here

| File | What it is |
|---|---|
| `qa-test-agent.md` | Long dated consolidation log of QA playbook changes (archive; new history goes to `rule-changelog.md`) |
| `qa-test-accounts.md` | Standing staging test personas (passwords for real external accounts are redacted) |
| `schema-cheat-sheet.md` | Staging DB schema quick reference for QA SQL |
| `locator-conventions.md`, `test-authoring-conventions.md`, `manual-testing-guide-canons.md`, `simulator-keyboard-suppression.md` | QA convention notes |
| `qa-*-2026-*.md`, `agent-rule-updates-2026-08-31.md`, `qa-task43b-android.md` | Dated round notes that the playbook cites as evidence |
| `rule-changelog.md` | One line per rule added or changed (written by the rule-intake prompt) |
| `rule-candidates.md` | First-sighting proposals waiting for a second occurrence before becoming rules |
| `archive/` | Superseded files kept for history |

## Rules for this folder

- **No credentials.** Never write a real password, token, API key, or JWT here. Reference secrets by env-var name (for example `PLAYWRIGHT_ADMIN_PASSWORD`) or "see password manager". Seed-fixture passwords that are already committed in `scripts/` are fine.
- **Notes are evidence, not rules.** A lesson that every session must follow belongs in the Builder agent or an `.instructions.md` file (see `.github/prompts/apply-handoff-rule-suggestion.prompt.md`). This folder holds the story behind it.
- **Do not add per-session logs** unless a playbook rule cites the file by name.
- Validate the whole rule library with `npm run agent-rules:check` from the repo root.
