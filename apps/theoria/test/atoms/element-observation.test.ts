import { Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { elementWidthAtom, makeElementWidthSlot } from "../../app/web/atoms/element-observation.js"

const makeTestRegistry = (): Registry.Registry =>
  Registry.make({
    defaultIdleTTL: 5,
    scheduleTask: (f) => {
      f()
    },
    timeoutResolution: 1
  })

describe("element observation", () => {
  it.live("release mount-scoped width state once the last subscriber detaches", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const slot = makeElementWidthSlot()
      const remove = registry.subscribe(elementWidthAtom(slot), () => undefined)
      expect(registry.getNodes().size).toBe(1)

      remove()
      yield* Effect.sleep("20 millis")

      expect(registry.getNodes().size).toBe(0)
    }))
})
