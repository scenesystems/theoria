import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Boolean as Bool, Effect, Equal, Match, Number as Num, Option, Schema } from "effect"

import { toVector } from "../../src/Objective.js"
import * as Optimization from "../../src/Optimization.js"
import * as Sampler from "../../src/Sampler.js"
import {
  decodePromptCategoricalConfig,
  makePromptCategoricalSpace,
  PromptCategoricalConfig
} from "../fixtures/scenarios/promptCategorical.js"
import { FixtureRegistryLive, loadFixture, MotpeStudyFixture } from "../helpers/fixtures/index.js"

const encodeTrace = Schema.encodeSync(Schema.fromJsonString(Schema.Array(PromptCategoricalConfig)))
const encodeVectors = Schema.encodeSync(Schema.fromJsonString(Schema.Array(Schema.Array(Schema.Finite))))

const instructionLatency = (instruction: string): number =>
  Match.value(instruction).pipe(
    Match.when("baseline", () => 0.3),
    Match.when("rewrite", () => 0.9),
    Match.when("counterexample", () => 1.5),
    Match.orElse(() => 2.1)
  )

const demosLatency = (demos: string): number =>
  Match.value(demos).pipe(
    Match.when("none", () => 0.1),
    Match.when("few", () => 0.6),
    Match.orElse(() => 1.3)
  )

const scoringLatency = (scoring: string): number =>
  Match.value(scoring).pipe(
    Match.when("recall", () => 0.2),
    Match.when("balanced", () => 0.5),
    Match.orElse(() => 1.1)
  )

const instructionQualityLoss = (instruction: string): number =>
  Match.value(instruction).pipe(
    Match.when("baseline", () => 2),
    Match.when("rewrite", () => 1.2),
    Match.when("counterexample", () => 0.8),
    Match.orElse(() => 0.5)
  )

const demosQualityLoss = (demos: string): number =>
  Match.value(demos).pipe(
    Match.when("none", () => 1.8),
    Match.when("few", () => 0.9),
    Match.orElse(() => 0.2)
  )

const scoringQualityLoss = (scoring: string): number =>
  Match.value(scoring).pipe(
    Match.when("recall", () => 1.4),
    Match.when("balanced", () => 0.9),
    Match.orElse(() => 0.4)
  )

const interactionQualityBonus = (instruction: string, demos: string, scoring: string): number =>
  Match.value(Bool.and(
    Equal.equals(instruction, "socratic"),
    Bool.and(Equal.equals(demos, "curated"), Equal.equals(scoring, "strict"))
  )).pipe(
    Match.when(true, () => Num.multiply(-1, 0.2)),
    Match.orElse(() => 0)
  )

const objectiveVector = (raw: unknown) =>
  decodePromptCategoricalConfig(raw).pipe(
    Effect.map((config) =>
      Arr.make(
        Num.sumAll(Arr.make(
          instructionLatency(config.instruction),
          demosLatency(config.demos),
          scoringLatency(config.scoring)
        )),
        Num.sumAll(Arr.make(
          instructionQualityLoss(config.instruction),
          demosQualityLoss(config.demos),
          scoringQualityLoss(config.scoring),
          interactionQualityBonus(config.instruction, config.demos, config.scoring)
        ))
      )
    )
  )

const asMultiObjective = (result: Optimization.Result): Option.Option<Optimization.MultiObjectiveResult> =>
  Match.value(result).pipe(
    Match.tag("MultiObjective", (multi) => Option.some(multi)),
    Match.orElse(() => Option.none())
  )

const traceFromResult = (
  result: Optimization.Result
) =>
  Option.match(asMultiObjective(result), {
    onNone: () => Effect.succeedNone,
    onSome: (value) =>
      Effect.forEach(value.trials, (trial) => decodePromptCategoricalConfig(trial.config)).pipe(
        Effect.asSome
      )
  })

const runWithFixture = (
  fixture: Schema.Schema.Type<typeof MotpeStudyFixture>,
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
        directions: fixture.payload.directions,
        trials,
        objective: objectiveVector
      })
    )
  })

const samplerFromFixture = (fixture: Schema.Schema.Type<typeof MotpeStudyFixture>) =>
  Sampler.tpe(
    new Sampler.TpeOptions({
      seed: fixture.payload.sampler.seed,
      nStartupTrials: fixture.payload.sampler.nStartupTrials,
      nEiCandidates: fixture.payload.sampler.nEiCandidates
    })
  )

const valuesFromResult = (result: Optimization.MultiObjectiveResult) =>
  Arr.flatMap(Arr.fromIterable(result.trials), (trial) =>
    Match.value(trial.state).pipe(
      Match.tag("Completed", ({ value }) => Arr.of(toVector(value))),
      Match.orElse(() => Arr.empty<ReadonlyArray<number>>())
    ))

const independentlyDominates = (
  left: ReadonlyArray<number>,
  right: ReadonlyArray<number>,
  directions: ReadonlyArray<"minimize" | "maximize">
) => {
  const comparisons = Arr.map(
    Arr.zip(Arr.zip(left, right), directions),
    ([[leftValue, rightValue], direction]) =>
      Match.value(direction).pipe(
        Match.when(
          "minimize",
          () => Arr.make(Num.isLessThanOrEqualTo(leftValue, rightValue), Num.isLessThan(leftValue, rightValue))
        ),
        Match.when(
          "maximize",
          () => Arr.make(Num.isGreaterThanOrEqualTo(leftValue, rightValue), Num.isGreaterThan(leftValue, rightValue))
        ),
        Match.exhaustive
      )
  )
  return Bool.and(
    Arr.every(comparisons, (comparison) => Option.getOrElse(Arr.head(comparison), () => false)),
    Arr.some(comparisons, (comparison) => Option.getOrElse(Arr.get(comparison, 1), () => false))
  )
}

describe("integration deterministic MOTPE optimization replay", () => {
  it.effect("reproduces fresh runs and checkpoint continuation with an independently verified Pareto front", () =>
    Effect.gen(function*() {
      const loaded = yield* loadFixture("motpe-study.2obj").pipe(Effect.provide(FixtureRegistryLive))
      const fixture = yield* Schema.decodeUnknownEffect(MotpeStudyFixture)(loaded)

      const totalTrials = fixture.payload.sampler.trials
      const firstLegTrials = 8
      const first = yield* runWithFixture(fixture, totalTrials)
      const second = yield* runWithFixture(fixture, totalTrials)
      const firstLeg = yield* runWithFixture(fixture, firstLegTrials)
      const firstOption = asMultiObjective(first)
      const secondOption = asMultiObjective(second)

      expect(Option.isSome(firstOption)).toBe(true)
      expect(Option.isSome(secondOption)).toBe(true)
      const firstResult = yield* Effect.fromOption(firstOption)
      const secondResult = yield* Effect.fromOption(secondOption)
      const firstLegResult = yield* Effect.fromOption(asMultiObjective(firstLeg))
      const resumed = yield* Optimization.resume(
        new Optimization.ResumeOptions({
          space: yield* makePromptCategoricalSpace,
          sampler: samplerFromFixture(fixture),
          snapshot: yield* Optimization.snapshot(firstLegResult),
          directions: fixture.payload.directions,
          trials: Num.subtract(totalTrials, firstLegTrials),
          objective: objectiveVector
        })
      )
      const resumedResult = yield* Effect.fromOption(asMultiObjective(resumed))

      const firstTraceOption = yield* traceFromResult(first)
      const secondTraceOption = yield* traceFromResult(second)

      expect(Option.isSome(firstTraceOption)).toBe(true)
      expect(Option.isSome(secondTraceOption)).toBe(true)
      const firstTrace = yield* Effect.fromOption(firstTraceOption)
      const secondTrace = yield* Effect.fromOption(secondTraceOption)

      const firstTraceJson = encodeTrace(Arr.fromIterable(firstTrace))
      const secondTraceJson = encodeTrace(Arr.fromIterable(secondTrace))
      const resumedTrace = yield* Effect.fromOption(yield* traceFromResult(resumed))

      expect(Arr.fromIterable(firstResult.trials)).toHaveLength(totalTrials)
      expect(Arr.fromIterable(secondResult.trials)).toHaveLength(totalTrials)
      expect(Arr.fromIterable(resumedResult.trials)).toHaveLength(totalTrials)
      expect(firstTraceJson).toBe(secondTraceJson)
      expect(encodeTrace(Arr.fromIterable(resumedTrace))).toBe(firstTraceJson)

      const firstValues = valuesFromResult(firstResult)
      expect(firstValues).toHaveLength(totalTrials)
      expect(firstValues).toEqual(yield* Effect.forEach(firstTrace, objectiveVector))
      expect(encodeVectors(valuesFromResult(secondResult))).toBe(encodeVectors(firstValues))
      expect(encodeVectors(valuesFromResult(resumedResult))).toBe(encodeVectors(firstValues))

      const firstParetoTrialNumbers = Arr.map(
        Arr.fromIterable(firstResult.paretoFront),
        (trial) => trial.trialNumber
      )
      const secondParetoTrialNumbers = Arr.map(
        Arr.fromIterable(secondResult.paretoFront),
        (trial) => trial.trialNumber
      )

      expect(secondParetoTrialNumbers).toEqual(firstParetoTrialNumbers)
      expect(Arr.map(Arr.fromIterable(resumedResult.paretoFront), (trial) => trial.trialNumber)).toEqual(
        firstParetoTrialNumbers
      )

      const firstParetoValues = Arr.map(
        Arr.fromIterable(firstResult.paretoFront),
        (trial) => toVector(trial.state.value)
      )
      const secondParetoValues = Arr.map(
        Arr.fromIterable(secondResult.paretoFront),
        (trial) => toVector(trial.state.value)
      )
      expect(encodeVectors(Arr.fromIterable(secondParetoValues))).toBe(
        encodeVectors(Arr.fromIterable(firstParetoValues))
      )

      const directions = Arr.fromIterable(fixture.payload.directions)
      expect(
        Arr.every(
          firstParetoValues,
          (candidate) =>
            Bool.not(Arr.some(firstValues, (point) => independentlyDominates(point, candidate, directions)))
        )
      ).toBe(true)
      expect(
        Arr.every(
          firstValues,
          (point) =>
            Arr.some(
              firstParetoValues,
              (candidate) =>
                Bool.or(Equal.equals(candidate, point), independentlyDominates(candidate, point, directions))
            )
        )
      ).toBe(true)
    }))
})
