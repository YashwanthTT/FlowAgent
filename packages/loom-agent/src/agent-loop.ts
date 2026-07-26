import type { AIProvider, AIChatMessage, ToolCall } from "@loom/ai";
import { consumeStream } from "@loom/ai";
import { allToolDefinitions, executeTool } from "./tools";

/**
 * Callbacks the TUI can hook into to display agent activity in real-time.
 */
export interface AgentCallbacks {
  /** Called when the agent starts thinking */
  onThinking?: () => void;
  /** Called for each chunk of streamed text from the model */
  onTextChunk?: (chunk: string) => void;
  /** Called when the model finishes its text response */
  onTextDone?: (fullText: string) => void;
  /** Called when the model invokes a tool */
  onToolCall?: (name: string, args: string) => void;
  /** Called when a tool produces a result */
  onToolResult?: (name: string, result: string) => void;
  /** Called when the full agent turn is complete */
  onDone?: (finalResponse: string) => void;
  /** Called on error */
  onError?: (error: Error) => void;
}

/**
 * Maximum number of tool-use roundtrips before the agent is forced to stop.
 * Prevents infinite loops if the model keeps calling tools endlessly.
 */
const MAX_TOOL_ROUNDS = 10;

/**
 * The coding agent loop. Takes a user message, streams the response from
 * the AI model, executes any tool calls (read_file / write_file), feeds
 * results back, and repeats until the model responds with plain text.
 */
export async function runAgentLoop(
  provider: AIProvider,
  userMessage: string,
  callbacks: AgentCallbacks = {},
  conversationHistory: AIChatMessage[] = []
): Promise<{ response: string; history: AIChatMessage[] }> {
  const messages: AIChatMessage[] = [
    ...conversationHistory,
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: userMessage,
    },
  ];

  let finalResponse = "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    callbacks.onThinking?.();

    try {
      const stream = provider.streamChat(messages, allToolDefinitions);
      const result = await consumeStream(stream, {
        onTextChunk: (chunk) => callbacks.onTextChunk?.(chunk),
      });

      // If the model produced text without tool calls, we're done
      if (!result.toolCalls || result.toolCalls.length === 0) {
        finalResponse = result.content;
        callbacks.onTextDone?.(finalResponse);

        messages.push({
          role: "assistant",
          content: finalResponse,
        });

        break;
      }

      // The model wants to call tools — add the assistant message with tool_calls
      messages.push({
        role: "assistant",
        content: result.content,
        toolCalls: result.toolCalls,
      });

      // Execute each tool call and add results to conversation
      for (const toolCall of result.toolCalls) {
        callbacks.onToolCall?.(toolCall.name, toolCall.arguments);

        const toolResult = executeTool(toolCall.name, toolCall.arguments);
        callbacks.onToolResult?.(toolCall.name, toolResult);

        messages.push({
          role: "tool",
          content: toolResult,
          name: toolCall.name,
          toolCallId: toolCall.id,
        });
      }

      // Loop back — the model will see the tool results and respond again
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      callbacks.onError?.(error);
      finalResponse = `Error: ${error.message}`;
      break;
    }
  }

  callbacks.onDone?.(finalResponse);

  return { response: finalResponse, history: messages };
}

const SYSTEM_PROMPT = `You are Loom, an AI coding assistant running in a terminal.
You have access to the following tools:

1. **read_file** — Read the contents of a file by its absolute path.
2. **write_file** — Write or create a file at an absolute path with given content.

When the user asks you to read, inspect, or view a file, use the read_file tool.
When the user asks you to write, create, modify, or save a file, use the write_file tool.

Guidelines:
- Always use absolute paths when calling tools.
- When modifying a file, first read it with read_file, then write the full updated content with write_file.
- Provide clear, concise explanations of what you did.
- If a tool call fails, explain the error and suggest a fix.
- Keep your responses focused and helpful.`;
