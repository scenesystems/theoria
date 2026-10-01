import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Boolean as Bool, Effect, Equal, Match, Number as Num, Option, Schema } from "effect"

import * as Optimization from "../../src/Optimization.js"
import * as Sampler from "../../src/Sampler.js"
import {
  decodePromptCategoricalConfig,
  makePromptCategoricalSpace,
  PromptCategoricalConfig
} from "../fixtures/scenarios/promptCategorical.js"
import { FixtureRegistryLive, loadFixture, TpeCategoricalStudyReplayFixture } from "../helpers/fixtures/index.js"

const encodeTrace = Schema.encodeSync(Schema.parseJson(Schema.Array(PromptCategoricalConfig)))

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
    Match.when(true, () => Num.negate(0.25)),
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

const runWithReplayFixture = (
  fixture: Schema.Schema.Type<typeof TpeCategoricalStudyReplayFixture>
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
      direction: "minimize",
      trials: fixture.payload.sampler.trials,
      objective: objectiveValue
    })
  })

describe("integration deterministic fixture replay", () => {
  it.effect("replays seed/history to byte-identical trace output", () =>
    Effect.gen(function*() {
      const loaded = yield* loadFixture("tpe-categorical-study.replay").pipe(Effect.provide(FixtureRegistryLive))
      const fixture = yield* Schema.decodeUnknown(TpeCategoricalStudyReplayFixture)(loaded)

      const first = yield* runWithReplayFixture(fixture)
      const second = yield* runWithReplayFixture(fixture)
      const firstOption = asSingleObjective(first)
      const secondOption = asSingleObjective(second)

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

      expect(firstResult.bestTrial.state.value).toBeCloseTo(fixture.payload.expected.bestValue, 12)
      expect(secondResult.bestTrial.state.value).toBeCloseTo(fixture.payload.expected.bestValue, 12)
    }))
})
