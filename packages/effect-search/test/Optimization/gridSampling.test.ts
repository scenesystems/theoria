import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Equal, Match, Number as Num, Option, Predicate, Schema, Stream } from "effect"

import * as Optimization from "../../src/Optimization.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"
import * as Trial from "../../src/Trial.js"

const gridSpace = SearchSpace.make({
  alpha: SearchSpace.categorical(Arr.make("a", "b", "c")),
  beta: SearchSpace.categorical(Arr.make("x", "y", "z", "w")),
  useBatchNorm: SearchSpace.boolean()
})

const asSingleObjective = (result: Optimization.Result): Option.Option<Optimization.SingleObjectiveResult> =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", (single) => Option.some(single)),
    Match.orElse(() => Option.none())
  )

const completedConfigs = (space: SearchSpace.SearchSpace, trials: Iterable<Trial.Trial<unknown>>) => {
  const decode = Schema.decodeUnknownSync(space.schema)

  return Arr.flatMap(Arr.fromIterable(trials), (trial) =>
    Trial.matchState({
      Running: Arr.empty,
      Completed: () => Arr.of(decode(trial.config)),
      Pruned: Arr.empty,
      Failed: Arr.empty,
      Cancelled: Arr.empty
    })(trial.state))
}

const completedValues = (trials: Iterable<Trial.Trial<unknown>>) =>
  Arr.flatMap(Arr.fromIterable(trials), (trial) =>
    Trial.matchState({
      Running: Arr.empty,
      Completed: ({ value }) => Option.liftPredicate(value, Predicate.isNumber).pipe(Option.toArray),
      Pruned: Arr.empty,
      Failed: Arr.empty,
      Cancelled: Arr.empty
    })(trial.state))

const keyFromConfig = (
  config: { readonly alpha: string; readonly beta: string; readonly useBatchNorm: boolean }
): string => `${config.alpha}|${config.beta}|${config.useBatchNorm}`

const objectiveForSpace = (space: SearchSpace.SearchSpace) => {
  const decode = Schema.decodeUnknownSync(space.schema)

  return (raw: unknown) => {
    const config = decode(raw)
    const alphaPenalty = Match.value(config.alpha).pipe(
      Match.when("a", () => 0),
      Match.when("b", () => 0.3),
      Match.orElse(() => 0.6)
    )
    const betaPenalty = Match.value(config.beta).pipe(
      Match.when("x", () => 0),
      Match.when("y", () => 0.1),
      Match.when("z", () => 0.2),
      Match.orElse(() => 0.4)
    )
    const normPenalty = Match.value(config.useBatchNorm).pipe(
      Match.when(true, () => 0.05),
      Match.orElse(() => 0.15)
    )

    return Effect.succeed(Num.sumAll(Arr.make(alphaPenalty, betaPenalty, normPenalty)))
  }
}

describe("integration grid optimization", () => {
  it.effect("uses spaceExhausted completion when trial budget exceeds finite grid size", () =>
    Effect.gen(function*() {
      const space = yield* gridSpace
      const optimized = yield* Optimization.run({
        space,
        sampler: Sampler.grid(),
        direction: "minimize",
        trials: 100,
        objective: objectiveForSpace(space)
      })

      const singleOption = asSingleObjective(optimized)
      expect(Option.isSome(singleOption)).toBe(true)
      const result = yield* singleOption
      const configurations = completedConfigs(space, result.trials)
      const keys = Arr.map(configurations, keyFromConfig)
      const values = completedValues(result.trials)
      const baseline = Arr.head(values).pipe(Option.getOrElse(() => Number.POSITIVE_INFINITY))
      const minimum = Arr.reduce(values, baseline, Num.min)

      expect(result.completionReason).toBe("spaceExhausted")
      expect(result.trials).toHaveLength(24)
      expect(Arr.map(Arr.fromIterable(result.trials), (trial) => trial.trialNumber)).toEqual(
        Arr.makeBy(24, (index) => index)
      )
      expect(Arr.dedupe(keys)).toHaveLength(24)
      expect(result.bestTrial.state.value).toBe(minimum)
    }))

  it.effect("uses budgetExhausted completion when budget is within finite grid size", () =>
    Effect.gen(function*() {
      const space = yield* gridSpace
      const optimized = yield* Optimization.run({
        space,
        sampler: Sampler.grid(),
        direction: "minimize",
        trials: 10,
        objective: objectiveForSpace(space)
      })

      const singleOption = asSingleObjective(optimized)
      expect(Option.isSome(singleOption)).toBe(true)
      const result = yield* singleOption

      expect(result.completionReason).toBe("budgetExhausted")
      expect(result.trials).toHaveLength(10)
      expect(Arr.map(Arr.fromIterable(result.trials), (trial) => trial.trialNumber)).toEqual(
        Arr.makeBy(10, (index) => index)
      )
    }))

  it.effect("keeps stream lifecycle compatibility for grid studies", () =>
    Effect.gen(function*() {
      const space = yield* gridSpace
      const events = Chunk.toReadonlyArray(
        yield* Stream.runCollect(
          Optimization.stream({
            space,
            sampler: Sampler.grid(),
            direction: "minimize",
            trials: 100,
            objective: objectiveForSpace(space)
          })
        )
      )
      const tags = Arr.map(events, (event) => event._tag)
      const lastEvent = Arr.last(events)

      expect(Arr.filter(tags, Equal.equals("TrialStarted"))).toHaveLength(24)
      expect(Arr.filter(tags, Equal.equals("TrialCompleted"))).toHaveLength(24)
      expect(Option.map(lastEvent, (event) => event._tag)).toEqual(Option.some("Completed"))

      expect(Option.flatMap(lastEvent, (event) =>
        Match.value(event).pipe(
          Match.tag("Completed", ({ completionReason }) => Option.some(completionReason)),
          Match.orElse(() => Option.none())
        ))).toEqual(
          Option.some("spaceExhausted")
        )
    }))
})
