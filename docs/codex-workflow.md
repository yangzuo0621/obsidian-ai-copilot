# Codex Workflow

This document defines how Codex should advance this project. It is intentionally procedural: follow it when the user asks to advance the next stage or implement a stage from the plan.

## Core Loop

1. Read `AGENTS.md`.
2. Read `docs/stage-status.md`.
3. Identify the current active stage.
4. Read the matching section in `docs/copilot-for-obsidian-implementation-plan.md`.
5. Check the git state with `git status --short --branch`.
6. Create or switch to a stage branch using the `codex/` prefix unless the user requested a different branch.
7. Implement only the active stage scope.
8. Run the verification commands listed for the stage.
9. Update `docs/stage-status.md`.
10. Update `docs/architecture-decisions.md` if an architecture decision changed or was added.
11. Commit the completed stage if verification passes.
12. Stop and report the result. Do not push or merge unless the user explicitly asks.

## Stage Discipline

- One stage per work cycle.
- Future stages are planning placeholders and may be revised before implementation.
- Completed stages should not be rewritten unless fixing a bug or explicitly requested.
- Current-stage scope may be clarified before or during implementation, but scope changes must be reflected in `docs/stage-status.md`.
- If verification fails, fix the issue or document the blocker. Do not mark the stage complete.

## Before Editing

Codex must:

- Confirm the active stage.
- Inspect relevant existing files.
- Check for unrelated user changes.
- Avoid broad refactors unless the stage requires them.

## During Implementation

Codex should:

- Prefer the module structure in the implementation plan.
- Add public types before wiring implementation details.
- Keep UI, provider, context, prompt, and Obsidian adapter responsibilities separate.
- Keep comments sparse and useful.
- Avoid hardcoded secrets, absolute user vault paths, and hidden network assumptions.

## Verification

Use the stage-specific verification section in `docs/stage-status.md`.

Automated verification should be runnable locally and in CI. The baseline command is:

```txt
npm run verify
```

Local smoke verification may depend on a developer machine or Obsidian vault, so it is documented separately and is not required in GitHub Actions. This includes commands such as:

```txt
npm run deploy:test
```

If a command cannot run because dependencies or project files do not exist yet, document that clearly in the stage notes. For example, Stage 0 creates the first build setup, so verification evolves during that stage.

## Pull Request Policy

- Stage and feature work should be merged through pull requests.
- Pull requests must pass the GitHub Actions verification workflow before merge.
- `main` should remain buildable at all times.
- CI runs automated verification only; local Obsidian smoke tests remain manual.
- PR titles must follow the Pull Request Title Rules in `AGENTS.md`.
- Do not push branches, create PRs, or merge unless the user explicitly asks.

## Commit Policy

Commit after:

- The active stage scope is implemented.
- Verification passed or an accepted limitation is documented.
- Stage status is updated.

Do not push unless the user explicitly asks.

Suggested commit style:

```txt
docs: add codex project controls
feat: scaffold obsidian plugin
feat: add settings and provider abstraction
fix: handle aborted stream state
```

## Stop Conditions

Stop and ask the user when:

- The stage requires a product or architecture decision not covered by docs.
- A destructive action would be needed.
- A secret, token, API key, or private account choice is required.
- Verification fails for reasons that cannot be resolved locally.
