/**
 * BootstrapRS pinned settings defaults and its bounded fraction-ranking boundary.
 *
 * Upstream references (DSPy 3.4.0):
 * - dspy/dsp/utils/settings.py:32 `max_errors=10`
 * - dspy/teleprompt/random_search.py:69 `effective_max_errors = ... dspy.settings.max_errors`, passed to every
 *   BootstrapFewShot (:99, :116) and to the full-validation Evaluate (:125)
 * - dspy/evaluate/evaluate.py:227 `score=round(100 * ncorrect / ntotal, 2)`
 * - dspy/teleprompt/random_search.py:136 `score > max(scores)` and :146 `score >= self.stop_at_score`
 *
 * The rounded-percentage expectations below were recorded by executing the pinned upstream optimizer
 * (`BootstrapFewShotWithRandomSearch` with scripted evaluation scores and one validation row).
 */
import { describe, expect, it } from "@effect/vitest"
import * as BootstrapRS from "@scenesystems/effect-dsp/BootstrapRS"
import * as Evaluate from "@scenesystems/effect-dsp/Evaluate"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import * as TeacherTrace from "@scenesystems/effect-dsp/TeacherTrace"
import { Array as Arr, Boolean as Bool, Effect, Number as Num, Option, Ref, Schema, Tuple } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { assertNoMutation } from "../kit/Mutation.js"

/** `dspy.settings.max_errors` at the pinned DSPy 3.4.0 (dspy/dsp/utils/settings.py:32). */
const settingsMaxErrors = 10

const rows = (prefix: string, count: number) =>
  Arr.makeBy(
    count,
    (index) => new Example({ input: { question: `${prefix}-${index}` }, labels: Option.some({ answer: "Paris" }) })
  )

class ScorerFailed extends Schema.TaggedError<ScorerFailed>()("ScorerFailed", { phase: Schema.String }) {}

const setup = Effect.gen(function*() {
  const signature = yield* Signature.make("Answer questions", { question: Schema.String }, { answer: Schema.String })
  const module = yield* Module.predict("qa", signature)
  // Structured output keeps every candidate's rows scorable whether or not it carries demonstrations.
  yield* Ref.update(
    module.parameters,
    (parameters) =>
      new ModuleParameters({
        instructions: parameters.instructions,
        demos: parameters.demos,
        outputStrategy: "structured"
      })
  )
  const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "Paris" }))
  return { module, mock }
})

const score = (value: number) => new Metric.Score({ value, feedback: Option.none() })

/** Fails every metric call in one phase and records the calls made in that phase. */
const failingIn = (phase: Metric.Phase, calls: Ref.Ref<number>) =>
  Metric.withFeedback((_example, _prediction, context) =>
    Bool.match(context.phase === phase, {
      onFalse: () => Effect.succeed(score(1)),
      onTrue: () => Ref.update(calls, Num.increment).pipe(Effect.andThen(Effect.fail(new ScorerFailed({ phase }))))
    }), "failing")

/** Returns scripted evaluation values in candidate order; bootstrap acceptance always scores one. */
const scripted = (values: ReadonlyArray<number>) =>
  Effect.gen(function*() {
    const position = yield* Ref.make(0)
    return Metric.withFeedback((_example, _prediction, context) =>
      Bool.match(context.phase === "evaluate", {
        onFalse: () => Effect.succeed(score(1)),
        onTrue: () =>
          Ref.getAndUpdate(position, Num.increment).pipe(
            Effect.flatMap((index) => Effect.fromOption(Arr.get(values, index))),
            // A missing scripted value is a broken test, never an expected evaluation failure.
            Effect.orDie,
            Effect.map(score)
          )
      }), "scripted")
  })

const runScripted = (values: ReadonlyArray<number>, stopAtScore: Option.Option<number>) =>
  Effect.gen(function*() {
    const { mock, module } = yield* setup
    const metric = yield* scripted(values)
    const result = yield* assertNoMutation(
      module,
      BootstrapRS.run(
        new BootstrapRS.Options({
          module,
          trainset: rows("train", 2),
          valset: rows("val", 1),
          metric,
          numCandidatePrograms: 0,
          maxBootstrappedDemos: 1,
          maxLabeledDemos: 1,
          stopAtScore
        })
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
    )
    // Every scripted value must come from a scored row, never from a failed row's zero.
    expect(Arr.map(result.report.candidates, (candidate) => candidate.evaluation.failureCount)).toEqual(
      Arr.map(result.report.candidates, () => 0)
    )
    return result
  })

const seedsAndScores = (report: BootstrapRS.Report) =>
  Arr.map(report.candidates, (candidate) => Tuple.make(candidate.seed, candidate.score))

describe("BootstrapRS pinned max_errors default", () => {
  it.effect("absent maxErrors cancels full validation at DSPy's settings default of ten errors", () =>
    Effect.gen(function*() {
      const { mock, module } = yield* setup
      const calls = yield* Ref.make(0)
      const failure = yield* assertNoMutation(
        module,
        BootstrapRS.run(
          new BootstrapRS.Options({
            module,
            trainset: rows("train", 2),
            valset: rows("val", 12),
            metric: failingIn("evaluate", calls),
            numCandidatePrograms: 0
          })
        ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
      ).pipe(Effect.flip)

      // Upstream: the zero-shot candidate's Evaluate cancels after ten scorer errors and compile raises.
      expect(failure).toEqual(new Evaluate.TooManyErrors({ count: settingsMaxErrors, limit: settingsMaxErrors }))
      expect(yield* Ref.get(calls)).toBe(settingsMaxErrors)
    }))

  it.effect("absent maxErrors reaches each bootstrap compilation as the same settings default", () =>
    Effect.gen(function*() {
      const { mock, module } = yield* setup
      const calls = yield* Ref.make(0)
      const failure = yield* assertNoMutation(
        module,
        BootstrapRS.run(
          new BootstrapRS.Options({
            module,
            trainset: rows("train", 12),
            valset: rows("val", 1),
            metric: failingIn("bootstrap", calls),
            numCandidatePrograms: 0,
            maxBootstrappedDemos: 12,
            maxLabeledDemos: 0
          })
        ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
      ).pipe(Effect.flip)

      expect(failure).toEqual(new TeacherTrace.TooManyErrors({ count: settingsMaxErrors, limit: settingsMaxErrors }))
      expect(yield* Ref.get(calls)).toBe(settingsMaxErrors)
    }))
})

describe("BootstrapRS fraction ranking versus DSPy rounded percentages", () => {
  it.effect("ranks unrounded fractions where DSPy's two-decimal percentages tie (bounded below 1e-4)", () =>
    Effect.gen(function*() {
      const result = yield* runScripted([0.33331, 0.33334, 0], Option.none())

      expect(seedsAndScores(result.report)).toEqual([[-3, 0.33331], [-2, 0.33334], [-1, 0]])
      // Approved public policy: higher fraction wins, earliest wins exact ties.
      expect(result.report.winnerSeed).toBe(-2)
      // Pinned upstream recorded 33.33 for both and kept seed -3. The divergence exists only because
      // the fractions are closer than one hundredth of a percent.
      const upstream = { scores: [33.33, 33.33, 0], winnerSeed: -3 }
      expect(upstream.winnerSeed).not.toBe(result.report.winnerSeed)
      expect(Num.isLessThan(Num.subtract(0.33334, 0.33331), 0.0001)).toBe(true)
    }))

  it.effect("agrees with DSPy once fractions differ by at least one hundredth of a percent", () =>
    Effect.gen(function*() {
      const result = yield* runScripted([0.3333, 0.3334, 0], Option.none())

      expect(seedsAndScores(result.report)).toEqual([[-3, 0.3333], [-2, 0.3334], [-1, 0]])
      // Pinned upstream recorded 33.33 and 33.34 and selected seed -2.
      expect(result.report.winnerSeed).toBe(-2)
    }))

  it.effect("stopAtScore compares the unrounded fraction, so 0.99996 does not stop where DSPy's 100.0 does", () =>
    Effect.gen(function*() {
      const result = yield* runScripted([0.99996, 1, 1], Option.some(1))

      expect(seedsAndScores(result.report)).toEqual([[-3, 0.99996], [-2, 1]])
      expect(result.report.winnerSeed).toBe(-2)
      // Pinned upstream with stop_at_score=100 rounded 99.996 to 100.0, stopped after seed -3 and kept it.
      const upstream = { evaluatedSeeds: [-3], winnerSeed: -3 }
      expect(Arr.length(upstream.evaluatedSeeds)).toBe(1)
      expect(Num.isLessThan(Num.subtract(1, 0.99996), 0.00005)).toBe(true)
    }))
})
