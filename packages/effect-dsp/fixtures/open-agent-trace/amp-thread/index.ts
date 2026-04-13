import { Effect, Schema } from "effect"

import { AmpThreadExportSnapshot } from "../../../src/OpenAgentTrace/ampThread/schema.js"

export const threadId = "T-019d8454-ca5d-744b-ba6c-58084623ae37"
export const sourceUrl = `https://ampcode.com/threads/${threadId}`

export const exportSnapshot = Schema.decodeUnknownSync(AmpThreadExportSnapshot)({
  v: 1,
  id: threadId,
  title: "Open-Agent-Trace Import Proof",
  created: "2026-04-12T00:00:00.000Z",
  updatedAt: "2026-04-12T00:01:00.000Z",
  agentMode: "smart",
  env: {
    initial: {
      trees: [{ uri: "file:///Users/metis/Projects/hawalilabs/scenesystems/theoria" }]
    }
  },
  messages: [
    {
      messageId: 1,
      role: "user",
      meta: { sentAt: 1775952000000 },
      content: [{ type: "text", text: "Inspect the open-agent-trace import seam." }]
    },
    {
      messageId: 2,
      role: "assistant",
      meta: { sentAt: 1775952001000 },
      content: [{ type: "text", text: "I'll trace the existing registry and workflow projection path first." }]
    },
    {
      messageId: 3,
      role: "assistant",
      meta: { sentAt: 1775952002000 },
      content: [{
        type: "tool_use",
        id: "toolu_open_agent_trace_rg",
        name: "shell_command",
        input: {
          command: "rg -n \"open-agent-trace\" apps/theoria/app",
          workdir: "/Users/metis/Projects/hawalilabs/scenesystems/theoria"
        }
      }]
    },
    {
      messageId: 4,
      role: "user",
      meta: { sentAt: 1775952003000 },
      content: [{
        type: "tool_result",
        toolUseID: "toolu_open_agent_trace_rg",
        run: {
          status: "done",
          result: {
            stdout: "apps/theoria/app/server/routes/open-agent-trace.ts:12:export const openAgentTraceRoute = ...",
            stderr: "",
            exitCode: 0
          }
        }
      }]
    },
    {
      messageId: 5,
      role: "assistant",
      meta: { sentAt: 1775952004000 },
      content: [{
        type: "text",
        text:
          "The panel is read-only today, so the next step is a POST import route that normalizes one imported trace at a time."
      }]
    }
  ]
})

export const loadExportSnapshot = () => Effect.succeed(exportSnapshot)
