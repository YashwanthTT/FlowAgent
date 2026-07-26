export { readFileDefinition, executeReadFile } from "./read-file";
export type { ReadFileResult } from "./read-file";

export { writeFileDefinition, executeWriteFile } from "./write-file";
export type { WriteFileResult } from "./write-file";

import { readFileDefinition, executeReadFile } from "./read-file";
import { writeFileDefinition, executeWriteFile } from "./write-file";
import type { ToolDefinition } from "@loom/ai";

/**
 * All tool definitions — pass these to the AI provider so it knows
 * which tools are available.
 */
export const allToolDefinitions: ToolDefinition[] = [
  readFileDefinition,
  writeFileDefinition,
];

/**
 * Execute a tool call by name. Returns a JSON string result
 * to be sent back to the model as a tool response message.
 */
export function executeTool(name: string, argsJson: string): string {
  let args: Record<string, unknown>;

  try {
    args = JSON.parse(argsJson);
  } catch {
    return JSON.stringify({
      success: false,
      error: `Failed to parse tool arguments as JSON: ${argsJson}`,
    });
  }

  switch (name) {
    case "read_file":
      return JSON.stringify(
        executeReadFile(args as { path: string })
      );

    case "write_file":
      return JSON.stringify(
        executeWriteFile(args as { path: string; content: string })
      );

    default:
      return JSON.stringify({
        success: false,
        error: `Unknown tool: ${name}`,
      });
  }
}
