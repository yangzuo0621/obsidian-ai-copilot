# Vault Loom

[English](README.md)

让整个 Vault 成为有用的 AI 上下文。Vault Loom 为 Obsidian 集成流式聊天、笔记感知检索、编辑命令，以及需要确认才能写入笔记的 Agent 模式。

> [!IMPORTANT]
> 本插件目前处于预发布开发阶段，尚未上架 Obsidian 社区插件市场，当前需要手动安装。

## 功能特性

- 流式显示助手回复，并可停止正在进行的生成。
- 将当前选中文本或活动笔记作为结构化上下文。
- 通过关键词搜索相关 Markdown 笔记。
- 可选用 Embedding 为 Markdown 分块建立索引并进行语义检索。
- 预览最近一次请求使用的上下文。
- 新建、切换、恢复和删除聊天会话。
- 通过命令面板解释或改写选中文本、总结当前笔记。
- 使用执行轮次受限的 Agent 模式；工具活动全程可见，每次笔记写入都需要确认。
- 连接可配置的 OpenAI-compatible 聊天与 Embedding 接口。

## 运行要求与兼容性

- 桌面版 Obsidian 1.12.7 或更高版本。
- OpenAI-compatible 接口，以及该接口所需的访问凭据。

首个公开版本仅支持桌面端。完成 Obsidian 移动端完整流程验证后，再考虑启用移动端支持。

部分兼容接口可能只支持聊天补全，不支持流式传输、工具调用或 Embedding。Chat 模式只要求兼容的聊天补全接口；Agent 模式需要工具调用能力；语义检索需要 Embedding 接口。

## 安装

### 社区插件市场

插件通过 Obsidian 社区目录审核后，将在此补充市场安装步骤。

### 从源码手动安装

1. 安装 Node.js 并克隆本仓库。
2. 在仓库根目录运行：

   ```sh
   npm ci
   npm run build
   ```

3. 在 Vault 中创建插件目录：

   ```text
   <vault>/.obsidian/plugins/vault-loom/
   ```

4. 将 `main.js`、`manifest.json` 和 `styles.css` 复制到该目录。
5. 重新加载 Obsidian，打开 **设置 → 第三方插件**，启用 **Vault Loom**。

开发测试时，可以在 `.env.local` 中设置 `OBSIDIAN_PLUGINS_DIR`，然后运行 `npm run deploy:test`。也可以直接传入目标目录：

```powershell
npm run deploy:test -- "<vault>/.obsidian/plugins"
```

## 配置

打开 **设置 → Vault Loom**，配置以下项目：

| 设置项                      | 用途                                 | 默认值                      |
| --------------------------- | ------------------------------------ | --------------------------- |
| API key                     | 访问凭据，保存在 Obsidian 插件数据中 | 空                          |
| Base URL                    | OpenAI-compatible API 根地址         | `https://api.openai.com/v1` |
| Model                       | 聊天补全模型名称                     | `gpt-4o-mini`               |
| Embedding model             | 语义检索使用的模型                   | `text-embedding-3-small`    |
| Temperature                 | 0 到 2 之间的回复随机性              | `0.7`                       |
| Context token budget        | 附加上下文的估算 Token 预算          | `4000`                      |
| Include selection           | 优先使用活动编辑器中的选中文本       | 开启                        |
| Include current file        | 没有选中文本时使用活动笔记           | 开启                        |
| Include vault search        | 附加关键词匹配的笔记片段             | 开启                        |
| Include embedding retrieval | 建立索引并检索语义相关分块           | 关闭                        |

可以在命令面板运行 **Test provider** 检查聊天配置。

## 使用方法

### Chat 模式

点击左侧功能区的机器人图标，或在命令面板运行 **Open chat** 打开侧边栏。输入问题并选择 **Send**。回复会流式写入当前会话，选择 **Stop** 可取消当前请求。

上下文预览会显示本次附加的选中文本、当前笔记、关键词匹配或语义匹配。组成提示词前，插件会根据配置的预算估算并裁剪上下文。

聊天会话保存在 Obsidian 插件数据中，并在插件重新加载后恢复。新建、切换或删除会话不会修改 Markdown 笔记。

### 编辑命令

| 命令                     | 结果                           |
| ------------------------ | ------------------------------ |
| `Explain selection`      | 为选中文本生成解释并插入编辑器 |
| `Rewrite selection`      | 用改写结果替换选中文本         |
| `Summarize current note` | 在活动编辑器中插入当前笔记摘要 |

运行命令本身即为授权本次编辑器改动的明确操作。如果请求失败，命令不会写入生成内容。

### Agent 模式

在 Vault Loom 侧边栏选择 **Agent**，允许模型请求已注册的工具。Agent 按顺序执行且轮次受限，工具活动会保留在聊天记录中。

| 工具                | 权限 | 行为                                      |
| ------------------- | ---- | ----------------------------------------- |
| `search_vault`      | 只读 | 搜索 Markdown 笔记名称和正文              |
| `read_note`         | 只读 | 读取一篇 Vault 相对路径下的 Markdown 笔记 |
| `create_note`       | 写入 | 新建笔记，不覆盖已有笔记                  |
| `append_to_note`    | 写入 | 向已有笔记追加 Markdown 内容              |
| `replace_selection` | 写入 | 替换活动编辑器中的非空选中文本            |

每个写入工具都会展示预览，只有获得确认后才会执行。如果等待确认期间活动笔记或选中文本发生变化，替换操作将被拒绝。

## 隐私与数据处理

本插件会从 Obsidian 直接连接到你配置的 API Base URL。向接口发送敏感 Vault 内容前，请先了解对应服务的隐私和数据保留政策。

- API Key、设置、聊天历史和可选的 Embedding 索引保存在 Obsidian 插件数据中。
- 聊天请求可能将对话，以及已启用的选中文本、当前笔记、关键词搜索和语义搜索上下文发送给配置的服务商。
- 启用语义检索后，Markdown 分块会被发送到配置的 Embedding 接口；分块文本、元数据和返回的向量会保存在本地插件数据索引中。
- Agent 请求可能会把工具定义、工具参数和工具结果发送给配置的服务商。
- 只读工具不会修改 Vault 文件。编辑命令与 Agent 写入工具只会在用户明确操作或确认后写入。
- 本项目未实现遥测或分析功能。

## 本地开发

```sh
npm ci
npm run dev
```

提交变更前，运行项目统一的自动化质量检查：

```sh
npm run verify
```

`npm run verify` 会检查格式、代码规范、TypeScript、生产构建、单元测试、发布元数据和必需的 Release 产物。本地 Obsidian 冒烟测试独立进行，可通过 `npm run deploy:test` 准备测试插件。

代码库将 UI、Provider 执行、Obsidian Adapter、结构化上下文、Prompt 组合、检索和工具拆分为独立模块。详情参见[实现计划](docs/copilot-for-obsidian-implementation-plan.md)、[阶段状态](docs/stage-status.md)和[架构决策](docs/architecture-decisions.md)。

## 发布状态

Vault Loom 尚未上架 Obsidian 社区插件市场。版本 1.0.0 所需的仓库元数据、许可证、版本兼容映射、发布检查和基于标签生成 Draft Release 的工作流已经准备完成。桌面端冒烟测试、发布生成的 GitHub Release，以及首次提交社区目录仍需人工完成。详情参见[发布指南](docs/releasing.md)。

## 许可证

Vault Loom 使用 [MIT License](LICENSE)。
