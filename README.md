# Vault Loom

[简体中文](README.zh-CN.md)

Weave your vault into useful AI context. Vault Loom combines streaming chat, note-aware retrieval, editing commands, and a confirmation-gated agent mode for Obsidian.

> [!IMPORTANT]
> This plugin is in pre-release development and is not yet available in the Obsidian Community Plugins directory. The current installation method is manual.

## Features

- Stream assistant responses and stop an active generation.
- Use the current selection or active note as structured context.
- Find relevant Markdown notes with keyword search.
- Optionally index Markdown chunks for embedding-based semantic retrieval.
- Preview the context attached to the latest request.
- Create, switch, restore, and delete chat sessions.
- Explain or rewrite a selection and summarize the current note from the command palette.
- Run a bounded Agent mode with visible tool activity and per-operation confirmation for note writes.
- Connect to configurable OpenAI-compatible chat and embedding endpoints.

## Requirements and compatibility

- Desktop Obsidian 1.12.7 or later.
- An OpenAI-compatible endpoint and any credentials required by that endpoint.

The first public release is desktop-only. Mobile support may be enabled after the complete workflow has been verified on Obsidian mobile.

An endpoint may support chat completions without supporting streaming, tool calls, or embeddings. Chat mode only requires compatible chat completions; Agent mode requires tool-calling support, and semantic retrieval requires an embeddings endpoint.

## Installation

### Community Plugins

Community Plugins installation will be documented after the plugin has been accepted into the Obsidian directory.

### Manual installation from source

1. Install Node.js and clone this repository.
2. From the repository root, run:

   ```sh
   npm ci
   npm run build
   ```

3. Create a plugin folder inside your vault:

   ```text
   <vault>/.obsidian/plugins/vault-loom/
   ```

4. Copy `main.js`, `manifest.json`, and `styles.css` into that folder.
5. Reload Obsidian, open **Settings → Community plugins**, and enable **Vault Loom**.

For a development vault, set `OBSIDIAN_PLUGINS_DIR` in `.env.local` and run `npm run deploy:test`. You can also pass the destination directly:

```powershell
npm run deploy:test -- "<vault>/.obsidian/plugins"
```

## Configuration

Open **Settings → Vault Loom** and configure:

| Setting                     | Purpose                                        | Default                     |
| --------------------------- | ---------------------------------------------- | --------------------------- |
| API key                     | Credential stored in Obsidian plugin data      | Empty                       |
| Base URL                    | OpenAI-compatible API base URL                 | `https://api.openai.com/v1` |
| Model                       | Chat completions model name                    | `gpt-4o-mini`               |
| Embedding model             | Model used for semantic retrieval              | `text-embedding-3-small`    |
| Temperature                 | Response randomness from 0 to 2                | `0.7`                       |
| Context token budget        | Estimated token budget for attached context    | `4000`                      |
| Include selection           | Prefer the active editor selection as context  | On                          |
| Include current file        | Use the active note when there is no selection | On                          |
| Include vault search        | Attach keyword-matched note snippets           | On                          |
| Include embedding retrieval | Index and retrieve semantically related chunks | Off                         |

Use **Test provider** from the command palette to check the chat configuration.

## Usage

### Chat

Open the sidebar with the ribbon bot icon or **Open chat** from the command palette. Enter a prompt and select **Send**. Responses stream into the active session, and **Stop** cancels the current request.

The context preview shows which selection, current note, keyword matches, or semantic matches were attached. Context is estimated and trimmed to the configured budget before prompt composition.

Chat sessions are stored in Obsidian plugin data and restored after the plugin reloads. Creating, switching, and deleting sessions does not modify Markdown notes.

### Editing commands

| Command                  | Result                                       |
| ------------------------ | -------------------------------------------- |
| `Explain selection`      | Inserts an explanation for the selected text |
| `Rewrite selection`      | Replaces the selected text with a rewrite    |
| `Summarize current note` | Inserts a summary into the active editor     |

Running one of these commands is the explicit action that authorizes its editor change. If the request fails, the command does not write generated text.

### Agent mode

Select **Agent** in the Vault Loom sidebar to allow the model to request registered tools. Agent execution is sequential and bounded, and tool activity remains visible in the conversation.

| Tool                | Access | Behavior                                               |
| ------------------- | ------ | ------------------------------------------------------ |
| `search_vault`      | Read   | Searches Markdown note names and content               |
| `read_note`         | Read   | Reads one vault-relative Markdown note                 |
| `create_note`       | Write  | Creates a new note without overwriting an existing one |
| `append_to_note`    | Write  | Appends Markdown to an existing note                   |
| `replace_selection` | Write  | Replaces the current non-empty editor selection        |

Every write tool displays a preview and requires approval before it runs. If the active note or selection changes while a replacement is awaiting approval, the replacement is rejected.

## Privacy and data handling

This plugin connects directly from Obsidian to the API base URL you configure. Review the privacy and retention terms of that service before sending sensitive vault content.

- The API key, settings, chat history, and optional embedding index are stored in Obsidian plugin data.
- Chat requests may send the conversation plus enabled selection, current-note, keyword-search, and semantic-search context to the configured provider.
- When semantic retrieval is enabled, Markdown chunks are sent to the configured embeddings endpoint. Their text, metadata, and returned vectors are stored in the local plugin data index.
- Agent requests may send tool definitions, tool arguments, and tool results to the configured provider.
- Read tools do not change vault files. Editing commands and Agent write tools only write after an explicit user action or confirmation.
- The project does not implement telemetry or analytics.

## Development

```sh
npm ci
npm run dev
```

Before submitting a change, run the same automated quality gate used by the project:

```sh
npm run verify
```

`npm run verify` checks formatting, linting, TypeScript, the production build, unit tests, release metadata, and required release assets. Local Obsidian smoke testing is separate and can be prepared with `npm run deploy:test`.

The codebase keeps UI, provider execution, Obsidian adapters, structured context, prompt composition, retrieval, and tools in separate modules. See the [implementation plan](docs/copilot-for-obsidian-implementation-plan.md), [stage status](docs/stage-status.md), and [architecture decisions](docs/architecture-decisions.md) for details.

## Release status

Vault Loom is not yet listed in the Obsidian Community Plugins directory. Repository metadata, licensing, version compatibility mapping, release validation, and a tag-driven Draft Release workflow are prepared for version 1.0.0. A desktop smoke test, publication of the generated GitHub release, and the initial directory submission remain manual release steps. See the [release guide](docs/releasing.md).

## License

Vault Loom is available under the [MIT License](LICENSE).
