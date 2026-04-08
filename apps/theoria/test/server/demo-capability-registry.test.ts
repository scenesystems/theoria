import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"

import { DspProviderRuntime } from "../../app/server/entries/effect-dsp/provider.js"
import { capabilityForId } from "../../app/server/entries/registry.js"

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

describe("server/entry-capability-registry", () => {
  it.effect("keeps capability ownership in the registry for runnable, provider-backed, and pending entries", () =>
    Effect.gen(function*() {
      const effectText = yield* capabilityForId("effect-text")
      const effectDsp = yield* capabilityForId("effect-dsp")
      const effectInference = yield* capabilityForId("effect-inference")

      expect(effectText).toEqual({
        id: "effect-text",
        enabled: true
      })
      expect(effectDsp).toEqual({
        id: "effect-dsp",
        enabled: false,
        reason: "DSP runtime resolution failed."
      })
      expect(effectInference).toEqual({
        id: "effect-inference",
        enabled: false,
        reason: "Runtime registration has not shipped for this demo yet."
      })
    }).pipe(Effect.provideService(DspProviderRuntime, disabledDspRuntime)))
})
