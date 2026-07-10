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
- Future quality tools should be added to `npm run verify` only after their initial baseline is stable.

## ADR-007: Use Vitest for Unit Test Automation

Status: Accepted

### Decision

The project will use Vitest for unit tests. Unit tests will be part of `npm run verify` and should initially focus on pure TypeScript behavior rather than Obsidian UI integration.

### Reason

Stage 2 introduced chat orchestration and provider request flow. These behaviors can regress without being caught by typechecking alone, but they are still small enough to test with fast unit tests and mocks.

### Consequences

- `npm run test` runs the unit test suite.
- `npm run verify` runs build checks and unit tests.
- New complex pure logic should include focused tests.
- Obsidian UI and manual vault smoke tests remain separate from Vitest until a reliable integration strategy is needed.

## ADR-008: Use ESLint for Static Code Quality Checks

Status: Accepted

### Decision

The project will use ESLint with the TypeScript ESLint recommended rules as a static quality gate. Linting is part of `npm run verify`.

### Reason

Stage 3 introduced more asynchronous and cross-module behavior around streaming and abort handling. TypeScript catches type errors, but ESLint can catch unused code, unsafe patterns, and import hygiene issues earlier in review.

### Consequences

- `npm run lint` runs ESLint over the repository.
- `npm run verify` runs lint, build, and unit tests.
- The initial rule set stays conservative and focuses on correctness and type-import hygiene.
- More opinionated style rules should be introduced separately, after the codebase has a clean baseline.

## ADR-009: Use Prettier for Formatting

Status: Accepted

### Decision

The project will use Prettier for automated formatting. Format checks are part of `npm run verify`.

### Reason

The codebase now has enough modules, tests, docs, and configuration files that formatting differences can create review noise. Prettier keeps formatting mechanical and lets ESLint focus on code quality rules.

### Consequences

- `npm run format` writes Prettier formatting changes.
- `npm run format:check` verifies formatting without writing files.
- `npm run verify` runs format checks, lint, build, and unit tests.
- Formatting-only changes should stay separate from feature work whenever possible.

## ADR-010: Persist Chat History in Plugin Data

Status: Accepted

### Decision

Chat sessions, the active session id, and message records will be persisted in Obsidian plugin data together with settings under a structured data envelope.

### Reason

Chat history belongs to the plugin rather than to user notes. Keeping it in plugin data avoids creating or modifying vault Markdown files, preserves the existing settings storage path, and makes session restore available after plugin reload.

### Consequences

- Plugin data uses separate `settings` and `chat` sections so saving one does not overwrite the other.
- Legacy flat settings data remains readable and is migrated to the envelope on the next save.
- Deleting a chat session removes only saved plugin chat history and does not touch vault content.
- Future persistence changes must preserve settings and chat data independently.

## ADR-011: Use Read-Only Keyword Search for Stage 7 Vault Context

Status: Accepted

### Decision

Stage 7 vault search will scan Markdown files on demand through Obsidian's vault APIs and convert keyword matches into `vault-search` context blocks.

### Reason

The stage goal is simple Vault-wide context, not a retrieval index. On-demand keyword search keeps the implementation read-only, avoids new persistence, and leaves semantic retrieval, chunking, vector storage, and file-change indexing for Stage 8.

### Consequences

- Vault search uses `Vault.getMarkdownFiles()` and `Vault.cachedRead()` through `VaultAdapter`.
- Search results are prompt context only; they do not create, edit, or index user notes.
- Large vault performance may be limited until Stage 8 introduces indexing and embedding retrieval.
- Editing commands keep vault search disabled and continue to use only explicit editor context.

## ADR-012: Persist the Embedding Index in Plugin Data

Status: Accepted

### Decision

Stage 8 semantic retrieval will store Markdown chunk metadata and embeddings in the plugin data envelope under a separate embedding index section.

### Reason

The embedding index belongs to the plugin and should not create or modify user Markdown notes. Keeping the first local vector store in plugin data reuses the existing persistence path, keeps Stage 8 dependency-free, and allows the index to travel with the rest of the plugin's local state.

### Consequences

- Semantic retrieval can rebuild stale entries from Markdown files when needed.
- Markdown modify, delete, and rename events update only plugin index data.
- The index may make plugin data larger for big vaults; a future stage may move the vector store to a separate plugin-owned file if size or performance requires it.
- Embedding retrieval remains opt-in because indexing can make network requests to the configured embedding provider.

## ADR-013: Use an Explicit, Controlled Agent Mode

Status: Accepted

### Decision

Tool calling will be available only in an explicit Agent mode that defaults back to ordinary Chat after plugin reload. Tools are registered behind provider-neutral interfaces, agent execution is sequential and bounded, and every note-writing tool requires a per-operation preview and confirmation before execution.

### Reason

Tool calling adds a new trust boundary: provider output can request local actions, but it must not gain unrestricted access to Obsidian or silently modify personal notes. A separate mode makes the capability visible, a registry limits the available operations, and per-write confirmation preserves user control.

### Consequences

- Ordinary Chat requests do not send tool definitions to the provider.
- Agent mode may use only registered tools and stops after a fixed number of provider rounds.
- Provider tool calls are treated as untrusted input and pass through JSON parsing and tool-specific validation.
- Read tools execute without confirmation, while every write tool must provide a user-visible preview and receive approval.
- Declined and failed tools return structured results to the provider rather than being hidden.
- Tool activity is stored with assistant chat messages so the execution process remains visible after reload.
- Obsidian APIs remain isolated in adapters and confirmation UI remains separate from tool business logic.
