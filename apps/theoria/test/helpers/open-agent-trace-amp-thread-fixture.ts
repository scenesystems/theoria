import { Schema } from "effect"
import * as Experimental from "effect-dsp/experimental"

import { AmpThreadImportRequest } from "../../app/contracts/study/workflow/open-agent-trace.js"

const fixtureThreadId = "T-019d8454-ca5d-744b-ba6c-58084623ae37"
const secondFixtureThreadId = "T-019d8454-ca5d-744b-ba6c-58084623ae38"

export const ampThreadImportRequestFixture = AmpThreadImportRequest.make({
  sourceUrl: `https://ampcode.com/threads/${fixtureThreadId}`,
  threadId: fixtureThreadId
})

export const secondAmpThreadImportRequestFixture = AmpThreadImportRequest.make({
  sourceUrl: `https://ampcode.com/threads/${secondFixtureThreadId}`,
  threadId: secondFixtureThreadId
})

export const ampThreadExportSnapshotFixture = Schema.decodeUnknownSync(
  Experimental.OpenAgentTrace.AmpThreadExportSnapshot
)({
  v: 1,
  id: fixtureThreadId,
  title: "Open-Agent-Trace Import Proof",
  created: 1775952000000,
  updatedAt: 1775952060000,
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

export const secondAmpThreadExportSnapshotFixture = Schema.decodeUnknownSync(
  Experimental.OpenAgentTrace.AmpThreadExportSnapshot
)({
  v: 1,
  id: secondFixtureThreadId,
  title: "Open-Agent-Trace Import Proof Followup",
  created: 1775952100000,
  updatedAt: 1775952160000,
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
      meta: { sentAt: 1775952100000 },
      content: [{ type: "text", text: "Import the second open-agent-trace proof thread." }]
    },
    {
      messageId: 2,
      role: "assistant",
      meta: { sentAt: 1775952101000 },
      content: [{ type: "text", text: "I will project it through the same workflow surface." }]
    },
    {
      messageId: 3,
      role: "assistant",
      meta: { sentAt: 1775952102000 },
      content: [{
        type: "tool_use",
        id: "toolu_open_agent_trace_cat",
        name: "shell_command",
        input: {
          command: "cat apps/theoria/app/contracts/study/workflow/open-agent-trace.ts",
          workdir: "/Users/metis/Projects/hawalilabs/scenesystems/theoria"
        }
      }]
    },
    {
      messageId: 4,
      role: "user",
      meta: { sentAt: 1775952103000 },
      content: [{
        type: "tool_result",
        toolUseID: "toolu_open_agent_trace_cat",
        run: {
          status: "done",
          result: {
            stdout: "export * from \"./open-agent-trace/thread-import.js\"",
            stderr: "",
            exitCode: 0
          }
        }
      }]
    },
    {
      messageId: 5,
      role: "assistant",
      meta: { sentAt: 1775952104000 },
      content: [{
        type: "text",
        text: "The second import should stay additive even when it projects to the same workflow kind."
      }]
    }
  ]
})
