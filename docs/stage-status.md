# Stage Status

This document is the project control panel. It tracks the active stage, what Codex is allowed to implement now, and how completion is verified.

Future stages are planning placeholders. They may be revised before implementation.

## Current Stage

Current stage: 0
Current status: completed

## Stage Checklist

- [x] Stage 0: Project scaffold
- [ ] Stage 1: Settings and provider abstraction
- [ ] Stage 2: Copilot sidebar and basic chat
- [ ] Stage 3: Streaming and abort
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

```txt
npm run build
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

Status: planned

### Goal

Add plugin settings and the first model provider abstraction.

### Summary Scope

- Settings types and defaults.
- Settings tab.
- `LLMProvider` interface.
- OpenAI-compatible provider with non-streaming request.
- Provider test command.

### Summary Out of Scope

- No chat sidebar.
- No streaming.
- No context builder.

## Stage 2: Copilot Sidebar and Basic Chat

Status: planned

### Goal

Add a usable Copilot sidebar with basic non-streaming chat.

### Summary Scope

- Register Copilot view.
- Render message list and composer.
- Add in-memory chat session.
- Wire `ChatService.sendMessage()`.

### Summary Out of Scope

- No streaming.
- No context injection beyond plain user input.

## Stage 3: Streaming and Abort

Status: planned

### Goal

Support token-by-token assistant responses and stop generation.

### Summary Scope

- Provider streaming method.
- Stream controller.
- Abort manager.
- UI stop button and streaming state.

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
