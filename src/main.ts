import { Notice, Plugin } from "obsidian";

import { createProvider } from "./providers/ProviderRegistry";
import { normalizeSettings } from "./settings/defaults";
import { CopilotSettingsTab } from "./settings/SettingsTab";
import type { CopilotSettings } from "./settings/types";

export default class ObsidianAICopilotPlugin extends Plugin {
  copilotSettings!: CopilotSettings;

  override async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new CopilotSettingsTab(this));

    this.addCommand({
      id: "show-load-notice",
      name: "Show load notice",
      callback: () => {
        new Notice("Obsidian AI Copilot is loaded.");
      },
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
}
