import { Headers, HttpServerRequest, HttpServerResponse } from "@effect/platform"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Schema } from "effect"

import { PlaceBuildEnvelope } from "../../app/contracts/imagined-place-result.js"
import { PlaceBuildRequest } from "../../app/contracts/imagined-place.js"
import { RuntimeInfo } from "../../app/server/config/runtime.js"
import { ParticipantsLive } from "../../app/server/imagined-place/authority.js"
import { imaginedPlacePath, imaginedPlaceRoute } from "../../app/server/routes/imagined-place.js"

const RuntimeInfoTest = Layer.succeed(RuntimeInfo, { buildSha: "test-sha", startedAtMs: 0 })
const RouteLive = Layer.merge(RuntimeInfoTest, ParticipantsLive)

const encodeRequest = Schema.encode(Schema.parseJson(PlaceBuildRequest))

const request = (init: RequestInit) =>
  HttpServerRequest.fromWeb(new Request(`http://127.0.0.1${imaginedPlacePath}`, init))

const jsonBody = (body: string) => request({ method: "POST", body, headers: { "content-type": "application/json" } })

/** `sec-fetch-site` is a forbidden header for `Request`, so it is set on the server request directly. */
const crossSite = (serverRequest: HttpServerRequest.HttpServerRequest) =>
  serverRequest.modify({ headers: Headers.set(serverRequest.headers, "sec-fetch-site", "cross-site") })

const call = (serverRequest: HttpServerRequest.HttpServerRequest) =>
  imaginedPlaceRoute(serverRequest, "req-1").pipe(
    Effect.flatMap((response) =>
      Effect.promise(() => HttpServerResponse.toWeb(response).json()).pipe(
        Effect.flatMap(Schema.decodeUnknown(PlaceBuildEnvelope)),
        Effect.map((envelope) => ({ status: response.status, envelope }))
      )
    ),
    Effect.provide(RouteLive)
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
        brief: "A garden.",
        acceptNeighbor: false,
        acceptProgram: false
      })
      const { envelope, status } = yield* call(crossSite(jsonBody(body)))
      expect(status).toBe(403)
      expect(!envelope.ok && envelope.error.code).toBe("cross-site-request")
    }))
})
