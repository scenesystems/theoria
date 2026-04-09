import { HttpServerResponse } from "@effect/platform"
import { Effect } from "effect"

import {
  OpenAgentTraceConsumerArtifactCatalogSuccessEnvelope,
  OpenAgentTraceRegistrySuccessEnvelope,
  OpenAgentTraceWorkflowHookupCatalogSuccessEnvelope
} from "../../contracts/study/workflow/open-agent-trace.js"
import { ResponseTiming } from "../kernel/response-timing.js"
import { OpenAgentTraceService } from "../study/workflow/open-agent-trace/service.js"

const responseHeaders = {
  "cache-control": "no-store"
}

const jsonResponse = (body: unknown, status: number) =>
  HttpServerResponse.json(body, {
    status,
    headers: responseHeaders
  })

export const openAgentTraceRouteNotFoundResponse = (requestId: string) =>
  Effect.gen(function*() {
    const timing = yield* ResponseTiming.start(requestId)

    return yield* jsonResponse(
      yield* timing.fail({
        code: "route-not-found",
        message: "Open-agent-trace route not found.",
        retryable: false
      }),
      404
    )
  })

export const openAgentTraceRegistryResponse = (requestId: string) =>
  Effect.gen(function*() {
    const timing = yield* ResponseTiming.start(requestId)
    const service = yield* OpenAgentTraceService
    const registry = yield* service.registry()
    const envelope = OpenAgentTraceRegistrySuccessEnvelope.make({
      ok: true,
      meta: yield* timing.finish(),
      data: registry
    })

    return yield* jsonResponse(envelope, 200)
  })

export const openAgentTraceConsumerArtifactResponse = (requestId: string) =>
  Effect.gen(function*() {
    const timing = yield* ResponseTiming.start(requestId)
    const service = yield* OpenAgentTraceService
    const catalog = yield* service.consumerArtifacts()
    const envelope = OpenAgentTraceConsumerArtifactCatalogSuccessEnvelope.make({
      ok: true,
      meta: yield* timing.finish(),
      data: catalog
    })

    return yield* jsonResponse(envelope, 200)
  })

export const openAgentTraceWorkflowHookupResponse = (requestId: string) =>
  Effect.gen(function*() {
    const timing = yield* ResponseTiming.start(requestId)
    const service = yield* OpenAgentTraceService
    const catalog = yield* service.workflowHookups()
    const envelope = OpenAgentTraceWorkflowHookupCatalogSuccessEnvelope.make({
      ok: true,
      meta: yield* timing.finish(),
      data: catalog
    })

    return yield* jsonResponse(envelope, 200)
  })
