import type { ToolDefinition } from "@loom/ai";
import { readFileSync, existsSync, statSync } from "fs";

/**
 * Tool definition for the AI model — describes the read_file function
 * so the LLM knows how to call it via tool_calls.
 */
export const readFileDefinition: ToolDefinition = {
  name: "read_file",
  description:
    "Read the contents of a file at the given absolute path. " +
    "Returns the file content as a string. Use this to inspect source code, " +
    "configuration files, logs, or any text file on disk.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description:
          "The absolute path to the file to read (e.g. /Users/dev/project/main.ts)",
      },
    },
    required: ["path"],
  },
};

/**
 * Maximum file size we'll read (512 KB). Prevents the agent from
 * accidentally dumping huge files into the context window.
 */
const MAX_FILE_SIZE = 512 * 1024;

export interface ReadFileResult {
  success: boolean;
  path: string;
  content?: string;
  error?: string;
  sizeBytes?: number;
  lineCount?: number;
}

/**
 * Execute the read_file tool with the given arguments from the LLM.
 */
export function executeReadFile(args: { path: string }): ReadFileResult {
  const { path } = args;

  if (!path || typeof path !== "string") {
    return {
      success: false,
      path: path ?? "",
      error: "Missing or invalid 'path' argument. Provide an absolute file path.",
    };
  }

  if (!existsSync(path)) {
    return {
      success: false,
      path,
      error: `File not found: ${path}`,
    };
  }

  try {
    const stat = statSync(path);

    if (stat.isDirectory()) {
      return {
        success: false,
        path,
        error: `Path is a directory, not a file: ${path}`,
      };
    }

    if (stat.size > MAX_FILE_SIZE) {
      return {
        success: false,
        path,
        error: `File is too large (${stat.size} bytes). Maximum allowed is ${MAX_FILE_SIZE} bytes.`,
        sizeBytes: stat.size,
      };
    }

    const content = readFileSync(path, "utf-8");
    const lineCount = content.split("\n").length;

    return {
      success: true,
      path,
      content,
      sizeBytes: stat.size,
      lineCount,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      path,
      error: `Failed to read file: ${message}`,
    };
  }
}
