/**
 * MIPROv2 phase-3 evaluation diagnostics and the pinned max_errors default.
 *
 * Upstream references (DSPy 3.4.0):
 * - dspy/dsp/utils/settings.py:30,32 `provide_traceback=False`, `max_errors=10`
 * - dspy/teleprompt/mipro_optimizer_v2.py:138-141 `effective_max_errors`, :219-227 one Evaluate with
 *   `max_errors=effective_max_errors, provide_traceback=provide_traceback`, :239 bootstrap max_errors
 * - dspy/utils/parallelizer.py:37-39 None inherits settings; :62-72 each failed item is logged, with
 *   `traceback.format_exc()` when provide_traceback is true and otherwise with a hint to enable it
 * - dspy/teleprompt/utils.py eval_candidate_program: a cancelled evaluation is logged and scores 0.0
 */
import { describe, expect, it } from "@effect/vitest"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import type * as MIPROv2 from "@scenesystems/effect-dsp/MIPROv2"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import {
  Array as Arr,
  Boolean as Bool,
  Cause,
  Data,
  Effect,
  Logger,
  Match,
  MutableRef,
  Number as Num,
  Option,
  Ref,
  References,
  Schema,
  String as Str
} from "effect"
import type { Record } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { resolveOptions, toPhase1Options, toPhase3Options } from "../../src/internal/miprov2/runtime/options.js"
import * as MIPROv2Options from "../../src/MIPROv2.js"
import { InstructionCandidate, PredictorInstructionCandidates } from "../../src/MIPROv2Candidates.js"
import * as MIPROv2Search from "../../src/MIPROv2Search.js"
import { assertNoMutation } from "../kit/Mutation.js"

/** `dspy.settings.max_errors` at the pinned DSPy 3.4.0. */
const settingsMaxErrors = 10
const withHint = "MIPROv2 evaluation example failed. Set provideTraceback: true for traceback."
const withTraceback = "MIPROv2 evaluation example failed"

class ScorerFailed extends Schema.TaggedError<ScorerFailed>()("ScorerFailed", { message: Schema.String }) {}

type Entry = Data.TaggedEnum<{
  Log: {
    readonly text: string
    readonly annotations: Record.ReadonlyRecord<string, unknown>
    readonly cause: Cause.Cause<unknown>
  }
  Emitted: { readonly event: MIPROv2.Event }
}>
const Entry = Data.taggedEnum<Entry>()

const Messages = Schema.Array(Schema.String)
const Question = Schema.Struct({ question: Schema.String })

const rows = (count: number) =>
  Arr.makeBy(
    count,
    (index) => new Example({ input: { question: `q-${index}` }, labels: Option.some({ answer: "Paris" }) })
  )

const setup = Effect.gen(function*() {
  const signature = yield* Signature.make("Answer questions", { question: Schema.String }, { answer: Schema.String })
  const module = yield* Module.predict("qa", signature)
  const baseline = (yield* Ref.get(module.parameters)).instructions
  const instructionCandidates = [
    new PredictorInstructionCandidates({
      predictorName: "qa",
      candidates: [
        new InstructionCandidate({
          predictorName: "qa",
          instruction: baseline,
          tip: "none",
          rolloutId: Option.none(),
          prompt: "baseline",
          isBaseline: true
        })
      ]
    })
  ]
  return { module, instructionCandidates }
})

/** Records log lines and emitted events in one execution-ordered timeline. */
const timeline = () => {
  const entries = MutableRef.make(Arr.empty<Entry>())
  const logger = Logger.make((options) => {
    MutableRef.update(
      entries,
      Arr.append(Entry.Log({
        text: Arr.join(Schema.decodeUnknownSync(Messages)(options.message), " "),
        annotations: options.fiber.getRef(References.CurrentLogAnnotations),
        cause: options.cause
      }))
    )
  })
  const emit = (event: MIPROv2.Event) =>
    Effect.sync(() => {
      MutableRef.update(entries, Arr.append(Entry.Emitted({ event })))
    })
  return { entries, layer: Logger.layer([logger]), emit }
}

const failsOn = (question: string) =>
  Metric.withFeedback((example) =>
    Schema.decodeUnknownEffect(Question)(example.input).pipe(
      Effect.orDie,
      Effect.flatMap(({ question: actual }) =>
        Bool.match(Str.Equivalence(actual, question), {
          onFalse: () => Effect.succeed(new Metric.Score({ value: 1, feedback: Option.none() })),
          onTrue: () => Effect.fail(new ScorerFailed({ message: "scorer failed" }))
        })
      )
    ), "failsOn")

const summary = (entry: Entry) =>
  Match.valueTags(entry, {
    Log: ({ annotations, cause, text }) => ({ log: text, annotations, traceback: Cause.hasFails(cause) }),
    Emitted: ({ event }) =>
      Match.value(event).pipe(
        Match.tag("TrialEvaluated", ({ fullValidation, sampled, score, trial }) => ({
          trial,
          score,
          fullValidation,
          sampled
        })),
        Match.orElse((other) => ({ event: other._tag }))
      )
  })

const logCause = (entry: Entry) =>
  Match.valueTags(entry, {
    Log: ({ cause }) => Option.some(cause),
    Emitted: () => Option.none()
  })

const runSearch = (options: {
  readonly provideTraceback: Option.Option<boolean>
  readonly metric: Metric.Metric<ScorerFailed>
  readonly valset: ReadonlyArray<Example>
  readonly trialBudget: number
  readonly maxErrors: Option.Option<number>
  readonly lm: MockLanguageModel.Strategy
}) =>
  Effect.gen(function*() {
    const { instructionCandidates, module } = yield* setup
    const mock = yield* MockLanguageModel.make(options.lm)
    const recorder = timeline()
    yield* assertNoMutation(
      module,
      MIPROv2Search.run(
        new MIPROv2Search.Options({
          module,
          valset: options.valset,
          metric: options.metric,
          demoCandidates: [],
          instructionCandidates,
          trialBudget: options.trialBudget,
          minibatch: false,
          emit: recorder.emit,
          ...Option.match(options.provideTraceback, {
            onNone: () => ({}),
            onSome: (provideTraceback) => ({ provideTraceback })
          }),
          ...Option.match(options.maxErrors, {
            onNone: () => ({}),
            onSome: (limit) => ({ maxErrors: Option.some(limit) })
          })
        })
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service), Effect.provide(recorder.layer))
    )
    return MutableRef.get(recorder.entries)
  })

const scorerAnnotations = (question: string) => ({
  input: `{"question":"${question}"}`,
  errorTag: "ScorerFailed",
  errorMessage: "scorer failed"
})
const baselineRow = { trial: 0, score: 0.5, fullValidation: true, sampled: false }

describe("MIPROv2 pinned max_errors default", () => {
  it.effect("compile defaults resolve bootstrap and evaluation budgets to dspy.settings.max_errors", () =>
    Effect.gen(function*() {
      const { module } = yield* setup
      const resolved = yield* resolveOptions(
        new MIPROv2Options.Options({ module, trainset: rows(5), metric: Metric.exactMatch("answer") })
      )
      expect(toPhase1Options(resolved).maxErrors).toEqual(Option.some(settingsMaxErrors))
      expect(toPhase3Options(resolved, MIPROv2Options.noEvents, [], []).maxErrors).toEqual(
        Option.some(settingsMaxErrors)
      )
      const explicit = yield* resolveOptions(
        new MIPROv2Options.Options({
          module,
          trainset: rows(5),
          metric: Metric.exactMatch("answer"),
          maxErrors: Option.some(3)
        })
      )
      expect(toPhase1Options(explicit).maxErrors).toEqual(Option.some(3))
      expect(toPhase3Options(explicit, MIPROv2Options.noEvents, [], []).maxErrors).toEqual(Option.some(3))
    }))

  it.effect("absent search maxErrors cancels an evaluation after ten failures and records zero", () =>
    Effect.gen(function*() {
      const { instructionCandidates, module } = yield* setup
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "Paris" }))
      const calls = yield* Ref.make(0)
      const metric = Metric.withFeedback(
        () =>
          Ref.update(calls, Num.increment).pipe(
            Effect.andThen(Effect.fail(new ScorerFailed({ message: "scorer failed" })))
          ),
        "failing"
      )
      const result = yield* MIPROv2Search.run(
        new MIPROv2Search.Options({
          module,
          valset: rows(12),
          metric,
          demoCandidates: [],
          instructionCandidates,
          trialBudget: 0,
          minibatch: false
        })
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service), Effect.provide(timeline().layer))

      expect(yield* Ref.get(calls)).toBe(settingsMaxErrors)
      expect(Arr.map(result.diagnostics.evaluations, (row) => row.score)).toEqual([0])
    }))
})

describe("MIPROv2 provideTraceback evaluation diagnostics", () => {
  it.effect("absent provideTraceback logs each failed example with DSPy's hint and no cause", () =>
    Effect.gen(function*() {
      const entries = yield* runSearch({
        provideTraceback: Option.none(),
        metric: failsOn("q-1"),
        valset: rows(2),
        trialBudget: 0,
        maxErrors: Option.none(),
        lm: MockLanguageModel.succeed({ answer: "Paris" })
      })

      expect(Arr.map(entries, summary)).toEqual([
        { log: withHint, annotations: scorerAnnotations("q-1"), traceback: false },
        baselineRow
      ])
    }))

  it.effect("provideTraceback false is the same as absent", () =>
    Effect.gen(function*() {
      const entries = yield* runSearch({
        provideTraceback: Option.some(false),
        metric: failsOn("q-0"),
        valset: rows(2),
        trialBudget: 0,
        maxErrors: Option.none(),
        lm: MockLanguageModel.succeed({ answer: "Paris" })
      })

      expect(Arr.map(entries, summary)).toEqual([
        { log: withHint, annotations: scorerAnnotations("q-0"), traceback: false },
        baselineRow
      ])
    }))

  it.effect("provideTraceback true attaches the failure cause with its stack instead of the hint", () =>
    Effect.gen(function*() {
      const entries = yield* runSearch({
        provideTraceback: Option.some(true),
        metric: failsOn("q-1"),
        valset: rows(2),
        trialBudget: 0,
        maxErrors: Option.none(),
        lm: MockLanguageModel.succeed({ answer: "Paris" })
      })

      expect(Arr.map(entries, summary)).toEqual([
        { log: withTraceback, annotations: scorerAnnotations("q-1"), traceback: true },
        baselineRow
      ])
      const cause = yield* Effect.fromOption(Option.flatMap(Arr.head(entries), logCause))
      expect(Cause.squash(cause)).toEqual(new ScorerFailed({ message: "scorer failed" }))
      expect(Str.includes("ScorerFailed")(Cause.pretty(cause))).toBe(true)
      expect(Str.includes("    at ")(Cause.pretty(cause))).toBe(true)
    }))

  it.effect("module failures stop at maxErrors and every partial trial is logged before its event", () =>
    Effect.gen(function*() {
      const entries = yield* runSearch({
        provideTraceback: Option.some(true),
        metric: failsOn("never"),
        valset: rows(3),
        trialBudget: 1,
        maxErrors: Option.some(2),
        lm: MockLanguageModel.fail("provider unavailable")
      })
      const failed = (question: string) => ({
        log: withTraceback,
        annotations: {
          input: `{"question":"${question}"}`,
          errorTag: "AiError",
          errorMessage: "MockLanguageModel.failing: MockLanguageModel.failing strategy requested an expected failure"
        },
        traceback: true
      })
      const cancelled = {
        log: "MIPROv2 evaluation failed",
        annotations: { errorTag: "TooManyErrors", count: 2, limit: 2 },
        traceback: true
      }

      // Two failures per evaluation reach the limit, so q-2 is never admitted; both rows still emit zero.
      expect(Arr.map(entries, summary)).toEqual([
        failed("q-0"),
        failed("q-1"),
        cancelled,
        { trial: 0, score: 0, fullValidation: true, sampled: false },
        failed("q-0"),
        failed("q-1"),
        cancelled,
        { trial: 1, score: 0, fullValidation: true, sampled: true }
      ])
    }))
})
