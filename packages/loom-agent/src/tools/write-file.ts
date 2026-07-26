import type { ToolDefinition } from "@loom/ai";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";

/**
 * Tool definition for the AI model — describes the write_file function
 * so the LLM knows how to call it via tool_calls.
 */
export const writeFileDefinition: ToolDefinition = {
  name: "write_file",
  description:
    "Write content to a file at the given absolute path. " +
    "Creates the file if it doesn't exist, or overwrites it if it does. " +
    "Parent directories are created automatically. " +
    "Use this to create new source files, modify existing code, write configs, etc.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description:
          "The absolute path to the file to write (e.g. /Users/dev/project/output.ts)",
      },
      content: {
        type: "string",
        description: "The full content to write to the file.",
      },
    },
    required: ["path", "content"],
  },
};

/**
 * Maximum content size we'll write (1 MB). Prevents accidental
 * massive file creation from LLM hallucinations.
 */
const MAX_WRITE_SIZE = 1024 * 1024;

export interface WriteFileResult {
  success: boolean;
  path: string;
  bytesWritten?: number;
  created?: boolean;
  error?: string;
}

/**
 * Execute the write_file tool with the given arguments from the LLM.
 */
export function executeWriteFile(args: {
  path: string;
  content: string;
}): WriteFileResult {
  const { path, content } = args;

  if (!path || typeof path !== "string") {
    return {
      success: false,
      path: path ?? "",
      error: "Missing or invalid 'path' argument. Provide an absolute file path.",
    };
  }

  if (content === undefined || content === null) {
    return {
      success: false,
      path,
      error: "Missing 'content' argument. Provide the file content to write.",
    };
  }

  const contentStr = String(content);

  if (contentStr.length > MAX_WRITE_SIZE) {
    return {
      success: false,
      path,
      error: `Content is too large (${contentStr.length} chars). Maximum allowed is ${MAX_WRITE_SIZE}.`,
    };
  }

  try {
    const fileExisted = existsSync(path);

    // Ensure parent directories exist
    const dir = dirname(path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(path, contentStr, "utf-8");

    return {
      success: true,
      path,
      bytesWritten: Buffer.byteLength(contentStr, "utf-8"),
      created: !fileExisted,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      path,
      error: `Failed to write file: ${message}`,
    };
  }
}
