/**
 * loom-config — Central configuration for the Loom coding agent.
 *
 * Wires together the AI provider (Ollama), available tools,
 * and agent settings in one place.
 */

import { OllamaProvider } from "@loom/ai";
import type { AIProvider, ToolDefinition } from "@loom/ai";
import { allToolDefinitions } from "@loom/agent";

// ─── Provider Configuration ───────────────────────────────────────

export interface LoomConfig {
  /** The active AI provider instance */
  provider: AIProvider;
  /** All tool definitions the agent can use */
  tools: ToolDefinition[];
  /** Display name shown in the TUI */
  agentName: string;
  /** Current version tag */
  version: string;
  /** Maximum tool-use rounds per turn */
  maxToolRounds: number;
}

/**
 * Creates the default Loom configuration using the locally
 * installed Ollama model.
 *
 * Detects model from LOOM_MODEL env var or defaults to "ornith:9b".
 */
export function createDefaultConfig(): LoomConfig {
  const modelName = process.env.LOOM_MODEL ?? "ornith:9b";
  const endpoint =
    process.env.LOOM_OLLAMA_ENDPOINT ?? "http://localhost:11434/api/chat";

  const provider = new OllamaProvider(modelName, endpoint);

  return {
    provider,
    tools: allToolDefinitions,
    agentName: "Loom Coding Agent",
    version: "v0.1",
    maxToolRounds: 10,
  };
}

/**
 * Creates a config with a custom Ollama model name.
 */
export function createOllamaConfig(modelName: string): LoomConfig {
  const endpoint =
    process.env.LOOM_OLLAMA_ENDPOINT ?? "http://localhost:11434/api/chat";

  const provider = new OllamaProvider(modelName, endpoint);

  return {
    provider,
    tools: allToolDefinitions,
    agentName: `Loom (${modelName})`,
    version: "v0.1",
    maxToolRounds: 10,
  };
}
