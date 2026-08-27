import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Ref } from "effect"

import type { DspRuntimeStatus } from "../../app/contracts/dsp-runtime-projection.js"
import { dspRuntimeProjection } from "../../app/server/demos/effect-dsp/provider.js"

const capability = (enabled: boolean) => ({
  enabled,
  provider: enabled ? Option.some<"openai">("openai") : Option.none<"openai">(),
  model: enabled ? Option.some("gpt-4o-mini") : Option.none<string>(),
  routeFamily: Option.none<never>(),
  baseUrl: Option.none<string>(),
  reason: enabled ? Option.none<string>() : Option.some("private configuration detail")
})

describe("server/runtime-projection", () => {
  it.effect("publishes only stable provider availability fields", () =>
    Effect.gen(function*() {
      const status = yield* Ref.make<DspRuntimeStatus>("configured")
      const projection = yield* dspRuntimeProjection({
        capability: capability(true),
        status
      })

      expect(projection).toEqual({
        status: "configured",
        provider: "openai",
        model: "gpt-4o-mini"
      })
      expect("requestedRuntime" in projection).toBe(false)
      expect("resolvedRoute" in projection).toBe(false)
    }))

  it.effect("uses stable reason codes instead of raw configuration failures", () =>
    Effect.gen(function*() {
      const status = yield* Ref.make<DspRuntimeStatus>("unavailable")
      const projection = yield* dspRuntimeProjection({
        capability: capability(false),
        status
      })

      expect(projection).toEqual({
        status: "unavailable",
        reason: "provider-configuration-invalid"
      })
    }))

  it.effect("reports provider execution degradation without exposing its cause", () =>
    Effect.gen(function*() {
      const status = yield* Ref.make<DspRuntimeStatus>("configured")
      yield* Ref.set(status, "degraded")
      const projection = yield* dspRuntimeProjection({
        capability: capability(true),
        status
      })

      expect(projection.status).toBe("degraded")
      expect(projection.reason).toBe("provider-request-failed")
    }))
})
