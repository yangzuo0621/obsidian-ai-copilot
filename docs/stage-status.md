# Stage Status

This document is the project control panel. It tracks the active stage, what Codex is allowed to implement now, and how completion is verified.

Future stages are planning placeholders. They may be revised before implementation.

## Current Stage

Current stage: 9
Current status: completed

## Project Verification

Automated verification:

```txt
npm run verify
```

`npm run verify` is the baseline command for local checks and GitHub Actions. It currently runs typechecking and production build.
After the Vitest baseline, it also runs unit tests.
After the ESLint baseline, it also runs lint checks.
After the Prettier baseline, it also runs format checks.

Local smoke verification:

```txt
npm run deploy:test
npm run deploy:test -- <test-vault>/.obsidian/plugins
```

Local smoke verification depends on an Obsidian test vault and is not required in GitHub Actions.

## Stage Checklist

- [x] Stage 0: Project scaffold
- [x] Stage 1: Settings and provider abstraction
- [x] Stage 2: Vault Loom sidebar and basic chat
- [x] Stage 3: Streaming and abort
- [x] Stage 4: Current note and selection context
- [x] Stage 5: Editing commands
- [x] Stage 6: Chat history persistence
- [x] Stage 7: Vault search context
- [x] Stage 8: Embedding retrieval
- [x] Stage 9: Tools and agent mode

## Stage 0: Project Scaffold

Status: completed

### Goal

Create the minimum Obsidian plugin project skeleton that can build and be loaded by Obsidian.

### Scope

- Create `package.json`.
- Create `manifest.json`.
- Create `tsconfig.json`.
- Create `esbuild.config.mjs`.
- Create `src/main.ts`.
- Create `styles.css`.
- Add basic npm scripts.
- Add one simple command to confirm the plugin loaded.
- Keep the project compatible with future TypeScript module structure.

### Out of Scope

- No settings UI.
- No provider implementation.
- No chat sidebar.
- No streaming.
- No context builder.
- No vault search.
- No editing commands beyond a minimal load/test command.

### Likely Files

- `package.json`
- `manifest.json`
- `tsconfig.json`
- `esbuild.config.mjs`
- `src/main.ts`
- `styles.css`
- `.gitignore`
- `docs/stage-status.md`

### Completion Criteria

- `npm install` or the selected package manager install succeeds.
- `npm run build` succeeds.
- Build output includes `main.js`.
- Obsidian manifest has a stable plugin id.
- `docs/stage-status.md` is updated after completion.

### Verification

Automated verification:

```txt
npm run verify
```

Local smoke verification:

```txt
npm run deploy:test
npm run deploy:test -- <test-vault>/.obsidian/plugins
git status --short --branch
```

Manual verification after copying to a vault plugin folder:

```txt
Obsidian can enable the plugin.
The test command appears in the command palette.
Running the test command shows a Notice.
```

Manual smoke test steps:

```txt
1. Run `npm run deploy:test`.
2. Restart or reload Obsidian.
3. Open Settings -> Community plugins.
4. Enable `Vault Loom`.
5. Confirm the plugin loads without an error notice.
```

Local configuration:

```txt
Create `.env.local` with:
OBSIDIAN_PLUGINS_DIR=<test-vault>/.obsidian/plugins
```

Override example:

```powershell
npm run deploy:test -- "<test-vault>/.obsidian/plugins"
```

### Notes

- Stage 0 initially used a development-only plugin id; marketplace preparation later changed it to `vault-loom` before the first public release.
- Avoid introducing UI frameworks at this stage.
- Avoid implementing any AI provider code in this stage.
- Stage 0 uses the standard Obsidian plugin skeleton with npm, esbuild, and TypeScript.
- Code style baseline: strict TypeScript, small modules, no UI framework, sparse comments.
- Automated verification should run before review: `npm install`, `npm run build`, `npm run deploy:test`, and `git status --short --branch`.
- Manual Obsidian smoke test passed on 2026-07-06.
- Review passed on 2026-07-06.
- The scaffold-only load notice command was removed during marketplace preparation.

## Stage 1: Settings and Provider Abstraction

Status: completed

### Goal

Add plugin settings and the first model provider abstraction.

### Scope

- Settings types and defaults.
- Settings tab.
- `LLMProvider` interface.
- OpenAI-compatible provider with non-streaming request.
- Provider test command.

### Out of Scope

- No chat sidebar.
- No streaming.
- No context builder.

### Files

- `src/main.ts`
- `src/settings/types.ts`
- `src/settings/defaults.ts`
- `src/settings/SettingsTab.ts`
- `src/providers/types.ts`
- `src/providers/OpenAICompatibleProvider.ts`
- `src/providers/ProviderFactory.ts`
- `docs/stage-status.md`

### Completion Criteria

- Plugin data stores provider settings through Obsidian's `loadData()` and `saveData()`.
- Settings tab allows editing API key, base URL, model, temperature, and context token budget.
- Provider logic is behind `LLMProvider` and does not depend on Obsidian APIs.
- OpenAI-compatible provider can send a non-streaming chat completions request.
- Command palette includes `Test provider`.

### Verification

Automated verification:

```txt
npm run verify
```

Local smoke verification:

```txt
npm run deploy:test
git status --short --branch
```

Manual verification after copying to a vault plugin folder:

```txt
Obsidian shows the plugin settings tab.
Settings can be edited and persist after closing settings.
Running `Test provider` sends one non-streaming provider request.
The command shows a success or failure Notice.
```

### Notes

- Stage 1 intentionally uses `fetch` instead of a provider SDK to avoid a large dependency.
- API keys are never hardcoded and are only stored in Obsidian plugin data.
- The context token budget is stored for future stages but no note context is injected yet.
- Streaming remains deferred to Stage 3.

## Stage 2: Vault Loom Sidebar and Basic Chat

Status: completed

### Goal

Add a usable Vault Loom sidebar with basic non-streaming chat.

### Scope

- Register Copilot view.
- Render message list and composer.
- Add in-memory chat session.
- Wire `ChatService.sendMessage()`.

### Out of Scope

- No streaming.
- No context injection beyond plain user input.

### Files

- `src/main.ts`
- `src/chat/types.ts`
- `src/chat/ChatSession.ts`
- `src/chat/ChatService.ts`
- `src/ui/CopilotView.ts`
- `styles.css`
- `docs/stage-status.md`

### Completion Criteria

- Command palette includes `Open chat`.
- The Vault Loom sidebar can be opened from the command palette or ribbon icon.
- The sidebar renders an in-memory message list and composer.
- Sending a message calls the configured provider through `ChatService.sendMessage()`.
- The assistant response or provider error is displayed in the sidebar.
- Chat state is intentionally in-memory only.

### Verification

Automated verification:

```txt
npm run verify
```

Local smoke verification:

```txt
npm run deploy:test
git status --short --branch
```

Manual verification after copying to a vault plugin folder:

```txt
Obsidian can open `Open chat` from the command palette.
The ribbon icon opens the same Vault Loom sidebar.
Typing a message and clicking Send sends one non-streaming provider request.
The user message and assistant response appear in the sidebar.
Provider failures render as an error message in the sidebar and show a Notice.
```

### Notes

- Stage 2 uses the existing OpenAI-compatible non-streaming provider.
- UI code calls `ChatService` rather than model providers directly.
- Plain chat history is sent as provider messages, but no note context is injected.
- Streaming, cancellation, and persisted sessions remain deferred to later stages.

## Stage 3: Streaming and Abort

Status: completed

### Goal

Support token-by-token assistant responses and stop generation.

### Summary Scope

- Provider streaming method.
- Stream controller.
- Abort manager.
- UI stop button and streaming state.

### Files

- `src/providers/types.ts`
- `src/providers/OpenAICompatibleProvider.ts`
- `src/streaming/AbortManager.ts`
- `src/streaming/StreamController.ts`
- `src/chat/types.ts`
- `src/chat/ChatService.ts`
- `src/ui/CopilotView.ts`
- `styles.css`
- `docs/stage-status.md`

### Completion Criteria

- OpenAI-compatible provider can send streaming chat completions requests.
- Streaming responses append assistant tokens incrementally.
- Active streaming requests can be stopped through the Vault Loom sidebar.
- Stopped requests restore the UI to an idle state and mark the assistant message as stopped.
- Streaming and abort behavior are covered by focused unit tests.

### Verification

Automated verification:

```txt
npm run verify
```

Local smoke verification:

```txt
npm run deploy:test
git status --short --branch
```

Manual verification after copying to a vault plugin folder:

```txt
Obsidian can open `Open chat`.
Typing a message streams the assistant response into the latest assistant message.
Clicking Stop cancels the active request.
After Stop, the composer returns to an idle state and the assistant message is marked Stopped.
Provider streaming failures render as an error message in the sidebar and show a Notice.
```

### Notes

- Stage 3 keeps chat history in memory only.
- Stage 3 does not add note, selection, or vault context.
- Provider streaming uses OpenAI-compatible chat completions SSE chunks and `AbortSignal` cancellation.
- Automated verification passed on 2026-07-08.

## Stage 4: Current Note and Selection Context

Status: completed

### Goal

Inject structured context from the current Obsidian editor.

### Summary Scope

- Obsidian adapters.
- Selection context.
- Current file context.
- Context builder.
- Context budget.
- Prompt composer.
- Context preview.

### Files

- `src/obsidian/WorkspaceAdapter.ts`
- `src/obsidian/EditorAdapter.ts`
- `src/obsidian/VaultAdapter.ts`
- `src/obsidian/CurrentFileAdapter.ts`
- `src/context/types.ts`
- `src/context/tokenEstimate.ts`
- `src/context/SelectionContext.ts`
- `src/context/CurrentFileContext.ts`
- `src/context/ContextBuilder.ts`
- `src/context/ContextBudget.ts`
- `src/prompts/PromptComposer.ts`
- `src/prompts/systemPrompts.ts`
- `src/chat/ChatService.ts`
- `src/chat/types.ts`
- `src/ui/CopilotView.ts`
- `src/settings/types.ts`
- `src/settings/defaults.ts`
- `src/settings/SettingsTab.ts`
- `styles.css`
- `docs/stage-status.md`

### Completion Criteria

- Current editor selection is collected as the highest-priority structured context when present.
- Current file content is collected as structured context when there is no selection.
- Context blocks pass through the configured context token budget before prompt composition.
- Provider requests are composed by `PromptComposer` instead of ad hoc provider message assembly.
- The Vault Loom sidebar shows a context preview for the context attached to the latest request.
- Context behavior is covered by focused unit tests.

### Verification

Automated verification:

```txt
npm run verify
```

Local smoke verification:

```txt
npm run deploy:test
git status --short --branch
```

Manual verification after copying to a vault plugin folder:

```txt
Obsidian can open `Open chat`.
Selecting text in the active Markdown editor shows Selection in the context preview after sending a chat message.
Sending a chat message without selected text shows Current file in the context preview when an active note is open.
The assistant response streams normally and Stop still cancels the active request.
Disabling selection or current file context in settings prevents that context type from being attached.
```

### Notes

- Stage 4 remains read-only. It does not add editing commands or write note content.
- Selection context takes precedence over current file context.
- Selection context records one-based editor line ranges and shows them in the context preview.
- Current file context uses active Markdown view data when available so unsaved editor content can be included.
- Selection context reads Obsidian `workspace.activeEditor` before falling back to the active or most recent Markdown view, so sidebar focus does not discard the editor selection.
- Automated verification passed on 2026-07-08.
- Local test vault deployment passed on 2026-07-08.

## Stage 5: Editing Commands

Status: completed

### Goal

Add Obsidian-native writing commands.

### Summary Scope

- Explain selection.
- Rewrite selection.
- Summarize current note.
- Insert or replace editor text with explicit user action.

### Files

- `src/main.ts`
- `src/commands/EditingCommandService.ts`
- `src/commands/EditingCommandService.test.ts`
- `src/commands/registerCommands.ts`
- `src/obsidian/EditorAdapter.ts`
- `src/obsidian/EditorAdapter.test.ts`
- `src/prompts/commandPrompts.ts`
- `src/prompts/PromptComposer.ts`
- `src/prompts/PromptComposer.test.ts`
- `docs/stage-status.md`

### Completion Criteria

- Command palette includes `Explain selection`.
- Command palette includes `Rewrite selection`.
- Command palette includes `Summarize current note`.
- Selection commands require active selected editor text.
- Explain selection inserts the generated explanation through the editor adapter.
- Rewrite selection replaces the current selection through the editor adapter.
- Summarize current note inserts the generated summary through the editor adapter.
- Editing command prompts are composed separately from provider execution.
- Editing command behavior is covered by focused unit tests.

### Verification

Automated verification:

```txt
npm run verify
```

Local smoke verification:

```txt
npm run deploy:test
git status --short --branch
```

Manual verification after copying to a vault plugin folder:

```txt
Obsidian can run `Explain selection` from the command palette when text is selected.
Running `Explain selection` inserts an explanation into the active editor.
Running `Rewrite selection` replaces the selected text with the rewritten result.
Running `Summarize current note` inserts a summary into the active editor.
Running a selection command without selected text shows a Notice and does not call the provider.
Provider failures show a Notice and do not write generated text.
```

### Notes

- Stage 5 uses explicit command palette actions as the user confirmation boundary for editor writes.
- Provider calls still go through the provider abstraction and receive composed prompts.
- Editor writes are centralized through `EditorAdapter`.
- Stage 5 does not add autonomous note-writing tools, diff previews, chat persistence, vault search, or agent mode.
- Automated verification passed on 2026-07-09.

## Stage 6: Chat History Persistence

Status: completed

### Goal

Persist and restore chat sessions.

### Summary Scope

- Chat store.
- Session list.
- Create, switch, and delete sessions.

### Files

- `src/main.ts`
- `src/chat/types.ts`
- `src/chat/ChatStore.ts`
- `src/chat/ChatStore.test.ts`
- `src/chat/ChatService.ts`
- `src/chat/ChatService.test.ts`
- `src/ui/CopilotView.ts`
- `styles.css`
- `docs/stage-status.md`
- `docs/architecture-decisions.md`

### Completion Criteria

- Chat sessions are saved in Obsidian plugin data.
- Plugin data stores settings and chat history without overwriting either section.
- Plugin reload restores the active session and saved messages.
- The Vault Loom sidebar can create, switch, and delete chat sessions.
- Session histories remain isolated from each other.
- Streaming responses continue to update the session and message that started the request.
- Chat persistence behavior is covered by focused unit tests.

### Verification

Automated verification:

```txt
npm run verify
```

Local smoke verification:

```txt
npm run deploy:test
git status --short --branch
```

Manual verification after copying to a vault plugin folder:

```txt
Obsidian can open `Open chat`.
Sending a chat message saves it to the active session.
Clicking New creates an empty session and switches to it.
The session selector switches between saved sessions without mixing messages.
Clicking Delete removes the current saved session after confirmation.
Reloading Obsidian restores the saved sessions, active session, and messages.
Streaming, Stop, context preview, and provider errors still behave as before.
```

### Notes

- Stage 6 stores chat history in Obsidian plugin data alongside settings, not in user notes.
- Existing flat settings data is still accepted and is migrated to the settings/chat envelope on the next save.
- Deleting a chat session removes only plugin chat history, not vault content.
- Automated verification passed on 2026-07-09.

## Stage 7: Vault Search Context

Status: completed

### Goal

Add simple Vault-wide keyword search context.

### Summary Scope

- Search service.
- Markdown file scan.
- Search results as context blocks.
- Budgeted prompt injection.

### Files

- `src/obsidian/VaultAdapter.ts`
- `src/retrieval/SearchService.ts`
- `src/retrieval/SearchService.test.ts`
- `src/context/types.ts`
- `src/context/ContextBuilder.ts`
- `src/context/ContextBuilder.test.ts`
- `src/context/VaultSearchContext.ts`
- `src/context/VaultSearchContext.test.ts`
- `src/chat/ChatService.ts`
- `src/chat/ChatService.test.ts`
- `src/commands/EditingCommandService.ts`
- `src/commands/EditingCommandService.test.ts`
- `src/settings/types.ts`
- `src/settings/defaults.ts`
- `src/settings/SettingsTab.ts`
- `src/ui/CopilotView.ts`
- `docs/stage-status.md`
- `docs/architecture-decisions.md`

### Completion Criteria

- Vault search can be enabled or disabled in settings.
- Chat messages pass the user's question to the context builder for keyword search.
- Markdown files are listed and read through `VaultAdapter`.
- Keyword search matches Markdown file names and note contents.
- Search results are converted to `vault-search` context blocks with source paths and line ranges.
- Search results pass through `ContextBudget` before prompt composition.
- The Vault Loom sidebar context preview labels search results as Vault search.
- Vault search behavior is covered by focused unit tests.

### Verification

Automated verification:

```txt
npm run verify
```

Local smoke verification:

```txt
npm run deploy:test
git status --short --branch
```

Manual verification after copying to a vault plugin folder:

```txt
Obsidian can open `Open chat`.
With vault search enabled, asking about a keyword that appears in another Markdown note shows Vault search in the context preview.
The preview shows the matching note path and line range.
Disabling vault search in settings prevents vault search context from being attached.
Selection and current file context still appear with higher priority when enabled.
Streaming, Stop, chat persistence, and provider errors still behave as before.
```

### Notes

- Stage 7 uses read-only Markdown scanning through Obsidian's `getMarkdownFiles()` and `cachedRead()`.
- Search is keyword-based over file names and note contents; semantic retrieval remains deferred to Stage 8.
- Vault search context is lower priority than selection and current file context and is clipped by the existing context budget.
- Editing commands explicitly disable vault search so note-writing commands remain scoped to editor context.
- Automated verification passed on 2026-07-09.
- Local test vault deployment passed on 2026-07-09.

## Stage 8: Embedding Retrieval

Status: completed

### Goal

Add semantic retrieval for larger vaults.

### Summary Scope

- Markdown chunking.
- Embedding provider.
- Local vector store.
- Index refresh on file changes.

### Files

- `src/main.ts`
- `src/settings/types.ts`
- `src/settings/defaults.ts`
- `src/settings/SettingsTab.ts`
- `src/context/types.ts`
- `src/context/ContextBuilder.ts`
- `src/context/SemanticSearchContext.ts`
- `src/context/SemanticSearchContext.test.ts`
- `src/retrieval/MarkdownChunker.ts`
- `src/retrieval/MarkdownChunker.test.ts`
- `src/retrieval/EmbeddingProvider.ts`
- `src/retrieval/EmbeddingIndexService.ts`
- `src/retrieval/EmbeddingIndexService.test.ts`
- `src/retrieval/VectorStore.ts`
- `src/retrieval/VectorStore.test.ts`
- `src/chat/ChatService.ts`
- `src/chat/ChatService.test.ts`
- `src/commands/EditingCommandService.ts`
- `src/commands/EditingCommandService.test.ts`
- `src/ui/CopilotView.ts`
- `docs/stage-status.md`
- `docs/architecture-decisions.md`

### Completion Criteria

- Markdown notes are split into line-aware chunks for semantic indexing.
- OpenAI-compatible embedding requests are behind a retrieval provider abstraction.
- Embeddings are stored in a local plugin-data vector store with chunk metadata.
- Chat context can include semantic retrieval blocks when embedding retrieval is enabled.
- Semantic search results remain structured `ContextBlock` data and pass through `ContextBudget`.
- The Vault Loom sidebar labels semantic retrieval context as Semantic search.
- Markdown file modify, delete, and rename events refresh or remove affected index entries.
- Editing commands keep embedding retrieval disabled and remain scoped to explicit editor context.
- Embedding retrieval behavior is covered by focused unit tests.

### Verification

Automated verification:

```txt
npm run verify
```

Local smoke verification:

```txt
npm run deploy:test
git status --short --branch
```

Manual verification after copying to a vault plugin folder:

```txt
Obsidian can open `Open chat`.
With embedding retrieval enabled and an embedding model configured, asking about a semantically related topic shows Semantic search in the context preview.
The preview shows the matching note path and line range.
Editing or renaming a Markdown note refreshes the semantic index for that note.
Deleting a Markdown note removes its semantic chunks from the index.
Disabling embedding retrieval prevents semantic search context from being attached.
Keyword vault search, selection context, current file context, streaming, Stop, and chat persistence still behave as before.
```

### Notes

- Embedding retrieval is disabled by default so existing chat behavior does not start making embedding requests unexpectedly.
- Stage 8 uses the configured OpenAI-compatible base URL and API key with a separate embedding model setting.
- The vector index is persisted in Obsidian plugin data, not user Markdown notes.
- Semantic retrieval context has lower priority than selection and current file context and slightly higher priority than keyword vault search.
- Editing commands explicitly disable semantic retrieval so note-writing commands remain scoped to editor context.
- Automated verification passed on 2026-07-09.

## Stage 9: Tools and Agent Mode

Status: completed

### Goal

Allow the assistant to call controlled Obsidian tools.

### Summary Scope

- Tool interface.
- Tool registry.
- Read/search tools.
- Confirmed note-writing tools.
- Agent runner.

### Scope

- Add an explicit Chat/Agent mode selector that defaults to Chat.
- Add provider-neutral tool definitions, tool calls, assistant tool-call messages, and tool result messages.
- Reconstruct streamed OpenAI-compatible tool calls by tool-call index.
- Add a bounded, cancellable multi-round agent runner.
- Add `search_vault`, `read_note`, `create_note`, `append_to_note`, and `replace_selection` tools.
- Keep Obsidian API access behind vault and editor adapters.
- Require a per-operation preview and confirmation before every note-writing tool.
- Show and persist tool input, status, result, decline, and error activity with the assistant message.

### Out of Scope

- No delete, move, or rename tools.
- No arbitrary filesystem, shell, or network tools.
- No unconfirmed or background note writes.
- No provider implementations beyond the existing OpenAI-compatible provider.
- No parallel write execution, batch approvals, or long-running autonomous agents.

### Files

- `src/agent/AgentRunner.ts`
- `src/tools/types.ts`
- `src/tools/ToolRegistry.ts`
- `src/tools/BuiltinTools.ts`
- `src/providers/types.ts`
- `src/providers/OpenAICompatibleProvider.ts`
- `src/obsidian/VaultAdapter.ts`
- `src/chat/types.ts`
- `src/chat/ChatStore.ts`
- `src/chat/ChatService.ts`
- `src/prompts/PromptComposer.ts`
- `src/prompts/systemPrompts.ts`
- `src/ui/CopilotView.ts`
- `src/ui/ToolConfirmationModal.ts`
- `src/main.ts`
- `styles.css`
- Focused unit tests for provider tool streaming, the tool registry, built-in tools, the agent runner, chat integration, and persistence.

### Completion Criteria

- Agent mode can call `search_vault` and `read_note` and return results to the provider for another round.
- `create_note`, `append_to_note`, and `replace_selection` cannot run before explicit user confirmation.
- Declined writes do not modify the vault and are returned to the model as declined tool results.
- Tool activity is visible in the Vault Loom sidebar and survives chat persistence.
- Stop cancels the active provider or agent request and prevents later tool rounds.
- Agent execution stops at a fixed round limit.
- Ordinary Chat mode remains the default and does not expose tools to the provider.

### Verification

Automated verification:

```txt
npm run verify
```

Local smoke verification:

```txt
npm run deploy:test
git status --short --branch
```

Manual verification after copying to a vault plugin folder:

```txt
Chat mode continues to stream ordinary responses without tool definitions.
Agent mode can search the vault and read a selected Markdown note while showing tool activity.
Creating or appending to a note opens a preview modal and changes the vault only after approval.
Replacing a selection opens a preview modal and changes only the active selection after approval.
Canceling any write confirmation leaves the note unchanged and shows the tool as declined.
Clicking Stop ends the active agent request and prevents later tool calls.
Reloading the plugin restores completed tool activity in chat history while defaulting back to Chat mode.
```

### Notes

- Agent mode is deliberately explicit and is not persisted, so plugin reloads return to safer ordinary Chat mode.
- The runner executes tool calls sequentially and stops after six provider rounds.
- Vault paths are normalized, remain vault-relative, reject parent traversal, and gain a `.md` extension when omitted.
- `create_note` refuses to overwrite any existing vault item and creates missing parent folders.
- `append_to_note` uses `Vault.process()` for an atomic background edit; `replace_selection` uses the active Editor API.
- OpenAI-compatible streamed tool-call name and argument fragments are accumulated by call index before execution.
- Automated verification passed on 2026-07-10 with 20 test files and 73 tests.
- Local test vault deployment passed on 2026-07-10.

## Marketplace Release Preparation

Status: automated preparation completed; manual release pending

### Scope

- Adopt the public name `Vault Loom` and stable plugin id `vault-loom`.
- Prepare version `1.0.0` with minimum Obsidian version `1.12.7`.
- Keep the first release desktop-only until mobile verification is complete.
- Add the MIT license and `versions.json` compatibility mapping.
- Add version alignment and required-asset release checks.
- Add a tag-driven GitHub Actions workflow that creates a Draft Release.
- Document the manual smoke test, release, and initial directory submission steps.

### Verification

Automated verification:

```txt
npm run verify
npm run release:check -- 1.0.0
```

Manual verification and submission remain tracked in `docs/releasing.md`.

### Notes

- The marketplace id omits `obsidian` to comply with new-plugin submission rules.
- `AI Copilot` and `copilot` were already present in the Community Plugins directory, so the public brand was changed before the first release.
- Release tags must exactly match the manifest version and must not use a `v` prefix.
