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
  it.effect("keeps capability ownership on the single workflow entry", () =>
    Effect.gen(function*() {
      const workflow = yield* capabilityForEntryId("workflow")

      expect(workflow).toEqual({
        id: "workflow",
        enabled: true
      })
    }).pipe(Effect.provideService(DspProviderRuntime, disabledDspRuntime)))
})
