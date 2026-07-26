import { createCliRenderer, TextRenderable } from "@opentui/core";
import { createInput } from "./src/input";
import { slashCommands } from "./src/slash-command";
import { createSideBar } from "./src/sidebar";
import { createDefaultConfig } from "@loom/config";
import { runAgentLoop } from "@loom/agent";
import type { AIChatMessage } from "@loom/ai";

// ─── Bootstrap ────────────────────────────────────────────────────

const config = createDefaultConfig();
const renderer = await createCliRenderer();

// Conversation history persists across turns
let conversationHistory: AIChatMessage[] = [];

// ─── Slash Commands ───────────────────────────────────────────────

let commandList = "";

for (let i = 0; i < 5; i = i + 1) {
  commandList =
    commandList +
    slashCommands[i].name +
    slashCommands[i].description;
}

const commandText = new TextRenderable(renderer, {
  id: "command-list",
  content: commandList,
  fg: "#94a3b8",
});

// ─── Sidebar ──────────────────────────────────────────────────────

const sidebar = createSideBar(renderer, {
  version: config.version,
  subphase: "Idle — waiting for input",
  iteration: { current: 0, max: 0 },
  steps: [
    { name: "Tester", status: "Pending" },
    { name: "Implementer", status: "Pending" },
    { name: "QC", status: "Pending" },
    { name: "Evaluator", status: "Pending" },
  ],
});

sidebar.pushlog(`Model: ${config.provider.name}`);
sidebar.pushlog(`Tools: read_file, write_file`);
sidebar.pushlog("Ready. Type a message to begin.");

// ─── Response Display ─────────────────────────────────────────────

const responseText = new TextRenderable(renderer, {
  id: "response-display",
  content: "",
});

// ─── Input Handling ───────────────────────────────────────────────

const input = createInput();

input.on("submit", async (value: string) => {
  const userMessage = value.trim();
  if (!userMessage) return;

  // Clear input and show user message
  input.value = "";
  responseText.content = `\n> ${userMessage}\n\nThinking...`;

  // Update sidebar state
  sidebar.update({
    subphase: "Processing query",
    iteration: { current: 1, max: config.maxToolRounds },
    steps: [
      { name: "Tester", status: "Pending" },
      { name: "Implementer", status: "Running" },
      { name: "QC", status: "Pending" },
      { name: "Evaluator", status: "Pending" },
    ],
  });
  sidebar.pushlog(`User: ${userMessage.slice(0, 40)}...`);

  let streamedText = "";

  try {
    const { response, history } = await runAgentLoop(
      config.provider,
      userMessage,
      {
        onThinking: () => {
          sidebar.pushlog("Agent is thinking...");
        },
        onTextChunk: (chunk) => {
          streamedText += chunk;
          responseText.content = `\n> ${userMessage}\n\n${streamedText}`;
        },
        onTextDone: (fullText) => {
          responseText.content = `\n> ${userMessage}\n\n${fullText}`;
        },
        onToolCall: (name, args) => {
          sidebar.pushlog(`Tool call: ${name}`);
          sidebar.update({
            steps: [
              { name: "Tester", status: "Pending" },
              { name: "Implementer", status: "Running" },
              { name: "QC", status: "Running" },
              { name: "Evaluator", status: "Pending" },
            ],
          });
          try {
            const parsed = JSON.parse(args);
            if (parsed.path) {
              sidebar.pushlog(`  → ${parsed.path}`);
            }
          } catch {}
        },
        onToolResult: (name, result) => {
          try {
            const parsed = JSON.parse(result);
            if (parsed.success) {
              sidebar.pushlog(`  ✓ ${name} succeeded`);
            } else {
              sidebar.pushlog(`  ✗ ${name}: ${parsed.error?.slice(0, 30)}`);
            }
          } catch {
            sidebar.pushlog(`  ✓ ${name} done`);
          }
        },
        onDone: (finalResponse) => {
          sidebar.update({
            subphase: "Idle — waiting for input",
            iteration: { current: 0, max: 0 },
            steps: [
              { name: "Tester", status: "Passed" },
              { name: "Implementer", status: "Passed" },
              { name: "QC", status: "Passed" },
              { name: "Evaluator", status: "Passed" },
            ],
          });
          sidebar.pushlog("Turn complete.");
        },
        onError: (error) => {
          sidebar.pushlog(`ERROR: ${error.message.slice(0, 40)}`);
          responseText.content = `\n> ${userMessage}\n\n❌ Error: ${error.message}`;
        },
      },
      conversationHistory
    );

    // Persist conversation so next turn has context
    conversationHistory = history;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    responseText.content = `\n> ${userMessage}\n\n❌ Error: ${msg}`;
    sidebar.pushlog(`Fatal error: ${msg.slice(0, 40)}`);
  }

  input.focus();
});

// ─── Render Layout ────────────────────────────────────────────────

renderer.root.add(sidebar.container);
renderer.root.add(commandText);
renderer.root.add(responseText);
renderer.root.add(input);

input.focus();