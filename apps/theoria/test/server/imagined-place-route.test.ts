import type { HttpServerRequest } from "@effect/platform"
import { Headers, HttpClientRequest, HttpClientResponse, HttpServerResponse } from "@effect/platform"
import { describe, expect, it } from "@effect/vitest"
import { Cipher } from "@scenesystems/seal"
import { Data, Effect, Layer, Ref, Schema } from "effect"
import * as Arr from "effect/Array"

import { Failure, Success } from "../../app/contracts/envelope.js"
import { PlaceBuild, PlaceBuildEnvelope } from "../../app/contracts/imagined-place-result.js"
import { PlaceBuildRequest } from "../../app/contracts/imagined-place.js"
import { PlaceBuildLimiter, refused, unlimited } from "../../app/server/config/place-build-limiter.js"
import { RuntimeInfo } from "../../app/server/config/runtime.js"
import { ParticipantsLive } from "../../app/server/imagined-place/authority.js"
import { imaginedPlacePath, imaginedPlaceRoute } from "../../app/server/routes/imagined-place.js"
import { serverRequest } from "./platform/web-request.js"

const RuntimeInfoTest = Layer.succeed(RuntimeInfo, { buildSha: "test-sha", startedAtMs: 0 })
const RouteLive = Layer.mergeAll(RuntimeInfoTest, ParticipantsLive, Cipher.layer, unlimited)

const encodeRequest = Schema.encode(Schema.parseJson(PlaceBuildRequest))
const decodeEnvelope = Schema.decode(Schema.parseJson(PlaceBuildEnvelope))
const decodeSuccessEnvelope = Schema.decodeUnknown(Success(PlaceBuild))
const decodeFailureEnvelope = Schema.decodeUnknown(Failure)

const request = (init: RequestInit) => serverRequest(`http://127.0.0.1${imaginedPlacePath}`, init)

const jsonBody = (body: string) => request({ method: "POST", body, headers: { "content-type": "application/json" } })

/** `sec-fetch-site` is a forbidden header for `Request`, so it is set on the server request directly. */
const crossSite = (incoming: HttpServerRequest.HttpServerRequest) =>
  incoming.modify({ headers: Headers.set(incoming.headers, "sec-fetch-site", "cross-site") })

const responseText = (
  incoming: HttpServerRequest.HttpServerRequest,
  response: HttpServerResponse.HttpServerResponse
) =>
  HttpClientResponse.fromWeb(
    HttpClientRequest.make(incoming.method)(`http://127.0.0.1${imaginedPlacePath}`),
    HttpServerResponse.toWeb(response)
  ).text

const call = (incoming: HttpServerRequest.HttpServerRequest, layer: typeof RouteLive = RouteLive) =>
  imaginedPlaceRoute(incoming, "req-1").pipe(
    Effect.flatMap((response) =>
      responseText(incoming, response).pipe(
        Effect.flatMap(decodeEnvelope),
        Effect.map((envelope) => Data.struct({ status: response.status, headers: response.headers, envelope }))
      )
    ),
    Effect.provide(layer)
  )

describe("server/routes/imagined-place", () => {
  it.effect("builds a place from a valid POST body and wraps it in an envelope", () =>
    Effect.gen(function*() {
      const body = yield* encodeRequest({
        scenario: "drowned-library",
        brief: "A reading room.",
        acceptNeighbor: true,
        acceptProgram: true
      })
      const response = yield* call(jsonBody(body))
      const envelope = yield* decodeSuccessEnvelope(response.envelope)
      expect(response.status).toBe(200)
      expect(envelope.ok).toBe(true)
      expect(envelope.meta.requestId).toBe("req-1")
      expect(envelope.meta.buildSha).toBe("test-sha")
      expect(envelope.data.artifact.scenario).toBe("drowned-library")
      expect(envelope.data.artifact.brief).toBe("A reading room.")
      expect(envelope.data.artifact.accepted.length).toBe(2)
      expect(envelope.data.evidence.lineage.length).toBe(2)
    }))

  it.effect("rejects an invalid body with 400 and says what was wrong", () =>
    Effect.gen(function*() {
      const response = yield* call(jsonBody(`{"scenario":"nowhere","brief":"","acceptNeighbor":true}`))
      const envelope = yield* decodeFailureEnvelope(response.envelope)
      expect(response.status).toBe(400)
      expect(envelope.ok).toBe(false)
      expect(envelope.error.code).toBe("invalid-request")
      expect(envelope.error.retryable).toBe(false)
    }))

  it.effect("rejects an unreadable body with 400", () =>
    Effect.gen(function*() {
      const response = yield* call(jsonBody("not json"))
      const envelope = yield* decodeFailureEnvelope(response.envelope)
      expect(response.status).toBe(400)
      expect(envelope.error.code).toBe("invalid-request")
    }))

  it.effect("only accepts POST", () =>
    Effect.gen(function*() {
      const response = yield* call(request({ method: "GET" }))
      const envelope = yield* decodeFailureEnvelope(response.envelope)
      expect(response.status).toBe(405)
      expect(envelope.error.code).toBe("method-not-allowed")
    }))

  it.effect("refuses cross-site requests", () =>
    Effect.gen(function*() {
      const body = yield* encodeRequest({
        scenario: "unfinished-light",
        brief: "A rock.",
        acceptNeighbor: false,
        acceptProgram: false
      })
      const response = yield* call(crossSite(jsonBody(body)))
      const envelope = yield* decodeFailureEnvelope(response.envelope)
      expect(response.status).toBe(403)
      expect(envelope.error.code).toBe("cross-site-request")
    }))

  it.effect("answers a refused admission with 429, retry-after, and the client address as the actor", () =>
    Effect.gen(function*() {
      const seen = yield* Ref.make(Arr.empty<string>())
      /** Refuses every build and records the actors it was asked about. */
      const refusing = Layer.succeed(
        PlaceBuildLimiter,
        PlaceBuildLimiter.of({
          admit: (actor) => Ref.update(seen, Arr.append(actor)).pipe(Effect.as(refused(60)))
        })
      )
      const body = yield* encodeRequest({
        scenario: "drowned-library",
        brief: "A reading room.",
        acceptNeighbor: true,
        acceptProgram: true
      })
      const fromAddress = request({
        method: "POST",
        body,
        headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.7" }
      })

      const response = yield* call(
        fromAddress,
        Layer.mergeAll(RuntimeInfoTest, ParticipantsLive, Cipher.layer, refusing)
      )
      const envelope = yield* decodeFailureEnvelope(response.envelope)
      const retryAfter = yield* Headers.get(response.headers, "retry-after")
      expect(response.status).toBe(429)
      expect(retryAfter).toBe("60")
      expect(envelope.error.code).toBe("rate-limited")
      expect(envelope.error.retryable).toBe(true)
      expect(yield* Ref.get(seen)).toEqual(Arr.of("203.0.113.7"))
    }))
})
