# Loom — How Each File Connects

## 📦 Workspace Structure (Monorepo)

```
loom/
├── package.json          # Root workspace (workspaces: ["packages/*"])
├── tsconfig.base.json    # Shared TypeScript config
├── tsconfig.json         # Root TS config extending base
│
└── packages/
    ├── loom-ai/          # @loom/ai       — AI provider abstractions
    ├── loom-agent/       # @loom/agent    — Agent loop & tools
    ├── loom-config/      # @loom/config   — Wires provider + tools together
    └── loom-coding/      # @loom/loom-coding  — TUI (the "entry point")
```

Dependency graph (via `package.json`):

```
@loom/loom-coding  ──depends-on──>  @loom/config  ──>  @loom/ai
                                    @loom/agent    ─>  @loom/ai
                                    @loom/ai
```

---

## 🔗 File-by-File Connection Map

### 1. `@loom/ai` — The Foundation Layer

```
packages/loom-ai/
├── package.json          # No deps. The leaf package.
├── types.ts              ★ Defines all shared types: AIProvider, AIChatMessage, ToolDefinition,
│                           ToolCall, ChatResponse, ChatResponseChunk, Role
├── index.ts              ★ Re-exports everything from types.ts, events.ts, and the 3 providers
├── src/
│   ├── events.ts         ★ consumeStream(): takes AsyncIterable<ChatResponseChunk> and streams
│   │                       text/tool-call deltas into a final { content, toolCalls }.
│   ├── ollama.ts         ★ OllamaProvider implements AIProvider (chat + streamChat).
│   │                       Called by the agent loop to talk to a local Ollama server.
│   ├── openrouter.ts     ★ OpenRouterProvider implements AIProvider. Same interface, different API.
│   └── gemini.ts         ★ GeminiProvider (stub, not implemented).
│                           Throws "not implemented" on both chat() and streamChat().
```

**How it connects:**

- `types.ts` is the **contract** — every other package imports these types (`AIProvider`, `AIChatMessage`, `ToolDefinition`, etc.)
- `events.ts` exports `consumeStream()` used by `agent-loop.ts` to consume streaming responses
- `ollama.ts`, `openrouter.ts`, `gemini.ts` all implement `AIProvider` from `types.ts`
- `index.ts` re-exports everything so consumers can `import { OllamaProvider, consumeStream, AIProvider } from "@loom/ai"`

---

### 2. `@loom/agent` — The Agent Loop & Tools

```
packages/loom-agent/
├── package.json          # depends on @loom/ai
├── index.ts              ★ Re-exports: tool definitions/executors, runAgentLoop, AgentCallbacks
├── src/
│   ├── agent-loop.ts     ★ runAgentLoop(): The core agent orchestration.
│   │                       Takes an AIProvider + user message + callbacks + conversationHistory.
│   │                       Loops: send messages → stream response → execute tools → feed back.
│   │                       Uses consumeStream() from @loom/ai to parse streaming responses.
│   │                       Uses allToolDefinitions & executeTool from ./tools.
│   │                       Calls callbacks (onThinking, onTextChunk, onToolCall, etc.) for TUI.
│   │
│   └── tools/
│       ├── index.ts      ★ Bundles both tool definitions. Exports:
│       │                   - allToolDefinitions[] (passed to provider so LLM knows tools)
│       │                   - executeTool(name, argsJson) — dispatcher that calls read/write
│       ├── read-file.ts  ★ readFileDefinition (ToolDefinition) + executeReadFile(args)
│       │                   Uses Node fs: readFileSync, existsSync, statSync
│       └── write-file.ts ★ writeFileDefinition (ToolDefinition) + executeWriteFile(args)
│                           Uses Node fs: writeFileSync, existsSync, mkdirSync
```

**How it connects:**

- `agent-loop.ts` imports from `@loom/ai`: `AIProvider`, `AIChatMessage`, `ToolCall`, `consumeStream`
- `agent-loop.ts` imports from `./tools`: `allToolDefinitions`, `executeTool`
- `tools/index.ts` imports `ToolDefinition` from `@loom/ai` to type the definitions
- `agent-loop.ts` calls `provider.streamChat(messages, allToolDefinitions)` — the provider is injected from above, so it doesn't import providers directly
- Index re-exports everything consumed by `@loom/config` and `@loom/loom-coding`

---

### 3. `@loom/config` — Wires Everything Together

```
packages/loom-config/
├── package.json          # depends on @loom/ai, @loom/agent
├── index.ts              ★ createDefaultConfig() + createOllamaConfig()
│                           Creates a LoomConfig object that couples:
│                           - An AIProvider (e.g., new OllamaProvider(model, endpoint))
│                           - allToolDefinitions from @loom/agent
│                           - Metadata: agentName, version, maxToolRounds
```

**How it connects:**

- `index.ts` imports `OllamaProvider` from `@loom/ai` — this is where the **concrete provider decision** is made
- `index.ts` imports `allToolDefinitions` from `@loom/agent` — couples the config to the agent's available tools
- `index.ts` imports types (`AIProvider`, `ToolDefinition`) from `@loom/ai` for the `LoomConfig` interface
- Exported `createDefaultConfig()` is called by `loom-coding/index.ts` to get the runtime configuration

---

### 4. `@loom/loom-coding` — The TUI Application (Entry Point)

```
packages/loom-coding/
├── package.json          # depends on @opentui/core, @loom/ai, @loom/agent, @loom/config
├── index.ts              ★ BOOTSTRAP — the main() entry point called by `bun run packages/loom-coding/index.ts`
│                           Flow:
│                           1. createDefaultConfig()  from @loom/config  → gets { provider, tools, ... }
│                           2. createCliRenderer()    from @opentui/core → sets up TUI
│                           3. createInput()          from ./src/input   → input box
│                           4. createSideBar()        from ./src/sidebar → side panel
│                           5. Runs: slashCommands loop (builds command list)
│                           6. On input submit → calls runAgentLoop(config.provider, message, callbacks, history)
│                           7. All TUI rendering (responseText, sidebar updates, etc.) happens via callbacks
│
├── prototype.ts          ★ STANDALONE alternative entry point — a REPL (readline) version.
│                           No TUI, no @opentui/core. Direct stdin/stdout + fetch to Ollama.
│                           Self-contained: defines its own types, tools, provider calls inline.
│                           Does NOT import any @loom/* packages — it's a prototype that pre-dates
│                           the modular architecture.
│
├── src/
│   ├── input.ts          ★ createInput(): returns an Input component from @opentui/core
│   ├── sidebar.ts        ★ createSideBar(): builds the side panel showing version, steps, logs
│   ├── slash-command.ts  ★ slashCommands[]: list of { name, description } for /help, /clear, etc.
│   ├── notification.ts   ★ Notification helpers (exported but not used in index.ts yet)
│   └── cli-command.ts    ★ CLI command handling (exported but not wired yet)
```

**How it connects:**

- `index.ts` is the **main entry point** — it imports from all other packages:
  - `createDefaultConfig` from `@loom/config` (which itself already wires `@loom/ai` + `@loom/agent`)
  - `runAgentLoop`, `AgentCallbacks` from `@loom/agent`
  - `AIChatMessage` from `@loom/ai` (for typing the conversation history)
  - `createCliRenderer` from `@opentui/core`
  - `createInput`, `createSideBar`, `slashCommands` from local `./src/`
- The agent loop callbacks (`onThinking`, `onTextChunk`, `onToolCall`, `onToolResult`, `onDone`, `onError`) are the **bridge** between the agent and the TUI — they update the sidebar, push logs, and render text
- `prototype.ts` is a **standalone prototype** that doesn't use any `@loom/*` modules — it was the first proof-of-concept before the modular structure was extracted

---

## 🧵 Runtime Data Flow

```
User types message in Input
        │
        ▼
loom-coding/index.ts  ──on("submit")──>  runAgentLoop(provider, message, callbacks, history)
                                                │
                                                ▼
                                        agent-loop.ts
                                            │  for each round (max 10):
                                            │    provider.streamChat(messages, allToolDefinitions)
                                            │        │
                                            │        ▼
                                            │    ollama.ts (or openrouter.ts) → HTTP POST to AI API
                                            │        │
                                            │        ▼
                                            │    consumeStream() from events.ts ← yields chunks
                                            │        │
                                            │        ▼
                                            │    If tool_calls in response:
                                            │      executeTool(name, argsJson)
                                            │          ├── read-file.ts → readFileSync()
                                            │          └── write-file.ts → writeFileSync()
                                            │      Push tool result message back → next round
                                            │    Else (text only):
                                            │      response is final → break
                                            │
                                            ▼
                                    Returns { response, history }
                                        │
                                        ▼
                                TUI: sidebar updated, response displayed
```

---

## 🗺️ Summary Table

| File (Package) | Imports From | Used By | Role |
|---|---|---|---|
| `loom-ai/types.ts` | — | Everything | Shared type definitions (the contract) |
| `loom-ai/src/events.ts` | `../types` | `loom-agent/agent-loop.ts` | Stream consumer utility |
| `loom-ai/src/ollama.ts` | `../types` | `loom-config/index.ts` | Ollama provider (AIProvider impl) |
| `loom-ai/src/openrouter.ts` | `../types` | (exported, not yet used) | OpenRouter provider |
| `loom-ai/src/gemini.ts` | `../types` | (stub) | Gemini provider (not implemented) |
| `loom-ai/index.ts` | All above | `loom-config`, `loom-agent` | Barrel re-exports |
| `loom-agent/src/tools/read-file.ts` | `@loom/ai` | `tools/index.ts` | `read_file` tool |
| `loom-agent/src/tools/write-file.ts` | `@loom/ai` | `tools/index.ts` | `write_file` tool |
| `loom-agent/src/tools/index.ts` | `./read-file`, `./write-file`, `@loom/ai` | `agent-loop.ts` | Bundles tool definitions + dispatch |
| `loom-agent/src/agent-loop.ts` | `@loom/ai`, `./tools` | `loom-coding/index.ts` | Agent orchestration loop |
| `loom-agent/index.ts` | All above | `loom-config`, `loom-coding` | Barrel re-exports |
| `loom-config/index.ts` | `@loom/ai`, `@loom/agent` | `loom-coding/index.ts` | Wires provider + tools into config |
| `loom-coding/src/input.ts` | `@opentui/core` | `loom-coding/index.ts` | TUI input component |
| `loom-coding/src/sidebar.ts` | (local) | `loom-coding/index.ts` | TUI sidebar component |
| `loom-coding/src/slash-command.ts` | — | `loom-coding/index.ts` | Command definitions |
| `loom-coding/src/notification.ts` | (local) | (unused) | Notification helpers |
| `loom-coding/src/cli-command.ts` | (local) | (unused) | CLI command handlers |
| `loom-coding/prototype.ts` | Node built-ins only | Standalone | Pre-modular proof-of-concept REPL |
| `loom-coding/index.ts` | All `@loom/*` + local `./src/*` | **Entry point** | Bootstraps the TUI app |

---

**Key architectural insight:** The project follows a **layered dependency** pattern:

1. **`@loom/ai`** (leaf) — pure types + provider implementations, depends on nothing
2. **`@loom/agent`** (middle) — agent logic + tools, depends on `@loom/ai`
3. **`@loom/config`** (middle) — wires a specific provider + tools, depends on both
4. **`@loom/loom-coding`** (top) — UI + entry point, depends on everything

The **provider is injected** into `runAgentLoop()` at runtime (via `config.provider`), not hard-coded, so you could swap `OllamaProvider` for `OpenRouterProvider` simply by changing the config without touching the agent loop.
