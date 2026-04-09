import { HttpServerResponse } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Schema } from "effect"

import { LiveEnvelope, ReadyEnvelope } from "../../app/contracts/health.js"
import { VersionEnvelope } from "../../app/contracts/version.js"
import { DspProviderRuntime } from "../../app/server/capability/effect-dsp.js"
import { RuntimeInfoLive } from "../../app/server/config/runtime.js"
import { liveRoute, readyRoute } from "../../app/server/routes/health.js"
import { versionRoute } from "../../app/server/routes/version.js"

class ResponseJsonError extends Schema.TaggedError<ResponseJsonError>()("ResponseJsonError", {
  message: Schema.String
}) {}

const disabledDspRuntime = DspProviderRuntime.of({
  capability: {
    enabled: false,
    provider: Option.none(),
    model: Option.none(),
    routeFamily: Option.none(),
    baseUrl: Option.none(),
    reason: Option.some("DSP runtime resolution failed.")
  },
  resolution: {
    desired: Option.none(),
    resolvedRoute: Option.none()
  },
  layer: Option.none()
})

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
    const decoded = yield* Schema.decodeUnknown(schema)(body).pipe(Effect.orDie)

    return { decoded, status: webResponse.status }
  })

const provideServer = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.provide(BunContext.layer),
    Effect.provide(RuntimeInfoLive),
    Effect.provideService(DspProviderRuntime, disabledDspRuntime)
  )

describe("server/service-status-routes", () => {
  it.effect("publishes version and health data through explicit transport envelopes", () =>
    provideServer(
      Effect.gen(function*() {
        const version = yield* versionRoute("req-version").pipe(
          Effect.flatMap((response) => decodeWebJson(response, VersionEnvelope))
        )
        const live = yield* liveRoute("req-live").pipe(
          Effect.flatMap((response) => decodeWebJson(response, LiveEnvelope))
        )
        const ready = yield* readyRoute("req-ready").pipe(
          Effect.flatMap((response) => decodeWebJson(response, ReadyEnvelope))
        )

        expect(version.status).toBe(200)
        expect(live.status).toBe(200)
        expect(ready.status).toBe(200)
        expect(version.decoded.ok).toBe(true)
        expect(live.decoded.ok).toBe(true)
        expect(ready.decoded.ok).toBe(true)

        if (!version.decoded.ok || !live.decoded.ok || !ready.decoded.ok) {
          return
        }

        expect(version.decoded.data.service).toBe("theoria")
        expect(version.decoded.data.buildSha.length).toBeGreaterThan(0)
        expect(live.decoded.data.status).toBe("live")
        expect(ready.decoded.data.status).toBe("ready")
        expect(ready.decoded.data.uptimeMs).toBeGreaterThanOrEqual(0)
        expect(ready.decoded.data.dsp.enabled).toBe(false)
      })
    ))
})
