import type { CompletionRequest, LLMProvider, ToolCall } from "../providers/types";
import type { ToolRegistry } from "../tools/ToolRegistry";
import type { ToolConfirmationService } from "../tools/types";
import type { ToolActivityRecord, ToolActivityStatus } from "../chat/types";

const DEFAULT_MAX_ROUNDS = 6;

export interface AgentRunnerCallbacks {
  onToken(token: string): void;
  onActivity(activity: ToolActivityRecord): void;
}

export interface AgentRunOptions {
  requestId: string;
  provider: LLMProvider;
  request: CompletionRequest;
  callbacks: AgentRunnerCallbacks;
}

export interface AgentRunResult {
  content: string;
}

export class AgentRunner {
  private activeRequestId: string | null = null;
  private activeController: AbortController | null = null;

  constructor(
    private readonly tools: ToolRegistry,
    private readonly confirmation: ToolConfirmationService,
    private readonly maxRounds = DEFAULT_MAX_ROUNDS,
  ) {}

  async run(options: AgentRunOptions): Promise<AgentRunResult> {
    if (this.activeController) {
      throw new Error("An agent request is already running.");
    }

    const controller = new AbortController();
    this.activeRequestId = options.requestId;
    this.activeController = controller;
    const messages = [...options.request.messages];
    let fullContent = "";

    try {
      for (let round = 0; round < this.maxRounds; round += 1) {
        this.throwIfAborted(controller.signal);
        const result = await options.provider.stream(
          {
            ...options.request,
            messages,
            tools: this.tools.getDefinitions(),
          },
          {
            onToken: (token) => {
              fullContent += token;
              options.callbacks.onToken(token);
            },
            onDone: () => undefined,
            onError: () => undefined,
          },
          controller.signal,
        );

        this.throwIfAborted(controller.signal);
        if (result.toolCalls.length === 0) {
          return { content: fullContent };
        }

        messages.push({
          role: "assistant",
          content: result.content || null,
          toolCalls: result.toolCalls,
        });

        for (const call of result.toolCalls) {
          this.throwIfAborted(controller.signal);
          const activity = createActivity(call);
          options.callbacks.onActivity(activity);

          const execution = await this.tools.execute(
            call,
            this.confirmation,
            (status) => {
              activity.status = status;
              options.callbacks.onActivity({ ...activity });
            },
            controller.signal,
          );
          this.throwIfAborted(controller.signal);

          activity.status = execution.status;
          activity.result = execution.content;
          activity.error = execution.error;
          options.callbacks.onActivity({ ...activity });
          messages.push({
            role: "tool",
            toolCallId: call.id,
            content: execution.content,
          });
        }
      }

      throw new Error(`Agent stopped after reaching the ${this.maxRounds}-round safety limit.`);
    } finally {
      if (this.activeRequestId === options.requestId) {
        this.activeRequestId = null;
        this.activeController = null;
      }
    }
  }

  abort(requestId: string): void {
    if (this.activeRequestId === requestId) {
      this.activeController?.abort();
    }
  }

  private throwIfAborted(signal: AbortSignal): void {
    if (signal.aborted) {
      throw new DOMException("Agent request aborted.", "AbortError");
    }
  }
}

function createActivity(call: ToolCall): ToolActivityRecord {
  return {
    id: `activity-${call.id}`,
    toolCallId: call.id,
    toolName: call.function.name,
    arguments: call.function.arguments,
    status: "requested" satisfies ToolActivityStatus,
  };
}
