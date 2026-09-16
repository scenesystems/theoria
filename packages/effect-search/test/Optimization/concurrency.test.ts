import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Match, Number as Num, Option, Ref } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import * as Optimization from "../../src/Optimization.js"
import { pendingAsZeroPolicy } from "../../src/Sampler.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"
import { makeSlotSpace } from "../fixtures/scenarios/slot.js"

const makeSpace = () =>
  SearchSpace.make({
    x: SearchSpace.float(Num.negate(2), 2),
    depth: SearchSpace.int(1, 4)
  })

const asSingleObjective = (result: Optimization.Result): Option.Option<Optimization.SingleObjectiveResult> =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", (single) => Option.some(single)),
    Match.orElse(() => Option.none())
  )

describe("Optimization concurrency", () => {
  it.live("runs bounded parallel evaluations and preserves trial contracts", () =>
    Effect.gen(function*() {
      const activeRef = yield* Ref.make(0)
      const maxActiveRef = yield* Ref.make(0)
      const space = yield* makeSpace()

      const result = yield* Optimization.run({
        space,
        sampler: Sampler.random({ seed: 42 }),
        direction: "minimize",
        trials: 10,
        concurrency: 4,
        objective: (raw) =>
          Effect.acquireUseRelease(
            Ref.updateAndGet(activeRef, (active) => Num.increment(active)).pipe(
              Effect.tap((active) => Ref.update(maxActiveRef, (maxActive) => Num.max(maxActive, active)))
            ),
            () => {
              const config = raw

              return Effect.sleep("15 millis").pipe(Effect.as(Num.sum(Numeric.abs(config.x), config.depth)))
            },
            () => Ref.update(activeRef, (active) => Num.decrement(active))
          )
      })

      const single = asSingleObjective(result)
      const maxActive = yield* Ref.get(maxActiveRef)

      expect(Option.isSome(single)).toBe(true)
      const completed = yield* single

      expect(maxActive).toBeGreaterThanOrEqual(2)
      expect(completed.trials).toHaveLength(10)
      expect(completed.completionReason).toBe("budgetExhausted")
    }))

  it.live("reserves suggestions atomically so concurrent workers observe monotone history growth", () =>
    Effect.gen(function*() {
      const seenHistoryLengthsRef = yield* Ref.make(Arr.empty<number>())

      const deterministicSampler = new Sampler.Sampler({
        kind: Sampler.Random({ options: {} }),
        pendingImputationPolicy: pendingAsZeroPolicy,
        checkpoint: Effect.succeed({
          _tag: "Random",
          seed: 0
        }),
        restore: () => Effect.void,
        suggest: (_space, context) =>
          Ref.update(seenHistoryLengthsRef, Arr.append(Arr.length(context.completed))).pipe(
            Effect.as({ slot: Arr.length(context.completed) })
          )
      })

      yield* Optimization.run({
        space: yield* makeSlotSpace(32),
        sampler: deterministicSampler,
        direction: "minimize",
        trials: 8,
        concurrency: 4,
        objective: () => Effect.sleep("12 millis").pipe(Effect.as(1))
      })

      const seenHistoryLengths = yield* Ref.get(seenHistoryLengthsRef)

      expect(seenHistoryLengths).toEqual(Arr.make(0, 1, 2, 3, 4, 5, 6, 7))
    }))
})
