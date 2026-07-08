# AGENTS.md

## Project

This repository implements an Obsidian AI copilot plugin. The project is developed in stages so the codebase stays buildable, reviewable, and easy to reason about.

## Required Reading

Before implementing a stage, read:

- `docs/codex-workflow.md`
- `docs/stage-status.md`
- `docs/copilot-for-obsidian-implementation-plan.md`
- `docs/architecture-decisions.md` when the change touches architecture boundaries

## Working Rules

- Work on one stage at a time.
- Do not implement future-stage features unless explicitly requested.
- Do stage and feature work on a branch, not directly on `main`.
- Merge stage and feature work through pull requests after CI passes.
- On Windows, prefer PowerShell 7 (`pwsh`) for project commands when available.
- Keep changes scoped to the active stage.
- Prefer clear interfaces and types before implementation.
- Keep `main` buildable.
- Run the documented verification steps before committing.
- Update project docs after completing a stage.
- Commit after successful verification unless the user says not to.
- Do not push unless explicitly requested.

## Architecture Rules

- UI code must not call model providers directly.
- Provider code must not depend on Obsidian APIs.
- Obsidian API usage should go through adapter modules.
- Context must be represented as structured blocks before prompt composition.
- Prompt composition must be separate from provider execution.
- Streaming must support cancellation.
- Note-writing operations require explicit user confirmation.

## Git Rules

- Keep commits small and stage-focused.
- Use branch names with the `codex/` prefix unless the user asks for another name.
- Do not merge directly to `main`; prepare changes for PR review.
- Do not rewrite history unless explicitly requested.
- Do not commit `.agents/`, `work/`, secrets, API keys, or local machine state.
- Check `git status --short --branch` before and after edits.

## Pull Request Title Rules

PR titles must follow Conventional Commits:

```txt
<type>(<scope>): <imperative summary>
```

Examples:

```txt
feat(stage-2): add copilot sidebar chat
fix(chat): initialize copilot view reliably
docs(stage-2): update stage status
chore(ci): add verification workflow
```

Rules:

- Use `feat`, `fix`, `docs`, `test`, `refactor`, or `chore`.
- Use `stage-N` as the scope for stage work.
- Use a short imperative summary.
- Use lowercase summary text.
- Do not end with a period.
- Avoid titles like `Stage 2: ...`; prefer `feat(stage-2): ...`.

## Safety

- Never hardcode API keys.
- Never automatically modify user notes without confirmation.
- Do not introduce large dependencies without explaining why they are needed.
- Prefer the existing implementation plan over ad hoc architecture changes.
