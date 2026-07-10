# Copilot for Obsidian 实现计划

本文档用于指导从零实现一个类似 Copilot for Obsidian 的 Obsidian AI 插件。目标不是一次性做完整大而全产品，而是按阶段建立稳定骨架：先跑通聊天、上下文、流式输出，再逐步扩展 Vault 检索、工具调用和 Agent 能力。

## 1. 产品目标

插件应提供一个 Obsidian 内的 AI 助手，能够理解当前笔记、选中文本、用户显式引用的笔记，以及后续扩展的 Vault 检索结果，并支持流式回答、停止生成、改写/总结/解释等编辑命令。

首个可用版本的核心能力：

- 在侧边栏打开 Copilot 聊天视图。
- 配置模型服务商和 API Key。
- 支持 OpenAI-compatible provider。
- 支持普通聊天。
- 支持把当前文件、选中文本加入上下文。
- 支持 streaming token-by-token 输出。
- 支持停止生成。
- 支持基础命令：解释选中文本、总结当前笔记、改写选中文本。

后续增强能力：

- 聊天历史持久化。
- Vault 全文搜索上下文。
- Embedding 检索。
- 多 provider。
- 工具调用。
- Agent 模式。

## 2. 设计原则

### 2.1 模块隔离

UI、Obsidian API、模型 provider、上下文构建、prompt 拼装、streaming 控制需要分开。任何模块不应直接跨层访问太多细节。

例如，UI 不直接调用 OpenAI SDK，而是调用 `ChatService` 或 `AppController`。模型 provider 不知道 Obsidian 文件结构，只接收标准化的 `CompletionRequest`。

### 2.2 上下文结构化

不要把当前文件、选中文本、搜索结果直接拼成一个巨大字符串。所有上下文先统一成 `ContextBlock`，再由预算模块裁剪，最后交给 `PromptComposer` 生成 messages。

### 2.3 Streaming 一等公民

流式输出不是 UI 的小细节，而是独立能力。它必须支持：

- token 增量回调；
- 完成回调；
- 错误回调；
- 用户取消；
- 后续 provider 替换。

### 2.4 渐进实现

先做“单 provider + 当前文件上下文 + streaming 聊天”。不要一开始就做 embedding、agent 和复杂工具调用。基础链路稳定后再扩展。

## 3. 推荐目录结构

```txt
src/
  main.ts

  settings/
    defaults.ts
    types.ts
    SettingsTab.ts

  core/
    AppController.ts
    errors.ts
    logger.ts

  obsidian/
    VaultAdapter.ts
    EditorAdapter.ts
    WorkspaceAdapter.ts

  providers/
    types.ts
    OpenAICompatibleProvider.ts
    ProviderFactory.ts

  chat/
    types.ts
    ChatSession.ts
    ChatStore.ts
    ChatService.ts

  context/
    types.ts
    ContextBuilder.ts
    ContextBudget.ts
    CurrentFileContext.ts
    SelectionContext.ts
    LinkedNotesContext.ts
    VaultSearchContext.ts

  prompts/
    PromptComposer.ts
    systemPrompts.ts
    commandPrompts.ts

  streaming/
    StreamController.ts
    AbortManager.ts

  retrieval/
    Indexer.ts
    SearchService.ts
    EmbeddingProvider.ts
    VectorStore.ts

  tools/
    types.ts
    ToolRegistry.ts
    ReadNoteTool.ts
    SearchVaultTool.ts
    WriteNoteTool.ts

  ui/
    CopilotView.ts
    ChatPanel.ts
    MessageList.ts
    Composer.ts
    ContextPreview.ts

  commands/
    registerCommands.ts
    explainSelection.ts
    rewriteSelection.ts
    summarizeCurrentNote.ts

  tests/
```

## 4. 核心模块设计

### 4.1 `main.ts`

职责：

- 加载和保存 settings。
- 初始化 `AppController`。
- 注册 view。
- 注册 commands。
- 注册 settings tab。

非职责：

- 不拼 prompt。
- 不直接请求模型。
- 不直接管理聊天状态。
- 不直接处理 streaming token。

### 4.2 `settings/`

保存插件配置。

建议配置：

```ts
export interface CopilotSettings {
  providerId: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxOutputTokens: number;
  contextTokenBudget: number;
  includeCurrentFile: boolean;
  includeSelection: boolean;
  includeLinkedNotes: boolean;
  includeVaultSearch: boolean;
}
```

第一阶段只需要：

- `apiKey`
- `baseUrl`
- `model`
- `temperature`
- `contextTokenBudget`

### 4.3 `obsidian/`

封装 Obsidian API，避免业务层到处直接调用 `this.app.workspace`、`this.app.vault`、`editor`。

`VaultAdapter`：

- 读取 markdown 文件。
- 写入 markdown 文件。
- 根据路径获取文件。
- 列出 vault 中的 markdown 文件。

`EditorAdapter`：

- 获取当前 editor。
- 获取 selection。
- 替换 selection。
- 在光标处插入文本。

`WorkspaceAdapter`：

- 获取当前 active file。
- 打开 Copilot view。
- 获取当前 leaf/editor 上下文。

### 4.4 `providers/`

模型 provider 抽象。

```ts
export interface LLMProvider {
  id: string;
  label: string;
  complete(request: CompletionRequest): Promise<CompletionResult>;
  stream(request: CompletionRequest, callbacks: StreamCallbacks, signal?: AbortSignal): Promise<void>;
}
```

核心类型：

```ts
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface StreamCallbacks {
  onToken(token: string): void;
  onDone(): void;
  onError(error: unknown): void;
}
```

第一阶段实现 `OpenAICompatibleProvider`，使用 OpenAI-compatible chat completions API，后续再扩展 Anthropic、Gemini、Ollama、OpenRouter。

### 4.5 `context/`

上下文构建模块是插件质量的核心。

统一上下文结构：

```ts
export interface ContextBlock {
  id: string;
  type: "selection" | "current-file" | "linked-note" | "vault-search" | "frontmatter" | "manual";
  title: string;
  content: string;
  priority: number;
  tokenEstimate: number;
  sourcePath?: string;
}
```

`ContextBuilder` 职责：

- 根据当前 Obsidian 状态收集上下文。
- 调用各个 context source。
- 返回 `ContextBlock[]`。

`ContextBudget` 职责：

- 估算 token。
- 根据优先级裁剪。
- 控制总上下文长度。

建议优先级：

1. 用户选中文本。
2. 当前文件标题、路径、frontmatter。
3. 当前文件正文。
4. 用户显式引用的笔记。
5. Vault 搜索结果。
6. 自动发现的链接和反链。

第一阶段只实现：

- `SelectionContext`
- `CurrentFileContext`
- `ContextBudget`

### 4.6 `prompts/`

`PromptComposer` 把结构化上下文、聊天历史、用户输入、命令模式组合成标准 messages。

输入：

```ts
export interface ComposePromptInput {
  mode: "chat" | "explain-selection" | "rewrite-selection" | "summarize-note";
  userInput: string;
  contextBlocks: ContextBlock[];
  history: ChatMessage[];
}
```

输出：

```ts
ChatMessage[]
```

注意事项：

- system prompt 固定描述助手角色和边界。
- context blocks 用明确分隔符包裹。
- 每个 context block 包含 title、type、source path。
- 不要让 provider 负责 prompt 拼装。

### 4.7 `streaming/`

`StreamController` 管理一次生成过程。

职责：

- 创建 `AbortController`。
- 调用 provider 的 `stream`。
- 把 token 增量转发给 `ChatService` 或 UI handler。
- 捕获取消和错误。

`AbortManager` 管理当前活跃请求：

- `start(id, controller)`
- `abort(id)`
- `abortAll()`
- `isRunning(id)`

第一阶段需要支持：

- 开始生成。
- UI 增量更新。
- 停止生成。
- 错误显示。

### 4.8 `chat/`

管理聊天状态。

`ChatSession`：

```ts
export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessageRecord[];
  createdAt: number;
  updatedAt: number;
}
```

`ChatMessageRecord`：

```ts
export interface ChatMessageRecord {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
  contextBlockIds?: string[];
  status?: "pending" | "streaming" | "done" | "error";
}
```

`ChatService` 职责：

- 接收用户输入。
- 请求 `ContextBuilder`。
- 请求 `PromptComposer`。
- 调用 `StreamController`。
- 更新 `ChatStore`。
- 通知 UI 刷新。

第一阶段可以先用内存 store，后续再持久化到 plugin data 或 `.obsidian/plugins/.../sessions.json`。

### 4.9 `ui/`

建议 UI 层保持薄。

`CopilotView`：

- Obsidian view 容器。
- 初始化 `ChatPanel`。

`ChatPanel`：

- 组合消息列表、输入框、上下文预览。

`MessageList`：

- 渲染 user/assistant 消息。
- 渲染 streaming 状态。

`Composer`：

- 输入框。
- 发送按钮。
- 停止按钮。

`ContextPreview`：

- 展示本次回答使用了哪些上下文。
- 后续可允许用户取消某个 context block。

### 4.10 `retrieval/`

Vault QA 和 embedding 检索放到后续阶段，不进入第一版核心链路。

阶段 1：无 retrieval。

阶段 2：实现 `SearchService`，基于文件名和正文关键词搜索。

阶段 3：

- Markdown 文件分块。
- 生成 embedding。
- 本地保存索引。
- 相似度召回 chunks。

### 4.11 `tools/`

工具调用和 Agent 模式是后续能力。

工具接口：

```ts
export interface Tool {
  name: string;
  description: string;
  inputSchema: unknown;
  run(input: unknown): Promise<ToolResult>;
}
```

候选工具：

- `read_note`
- `search_vault`
- `create_note`
- `append_to_note`
- `replace_selection`

原则：先把工具定义好，但不要过早接进普通聊天主链路。

## 5. 实现阶段

### 阶段 0：项目骨架

目标：能作为 Obsidian 插件加载。

任务：

- 初始化 TypeScript Obsidian 插件项目。
- 添加 `manifest.json`、`package.json`、`tsconfig.json`、构建脚本。
- 实现 `main.ts`。
- 插件加载时显示 Notice。
- 注册一个基础 command。

完成标准：

- 插件能在 Obsidian 中启用。
- 构建产物包含 `main.js`、`manifest.json`、`styles.css`。

### 阶段 1：设置页和 Provider 抽象

目标：配置模型，并跑通一次非 streaming 请求。

任务：

- 实现 settings 类型和默认值。
- 实现 settings tab。
- 实现 `LLMProvider` 接口。
- 实现 `OpenAICompatibleProvider.complete()`。
- 添加一个测试命令：“Ask Copilot: Test Provider”。

完成标准：

- 用户能输入 API Key、base URL、model。
- 命令能向模型发送一句测试问题并显示 Notice 或 console 输出。

### 阶段 2：Copilot 侧边栏和基础聊天

目标：有一个可用聊天窗口。

任务：

- 注册 `CopilotView`。
- 实现消息列表。
- 实现输入框。
- 实现发送按钮。
- 实现内存 `ChatSession`。
- 实现 `ChatService.sendMessage()`。

完成标准：

- 用户可以打开侧边栏。
- 用户可以发送消息。
- assistant 回复能显示在侧边栏。

### 阶段 3：Streaming 和停止生成

目标：回复逐字/逐 token 出现，用户可以停止。

任务：

- 实现 `OpenAICompatibleProvider.stream()`。
- 实现 `StreamController`。
- 实现 `AbortManager`。
- UI 增加停止按钮。
- assistant 消息支持 `streaming` 状态。

完成标准：

- 回复可以流式显示。
- 点击停止后请求中断。
- 中断后 UI 状态正确恢复。

### 阶段 4：当前笔记和选中文本上下文

目标：AI 能理解当前 Obsidian 工作区。

任务：

- 实现 `VaultAdapter`。
- 实现 `EditorAdapter`。
- 实现 `WorkspaceAdapter`。
- 实现 `SelectionContext`。
- 实现 `CurrentFileContext`。
- 实现 `ContextBuilder`。
- 实现 `ContextBudget`。
- 实现 `PromptComposer`。

完成标准：

- 有选中文本时，优先把 selection 注入上下文。
- 无选中文本时，可以注入当前文件。
- UI 可以显示“本次使用的上下文”。

### 阶段 5：编辑命令

目标：提供真正 Obsidian 原生的写作辅助。

任务：

- `explainSelection`：解释选中文本。
- `rewriteSelection`：改写选中文本。
- `summarizeCurrentNote`：总结当前笔记。
- 支持将结果插入光标位置。
- 支持替换 selection。

完成标准：

- 命令面板中可以调用这些命令。
- 命令能正确读取 editor selection/current file。
- 结果能回写到 editor 或显示在 Copilot view。

### 阶段 6：聊天历史持久化

目标：重启 Obsidian 后恢复聊天。

任务：

- 实现 `ChatStore`。
- 保存 session list。
- 保存 message records。
- UI 支持新建/切换/删除会话。

完成标准：

- 插件重载后历史仍在。
- 不同会话之间隔离。

### 阶段 7：Vault 搜索上下文

目标：支持简单 Vault QA。

任务：

- 实现 `SearchService`。
- 支持按关键词搜索文件名和正文。
- 把搜索结果转换成 `ContextBlock[]`。
- `ContextBudget` 对搜索结果做裁剪。

完成标准：

- 用户提问时，可以召回相关笔记片段。
- context preview 能展示召回来源。

### 阶段 8：Embedding 检索

目标：更准确地回答整个 Vault 的问题。

任务：

- 实现 markdown chunker。
- 实现 embedding provider。
- 实现本地 vector store。
- 监听文件修改并更新索引。
- SearchService 支持 semantic search。

完成标准：

- 可以基于语义召回相关 chunks。
- 大 vault 中搜索延迟可接受。

### 阶段 9：工具调用和 Agent 模式

目标：AI 不只回答，还可以读取、搜索、创建或修改笔记。

任务：

- 实现 `ToolRegistry`。
- 实现基础工具。
- provider 层支持 tool calling。
- Agent runner 控制多轮工具调用。
- 对写操作增加确认机制。

完成标准：

- AI 可以调用 `search_vault`、`read_note`。
- 写入类操作需要用户确认。
- 工具调用过程可见。

## 6. 第一版最小可行范围

建议第一轮只做到阶段 0 到阶段 4。

第一版包含：

- 插件可加载。
- 设置页。
- OpenAI-compatible provider。
- Copilot 侧边栏。
- 基础聊天。
- Streaming。
- 停止生成。
- 当前文件上下文。
- 选中文本上下文。
- PromptComposer。
- ContextBudget。

第一版暂不包含：

- Embedding。
- Agent。
- 多 provider。
- 复杂会话管理。
- 自动改写文件。

## 7. 推荐开发节奏

每个阶段都按下面节奏推进：

1. 先定义类型和接口。
2. 实现最小逻辑。
3. 接入 UI 或命令。
4. 手动在 Obsidian 中验证。
5. 补充必要测试或 mock。
6. 更新本文档的完成状态。

建议维护一个阶段状态：

```txt
[ ] 阶段 0：项目骨架
[ ] 阶段 1：设置页和 Provider 抽象
[ ] 阶段 2：Copilot 侧边栏和基础聊天
[ ] 阶段 3：Streaming 和停止生成
[ ] 阶段 4：当前笔记和选中文本上下文
[ ] 阶段 5：编辑命令
[ ] 阶段 6：聊天历史持久化
[ ] 阶段 7：Vault 搜索上下文
[ ] 阶段 8：Embedding 检索
[ ] 阶段 9：工具调用和 Agent 模式
```

## 8. 关键风险

### 8.1 上下文过长

风险：当前文件、搜索结果、聊天历史叠加后超出模型窗口。

处理：

- 所有上下文进入 `ContextBudget`。
- 每个 block 有 token 估算。
- 高优先级 block 优先保留。
- 低优先级 block 截断或丢弃。

### 8.2 Streaming 状态错乱

风险：用户连续发送、停止、切换会话时，token 写到错误消息。

处理：

- 每次生成都有 request id。
- assistant message 有 message id。
- token append 时校验当前 session/message。
- 中断时显式更新状态。

### 8.3 Obsidian API 分散调用

风险：业务代码到处直接访问 Obsidian API，后续难测试、难重构。

处理：

- 使用 `obsidian/` adapter 层集中封装。
- 业务层只依赖 adapter。

### 8.4 写入操作风险

风险：AI 自动改写用户笔记造成不可逆修改。

处理：

- 第一版只插入或替换明确 selection。
- Agent 写操作必须确认。
- 后续支持 diff preview。

## 9. 下一步

下一步建议直接开始阶段 0：创建 Obsidian 插件项目骨架。

阶段 0 的第一个实现目标：

- 创建 `package.json`。
- 创建 `manifest.json`。
- 创建 `tsconfig.json`。
- 创建 `src/main.ts`。
- 创建 `styles.css`。
- 配置 esbuild。
- 跑通一次 build。
