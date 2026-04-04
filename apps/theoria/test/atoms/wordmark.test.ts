import { Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { setWordmarkMountedAtom, wordmarkFrameAtom } from "../../app/web/atoms/wordmark.js"

const makeTestRegistry = (): Registry.Registry =>
  Registry.make({
    defaultIdleTTL: 5,
    scheduleTask: (task) => {
      task()
    },
    timeoutResolution: 1
  })

const waitForFrame = ({
  minimum,
  registry
}: {
  readonly minimum: number
  readonly registry: Registry.Registry
}): Effect.Effect<number, never, never> =>
  Effect.eventually(
    Effect.sync(() => registry.get(wordmarkFrameAtom)).pipe(
      Effect.filterOrFail((frame) => frame > minimum, () => "waiting-for-wordmark-frame")
    )
  ).pipe(Effect.orDie)

const waitForResetFrame = (registry: Registry.Registry): Effect.Effect<number, never, never> =>
  Effect.eventually(
    Effect.sync(() => registry.get(wordmarkFrameAtom)).pipe(
      Effect.filterOrFail((frame) => frame === 0, () => "waiting-for-wordmark-reset")
    )
  ).pipe(Effect.orDie)

describe("wordmark animation", () => {
  it.live("keeps the shared loop running until the last mounted wordmark detaches", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()

      yield* Effect.ensuring(
        Effect.gen(function*() {
          registry.set(setWordmarkMountedAtom, true)
          const firstFrame = yield* waitForFrame({ minimum: 0, registry })

          registry.set(setWordmarkMountedAtom, true)
          const secondFrame = yield* waitForFrame({ minimum: firstFrame, registry })

          registry.set(setWordmarkMountedAtom, false)
          const thirdFrame = yield* waitForFrame({ minimum: secondFrame, registry })

          registry.set(setWordmarkMountedAtom, false)
          const resetFrame = yield* waitForResetFrame(registry)

          expect(firstFrame).toBeGreaterThan(0)
          expect(secondFrame).toBeGreaterThan(firstFrame)
          expect(thirdFrame).toBeGreaterThan(secondFrame)
          expect(resetFrame).toBe(0)
        }),
        Effect.sync(() => {
          registry.set(setWordmarkMountedAtom, false)
          registry.set(setWordmarkMountedAtom, false)
        })
      )
    }))
})
