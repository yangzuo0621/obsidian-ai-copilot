import { Notice, Plugin } from "obsidian";

export default class ObsidianAICopilotPlugin extends Plugin {
  override async onload(): Promise<void> {
    this.addCommand({
      id: "show-load-notice",
      name: "Show load notice",
      callback: () => {
        new Notice("Obsidian AI Copilot is loaded.");
      },
    });

    new Notice("Obsidian AI Copilot loaded.");
  }

  override onunload(): void {
    // Reserved for future cleanup as the plugin gains long-lived resources.
  }
}
