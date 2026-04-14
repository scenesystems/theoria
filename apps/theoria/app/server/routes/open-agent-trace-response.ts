import { HttpServerRequest, HttpServerResponse } from "@effect/platform"
import { Effect } from "effect"

import type { ErrorCode } from "../../contracts/error.js"
import {
  AmpThreadImportRequest,
  AmpThreadImportSuccessEnvelope,
  OpenAgentTraceConsumerArtifactCatalogSuccessEnvelope,
  OpenAgentTraceRegistrySuccessEnvelope,
  OpenAgentTraceRequestError,
  OpenAgentTraceWorkflowHookupCatalogSuccessEnvelope
} from "../../contracts/study/workflow/open-agent-trace.js"
import { ResponseTiming } from "../kernel/response-timing.js"
import { importAmpThread } from "../study/workflow/open-agent-trace/import/amp-thread.js"
import { OpenAgentTraceService } from "../study/workflow/open-agent-trace/service.js"

const responseHeaders = {
  "cache-control": "no-store"
}

const jsonResponse = (body: unknown, status: number) =>
  HttpServerResponse.json(body, {
    status,
    headers: responseHeaders
  })

const threadImportFailureResponse = (
  requestId: string,
  options: {
    readonly code: ErrorCode
    readonly message: string
    readonly retryable: boolean
    readonly status: number
  }
) =>
  Effect.gen(function*() {
    const timing = yield* ResponseTiming.start(requestId)

    return yield* jsonResponse(
      yield* timing.fail({
        code: options.code,
        message: options.message,
        retryable: options.retryable
      }),
      options.status
    )
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
    const envelope = OpenAgentTraceRegistrySuccessEnvelope.ok(yield* timing.finish(), registry)

    return yield* jsonResponse(envelope, 200)
  })

export const openAgentTraceConsumerArtifactResponse = (requestId: string) =>
  Effect.gen(function*() {
    const timing = yield* ResponseTiming.start(requestId)
    const service = yield* OpenAgentTraceService
    const catalog = yield* service.consumerArtifacts()
    const envelope = OpenAgentTraceConsumerArtifactCatalogSuccessEnvelope.ok(yield* timing.finish(), catalog)

    return yield* jsonResponse(envelope, 200)
  })

export const openAgentTraceWorkflowHookupResponse = (requestId: string) =>
  Effect.gen(function*() {
    const timing = yield* ResponseTiming.start(requestId)
    const service = yield* OpenAgentTraceService
    const catalog = yield* service.workflowHookups()
    const envelope = OpenAgentTraceWorkflowHookupCatalogSuccessEnvelope.ok(yield* timing.finish(), catalog)

    return yield* jsonResponse(envelope, 200)
  })

export const openAgentTraceThreadImportResponse = (requestId: string) =>
  Effect.flatMap(HttpServerRequest.HttpServerRequest, (httpRequest) =>
    httpRequest.method !== "POST"
      ? threadImportFailureResponse(requestId, {
        code: "invalid-query",
        message: "Amp thread imports require POST.",
        retryable: false,
        status: 405
      })
      : HttpServerRequest.schemaBodyJson(AmpThreadImportRequest).pipe(
        Effect.mapError(() =>
          new OpenAgentTraceRequestError({
            message: "Amp thread imports require a JSON body encoded through the shared open-agent-trace contract."
          })
        ),
        Effect.flatMap((request) =>
          Effect.gen(function*() {
            const timing = yield* ResponseTiming.start(requestId)
            const payload = yield* importAmpThread(request)
            const envelope = AmpThreadImportSuccessEnvelope.ok(yield* timing.finish(), payload)

            return yield* jsonResponse(envelope, 200)
          })
        ),
        Effect.catchTag("OpenAgentTraceRequestError", (error) =>
          threadImportFailureResponse(requestId, {
            code: "invalid-query",
            message: error.message,
            retryable: false,
            status: 400
          })),
        Effect.catchTag("OpenAgentTraceDecodeError", (error) =>
          threadImportFailureResponse(requestId, {
            code: "execution-failed",
            message: error.message,
            retryable: false,
            status: 422
          })),
        Effect.catchTag("OpenAgentTraceExecutionError", (error) =>
          threadImportFailureResponse(requestId, {
            code: error.code,
            message: error.message,
            retryable: error.retryable,
            status: error.code === "provider-unavailable" ? 503 : 500
          }))
      ))
