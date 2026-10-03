import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Boolean as Bool, Effect, Equal, Match, Number as Num, Option, Predicate, Schema } from "effect"

import * as Optimization from "../../src/Optimization.js"
import * as Sampler from "../../src/Sampler.js"
import {
  decodePromptCategoricalConfig,
  makePromptCategoricalSpace,
  PromptCategoricalConfig
} from "../fixtures/scenarios/promptCategorical.js"
import { FixtureRegistryLive, loadFixture, TpeCategoricalStudyReplayFixture } from "../helpers/fixtures/index.js"

const encodeTrace = Schema.encodeSync(Schema.fromJsonString(Schema.Array(PromptCategoricalConfig)))
const encodeValues = Schema.encodeSync(Schema.fromJsonString(Schema.Array(Schema.Finite)))

const instructionPenalty = (instruction: string): number =>
  Match.value(instruction).pipe(
    Match.when("rewrite", () => 0),
    Match.when("counterexample", () => 0.35),
    Match.when("socratic", () => 0.6),
    Match.orElse(() => 0.9)
  )

const demosPenalty = (demos: string): number =>
  Match.value(demos).pipe(
    Match.when("curated", () => 0),
    Match.when("few", () => 0.25),
    Match.orElse(() => 0.55)
  )

const scoringPenalty = (scoring: string): number =>
  Match.value(scoring).pipe(
    Match.when("balanced", () => 0),
    Match.when("recall", () => 0.2),
    Match.orElse(() => 0.45)
  )

const interactionPenalty = (instruction: string, demos: string, scoring: string): number =>
  Match.value(Bool.and(
    Equal.equals(instruction, "rewrite"),
    Bool.and(Equal.equals(demos, "curated"), Equal.equals(scoring, "balanced"))
  )).pipe(
    Match.when(true, () => Num.multiply(-1, 0.25)),
    Match.orElse(() => 0)
  )

const objectiveValue = (raw: unknown) =>
  decodePromptCategoricalConfig(raw).pipe(
    Effect.map((config) =>
      Num.sumAll(Arr.make(
        instructionPenalty(config.instruction),
        demosPenalty(config.demos),
        scoringPenalty(config.scoring),
        interactionPenalty(config.instruction, config.demos, config.scoring)
      ))
    )
  )

const asSingleObjective = (result: Optimization.Result): Option.Option<Optimization.SingleObjectiveResult> =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", (single) => Option.some(single)),
    Match.orElse(() => Option.none())
  )

const traceFromResult = (
  result: Optimization.Result
) =>
  Option.match(asSingleObjective(result), {
    onNone: () => Effect.succeedNone,
    onSome: (value) =>
      Effect.forEach(value.trials, (trial) => decodePromptCategoricalConfig(trial.config)).pipe(
        Effect.asSome
      )
  })

const valueTrace = (result: Optimization.SingleObjectiveResult) =>
  Arr.flatMap(Arr.fromIterable(result.trials), (trial) =>
    Match.value(trial.state).pipe(
      Match.tag("Completed", ({ value }) => Option.liftPredicate(value, Predicate.isNumber).pipe(Option.toArray)),
      Match.orElse(() => Arr.empty<number>())
    ))

const runWithReplayFixture = (
  fixture: Schema.Schema.Type<typeof TpeCategoricalStudyReplayFixture>,
  trials: number
) =>
  Effect.gen(function*() {
    const space = yield* makePromptCategoricalSpace
    return yield* Optimization.run(
      new Optimization.FlatOptions({
        space,
        sampler: Sampler.tpe(
          new Sampler.TpeOptions({
            seed: fixture.payload.sampler.seed,
            nStartupTrials: fixture.payload.sampler.nStartupTrials,
            nEiCandidates: fixture.payload.sampler.nEiCandidates
          })
        ),
        direction: "minimize",
        trials,
        objective: objectiveValue
      })
    )
  })

const samplerFromFixture = (fixture: Schema.Schema.Type<typeof TpeCategoricalStudyReplayFixture>) =>
  Sampler.tpe(
    new Sampler.TpeOptions({
      seed: fixture.payload.sampler.seed,
      nStartupTrials: fixture.payload.sampler.nStartupTrials,
      nEiCandidates: fixture.payload.sampler.nEiCandidates
    })
  )

describe("integration deterministic categorical optimization replay", () => {
  it.effect("reproduces fresh runs and checkpoint continuation without an RNG trajectory oracle", () =>
    Effect.gen(function*() {
      const loaded = yield* loadFixture("tpe-categorical-study.replay").pipe(Effect.provide(FixtureRegistryLive))
      const fixture = yield* Schema.decodeUnknownEffect(TpeCategoricalStudyReplayFixture)(loaded)
      const totalTrials = fixture.payload.sampler.trials
      const firstLegTrials = 7

      const first = yield* runWithReplayFixture(fixture, totalTrials)
      const second = yield* runWithReplayFixture(fixture, totalTrials)
      const firstLeg = yield* runWithReplayFixture(fixture, firstLegTrials)
      const firstOption = asSingleObjective(first)
      const secondOption = asSingleObjective(second)
      const firstLegOption = asSingleObjective(firstLeg)

      expect(Option.isSome(firstOption)).toBe(true)
      expect(Option.isSome(secondOption)).toBe(true)
      expect(Option.isSome(firstLegOption)).toBe(true)
      const firstResult = yield* Effect.fromOption(firstOption)
      const secondResult = yield* Effect.fromOption(secondOption)
      const firstLegResult = yield* Effect.fromOption(firstLegOption)
      const checkpoint = yield* Optimization.snapshot(firstLegResult)
      const resumed = yield* Optimization.resume(
        new Optimization.ResumeOptions({
          space: yield* makePromptCategoricalSpace,
          sampler: samplerFromFixture(fixture),
          snapshot: checkpoint,
          direction: "minimize",
          trials: Num.subtract(totalTrials, firstLegTrials),
          objective: objectiveValue
        })
      )
      const resumedResult = yield* Effect.fromOption(asSingleObjective(resumed))

      const firstTraceOption = yield* traceFromResult(first)
      const secondTraceOption = yield* traceFromResult(second)

      expect(Option.isSome(firstTraceOption)).toBe(true)
      expect(Option.isSome(secondTraceOption)).toBe(true)
      const firstTrace = yield* Effect.fromOption(firstTraceOption)
      const secondTrace = yield* Effect.fromOption(secondTraceOption)

      const firstTraceJson = encodeTrace(Arr.fromIterable(firstTrace))
      const secondTraceJson = encodeTrace(Arr.fromIterable(secondTrace))
      const resumedTrace = yield* Effect.fromOption(yield* traceFromResult(resumed))
      const resumedTraceJson = encodeTrace(Arr.fromIterable(resumedTrace))

      expect(Arr.fromIterable(firstResult.trials)).toHaveLength(totalTrials)
      expect(Arr.fromIterable(secondResult.trials)).toHaveLength(totalTrials)
      expect(Arr.fromIterable(resumedResult.trials)).toHaveLength(totalTrials)
      expect(firstTraceJson).toBe(secondTraceJson)
      expect(resumedTraceJson).toBe(firstTraceJson)

      const firstValues = valueTrace(firstResult)
      const secondValues = valueTrace(secondResult)
      const resumedValues = valueTrace(resumedResult)
      expect(firstValues).toHaveLength(totalTrials)
      expect(firstValues).toEqual(yield* Effect.forEach(firstTrace, objectiveValue))
      expect(encodeValues(secondValues)).toBe(encodeValues(firstValues))
      expect(encodeValues(resumedValues)).toBe(encodeValues(firstValues))

      const firstValue = yield* Effect.fromOption(Arr.head(firstValues))
      const independentlyComputedBest = Arr.reduce(firstValues, firstValue, Num.min)
      expect(firstResult.bestTrial.state.value).toBe(independentlyComputedBest)
      expect(secondResult.bestTrial.state.value).toBe(independentlyComputedBest)
      expect(resumedResult.bestTrial.state.value).toBe(independentlyComputedBest)
    }))
})
