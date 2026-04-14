import { Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { elementWidthAtom, ElementWidthSlot } from "../../app/web/atoms/surface/element-observation.js"

const makeTestRegistry = (): Registry.Registry =>
  Registry.make({
    defaultIdleTTL: 5,
    scheduleTask: (f) => {
      f()
    },
    timeoutResolution: 1
  })

describe("element observation", () => {
  it.effect("release mount-scoped width state once the last subscriber detaches", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const slot = ElementWidthSlot.make()
      const remove = registry.subscribe(elementWidthAtom(slot), () => undefined)
      const waitForTimeout = Effect.async<void, never, never>((resume) => {
        const handle = setTimeout(() => {
          resume(Effect.void)
        }, 20)

        return Effect.sync(() => {
          clearTimeout(handle)
        })
      })

      expect(registry.getNodes().size).toBe(1)

      remove()
      yield* waitForTimeout

      expect(registry.getNodes().size).toBe(0)
    }))
})
