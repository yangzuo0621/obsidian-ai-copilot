import { Notice, Plugin, WorkspaceLeaf } from "obsidian";

import { ChatService } from "./chat/ChatService";
import { createProvider } from "./providers/ProviderRegistry";
import { normalizeSettings } from "./settings/defaults";
import { CopilotSettingsTab } from "./settings/SettingsTab";
import type { CopilotSettings } from "./settings/types";
import { COPILOT_VIEW_TYPE, CopilotView } from "./ui/CopilotView";

export default class ObsidianAICopilotPlugin extends Plugin {
  copilotSettings!: CopilotSettings;
  private chatService!: ChatService;

  override async onload(): Promise<void> {
    await this.loadSettings();
    this.chatService = new ChatService(() => this.copilotSettings);

    this.registerView(
      COPILOT_VIEW_TYPE,
      (leaf: WorkspaceLeaf) => new CopilotView(leaf, this.chatService),
    );

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

    new Notice("Obsidian AI Copilot loaded.");
  }

  override onunload(): void {
    // Reserved for future cleanup as the plugin gains long-lived resources.
  }

  async loadSettings(): Promise<void> {
    const data = (await this.loadData()) as Partial<CopilotSettings> | null;
    this.copilotSettings = normalizeSettings(data);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.copilotSettings);
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
    const existingLeaves = this.app.workspace.getLeavesOfType(COPILOT_VIEW_TYPE);
    let leaf: WorkspaceLeaf | null = existingLeaves[0] ?? null;

    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false);
      if (!leaf) {
        throw new Error("Unable to create Copilot sidebar leaf.");
      }

      await leaf.setViewState({
        type: COPILOT_VIEW_TYPE,
        active: true,
      });
    }

    this.app.workspace.revealLeaf(leaf);
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
