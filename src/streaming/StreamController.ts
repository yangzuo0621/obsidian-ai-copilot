import type { CompletionRequest, LLMProvider } from "../providers/types";

import { AbortManager } from "./AbortManager";

export interface StreamControllerCallbacks {
  onToken(token: string): void;
  onDone(): void;
  onAbort(): void;
  onError(error: unknown): void;
}

export interface StartStreamOptions {
  id: string;
  provider: LLMProvider;
  request: CompletionRequest;
  callbacks: StreamControllerCallbacks;
}

export class StreamController {
  constructor(private readonly abortManager = new AbortManager()) {}

  async start(options: StartStreamOptions): Promise<void> {
    const abortController = new AbortController();
    this.abortManager.start(options.id, abortController);

    try {
      await options.provider.stream(
        options.request,
        {
          onToken: (token) => {
            if (this.abortManager.isRunning(options.id)) {
              options.callbacks.onToken(token);
            }
          },
          onDone: () => {
            if (this.abortManager.isRunning(options.id)) {
              options.callbacks.onDone();
            }
          },
          onError: (error) => {
            if (this.abortManager.isRunning(options.id)) {
              options.callbacks.onError(error);
            }
          },
        },
        abortController.signal,
      );
    } catch (error) {
      if (isAbortError(error) || abortController.signal.aborted) {
        options.callbacks.onAbort();
        return;
      }

      options.callbacks.onError(error);
    } finally {
      this.abortManager.finish(options.id, abortController);
    }
  }

  abort(id: string): void {
    this.abortManager.abort(id);
  }

  abortAll(): void {
    this.abortManager.abortAll();
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}
