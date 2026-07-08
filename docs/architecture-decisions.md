# Architecture Decisions

This document records durable architecture decisions. Add an ADR whenever the project makes a decision that affects module boundaries, dependencies, persistence, safety, or user-facing behavior.

## ADR-001: Build the Plugin in Explicit Stages

Status: Accepted

### Decision

The project will be implemented stage by stage. Codex should complete one stage, verify it, update status docs, commit, and stop.

### Reason

The plugin touches many domains: Obsidian APIs, model providers, streaming, context construction, retrieval, UI state, and future agent tools. Stage-based work keeps the project reviewable and prevents unrelated features from blending together.

### Consequences

- Future-stage functionality is intentionally deferred.
- Stage scope must be documented before implementation.
- The main branch should remain buildable after each completed stage.

## ADR-002: Separate Provider Logic from UI and Obsidian APIs

Status: Accepted

### Decision

Model providers will live behind a provider interface. UI and Obsidian adapter code must not call model SDKs directly.

### Reason

The project should support OpenAI-compatible APIs first and later allow Anthropic, Gemini, Ollama, OpenRouter, or other providers without rewriting UI and context logic.

### Consequences

- Provider modules receive standard completion requests.
- Provider modules do not know about vault files, editors, or Obsidian leaves.
- Chat orchestration composes context and prompts before calling providers.

## ADR-003: Represent Context as Structured Blocks

Status: Accepted

### Decision

All note, selection, search, and manual context must be represented as `ContextBlock`-style structured data before prompt composition.

### Reason

Structured context allows prioritization, token budgeting, source display, and safer prompt composition. It avoids uncontrolled long-string prompt assembly.

### Consequences

- Context collection and prompt composition are separate modules.
- Each block should have a type, title, content, priority, estimated token count, and optional source path.
- Long context must pass through a budget step before being sent to a model.

## ADR-004: Streaming Must Support Cancellation

Status: Accepted

### Decision

Streaming is a core behavior and must be implemented with explicit cancellation support.

### Reason

AI responses can be slow, expensive, or no longer relevant after the user changes context. Users need a reliable stop action.

### Consequences

- Streaming requests should use `AbortController` or an equivalent cancellation primitive.
- UI state must distinguish pending, streaming, done, aborted, and error states where needed.
- Token updates should target a specific session and message id to avoid cross-session state corruption.

## ADR-005: Note-Writing Actions Require Confirmation

Status: Accepted

### Decision

Any operation that writes to user notes must require an explicit user action or confirmation.

### Reason

Obsidian vaults are personal knowledge bases. Silent or autonomous writes can cause data loss or unwanted edits.

### Consequences

- Early stages may insert or replace text only through explicit editor commands.
- Future agent tools that write files must include confirmation or preview.
- Read-only capabilities should be implemented before autonomous write tools.

## ADR-006: Verify Changes Through Pull Requests and CI

Status: Accepted

### Decision

Stage and feature changes will be developed on branches, reviewed through pull requests, and merged only after the GitHub Actions verification workflow passes.

### Reason

The project is intentionally stage-based and should keep `main` buildable. A shared `npm run verify` command gives local development and CI the same automated quality gate while keeping machine-specific Obsidian smoke tests separate.

### Consequences

- Stage work should use `codex/` branches unless another branch name is requested.
- Pull requests are the default path for merging to `main`.
- CI runs automated verification and does not run local vault deployment commands.
- Future quality tools such as Vitest or ESLint should be added to `npm run verify` only after their initial baseline is stable.
