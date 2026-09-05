import { Headers, HttpServerRequest, HttpServerResponse } from "@effect/platform"
import { describe, expect, it } from "@effect/vitest"
import { Data, Effect, Layer, Ref, Schema } from "effect"
import * as Arr from "effect/Array"

import { PlaceBuildEnvelope } from "../../app/contracts/imagined-place-result.js"
import { PlaceBuildRequest } from "../../app/contracts/imagined-place.js"
import { PlaceBuildLimiter, refused, unlimited } from "../../app/server/config/place-build-limiter.js"
import { RuntimeInfo } from "../../app/server/config/runtime.js"
import { ParticipantsLive } from "../../app/server/imagined-place/authority.js"
import { imaginedPlacePath, imaginedPlaceRoute } from "../../app/server/routes/imagined-place.js"

const RuntimeInfoTest = Layer.succeed(RuntimeInfo, { buildSha: "test-sha", startedAtMs: 0 })
const RouteLive = Layer.mergeAll(RuntimeInfoTest, ParticipantsLive, unlimited)

/** Refuses every build and records the actors it was asked about. */
const refusing = (seen: Ref.Ref<ReadonlyArray<string>>) =>
  Layer.succeed(
    PlaceBuildLimiter,
    PlaceBuildLimiter.of({
      admit: (actor) => Ref.update(seen, Arr.append(actor)).pipe(Effect.as(refused(60)))
    })
  )

const encodeRequest = Schema.encode(Schema.parseJson(PlaceBuildRequest))
const decodeEnvelope = Schema.decode(Schema.parseJson(PlaceBuildEnvelope))

/** The response body could not be read as text. */
class UnreadableBody extends Data.TaggedError("UnreadableBody")<{ readonly cause: unknown }> {}

const responseText = (response: HttpServerResponse.HttpServerResponse) =>
  Effect.tryPromise({
    try: () => HttpServerResponse.toWeb(response).text(),
    catch: (cause) => new UnreadableBody({ cause })
  })

const request = (init: RequestInit) =>
  HttpServerRequest.fromWeb(new Request(`http://127.0.0.1${imaginedPlacePath}`, init))

const jsonBody = (body: string) => request({ method: "POST", body, headers: { "content-type": "application/json" } })

/** `sec-fetch-site` is a forbidden header for `Request`, so it is set on the server request directly. */
const crossSite = (serverRequest: HttpServerRequest.HttpServerRequest) =>
  serverRequest.modify({ headers: Headers.set(serverRequest.headers, "sec-fetch-site", "cross-site") })

const call = (serverRequest: HttpServerRequest.HttpServerRequest, layer: typeof RouteLive = RouteLive) =>
  imaginedPlaceRoute(serverRequest, "req-1").pipe(
    Effect.flatMap((response) =>
      responseText(response).pipe(
        Effect.flatMap(decodeEnvelope),
        Effect.map((envelope) => ({ status: response.status, headers: response.headers, envelope }))
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
      const { envelope, status } = yield* call(jsonBody(body))
      expect(status).toBe(200)
      expect(envelope.ok).toBe(true)
      if (envelope.ok) {
        expect(envelope.meta.requestId).toBe("req-1")
        expect(envelope.meta.buildSha).toBe("test-sha")
        expect(envelope.data.artifact.scenario).toBe("drowned-library")
        expect(envelope.data.artifact.brief).toBe("A reading room.")
        expect(envelope.data.artifact.accepted.length).toBe(2)
        expect(envelope.data.evidence.lineage.length).toBe(2)
      }
    }))

  it.effect("rejects an invalid body with 400 and says what was wrong", () =>
    Effect.gen(function*() {
      const { envelope, status } = yield* call(jsonBody(`{"scenario":"nowhere","brief":"","acceptNeighbor":true}`))
      expect(status).toBe(400)
      expect(envelope.ok).toBe(false)
      if (!envelope.ok) {
        expect(envelope.error.code).toBe("invalid-request")
        expect(envelope.error.retryable).toBe(false)
      }
    }))

  it.effect("rejects an unreadable body with 400", () =>
    Effect.gen(function*() {
      const { envelope, status } = yield* call(jsonBody("not json"))
      expect(status).toBe(400)
      expect(!envelope.ok && envelope.error.code).toBe("invalid-request")
    }))

  it.effect("only accepts POST", () =>
    Effect.gen(function*() {
      const { envelope, status } = yield* call(request({ method: "GET" }))
      expect(status).toBe(405)
      expect(!envelope.ok && envelope.error.code).toBe("method-not-allowed")
    }))

  it.effect("refuses cross-site requests", () =>
    Effect.gen(function*() {
      const body = yield* encodeRequest({
        scenario: "unfinished-light",
        brief: "A rock.",
        acceptNeighbor: false,
        acceptProgram: false
      })
      const { envelope, status } = yield* call(crossSite(jsonBody(body)))
      expect(status).toBe(403)
      expect(!envelope.ok && envelope.error.code).toBe("cross-site-request")
    }))

  it.effect("answers a refused admission with 429, retry-after, and the client address as the actor", () =>
    Effect.gen(function*() {
      const seen = yield* Ref.make<ReadonlyArray<string>>([])
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

      const { envelope, headers, status } = yield* call(
        fromAddress,
        Layer.mergeAll(RuntimeInfoTest, ParticipantsLive, refusing(seen))
      )
      expect(status).toBe(429)
      expect(headers["retry-after"]).toBe("60")
      expect(!envelope.ok && envelope.error.code).toBe("rate-limited")
      expect(!envelope.ok && envelope.error.retryable).toBe(true)
      expect(yield* Ref.get(seen)).toEqual(["203.0.113.7"])
    }))
})
