import { HttpServerRequest, HttpServerResponse } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Schema } from "effect"

import {
  AmpThreadImportEnvelope,
  AmpThreadImportRequest,
  canonicalAmpThreadSourceUrl,
  encodeRequestJson,
  OpenAgentTraceRegistryEnvelope,
  OpenAgentTraceThreadImportRoute
} from "../../app/contracts/study/workflow/open-agent-trace.js"
import { RuntimeInfoLive } from "../../app/server/config/runtime.js"
import { AmpThreadImportKernel } from "../../app/server/kernel/amp-thread-import/service.js"
import { openAgentTraceRoute } from "../../app/server/routes/open-agent-trace.js"
import { loadOpenAgentTraceRegistry } from "../../app/server/study/workflow/open-agent-trace/registry.js"
import {
  ampThreadExportSnapshotFixture,
  ampThreadImportRequestFixture
} from "../helpers/open-agent-trace-amp-thread-fixture.js"

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
  exportSnapshot: () => Effect.succeed(ampThreadExportSnapshotFixture)
})

const registryRequest = HttpServerRequest.fromWeb(new Request("http://127.0.0.1/api/open-agent-trace/registry"))

const importRequest = HttpServerRequest.fromWeb(
  new Request(`http://127.0.0.1${OpenAgentTraceThreadImportRoute.pathname()}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: encodeRequestJson(ampThreadImportRequestFixture)
  })
)

const spoofedImportRequest = HttpServerRequest.fromWeb(
  new Request(`http://127.0.0.1${OpenAgentTraceThreadImportRoute.pathname()}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: encodeRequestJson(
      AmpThreadImportRequest.make({
        sourceUrl: "https://example.com/not-the-thread-you-imported",
        threadId: ampThreadImportRequestFixture.threadId
      })
    )
  })
)

const importGetRequest = HttpServerRequest.fromWeb(
  new Request(`http://127.0.0.1${OpenAgentTraceThreadImportRoute.pathname()}`, {
    method: "GET"
  })
)

describe("server/open-agent-trace-import", () => {
  it.effect("imports a checked-in Amp thread snapshot through the app route without mutating the fixture registry", () =>
    Effect.gen(function*() {
      const expectedRegistry = yield* loadOpenAgentTraceRegistry.pipe(Effect.orDie)
      const importResponse = yield* openAgentTraceRoute(
        OpenAgentTraceThreadImportRoute.pathname(),
        "req-open-agent-trace-import"
      ).pipe(
        Effect.provideService(HttpServerRequest.HttpServerRequest, importRequest),
        Effect.provide(BunContext.layer),
        Effect.provide(ampThreadImportKernelTest),
        Effect.provide(RuntimeInfoLive)
      )
      const importEnvelope = yield* decodeWebJson(importResponse, AmpThreadImportEnvelope)
      const registryResponse = yield* openAgentTraceRoute(
        "/api/open-agent-trace/registry",
        "req-open-agent-trace-registry"
      ).pipe(
        Effect.provideService(HttpServerRequest.HttpServerRequest, registryRequest),
        Effect.provide(BunContext.layer),
        Effect.provide(ampThreadImportKernelTest),
        Effect.provide(RuntimeInfoLive)
      )
      const registryEnvelope = yield* decodeWebJson(registryResponse, OpenAgentTraceRegistryEnvelope)

      expect(importEnvelope.ok).toBe(true)
      expect(registryEnvelope.ok).toBe(true)

      if (!importEnvelope.ok || !registryEnvelope.ok) {
        return
      }

      expect(importEnvelope.data.consumerArtifact.sourceKind).toBe("amp-thread")
      expect(importEnvelope.data.workflowHookup.transport).toBe("import")
      expect(importEnvelope.data.registryEntry.record.source.sourceUrl).toBe(
        canonicalAmpThreadSourceUrl(ampThreadImportRequestFixture.threadId)
      )
      expect(importEnvelope.data.registryEntry.workflowProjection.coverageGaps.map((gap) => gap.sourceKind)).toContain(
        "tool-lifecycle"
      )
      expect(registryEnvelope.data).toEqual(expectedRegistry)
    }))

  it.effect("canonicalizes imported source provenance and rejects non-POST import requests", () =>
    Effect.gen(function*() {
      const spoofedResponse = yield* openAgentTraceRoute(
        OpenAgentTraceThreadImportRoute.pathname(),
        "req-open-agent-trace-import-spoofed"
      ).pipe(
        Effect.provideService(HttpServerRequest.HttpServerRequest, spoofedImportRequest),
        Effect.provide(BunContext.layer),
        Effect.provide(ampThreadImportKernelTest),
        Effect.provide(RuntimeInfoLive)
      )
      const spoofedEnvelope = yield* decodeWebJson(spoofedResponse, AmpThreadImportEnvelope)
      const getResponse = yield* openAgentTraceRoute(
        OpenAgentTraceThreadImportRoute.pathname(),
        "req-open-agent-trace-import-get"
      ).pipe(
        Effect.provideService(HttpServerRequest.HttpServerRequest, importGetRequest),
        Effect.provide(BunContext.layer),
        Effect.provide(ampThreadImportKernelTest),
        Effect.provide(RuntimeInfoLive)
      )
      const getEnvelope = yield* decodeWebJson(getResponse, AmpThreadImportEnvelope)

      expect(spoofedEnvelope.ok).toBe(true)
      expect(getEnvelope.ok).toBe(false)

      if (!spoofedEnvelope.ok || getEnvelope.ok) {
        return
      }

      expect(spoofedEnvelope.data.registryEntry.record.source.sourceUrl).toBe(
        canonicalAmpThreadSourceUrl(ampThreadImportRequestFixture.threadId)
      )
      expect(spoofedEnvelope.data.consumerArtifact.sourceUrl).toBe(
        canonicalAmpThreadSourceUrl(ampThreadImportRequestFixture.threadId)
      )
      expect(getEnvelope.error.code).toBe("invalid-query")
      expect(HttpServerResponse.toWeb(getResponse).status).toBe(405)
    }))
})
