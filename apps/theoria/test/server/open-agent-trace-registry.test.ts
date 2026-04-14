import { HttpServerRequest, HttpServerResponse } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Option, Schema } from "effect"

import {
  type OpenAgentTraceRegistryEntry,
  OpenAgentTraceRegistryEnvelope
} from "../../app/contracts/study/workflow/open-agent-trace.js"
import { RuntimeInfoLive } from "../../app/server/config/runtime.js"
import { AmpThreadImportKernel } from "../../app/server/kernel/amp-thread-import/service.js"
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

const ampThreadImportKernelTest = Layer.succeed(AmpThreadImportKernel, {
  _tag: "theoria/server/kernel/AmpThreadImportKernel",
  exportSnapshot: () => Effect.die("unused-open-agent-trace-import-kernel")
})

const provideServer = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.provideService(
      HttpServerRequest.HttpServerRequest,
      HttpServerRequest.fromWeb(new Request("http://127.0.0.1/api/open-agent-trace/registry"))
    ),
    Effect.provide(BunContext.layer),
    Effect.provide(ampThreadImportKernelTest),
    Effect.provide(RuntimeInfoLive)
  )

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
          taskFirst: Option.fromNullable(
            envelope.data.find((entry) => entry.workflowProjection.workflowRecord.workflowKind === "task-first")
          ),
          chatContinuation: Option.fromNullable(
            envelope.data.find((entry) => entry.workflowProjection.workflowRecord.workflowKind === "chat-continuation")
          )
        })

        expect(Option.isSome(entries)).toBe(true)

        if (Option.isNone(entries)) {
          return
        }

        const { chatContinuation, taskFirst } = entries.value

        expect(envelope.data).toEqual(expectedRegistry)
        expect(taskFirst.entryId).toBe(taskFirst.record.recordId)
        expect(taskFirst.record.source.datasetId).toBe("badlogicgames/pi-mono")
        expect(taskFirst.record.selection.selectionPolicy).toBe("latest-leaf")
        expect(taskFirst.workflowHookup.transport).toBe("registry")
        expect(taskFirst.workflowProjection.workflowRecord.graph.nodes.length).toBe(2)
        expect(coverageKinds(taskFirst)).toEqual([
          "compaction",
          "branch-summary",
          "custom-message",
          "label",
          "session-info",
          "image"
        ])
        expect(chatContinuation.entryId).toBe(chatContinuation.record.recordId)
        expect(chatContinuation.workflowProjection.workflowRecord.workflowKind).toBe("chat-continuation")
        expect(coverageKinds(chatContinuation)).toEqual([])
      })
    ))
})
