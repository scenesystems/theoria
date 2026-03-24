import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Number as Num, Option, Ref } from "effect"

import { pendingAsZeroImputationPolicy, type SuggestContext } from "../../src/Sampler/index.js"
import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"
import * as Trial from "../../src/Trial/index.js"

const makeSpace = () =>
  SearchSpace.unsafeMake({
    x: SearchSpace.float(-1, 1)
  })

const objectiveSequence = (counterRef: Ref.Ref<number>) =>
  Ref.updateAndGet(counterRef, Num.increment).pipe(
    Effect.map((index) => Num.subtract(Num.multiply(index, 2), 1))
  )

const capturedContextsSampler = (
  contextsRef: Ref.Ref<ReadonlyArray<SuggestContext>>
): Sampler.Sampler =>
  new Sampler.Sampler({
    kind: Sampler.Random({ options: { seed: 0 } }),
    pendingImputationPolicy: pendingAsZeroImputationPolicy,
    checkpoint: Effect.succeed({ _tag: "Random", seed: 0 }),
    restore: () => Effect.void,
    suggest: (_space, context) =>
      Ref.update(contextsRef, (contexts) => Arr.append(contexts, context)).pipe(
        Effect.as({ x: 0 })
      )
  })

describe("re-evaluation averaging + variance threading", () => {
  it.effect("aggregates k evaluations into one completed trial with mean and variance metadata", () =>
    Effect.gen(function*() {
      const callsRef = yield* Ref.make(0)
      const result = yield* Study.optimize({
        space: makeSpace(),
        sampler: Sampler.random({ seed: 19 }),
        direction: "minimize",
        trials: 2,
        evaluationsPerTrial: 3,
        objective: () => objectiveSequence(callsRef)
      })

      const completed = Arr.filter(
        result.trials,
        (trial): trial is Trial.CompletedTrial<{ readonly x: number }> => Trial.isState("Completed")(trial.state)
      )

      expect(result.trials.length).toBe(2)
      expect(yield* Ref.get(callsRef)).toBe(6)
      expect(Arr.map(completed, (trial) => trial.state.value)).toEqual([3, 9])
      expect(Arr.map(completed, (trial) => trial.state.evaluationCount)).toEqual([3, 3])

      const variances = Arr.map(
        completed,
        (trial) => Option.fromNullable(trial.state.variance).pipe(Option.getOrElse(() => -1))
      )

      expect(Arr.every(variances, (variance) => Math.abs(variance - Num.unsafeDivide(8, 3)) < 1e-10)).toBe(true)
    }))

  it.effect("threads completed-trial variance into SuggestContext for downstream TPE noise handling", () =>
    Effect.gen(function*() {
      const callsRef = yield* Ref.make(0)
      const contextsRef = yield* Ref.make<ReadonlyArray<SuggestContext>>([])

      yield* Study.optimize({
        space: makeSpace(),
        sampler: capturedContextsSampler(contextsRef),
        direction: "minimize",
        trials: 2,
        evaluationsPerTrial: 2,
        objective: () => objectiveSequence(callsRef)
      })

      const contexts = yield* Ref.get(contextsRef)
      const secondContextVariance = Option.fromNullable(contexts[1]).pipe(
        Option.flatMap((context) => Option.fromNullable(context.completed[0])),
        Option.flatMap((trial) => Option.fromNullable(trial.variance))
      )

      expect(yield* Ref.get(callsRef)).toBe(4)
      expect(Option.isSome(secondContextVariance)).toBe(true)

      if (Option.isSome(secondContextVariance)) {
        expect(secondContextVariance.value).toBeCloseTo(1, 12)
      }
    }))
})
