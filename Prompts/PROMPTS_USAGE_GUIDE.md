PROMPTS USAGE GUIDE
===================

This file explains how to use the project prompts (found in module files) inside Visual Studio Code, how to run them with GitHub Copilot / Copilot agent-style workflows, and best practices for getting reliable, safe results.

1) Purpose
---------
- The prompts included in module files (e.g., `MODULE-01-INFRASTRUCTURE.md`, `MODULE-06-TRADE-FLOW.md`) are designed to be pasted into an AI assistant (VS Code Copilot chat, Cursor, ChatGPT, or similar) to generate code snippets, SQL migrations, configuration steps, and task templates.
- This guide shows you how to use them efficiently inside VS Code and when running Copilot agent style interactions.

2) Where to find prompts
------------------------
- Prompts live inside module markdown files under `POC1/ai-code-generator/modules/`.
- Each task block usually has a header like `### AI Prompt for Cursor` or `### AI Prompt for ChatGPT` followed by code fences. Copy the fenced block for the specific task you want to run.

3) Quick Workflow (VS Code)
---------------------------
- Open the module file in VS Code and locate the prompt block you want to run.
- Select the entire fenced code block (triple backticks included). Use `⌘A` within the fenced block, or click-drag to select exactly the prompt contents.
- Open Copilot Chat (or the extension you use):
  - If using GitHub Copilot Chat: open the chat panel (`View → Open View → GitHub Copilot` or the Copilot icon), paste the prompt, and send.
  - If using the inline Copilot suggestions, paste the prompt into the chat box in the Copilot panel so the agent has context.
- Review the output carefully. Copy generated code into the correct project files (follow filenames specified in the prompt).

4) Running Prompts in “Copilot Agent” Mode
-----------------------------------------
- If you use an agent workflow (a Copilot-like agent that can create files), follow these steps:
  1. Create a single prompt that explains the agent's goals and gives explicit file paths to write. Example header:

     "You are an automated dev assistant with write access to the repository at /Users/e127423/Library/CloudStorage/OneDrive-Mastercard/Desktop/LTV-CAC. For TASK INFRA-002 produce files: `src/services/supabase/client.ts`, `src/services/supabase/auth.ts` ... Write complete TypeScript implementations."

  2. Paste the long prompt from the module into the agent and include explicit acceptance criteria and where files should be created.
  3. Let the agent run. When it returns code, validate it locally (run type checks, tests).

Note: Giving the agent explicit file paths and a short checklist improves reliability.

5) Example: Using the Supabase client prompt
-------------------------------------------
- Open `MODULE-01-INFRASTRUCTURE.md` and find the `AI Prompt for Cursor (Generate Supabase Client & Services)` block.
- Copy the entire prompt including the instructions that list file names and paths.
- Paste into Copilot Chat. Add a short instruction before the prompt: "Generate the files exactly as specified and return only the file contents with filenames."
- After the assistant returns files, create corresponding files in the repository. For example:

```bash
# create dirs (from project root)
mkdir -p POC1/ai-code-generator/src/services/supabase
mkdir -p POC1/ai-code-generator/src/types
```

- Paste each returned file content into the specified path. Save and run `npm run type-check` (or `tsc`) to verify types.

6) Tips For Reliable Outputs
---------------------------
- Keep prompts focused: run one task prompt at a time. Large multi-task prompts increase risk of missing pieces.
- Prefer explicit instructions: ask the assistant to return files with header lines (e.g., "--- FILE: path ---"). This makes it easier to split the output into files.
- Validate incrementally: after pasting a module's prompt ask for only the smallest subset (e.g., `client.ts`) and verify it builds before requesting `auth.ts`.
- Use the workspace context: mention relative repo root and exact file paths in your prompt so generated imports and paths are correct.
- Lock dependencies: specify exact package versions in prompts when generating install commands to avoid breaking changes.
- Avoid exposing secrets: never paste your `.env.local` secrets into the chat. Replace them with placeholders like `<SUPABASE_URL>`.

7) Copilot / Chat Setup Recommendations
-------------------------------------
- Use the latest Copilot extension and enable the chat/agent mode if available.
- Configure Copilot to have access to the workspace files (this is typically automatic for VS Code extensions). The agent will produce better code when it can reference actual repo files.
- Enable safety settings (don’t auto-commit without review).

8) How to Accept/Reject Generated Code
-------------------------------------
- Always run static checks first: `npm run lint`, `npm run type-check`, `npm test`.
- Run quick manual smoke tests for UI components if possible (e.g., `expo start` for React Native).
- Keep generated changes in a feature branch and create a PR for code review. Use CI to run tests and lint.

9) Common Pitfalls and How to Avoid Them
---------------------------------------
- Problem: Generated imports use different path aliases.
  Solution: Include `tsconfig` path aliases in the prompt or ask the assistant to respect `@/` aliases.

- Problem: Generated SQL contains environment-specific settings.
  Solution: Replace secrets/placeholders and run migrations only after reviewing.

- Problem: Assistant returns too much prose mixed with code.
  Solution: Prepend the prompt with: "Return only files in the following format: \n--- FILE: path ---\n<file contents>\n--- END FILE ---".

10) Recommended Prompt Patterns
-------------------------------
- File output wrapper:

  Return only files in this exact format:

  --- FILE: path/to/file.ext ---
  <file contents>
  --- END FILE ---

- Small-step pattern:
  1. "Generate file X" → validate locally
  2. "Generate file Y" → validate locally

- Test-first pattern:
  - Ask the assistant to produce unit tests first for a given module, then generate implementation to satisfy those tests.

11) Security & Compliance Notes
------------------------------
- Do not paste private keys or secrets into any chat window. Use placeholders and store secrets in `.env.local` or secret managers (EAS secrets, GitHub Secrets, Vercel env vars).
- When generating code that interacts with payments (Stripe), use `service_role` keys only server-side and never in mobile/desktop bundles.

12) Example Prompts (short)
---------------------------
- "Create `src/services/supabase/client.ts` with AsyncStorage auth persistence and return file contents only using the file wrapper format."
- "Generate a Supabase Edge Function `supabase/functions/cancel-trade/index.ts` that refunds Stripe payment and returns JSON. Return only file in wrapper format."

13) Appendix: Quick Commands
---------------------------
Run these from the project root (macOS / zsh):

```bash
# Type check
npm run type-check

# Lint
npm run lint

# Start Expo
expo start

# Run unit tests (if present)
npm test
```

14) Where I put the file
------------------------
- This guide is saved to:
  - `POC1/ai-code-generator/PROMPTS_USAGE_GUIDE.md`

15) Want me to do it for you?
----------------------------
- I can run these prompts inside the workspace and create files automatically. Reply with which task(s) you want me to generate and where to place them (I will create a feature branch and run basic checks).

---
End of PROMPTS USAGE GUIDE
