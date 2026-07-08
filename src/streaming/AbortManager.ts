export class AbortManager {
  private readonly controllers = new Map<string, AbortController>();

  start(id: string, controller: AbortController): void {
    this.abort(id);
    this.controllers.set(id, controller);
  }

  finish(id: string, controller?: AbortController): void {
    if (controller && this.controllers.get(id) !== controller) {
      return;
    }

    this.controllers.delete(id);
  }

  abort(id: string): void {
    const controller = this.controllers.get(id);
    if (!controller) {
      return;
    }

    controller.abort();
    this.controllers.delete(id);
  }

  abortAll(): void {
    for (const controller of this.controllers.values()) {
      controller.abort();
    }

    this.controllers.clear();
  }

  isRunning(id: string): boolean {
    return this.controllers.has(id);
  }
}
