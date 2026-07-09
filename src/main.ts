import { Notice, Plugin } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";

import { ChatService } from "./chat/ChatService";
import { ChatStore } from "./chat/ChatStore";
import type { PersistedChatData } from "./chat/types";
import { EditingCommandService } from "./commands/EditingCommandService";
import { registerEditingCommands } from "./commands/registerCommands";
import { ContextBuilder } from "./context/ContextBuilder";
import { CurrentFileContext } from "./context/CurrentFileContext";
import { SelectionContext } from "./context/SelectionContext";
import { CurrentFileAdapter } from "./obsidian/CurrentFileAdapter";
import { EditorAdapter } from "./obsidian/EditorAdapter";
import { VaultAdapter } from "./obsidian/VaultAdapter";
import { WorkspaceAdapter } from "./obsidian/WorkspaceAdapter";
import { createProvider } from "./providers/ProviderRegistry";
import { normalizeSettings } from "./settings/defaults";
import { CopilotSettingsTab } from "./settings/SettingsTab";
import type { CopilotSettings } from "./settings/types";
import { COPILOT_VIEW_TYPE, CopilotView } from "./ui/CopilotView";

export default class ObsidianAICopilotPlugin extends Plugin {
  copilotSettings!: CopilotSettings;
  private chatService!: ChatService;
  private chatData: PersistedChatData | null = null;

  override async onload(): Promise<void> {
    await this.loadSettings();
    const workspaceAdapter = new WorkspaceAdapter(this.app);
    const editorAdapter = new EditorAdapter(workspaceAdapter);
    const vaultAdapter = new VaultAdapter(this.app);
    const currentFileAdapter = new CurrentFileAdapter(workspaceAdapter, vaultAdapter);
    const contextBuilder = new ContextBuilder({
      selection: new SelectionContext(editorAdapter, editorAdapter),
      currentFile: new CurrentFileContext(currentFileAdapter),
    });
    this.chatService = new ChatService(
      () => this.copilotSettings,
      contextBuilder,
      new ChatStore(this.chatData),
      async (chatData) => {
        this.chatData = chatData;
        await this.savePluginData();
      },
    );
    const editingCommandService = new EditingCommandService(() => this.copilotSettings, contextBuilder, editorAdapter);

    this.registerView(COPILOT_VIEW_TYPE, (leaf: WorkspaceLeaf) => new CopilotView(leaf, this.chatService));

    this.addSettingTab(new CopilotSettingsTab(this));

    this.addCommand({
      id: "show-load-notice",
      name: "Show load notice",
      callback: () => {
        new Notice("Obsidian AI Copilot is loaded.");
      },
    });

    this.addCommand({
      id: "ask-copilot-open-chat",
      name: "Ask Copilot: Open Chat",
      callback: async () => {
        await this.openCopilotViewWithNotice();
      },
    });

    this.addRibbonIcon("bot", "Open AI Copilot", () => {
      void this.openCopilotViewWithNotice();
    });

    this.addCommand({
      id: "ask-copilot-test-provider",
      name: "Ask Copilot: Test Provider",
      callback: async () => {
        await this.testProvider();
      },
    });

    registerEditingCommands(this, editingCommandService);

    new Notice("Obsidian AI Copilot loaded.");
  }

  override onunload(): void {
    // Reserved for future cleanup as the plugin gains long-lived resources.
  }

  async loadSettings(): Promise<void> {
    const data = (await this.loadData()) as Partial<CopilotPluginData & CopilotSettings> | null;
    if (isPluginDataEnvelope(data)) {
      this.copilotSettings = normalizeSettings(data.settings);
      this.chatData = data.chat ?? null;
      return;
    }

    this.copilotSettings = normalizeSettings(data);
    this.chatData = null;
  }

  async saveSettings(): Promise<void> {
    await this.savePluginData();
  }

  private async savePluginData(): Promise<void> {
    await this.saveData({
      settings: this.copilotSettings,
      chat: this.chatService?.getPersistedChatData() ?? this.chatData ?? undefined,
    } satisfies CopilotPluginData);
  }

  private async testProvider(): Promise<void> {
    try {
      const provider = createProvider(this.copilotSettings);
      const result = await provider.complete({
        model: this.copilotSettings.model,
        temperature: this.copilotSettings.temperature,
        messages: [
          {
            role: "user",
            content: "Reply with one short sentence confirming the Obsidian AI Copilot provider test worked.",
          },
        ],
      });

      console.log("Obsidian AI Copilot provider test response:", result);
      new Notice(`Provider test succeeded: ${result.content.slice(0, 120)}`);
    } catch (error) {
      console.error("Obsidian AI Copilot provider test failed:", error);
      new Notice(`Provider test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async activateCopilotView(): Promise<void> {
    const workspaceAdapter = new WorkspaceAdapter(this.app);
    await workspaceAdapter.revealOrCreateView(COPILOT_VIEW_TYPE);
  }

  private async openCopilotViewWithNotice(): Promise<void> {
    try {
      await this.activateCopilotView();
    } catch (error) {
      console.error("Failed to open AI Copilot view:", error);
      new Notice(`Failed to open AI Copilot: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

interface CopilotPluginData {
  settings: CopilotSettings;
  chat?: PersistedChatData;
}

function isPluginDataEnvelope(data: unknown): data is Partial<CopilotPluginData> {
  return typeof data === "object" && data !== null && ("settings" in data || "chat" in data);
}
