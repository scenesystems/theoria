import { HttpServerResponse } from "@effect/platform"
import { Clock, Effect, Match, Schema } from "effect"

import {
  OpenAgentTraceApiRegistryPathname,
  OpenAgentTraceRegistryEnvelope
} from "../../contracts/study/workflow/open-agent-trace.js"
import { RuntimeInfo } from "../config/runtime.js"
import { loadOpenAgentTraceRegistry } from "../study/workflow/open-agent-trace/registry.js"

const registryResponse = (requestId: string) =>
  Effect.gen(function*() {
    const startedAtMs = yield* Clock.currentTimeMillis
    const registry = yield* loadOpenAgentTraceRegistry
    const runtimeInfo = yield* RuntimeInfo
    const endedAtMs = yield* Clock.currentTimeMillis
    const envelope = yield* Schema.decodeUnknown(OpenAgentTraceRegistryEnvelope)({
      ok: true,
      meta: {
        requestId,
        buildSha: runtimeInfo.buildSha,
        durationMs: endedAtMs - startedAtMs
      },
      data: registry
    })

    return yield* HttpServerResponse.json(envelope, {
      status: 200,
      headers: {
        "cache-control": "no-store"
      }
    })
  })

const notFoundResponse = (requestId: string) =>
  Effect.gen(function*() {
    const startedAtMs = yield* Clock.currentTimeMillis
    const runtimeInfo = yield* RuntimeInfo
    const endedAtMs = yield* Clock.currentTimeMillis

    return yield* HttpServerResponse.json(
      {
        ok: false,
        meta: {
          requestId,
          buildSha: runtimeInfo.buildSha,
          durationMs: endedAtMs - startedAtMs
        },
        error: {
          code: "route-not-found",
          message: "Open-agent-trace route not found.",
          retryable: false
        }
      },
      {
        status: 404,
        headers: {
          "cache-control": "no-store"
        }
      }
    )
  })

export const openAgentTraceRoute = (pathname: string, requestId: string) =>
  Match.value(pathname).pipe(
    Match.when(OpenAgentTraceApiRegistryPathname, () => registryResponse(requestId)),
    Match.orElse(() => notFoundResponse(requestId))
  )
