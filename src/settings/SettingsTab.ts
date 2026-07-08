import { PluginSettingTab, Setting } from "obsidian";

import type ObsidianAICopilotPlugin from "../main";

export class CopilotSettingsTab extends PluginSettingTab {
  constructor(private readonly plugin: ObsidianAICopilotPlugin) {
    super(plugin.app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Obsidian AI Copilot" });

    new Setting(containerEl)
      .setName("API key")
      .setDesc("Stored in Obsidian plugin data. Leave blank only for compatible local endpoints that do not require a key.")
      .addText((text) => {
        text.inputEl.type = "password";
        text
          .setPlaceholder("sk-...")
          .setValue(this.plugin.copilotSettings.apiKey)
          .onChange(async (value) => {
            this.plugin.copilotSettings.apiKey = value.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Base URL")
      .setDesc("OpenAI-compatible API base URL, for example https://api.openai.com/v1.")
      .addText((text) => {
        text
          .setPlaceholder("https://api.openai.com/v1")
          .setValue(this.plugin.copilotSettings.baseUrl)
          .onChange(async (value) => {
            this.plugin.copilotSettings.baseUrl = value.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Model")
      .setDesc("Chat completions model name.")
      .addText((text) => {
        text
          .setPlaceholder("gpt-4o-mini")
          .setValue(this.plugin.copilotSettings.model)
          .onChange(async (value) => {
            this.plugin.copilotSettings.model = value.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Temperature")
      .setDesc("Controls response randomness.")
      .addSlider((slider) => {
        slider
          .setLimits(0, 2, 0.1)
          .setValue(this.plugin.copilotSettings.temperature)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.copilotSettings.temperature = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Context token budget")
      .setDesc("Maximum estimated tokens to reserve for current note or selection context.")
      .addText((text) => {
        text
          .setPlaceholder("4000")
          .setValue(String(this.plugin.copilotSettings.contextTokenBudget))
          .onChange(async (value) => {
            const parsed = Number.parseInt(value.trim(), 10);
            if (Number.isFinite(parsed) && parsed > 0) {
              this.plugin.copilotSettings.contextTokenBudget = parsed;
              await this.plugin.saveSettings();
            }
          });
      });

    new Setting(containerEl)
      .setName("Include selection")
      .setDesc("When text is selected in the active note, include it as the highest-priority context.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.copilotSettings.includeSelection)
          .onChange(async (value) => {
            this.plugin.copilotSettings.includeSelection = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Include current file")
      .setDesc("When there is no selection, include the active note as context.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.copilotSettings.includeCurrentFile)
          .onChange(async (value) => {
            this.plugin.copilotSettings.includeCurrentFile = value;
            await this.plugin.saveSettings();
          });
      });
  }
}
