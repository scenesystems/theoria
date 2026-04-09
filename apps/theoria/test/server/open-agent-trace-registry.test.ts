import { HttpServerResponse } from "@effect/platform"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Schema } from "effect"

import {
  type OpenAgentTraceRegistryEntry,
  OpenAgentTraceRegistryEnvelope
} from "../../app/contracts/study/workflow/open-agent-trace.js"
import { RuntimeInfoLive } from "../../app/server/config/runtime.js"
import { openAgentTraceRoute } from "../../app/server/routes/open-agent-trace.js"
import { loadOpenAgentTraceRegistry } from "../../app/server/study/workflow/open-agent-trace/registry.js"

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

const provideServer = <A, E, R>(effect: Effect.Effect<A, E, R>) => effect.pipe(Effect.provide(RuntimeInfoLive))

const coverageKinds = (entry: OpenAgentTraceRegistryEntry): ReadonlyArray<string> =>
  entry.workflowProjection.coverageGaps.map((gap) => gap.sourceKind)

describe("server/open-agent-trace-registry", () => {
  it.effect("serves package-authored normalized records and workflow projections for read-only corpus inspection", () =>
    provideServer(
      Effect.gen(function*() {
        const expectedRegistry = yield* loadOpenAgentTraceRegistry
        const response = yield* openAgentTraceRoute("/api/open-agent-trace/registry", "req-open-agent-trace")
        const envelope = yield* decodeWebJson(response, OpenAgentTraceRegistryEnvelope)

        expect(envelope.ok).toBe(true)

        if (!envelope.ok) {
          return
        }

        const entries = Option.all({
          taskFirst: Option.fromNullable(envelope.data[0]),
          chatContinuation: Option.fromNullable(envelope.data[1])
        })

        expect(Option.isSome(entries)).toBe(true)

        if (Option.isNone(entries)) {
          return
        }

        const { chatContinuation, taskFirst } = entries.value

        expect(envelope.data).toEqual(expectedRegistry)
        expect(taskFirst.record.source.datasetId).toBe("badlogicgames/pi-mono")
        expect(taskFirst.record.selection.selectionPolicy).toBe("latest-leaf")
        expect(taskFirst.workflowProjection.workflowRecord.graph.nodes.length).toBe(2)
        expect(coverageKinds(taskFirst)).toEqual([
          "compaction",
          "branch-summary",
          "custom-message",
          "label",
          "session-info",
          "image"
        ])
        expect(chatContinuation.workflowProjection.workflowRecord.workflowKind).toBe("chat-continuation")
        expect(coverageKinds(chatContinuation)).toEqual([])
      })
    ))
})
