import { describe, expect, it } from "@effect/vitest"
import { Effect, Number as Num, Option, Ref, Schema } from "effect"
import { abs } from "effect-math/Numeric"

import { SlotSpace } from "../../src/experimental/scenarios/slot.js"
import { pendingAsZeroImputationPolicy } from "../../src/Sampler/index.js"
import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"

const makeSpace = () =>
  SearchSpace.unsafeMake({
    x: SearchSpace.float(-2, 2),
    depth: SearchSpace.int(1, 4)
  })

const decodeConfig = Schema.decodeUnknownSync(makeSpace().schema)

const asSingleObjective = (result: Study.StudyResult) =>
  result._tag === "SingleObjective" ? Option.some(result) : Option.none()

describe("Study concurrency", () => {
  it.live("runs bounded parallel evaluations and preserves trial contracts", () =>
    Effect.gen(function*() {
      const activeRef = yield* Ref.make(0)
      const maxActiveRef = yield* Ref.make(0)

      const result = yield* Study.optimize({
        space: makeSpace(),
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
              const config = decodeConfig(raw)

              return Effect.sleep("15 millis").pipe(Effect.as(abs(config.x) + config.depth))
            },
            () => Ref.update(activeRef, (active) => Num.decrement(active))
          )
      })

      const single = asSingleObjective(result)
      const maxActive = yield* Ref.get(maxActiveRef)

      expect(Option.isSome(single)).toBe(true)

      if (Option.isNone(single)) {
        return
      }

      expect(maxActive).toBeGreaterThanOrEqual(2)
      expect(single.value.trials).toHaveLength(10)
      expect(single.value.completionReason).toBe("budgetExhausted")
    }))

  it.live("reserves suggestions atomically so concurrent workers observe monotone history growth", () =>
    Effect.gen(function*() {
      const seenHistoryLengthsRef = yield* Ref.make<Array<number>>([])

      const deterministicSampler = new Sampler.Sampler({
        kind: Sampler.Random({ options: {} }),
        pendingImputationPolicy: pendingAsZeroImputationPolicy,
        checkpoint: Effect.succeed({
          _tag: "Random",
          seed: 0
        }),
        restore: () => Effect.void,
        suggest: (_space, context) =>
          Ref.update(seenHistoryLengthsRef, (seen) => [...seen, context.completed.length]).pipe(
            Effect.as({ slot: context.completed.length })
          )
      })

      yield* Study.optimize({
        space: SlotSpace.make(32),
        sampler: deterministicSampler,
        direction: "minimize",
        trials: 8,
        concurrency: 4,
        objective: () => Effect.sleep("12 millis").pipe(Effect.as(1))
      })

      const seenHistoryLengths = yield* Ref.get(seenHistoryLengthsRef)

      expect(seenHistoryLengths).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    }))
})
