import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Number as Num, Option, Ref } from "effect"

import type { Direction } from "../../src/contracts/Direction.js"
import { pendingAsZeroImputationPolicy, type SuggestContext } from "../../src/Sampler/index.js"
import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"
import * as Trial from "../../src/Trial/index.js"

const makeSpace = () =>
  SearchSpace.make({
    x: SearchSpace.float(-1, 1)
  })

const objectiveSequence = (counterRef: Ref.Ref<number>) =>
  Ref.updateAndGet(counterRef, Num.increment).pipe(
    Effect.map((index) => Num.subtract(Num.multiply(index, 2), 1))
  )

const capturedContextsSampler = (
  contextsRef: Ref.Ref<Chunk.Chunk<SuggestContext>>
): Sampler.Sampler =>
  new Sampler.Sampler({
    kind: Sampler.Random({ options: { seed: 0 } }),
    pendingImputationPolicy: pendingAsZeroImputationPolicy,
    checkpoint: Effect.succeed({ _tag: "Random", seed: 0 }),
    restore: () => Effect.void,
    suggest: (_space, context) =>
      Ref.update(contextsRef, (contexts) => Chunk.append(contexts, context)).pipe(
        Effect.as({ x: 0 })
      )
  })

describe("re-evaluation averaging + variance threading", () => {
  it.effect("aggregates k evaluations into one completed trial with mean and variance metadata", () =>
    Effect.gen(function*() {
      const callsRef = yield* Ref.make(0)
      const result = yield* Study.optimize({
        space: yield* makeSpace(),
        sampler: Sampler.random({ seed: 19 }),
        direction: "minimize",
        trials: 2,
        evaluationsPerTrial: 3,
        objective: () => objectiveSequence(callsRef)
      })

      const completed = Arr.filterMap(
        result.trials,
        (trial) => Option.liftPredicate(trial.state, Trial.isState("Completed"))
      )

      expect(Arr.length(result.trials)).toBe(2)
      expect(yield* Ref.get(callsRef)).toBe(6)
      expect(Arr.map(completed, (state) => state.value)).toEqual(Arr.make(3, 9))
      expect(Arr.map(completed, (state) => state.evaluationCount)).toEqual(Arr.make(3, 3))

      const variances = Arr.map(
        completed,
        (state) => Option.fromNullable(state.variance).pipe(Option.getOrElse(() => -1))
      )

      yield* Effect.forEach(
        variances,
        (variance) => Effect.sync(() => expect(variance).toBeCloseTo(2.6666666666666665, 10))
      )
    }))

  it.effect("threads completed-trial variance into SuggestContext for downstream TPE noise handling", () =>
    Effect.gen(function*() {
      const callsRef = yield* Ref.make(0)
      const contextsRef = yield* Ref.make(Chunk.empty<SuggestContext>())

      yield* Study.optimize({
        space: yield* makeSpace(),
        sampler: capturedContextsSampler(contextsRef),
        direction: "minimize",
        trials: 2,
        evaluationsPerTrial: 2,
        objective: () => objectiveSequence(callsRef)
      })

      const contexts = yield* Ref.get(contextsRef)
      const secondContextVariance = Chunk.get(contexts, 1).pipe(
        Option.flatMap((context) => Arr.head(context.completed)),
        Option.flatMap((trial) => Option.fromNullable(trial.variance))
      )

      expect(yield* Ref.get(callsRef)).toBe(4)
      expect(yield* secondContextVariance).toBeCloseTo(1, 12)
    }))

  it.effect("averages asymmetric vector samples by coordinate and sums only reported costs", () =>
    Effect.gen(function*() {
      const reports = Arr.make(
        new Study.ObjectiveReport({ value: Arr.make(1, 10) }),
        new Study.ObjectiveReport({ value: Arr.make(3, 16), cost: 0 }),
        new Study.ObjectiveReport({ value: Arr.make(8, 25), cost: 5 })
      )
      const index = yield* Ref.make(0)
      const result = yield* Study.optimize({
        space: yield* makeSpace(),
        sampler: Sampler.random({ seed: 19 }),
        directions: Arr.make<Arr.NonEmptyArray<Direction>>("minimize", "maximize"),
        trials: 1,
        evaluationsPerTrial: 3,
        objective: () => Ref.getAndUpdate(index, Num.increment).pipe(Effect.flatMap((i) => Arr.get(reports, i)))
      })
      const trial = yield* Arr.head(result.trials)
      const completed = yield* Option.liftPredicate(trial.state, Trial.isState("Completed"))

      expect(completed.value).toEqual(Arr.make(4, 17))
      expect(completed.variance).toBeCloseTo(23.333333333333332, 12)
      expect(completed.evaluationCount).toBe(3)
      expect(trial.cost).toBe(5)
      expect(yield* Ref.get(index)).toBe(3)
    }))

  it.effect("rejects inconsistent vector dimensions instead of padding missing coordinates", () =>
    Effect.gen(function*() {
      const index = yield* Ref.make(0)
      const values = Arr.make(Arr.make(2, 7), Arr.of(9))
      const error = yield* Study.optimize({
        space: yield* makeSpace(),
        sampler: Sampler.random({ seed: 19 }),
        directions: Arr.make<Arr.NonEmptyArray<Direction>>("minimize", "maximize"),
        trials: 1,
        evaluationsPerTrial: 2,
        objective: () => Ref.getAndUpdate(index, Num.increment).pipe(Effect.flatMap((i) => Arr.get(values, i)))
      }).pipe(Effect.flip)

      expect(error).toMatchObject({ _tag: "effect-search/NoSuccessfulTrials", trialCount: 1 })
      expect(yield* Ref.get(index)).toBe(2)
    }))
})
