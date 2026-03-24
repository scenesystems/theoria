import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option, Schema } from "effect"

import {
  decodePromptCategoricalConfigEffect,
  makePromptCategoricalSpace,
  PromptCategoricalConfigSchema
} from "../../src/experimental/scenarios/promptCategorical.js"
import * as Sampler from "../../src/Sampler/index.js"
import * as Study from "../../src/Study/index.js"
import { FixtureRegistryLive, loadFixture, TpeCategoricalStudyReplayFixtureSchema } from "../helpers/fixtures.js"

const encodeTrace = Schema.encodeSync(Schema.parseJson(Schema.Array(PromptCategoricalConfigSchema)))

const instructionPenalty = (instruction: string): number =>
  instruction === "rewrite" ? 0 : instruction === "counterexample" ? 0.35 : instruction === "socratic" ? 0.6 : 0.9

const demosPenalty = (demos: string): number => demos === "curated" ? 0 : demos === "few" ? 0.25 : 0.55

const scoringPenalty = (scoring: string): number => scoring === "balanced" ? 0 : scoring === "recall" ? 0.2 : 0.45

const interactionPenalty = (instruction: string, demos: string, scoring: string): number =>
  instruction === "rewrite" && demos === "curated" && scoring === "balanced" ? -0.25 : 0

const objectiveValue = (raw: unknown) =>
  decodePromptCategoricalConfigEffect(raw).pipe(
    Effect.map((config) =>
      instructionPenalty(config.instruction) +
      demosPenalty(config.demos) +
      scoringPenalty(config.scoring) +
      interactionPenalty(config.instruction, config.demos, config.scoring)
    )
  )

const asSingleObjective = (result: Study.StudyResult) =>
  result._tag === "SingleObjective" ? Option.some(result) : Option.none()

const traceFromResult = (
  result: Study.StudyResult
) =>
  Option.match(asSingleObjective(result), {
    onNone: () => Effect.succeed(Option.none()),
    onSome: (value) =>
      Effect.forEach(value.trials, (trial) => decodePromptCategoricalConfigEffect(trial.config)).pipe(
        Effect.map((trace) => Option.some(trace))
      )
  })

const optimizeWithReplayFixture = (
  fixture: Schema.Schema.Type<typeof TpeCategoricalStudyReplayFixtureSchema>
) =>
  Study.optimize({
    space: makePromptCategoricalSpace(),
    sampler: Sampler.tpe({
      seed: fixture.payload.sampler.seed,
      nStartupTrials: fixture.payload.sampler.nStartupTrials,
      nEiCandidates: fixture.payload.sampler.nEiCandidates
    }),
    direction: "minimize",
    trials: fixture.payload.sampler.trials,
    objective: objectiveValue
  })

describe("integration deterministic fixture replay", () => {
  it.effect("replays seed/history to byte-identical trace output", () =>
    Effect.gen(function*() {
      const loaded = yield* loadFixture("tpe-categorical-study.replay").pipe(Effect.provide(FixtureRegistryLive))
      const fixture = yield* Schema.decodeUnknown(TpeCategoricalStudyReplayFixtureSchema)(loaded)

      const first = yield* optimizeWithReplayFixture(fixture)
      const second = yield* optimizeWithReplayFixture(fixture)
      const firstOption = asSingleObjective(first)
      const secondOption = asSingleObjective(second)

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

      expect(firstOption.value.bestTrial.state.value).toBeCloseTo(fixture.payload.expected.bestValue, 12)
      expect(secondOption.value.bestTrial.state.value).toBeCloseTo(fixture.payload.expected.bestValue, 12)
    }))
})
