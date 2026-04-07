import { HttpServerResponse } from "@effect/platform"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import { OpenAgentTraceRegistryEnvelope } from "../../app/contracts/open-agent-trace.js"
import { RuntimeInfoLive } from "../../app/server/config/runtime.js"
import { openAgentTraceRoute } from "../../app/server/routes/open-agent-trace.js"
import { openAgentTracePageModel } from "../../app/web/view/open-agent-trace/model.js"

class ResponseJsonError extends Schema.TaggedError<ResponseJsonError>()("ResponseJsonError", {
  message: Schema.String
}) {}

const decodeWebJson = <A, I>(
  response: HttpServerResponse.HttpServerResponse,
  schema: Schema.Schema<A, I>
) =>
  Effect.gen(function*() {
    const webResponse = HttpServerResponse.toWeb(response)
    const body = yield* Effect.tryPromise({
      try: () => webResponse.json(),
      catch: (cause) => new ResponseJsonError({ message: String(cause) })
    }).pipe(Effect.orDie)

    return yield* Schema.decodeUnknown(schema)(body).pipe(Effect.orDie)
  })

describe("web/open-agent-trace-orchestration", () => {
  it.effect("projects one normalized record, one workflow graph, and one coverage view for the read-only evidentiary surface", () =>
    Effect.gen(function*() {
      const response = yield* openAgentTraceRoute("/api/open-agent-trace/registry", "req-open-agent-trace-web").pipe(
        Effect.provide(RuntimeInfoLive)
      )
      const envelope = yield* decodeWebJson(response, OpenAgentTraceRegistryEnvelope)

      expect(envelope.ok).toBe(true)

      if (!envelope.ok) {
        return
      }

      const model = openAgentTracePageModel(envelope.data)
      const taskFirst = model.entries[0]
      const chatContinuation = model.entries[1]

      expect(model.summaryRows.map((row) => row.label)).toEqual([
        "Records",
        "Coverage Gaps",
        "Experimental Surface"
      ])
      expect(taskFirst?.sourceRows.find((row) => row.label === "Dataset")?.value).toBe("badlogicgames/pi-mono")
      expect(taskFirst?.branchItems[0]?.label).toBe("00000007")
      expect(taskFirst?.workflowRows.find((row) => row.label === "Workflow Kind")?.value).toBe("task-first")
      expect(taskFirst?.graphNodeItems[0]?.label).toBe("task-planner")
      expect(taskFirst?.coverageItems.map((item) => item.label).slice(0, 5)).toEqual([
        "compaction · coverage:0000000a",
        "branch-summary · coverage:00000007",
        "custom-message · coverage:00000009",
        "label · coverage:0000000b",
        "session-info · coverage:0000000c"
      ])
      expect(taskFirst?.coverageItems[5]?.label.startsWith("image · coverage:00000004")).toBe(true)
      expect(chatContinuation?.coverageItems).toEqual([])
      expect(chatContinuation?.graphNodeItems[0]?.label).toBe("chat-handoff")
    }))
})
