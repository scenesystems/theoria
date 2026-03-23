import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option, Schema } from "effect"

import { normalizeObjectiveVector } from "../../src/contracts/index.js"
import {
  decodePromptCategoricalConfigEffect,
  makePromptCategoricalSpace,
  PromptCategoricalConfigSchema
} from "../../src/experimental/scenarios/promptCategorical.js"
import { nonDominatedIndices } from "../../src/internal/pareto.js"
import * as Sampler from "../../src/Sampler/index.js"
import * as Study from "../../src/Study/index.js"
import { FixtureRegistryLive, loadFixture, MotpeStudyFixtureSchema } from "../helpers/fixtures.js"

const encodeTrace = Schema.encodeSync(Schema.parseJson(Schema.Array(PromptCategoricalConfigSchema)))
const encodeVectors = Schema.encodeSync(Schema.parseJson(Schema.Array(Schema.Array(Schema.Number))))

const instructionLatency = (instruction: string): number =>
  instruction === "baseline" ? 0.3 : instruction === "rewrite" ? 0.9 : instruction === "counterexample" ? 1.5 : 2.1

const demosLatency = (demos: string): number => demos === "none" ? 0.1 : demos === "few" ? 0.6 : 1.3

const scoringLatency = (scoring: string): number => scoring === "recall" ? 0.2 : scoring === "balanced" ? 0.5 : 1.1

const instructionQualityLoss = (instruction: string): number =>
  instruction === "baseline" ? 2.0 : instruction === "rewrite" ? 1.2 : instruction === "counterexample" ? 0.8 : 0.5

const demosQualityLoss = (demos: string): number => demos === "none" ? 1.8 : demos === "few" ? 0.9 : 0.2

const scoringQualityLoss = (scoring: string): number => scoring === "recall" ? 1.4 : scoring === "balanced" ? 0.9 : 0.4

const interactionQualityBonus = (instruction: string, demos: string, scoring: string): number =>
  instruction === "socratic" && demos === "curated" && scoring === "strict" ? -0.2 : 0

const objectiveVector = (raw: unknown) =>
  decodePromptCategoricalConfigEffect(raw).pipe(
    Effect.map((config) => [
      instructionLatency(config.instruction) +
      demosLatency(config.demos) +
      scoringLatency(config.scoring),
      instructionQualityLoss(config.instruction) +
      demosQualityLoss(config.demos) +
      scoringQualityLoss(config.scoring) +
      interactionQualityBonus(config.instruction, config.demos, config.scoring)
    ])
  )

const asMultiObjective = (result: Study.StudyResult) =>
  result._tag === "MultiObjective" ? Option.some(result) : Option.none()

const traceFromResult = (
  result: Study.StudyResult
) =>
  Option.match(asMultiObjective(result), {
    onNone: () => Effect.succeed(Option.none()),
    onSome: (value) =>
      Effect.forEach(value.trials, (trial) => decodePromptCategoricalConfigEffect(trial.config)).pipe(
        Effect.map((trace) => Option.some(trace))
      )
  })

const optimizeWithFixture = (
  fixture: Schema.Schema.Type<typeof MotpeStudyFixtureSchema>
) =>
  Study.optimize({
    space: makePromptCategoricalSpace(),
    sampler: Sampler.tpe({
      seed: fixture.payload.sampler.seed,
      nStartupTrials: fixture.payload.sampler.nStartupTrials,
      nEiCandidates: fixture.payload.sampler.nEiCandidates
    }),
    directions: fixture.payload.directions,
    trials: fixture.payload.sampler.trials,
    objective: objectiveVector
  })

describe("integration deterministic MOTPE study replay", () => {
  it.effect("replays deterministic multi-objective trace and pareto front", () =>
    Effect.gen(function*() {
      const loaded = yield* loadFixture("motpe-study.2obj").pipe(Effect.provide(FixtureRegistryLive))
      const fixture = yield* Schema.decodeUnknown(MotpeStudyFixtureSchema)(loaded)

      const first = yield* optimizeWithFixture(fixture)
      const second = yield* optimizeWithFixture(fixture)
      const firstOption = asMultiObjective(first)
      const secondOption = asMultiObjective(second)

      expect(Option.isSome(firstOption)).toBe(true)
      expect(Option.isSome(secondOption)).toBe(true)

      if (Option.isNone(firstOption) || Option.isNone(secondOption)) {
        return
      }

      const firstTraceOption = yield* traceFromResult(first)
      const secondTraceOption = yield* traceFromResult(second)

      expect(Option.isSome(firstTraceOption)).toBe(true)
      expect(Option.isSome(secondTraceOption)).toBe(true)

      if (Option.isNone(firstTraceOption) || Option.isNone(secondTraceOption)) {
        return
      }

      const expectedTraceJson = encodeTrace(fixture.payload.expected.configTrace)
      const firstTraceJson = encodeTrace(Arr.fromIterable(firstTraceOption.value))
      const secondTraceJson = encodeTrace(Arr.fromIterable(secondTraceOption.value))

      expect(firstTraceJson).toBe(expectedTraceJson)
      expect(secondTraceJson).toBe(expectedTraceJson)
      expect(firstTraceJson).toBe(secondTraceJson)

      const firstParetoTrialNumbers = firstOption.value.paretoFront.map((trial) => trial.trialNumber)
      const secondParetoTrialNumbers = secondOption.value.paretoFront.map((trial) => trial.trialNumber)

      expect(firstParetoTrialNumbers).toEqual(fixture.payload.expected.paretoTrialNumbers)
      expect(secondParetoTrialNumbers).toEqual(fixture.payload.expected.paretoTrialNumbers)

      const firstParetoValues = firstOption.value.paretoFront.map((trial) =>
        normalizeObjectiveVector(trial.state.value)
      )
      const secondParetoValues = secondOption.value.paretoFront.map((trial) =>
        normalizeObjectiveVector(trial.state.value)
      )
      const expectedParetoValues = fixture.payload.expected.paretoValues

      expect(encodeVectors(Arr.fromIterable(firstParetoValues))).toBe(encodeVectors(expectedParetoValues))
      expect(encodeVectors(Arr.fromIterable(secondParetoValues))).toBe(encodeVectors(expectedParetoValues))

      expect(nonDominatedIndices(firstParetoValues, fixture.payload.directions)).toEqual(
        firstParetoValues.map((_point, index) => index)
      )
      expect(nonDominatedIndices(secondParetoValues, fixture.payload.directions)).toEqual(
        secondParetoValues.map((_point, index) => index)
      )
    }))
})
