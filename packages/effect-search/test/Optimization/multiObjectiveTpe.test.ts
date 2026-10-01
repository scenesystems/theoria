import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Boolean as Bool, Effect, Equal, Match, Number as Num, Option, Schema } from "effect"

import { toVector } from "../../src/Objective.js"
import * as Optimization from "../../src/Optimization.js"
import { nonDominatedIndices } from "../../src/Pareto.js"
import * as Sampler from "../../src/Sampler.js"
import {
  decodePromptCategoricalConfig,
  makePromptCategoricalSpace,
  PromptCategoricalConfig
} from "../fixtures/scenarios/promptCategorical.js"
import { FixtureRegistryLive, loadFixture, MotpeStudyFixture } from "../helpers/fixtures/index.js"

const encodeTrace = Schema.encodeSync(Schema.parseJson(Schema.Array(PromptCategoricalConfig)))
const encodeVectors = Schema.encodeSync(Schema.parseJson(Schema.Array(Schema.Array(Schema.Number))))

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
    Match.when(true, () => Num.negate(0.2)),
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
  fixture: Schema.Schema.Type<typeof MotpeStudyFixture>
) =>
  Effect.gen(function*() {
    const space = yield* makePromptCategoricalSpace()
    return yield* Optimization.run({
      space,
      sampler: Sampler.tpe({
        seed: fixture.payload.sampler.seed,
        nStartupTrials: fixture.payload.sampler.nStartupTrials,
        nEiCandidates: fixture.payload.sampler.nEiCandidates
      }),
      directions: fixture.payload.directions,
      trials: fixture.payload.sampler.trials,
      objective: objectiveVector
    })
  })

describe("integration deterministic MOTPE optimization replay", () => {
  it.effect("replays deterministic multi-objective trace and pareto front", () =>
    Effect.gen(function*() {
      const loaded = yield* loadFixture("motpe-study.2obj").pipe(Effect.provide(FixtureRegistryLive))
      const fixture = yield* Schema.decodeUnknown(MotpeStudyFixture)(loaded)

      const first = yield* runWithFixture(fixture)
      const second = yield* runWithFixture(fixture)
      const firstOption = asMultiObjective(first)
      const secondOption = asMultiObjective(second)

      expect(Option.isSome(firstOption)).toBe(true)
      expect(Option.isSome(secondOption)).toBe(true)
      const firstResult = yield* firstOption
      const secondResult = yield* secondOption

      const firstTraceOption = yield* traceFromResult(first)
      const secondTraceOption = yield* traceFromResult(second)

      expect(Option.isSome(firstTraceOption)).toBe(true)
      expect(Option.isSome(secondTraceOption)).toBe(true)
      const firstTrace = yield* firstTraceOption
      const secondTrace = yield* secondTraceOption

      const expectedTraceJson = encodeTrace(fixture.payload.expected.configTrace)
      const firstTraceJson = encodeTrace(Arr.fromIterable(firstTrace))
      const secondTraceJson = encodeTrace(Arr.fromIterable(secondTrace))

      expect(firstTraceJson).toBe(expectedTraceJson)
      expect(secondTraceJson).toBe(expectedTraceJson)
      expect(firstTraceJson).toBe(secondTraceJson)

      const firstParetoTrialNumbers = Arr.map(
        Arr.fromIterable(firstResult.paretoFront),
        (trial) => trial.trialNumber
      )
      const secondParetoTrialNumbers = Arr.map(
        Arr.fromIterable(secondResult.paretoFront),
        (trial) => trial.trialNumber
      )

      expect(firstParetoTrialNumbers).toEqual(fixture.payload.expected.paretoTrialNumbers)
      expect(secondParetoTrialNumbers).toEqual(fixture.payload.expected.paretoTrialNumbers)

      const firstParetoValues = Arr.map(
        Arr.fromIterable(firstResult.paretoFront),
        (trial) => toVector(trial.state.value)
      )
      const secondParetoValues = Arr.map(
        Arr.fromIterable(secondResult.paretoFront),
        (trial) => toVector(trial.state.value)
      )
      const expectedParetoValues = fixture.payload.expected.paretoValues

      expect(encodeVectors(Arr.fromIterable(firstParetoValues))).toBe(encodeVectors(expectedParetoValues))
      expect(encodeVectors(Arr.fromIterable(secondParetoValues))).toBe(encodeVectors(expectedParetoValues))

      expect(nonDominatedIndices(firstParetoValues, fixture.payload.directions)).toEqual(
        Arr.map(firstParetoValues, (_point, index) => index)
      )
      expect(nonDominatedIndices(secondParetoValues, fixture.payload.directions)).toEqual(
        Arr.map(secondParetoValues, (_point, index) => index)
      )
    }))
})
