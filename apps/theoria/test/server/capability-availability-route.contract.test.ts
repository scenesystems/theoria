import { HttpServerResponse } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Schema } from "effect"

import { CapabilityAvailabilityEnvelope } from "../../app/contracts/capability/availability.js"
import { DspProviderRuntime } from "../../app/server/capability/effect-dsp.js"
import { RuntimeInfoLive } from "../../app/server/config/runtime.js"
import { capabilityAvailabilityRoute } from "../../app/server/routes/availability.js"

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

const decodeWebJson = (response: HttpServerResponse.HttpServerResponse) =>
  Effect.gen(function*() {
    const webResponse = HttpServerResponse.toWeb(response)
    const body = yield* Effect.tryPromise({
      try: () => webResponse.json(),
      catch: (cause) => new ResponseJsonError({ message: String(cause) })
    }).pipe(Effect.orDie)

    return { body, status: webResponse.status }
  })

const provideServer = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.provide(BunContext.layer),
    Effect.provide(RuntimeInfoLive),
    Effect.provideService(DspProviderRuntime, disabledDspRuntime)
  )

describe("server/capability-availability-route", () => {
  it.effect("publishes the entry-native availability transport with entries instead of demos", () =>
    provideServer(
      Effect.gen(function*() {
        const response = yield* capabilityAvailabilityRoute("req-availability")
        const decodedResponse = yield* decodeWebJson(response)
        const decoded = yield* Schema.decodeUnknown(CapabilityAvailabilityEnvelope)(decodedResponse.body).pipe(
          Effect.orDie
        )

        expect(decodedResponse.status).toBe(200)
        expect(decodedResponse.body.ok).toBe(true)
        expect(decodedResponse.body.data.entries.length).toBeGreaterThan(0)
        expect(decodedResponse.body.data.demos).toBeUndefined()
        expect(decoded.ok).toBe(true)

        if (!decoded.ok) {
          return
        }

        expect(decoded.data.entries.some((entry) => entry.id === "effect-text")).toBe(true)
        expect(decoded.data.entries.every((entry) => typeof entry.enabled === "boolean")).toBe(true)
      })
    ))
})
