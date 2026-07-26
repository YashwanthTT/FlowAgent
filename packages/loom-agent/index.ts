/**
 * @loom/agent — The agent core package.
 *
 * Exports:
 * - Tools (read_file, write_file) + definitions + executor
 * - Agent loop (the main conversation orchestrator)
 */

export {
  readFileDefinition,
  executeReadFile,
  writeFileDefinition,
  executeWriteFile,
  allToolDefinitions,
  executeTool,
} from "./src/tools";

export type { ReadFileResult } from "./src/tools";
export type { WriteFileResult } from "./src/tools";

export { runAgentLoop } from "./src/agent-loop";
export type { AgentCallbacks } from "./src/agent-loop";
