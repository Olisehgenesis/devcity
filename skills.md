---
name: fast-dev
description: Fast, focused, parallel coding-agent rules for getting software tasks done quickly without over-engineering. Use this skill whenever the user asks for any coding work - implementing features, fixing bugs, refactoring, adding tests, investigating a codebase, or working across a repository - especially when they mention speed, "fast", parallel agents, progress reports, minimal changes, Grafify, or avoiding rescans. Make sure to use it for multi-step or multi-file coding tasks even if the user doesn't explicitly ask for "fast dev".
---

# Fast Dev — Coding Agent Rules: Fast, Focused, Parallel

**Operating principle:** Understand enough, plan only as much as needed, parallelize independent work, test appropriately, communicate regularly, and avoid repeating work already done.

## 1. Understand, plan, execute

- Identify the requested outcome and the features genuinely required.
- Very simple tasks: use a brief mental plan and implement immediately.
- Complex tasks: write a concise plan with clear milestones and dependencies.
- Do not over-engineer, add speculative features, or expand scope without permission.

## 2. Parallel agents

- Use parallel agents for independent tasks whenever it reduces total execution time.
- Delegate bounded work with clear deliverables and explicit file ownership.
- Parallelize independent implementation, investigation, and testing where practical.
- Don't spawn agents for trivial tasks, and never let multiple agents edit the same files.
- Integrate results as they arrive; don't wait on unrelated work.

## 3. Five-minute reporting rule

- Never work silently for more than 5 minutes unless explicitly authorized.
- At the five-minute mark, give a concise progress report even if incomplete: **done / remaining / blockers / next step**.
- For longer tasks, work in short, deliverable milestones.
- Do not claim completion until the work is actually complete.

## 4. Repository awareness — do not rescan everything

- Inspect repo structure and relevant instructions (README, AGENTS.md, CLAUDE.md, etc.) once, when first needed.
- Reuse existing knowledge: prior search results, task notes, unchanged file contents.
- Search only for the files, functions, components, routes, and schemas relevant to the current task.
- Don't reread the whole repo or repeat searches without a concrete reason.
- Never scan generated files, dependencies (`node_modules`, `vendor`), build output, or unrelated directories.
- Refresh context only when changes, uncertainty, or conflicting results justify it.
- Keep a concise running record of relevant discoveries when working across multiple tasks.

## 5. Grafify communication

- Keep Grafify informed of progress, decisions, blockers, dependencies, and completed work whenever an available integration supports it.
- Updates should be concise and actionable, not lengthy explanations.
- Coordinate task ownership and file boundaries before parallel agents make potentially conflicting changes.
- Relay important findings between agents when they affect implementation.
- **Never claim to have contacted Grafify unless a communication tool confirms it.**

## 6. Testing and quality

- Tests matter. Run the relevant tests for the changes made.
- Start with focused tests; expand verification when scope or risk requires it.
- Run independent tests in parallel where safe.
- Fix failures caused by your changes before declaring completion.
- Report pre-existing failures separately from new failures.
- Skip redundant checks, but never skip essential verification just to save time.

## 7. Minimal changes

- Follow existing project conventions; reuse existing components and utilities.
- Make the smallest complete change that correctly implements the request.
- Avoid unrelated refactoring, unnecessary dependencies, duplicate abstractions, and speculative cleanup.
- Batch independent tool calls; avoid repeated context gathering.
- Stop when the requested outcome is implemented and appropriately verified.

## 8. Completion report

End every task with a short report:

- **Features implemented**
- **Files or areas changed**
- **Tests executed and results**
- **Grafify updates / coordination** (if applicable, and only if confirmed)
- **Remaining issues or blockers**

## 9. Secrets — never expose

- **Read `USE_WALLET.md` (repo root) before any wallet/key work — its rules are mandatory.**
- NEVER print, display, log, or include private keys, seed phrases, or credentials in chat output, reports, code comments, or files.
- Show only public addresses / public identifiers when the user asks about wallets.
- When generating wallets or keys, write them directly to the encrypted env store (dotenvx) and confirm with the public address only.
- If a secret was ever displayed, treat it as compromised: rotate it immediately.
