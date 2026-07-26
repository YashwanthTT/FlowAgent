import type {
  AIProvider,
  AIChatMessage,
  ToolDefinition,
  ChatResponse,
  ChatResponseChunk,
} from "../types";

/**
 * Placeholder for the Gemini AI provider.
 * TODO: Implement the Google Gemini API integration.
 */
export class GeminiProvider implements AIProvider {
  readonly id = "gemini";
  readonly name = "Google Gemini";

  constructor(
    private modelName: string = "gemini-pro",
    private apiKey: string = process.env.GEMINI_API_KEY ?? ""
  ) {}

  async chat(
    messages: AIChatMessage[],
    tools?: ToolDefinition[]
  ): Promise<ChatResponse> {
    throw new Error("GeminiProvider is not yet implemented");
  }

  async *streamChat(
    messages: AIChatMessage[],
    tools?: ToolDefinition[]
  ): AsyncIterable<ChatResponseChunk> {
    throw new Error("GeminiProvider is not yet implemented");
  }
}
