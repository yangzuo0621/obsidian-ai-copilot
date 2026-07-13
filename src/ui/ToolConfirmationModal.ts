import { Modal } from "obsidian";
import type { App } from "obsidian";

import type { ToolConfirmationRequest, ToolConfirmationService } from "../tools/types";

export class ObsidianToolConfirmationService implements ToolConfirmationService {
  constructor(private readonly app: App) {}

  confirm(request: ToolConfirmationRequest, signal?: AbortSignal): Promise<boolean> {
    return new Promise((resolve) => {
      const modal = new ToolConfirmationModal(this.app, request, resolve);
      signal?.addEventListener("abort", () => modal.close(), { once: true });
      modal.open();
    });
  }
}

class ToolConfirmationModal extends Modal {
  private resolved = false;

  constructor(
    app: App,
    private readonly request: ToolConfirmationRequest,
    private readonly resolve: (approved: boolean) => void,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.titleEl.setText(this.request.title);
    this.contentEl.createEl("p", { text: this.request.description });
    this.contentEl.createEl("p", {
      cls: "vault-loom-confirm-warning",
      text: "This tool will modify your vault. Review the proposed content before approving.",
    });
    this.contentEl.createEl("pre", {
      cls: "vault-loom-confirm-preview",
      text: this.request.preview || "(empty content)",
    });

    const actions = this.contentEl.createDiv({ cls: "vault-loom-confirm-actions" });
    const cancelButton = actions.createEl("button", { text: "Cancel" });
    const approveButton = actions.createEl("button", { cls: "mod-cta", text: "Approve" });
    cancelButton.addEventListener("click", () => this.finish(false));
    approveButton.addEventListener("click", () => this.finish(true));
  }

  override onClose(): void {
    this.contentEl.empty();
    if (!this.resolved) {
      this.resolved = true;
      this.resolve(false);
    }
  }

  private finish(approved: boolean): void {
    if (this.resolved) {
      return;
    }
    this.resolved = true;
    this.resolve(approved);
    this.close();
  }
}
