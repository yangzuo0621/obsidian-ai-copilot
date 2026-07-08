# Stage Status

This document is the project control panel. It tracks the active stage, what Codex is allowed to implement now, and how completion is verified.

Future stages are planning placeholders. They may be revised before implementation.

## Current Stage

Current stage: 3
Current status: completed

## Project Verification

Automated verification:

```txt
npm run verify
```

`npm run verify` is the baseline command for local checks and GitHub Actions. It currently runs typechecking and production build.
After the Vitest baseline, it also runs unit tests.

Local smoke verification:

```txt
npm run deploy:test
npm run deploy:test -- <test-vault>/.obsidian/plugins
```

Local smoke verification depends on an Obsidian test vault and is not required in GitHub Actions.

## Stage Checklist

- [x] Stage 0: Project scaffold
- [x] Stage 1: Settings and provider abstraction
- [x] Stage 2: Copilot sidebar and basic chat
- [x] Stage 3: Streaming and abort
- [ ] Stage 4: Current note and selection context
- [ ] Stage 5: Editing commands
- [ ] Stage 6: Chat history persistence
- [ ] Stage 7: Vault search context
- [ ] Stage 8: Embedding retrieval
- [ ] Stage 9: Tools and agent mode

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
4. Enable `Obsidian AI Copilot`.
5. Open the command palette and run `Show load notice`.
6. Confirm a Notice appears.
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

- Use a conservative plugin id, likely `obsidian-ai-copilot`.
- Avoid introducing UI frameworks at this stage.
- Avoid implementing any AI provider code in this stage.
- Stage 0 uses the standard Obsidian plugin skeleton with npm, esbuild, and TypeScript.
- Code style baseline: strict TypeScript, small modules, no UI framework, sparse comments.
- Automated verification should run before review: `npm install`, `npm run build`, `npm run deploy:test`, and `git status --short --branch`.
- Manual Obsidian smoke test passed on 2026-07-06.
- Review passed on 2026-07-06.

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
- `src/providers/ProviderRegistry.ts`
- `docs/stage-status.md`

### Completion Criteria

- Plugin data stores provider settings through Obsidian's `loadData()` and `saveData()`.
- Settings tab allows editing API key, base URL, model, temperature, and context token budget.
- Provider logic is behind `LLMProvider` and does not depend on Obsidian APIs.
- OpenAI-compatible provider can send a non-streaming chat completions request.
- Command palette includes `Ask Copilot: Test Provider`.

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
Running `Ask Copilot: Test Provider` sends one non-streaming provider request.
The command shows a success or failure Notice.
```

### Notes

- Stage 1 intentionally uses `fetch` instead of a provider SDK to avoid a large dependency.
- API keys are never hardcoded and are only stored in Obsidian plugin data.
- The context token budget is stored for future stages but no note context is injected yet.
- Streaming remains deferred to Stage 3.

## Stage 2: Copilot Sidebar and Basic Chat

Status: completed

### Goal

Add a usable Copilot sidebar with basic non-streaming chat.

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

- Command palette includes `Ask Copilot: Open Chat`.
- The Copilot sidebar can be opened from the command palette or ribbon icon.
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
Obsidian can open `Ask Copilot: Open Chat` from the command palette.
The ribbon icon opens the same Copilot sidebar.
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
- Active streaming requests can be stopped through the Copilot sidebar.
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
Obsidian can open `Ask Copilot: Open Chat`.
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

Status: planned

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

## Stage 5: Editing Commands

Status: planned

### Goal

Add Obsidian-native writing commands.

### Summary Scope

- Explain selection.
- Rewrite selection.
- Summarize current note.
- Insert or replace editor text with explicit user action.

## Stage 6: Chat History Persistence

Status: planned

### Goal

Persist and restore chat sessions.

### Summary Scope

- Chat store.
- Session list.
- Create, switch, and delete sessions.

## Stage 7: Vault Search Context

Status: planned

### Goal

Add simple Vault-wide keyword search context.

### Summary Scope

- Search service.
- Markdown file scan.
- Search results as context blocks.
- Budgeted prompt injection.

## Stage 8: Embedding Retrieval

Status: planned

### Goal

Add semantic retrieval for larger vaults.

### Summary Scope

- Markdown chunking.
- Embedding provider.
- Local vector store.
- Index refresh on file changes.

## Stage 9: Tools and Agent Mode

Status: planned

### Goal

Allow the assistant to call controlled Obsidian tools.

### Summary Scope

- Tool interface.
- Tool registry.
- Read/search tools.
- Confirmed note-writing tools.
- Agent runner.
