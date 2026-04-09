import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"

import { capabilityForEntryId } from "../../app/server/capability/availability.js"
import { DspProviderRuntime } from "../../app/server/capability/effect-dsp.js"

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

describe("server/entry-capability-availability", () => {
  it.effect("keeps capability ownership in the registry for runnable, provider-backed, and pending entries", () =>
    Effect.gen(function*() {
      const effectText = yield* capabilityForEntryId("effect-text")
      const effectDsp = yield* capabilityForEntryId("effect-dsp")
      const effectInference = yield* capabilityForEntryId("effect-inference")

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
        reason: "Runtime registration has not shipped for this entry yet."
      })
    }).pipe(Effect.provideService(DspProviderRuntime, disabledDspRuntime)))
})
