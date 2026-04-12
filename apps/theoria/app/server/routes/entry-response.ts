import { HttpServerResponse } from "@effect/platform"
import { Match, Schedule, Stream } from "effect"

import { FailureEnvelope, Metadata } from "../../contracts/envelope.js"
import type { ErrorCode } from "../../contracts/error.js"
import { encodeEvidenceEventJson, type EvidenceEvent } from "../../contracts/evidence/stream.js"

const encoder = new TextEncoder()

const sseEvent = (event: EvidenceEvent): Uint8Array =>
  encoder.encode(`event: evidence\ndata: ${encodeEvidenceEventJson(event)}\n\n`)

const sseHeartbeat = encoder.encode(`: heartbeat\n\n`)

const heartbeatStream: Stream.Stream<Uint8Array, never, never> = Stream.repeatValue(sseHeartbeat).pipe(
  Stream.schedule(Schedule.spaced("8 seconds"))
)

const statusFromEnvelope = (envelope: { readonly ok: boolean; readonly error?: { readonly code: string } }): number =>
  Match.value(envelope.ok).pipe(
    Match.when(true, () => 200),
    Match.orElse(() =>
      Match.value(envelope.error?.code).pipe(
        Match.when("invalid-entry-id", () => 404),
        Match.when("route-not-found", () => 404),
        Match.orElse(() => 500)
      )
    )
  )

const failureEnvelope = (code: ErrorCode, message: string, requestId: string, retryable = false) =>
  FailureEnvelope.fromError(
    Metadata.make({
      requestId,
      buildSha: "unknown",
      durationMs: 0
    }),
    {
      code,
      message,
      retryable
    }
  )

export const jsonResponse = <A extends { readonly ok: boolean; readonly error?: { readonly code: string } }>(body: A) =>
  HttpServerResponse.json(body, {
    status: statusFromEnvelope(body),
    headers: {
      "cache-control": "no-store"
    }
  })

export const routeNotFoundEnvelope = (requestId: string) =>
  failureEnvelope(
    "route-not-found",
    "Entry route must be /api/entries/:id/run, /api/entries/:id/preload, or /api/entries/:id/stream.",
    requestId
  )

export const invalidEntryEnvelope = (requestId: string) =>
  failureEnvelope("invalid-entry-id", "Requested entry does not exist.", requestId)

export const invalidQueryEnvelope = (requestId: string, message: string) =>
  failureEnvelope("invalid-query", message, requestId)

export const executionFailureEnvelope = (requestId: string) =>
  failureEnvelope("execution-failed", "Entry execution failed.", requestId, true)

export const streamEvidenceResponse = (stream: Stream.Stream<EvidenceEvent, never, never>) =>
  HttpServerResponse.stream(Stream.merge(Stream.map(stream, sseEvent), heartbeatStream, { haltStrategy: "left" }), {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      "connection": "keep-alive"
    }
  })
