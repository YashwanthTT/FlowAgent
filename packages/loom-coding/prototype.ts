/**
 * Barebone coding-agent prototype.
 *
 * - Input stream : stdin  (type a message, "exit" to quit)
 * - Output stream: stdout (model text + tool activity)
 * - Tools        : read_file, write_file
 * - Model        : ornith:9b via local Ollama (http://localhost:11434)
 *
 * Run: bun run packages/loom-coding/prototype.ts
 */

import * as readline from "node:readline/promises";
import { readFileSync, writeFileSync } from "node:fs";

const OLLAMA_URL = "http://localhost:11434/api/chat";
const MODEL = "ornith:9b";
const MAX_TOOL_ROUNDS = 10;

// ─── Types ────────────────────────────────────────────────────────

type Message = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_calls?: ToolCall[];
};

type ToolCall = {
  function: { name: string; arguments: Record<string, unknown> };
};

// ─── Tools ────────────────────────────────────────────────────────

const tools = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the contents of a file from disk",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the file" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write content to a file on disk (overwrites if it exists)",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the file" },
          content: { type: "string", description: "Content to write" },
        },
        required: ["path", "content"],
      },
    },
  },
];

function executeTool(name: string, args: Record<string, unknown>): string {
  try {
    if (name === "read_file") {
      return readFileSync(String(args.path), "utf-8");
    }
    if (name === "write_file") {
      writeFileSync(String(args.path), String(args.content), "utf-8");
      return `OK: wrote ${String(args.content).length} chars to ${args.path}`;
    }
    return `ERROR: unknown tool "${name}"`;
  } catch (err) {
    return `ERROR: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ─── Ollama call ──────────────────────────────────────────────────

async function chat(messages: Message[]): Promise<Message> {
  const res = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages, tools, stream: false }),
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { message: Message };
  return data.message;
}

// ─── Agent loop ───────────────────────────────────────────────────

const systemPrompt =
  "You are a coding agent. You have two tools: read_file and write_file. " +
  "Use them to inspect and modify files. Paths are relative to the current " +
  "working directory. When the task is done, reply with a short summary.";

async function runAgent(userInput: string, history: Message[]): Promise<void> {
  history.push({ role: "user", content: userInput });

  for (let round = 1; round <= MAX_TOOL_ROUNDS; round++) {
    const msg = await chat(history);
    history.push(msg);

    // No tool calls → final answer, print and return
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      console.log(`\nassistant: ${msg.content}\n`);
      return;
    }

    // Execute each tool call and feed results back
    for (const call of msg.tool_calls) {
      const { name, arguments: args } = call.function;
      console.log(`  [tool] ${name}(${JSON.stringify(args)})`);
      const result = executeTool(name, args);
      console.log(`  [tool] -> ${result.slice(0, 120)}${result.length > 120 ? "..." : ""}`);
      history.push({ role: "tool", name, content: result });
    }
  }

  console.log("\nassistant: (stopped: max tool rounds reached)\n");
}

// ─── REPL (input/output stream) ───────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const history: Message[] = [{ role: "system", content: systemPrompt }];

console.log(`barebone agent | model=${MODEL} | tools=read_file,write_file | "exit" to quit`);

while (true) {
  let line = "";
  try {
    line = (await rl.question("you: ")).trim();
  } catch {
    break; // stdin closed (EOF, e.g. piped input)
  }
  if (!line) continue;
  if (line === "exit" || line === "quit") break;

  try {
    await runAgent(line, history);
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

rl.close();
