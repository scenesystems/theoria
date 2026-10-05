/**
 * GEPA orchestration contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as GEPA from "@scenesystems/effect-dsp/GEPA"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import {
  Array as Arr,
  Boolean as Bool,
  Data,
  Deferred,
  Effect,
  Fiber,
  Inspectable,
  Match,
  Number as Num,
  Option,
  Record,
  Ref,
  Schema,
  Stream,
  String as Str
} from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import * as Response from "effect/ai/Response"
import { PredictorInstruction, ProgramCandidate } from "../../src/internal/gepa/model.js"
import { CandidateEvaluationWindow, evaluateCandidate } from "../../src/internal/gepa/runtime/evaluate.js"

class AnswerResponse extends Schema.Class<AnswerResponse>("AnswerResponse")({
  answer: Schema.String
}) {}

class DraftResponse extends Schema.Class<DraftResponse>("DraftResponse")({
  draft: Schema.String,
  sources: Schema.Array(Schema.String)
}) {}

class Gate2MetricFailure extends Data.TaggedError("Gate2MetricFailure") {}

type AcceptanceEvaluatedEvent = Extract<GEPA.Event, { readonly _tag: "AcceptanceEvaluated" }>

class CountingStreamResult extends Data.Class<{
  readonly acceptance: Option.Option<AcceptanceEvaluatedEvent>
  readonly evaluatedRows: number
}> {}

const improvingReflectiveResponse = Arr.of(
  Response.TextPart.make({
    metadata: {},
    text: "```\nimproved instruction\n```"
  })
)

const FULL_VALSET_ROW_COUNT = 4
const INITIAL_AND_REFLECTION_PARENT_ROW_COUNT = Num.multiply(2, FULL_VALSET_ROW_COUNT)
const REJECTED_MUTATION_ROW_COUNT = Num.sum(INITIAL_AND_REFLECTION_PARENT_ROW_COUNT, 3)
const ACCEPTED_MUTATION_ROW_COUNT = Num.sum(INITIAL_AND_REFLECTION_PARENT_ROW_COUNT, FULL_VALSET_ROW_COUNT)

const makeQaSignature = () =>
  Signature.make(
    "Answer questions with concise facts",
    {
      question: Signature.describe(Schema.String, "The question to answer")
    },
    {
      answer: Signature.describe(Schema.String, "A concise factual answer")
    }
  )

const makeDraftSignature = () =>
  Signature.make(
    "Draft an answer from a weighted query",
    {
      query: Signature.describe(Schema.String, "Question rewritten for the drafting stage"),
      confidence: Signature.describe(Schema.FiniteFromString, "Integer confidence weight")
    },
    {
      draft: Signature.describe(Schema.String, "Draft answer"),
      sources: Signature.describe(Schema.Array(Schema.String), "Sources used by the draft")
    }
  )

const makeEvaluationExamples = () =>
  Arr.map(
    Arr.range(1, FULL_VALSET_ROW_COUNT),
    (index) =>
      new Example({
        input: { question: Str.concat("Question ", Inspectable.toStringUnknown(index)) },
        labels: Option.some({ answer: "correct" })
      })
  )

const makeCountingModel = (
  evaluatedRows: Ref.Ref<number>,
  mutatedIsBetter: boolean
) =>
  MockLanguageModel.make(
    MockLanguageModel.fromFunction((prompt) =>
      Match.value(prompt).pipe(
        Match.when(
          Str.includes("Your task is to write a new instruction"),
          () => Effect.succeed(improvingReflectiveResponse)
        ),
        Match.orElse(() => {
          const usesMutation = Str.includes("Instructions: improved instruction")(prompt)
          const isCorrect = Bool.match(mutatedIsBetter, {
            onFalse: () => Bool.not(usesMutation),
            onTrue: () => usesMutation
          })

          return Ref.update(evaluatedRows, Num.increment).pipe(
            Effect.as(
              new AnswerResponse({
                answer: Bool.match(isCorrect, {
                  onFalse: () => "incorrect",
                  onTrue: () => "correct"
                })
              })
            )
          )
        })
      )
    )
  )

const runCountingStream = (mutatedIsBetter: boolean) =>
  Effect.gen(function*() {
    const signature = yield* makeQaSignature()
    const module = yield* Module.predict("counting-qa", signature)
    const evaluatedRows = yield* Ref.make(0)
    const mock = yield* makeCountingModel(evaluatedRows, mutatedIsBetter)
    const events = yield* Stream.runCollect(
      GEPA.stream(
        new GEPA.Options({
          module,
          trainset: makeEvaluationExamples(),
          metric: Metric.exactMatch("answer"),
          maxIterations: 1,
          seed: 42
        })
      )
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
    const eventList = Arr.fromIterable(events)

    return new CountingStreamResult({
      acceptance: Arr.findFirst(eventList, GEPA.events.$is("AcceptanceEvaluated")),
      evaluatedRows: yield* Ref.get(evaluatedRows)
    })
  })

describe("GEPA.run orchestration", () => {
  it.effect("restores every composed parameter owner after a checked candidate-evaluation failure", () =>
    Effect.gen(function*() {
      const rootSignature = yield* makeQaSignature()
      const draftSignature = yield* makeDraftSignature()
      const child = yield* Module.predict("draft-child", draftSignature)
      const root = yield* Module.compose(
        new Module.ComposeOptions({
          name: "draft-program",
          signature: rootSignature,
          subModules: { child },
          forward: ({ input }) =>
            child.forward({ query: input.question, confidence: 7 }).pipe(
              Effect.map((result) => new AnswerResponse({ answer: result.draft }))
            )
        })
      )
      const rootParams = yield* Ref.get(root.params)
      const childParams = yield* Ref.get(child.params)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.succeed(new DraftResponse({ draft: "correct", sources: Arr.make("trace-source") }))
      )
      const candidate = new ProgramCandidate({
        candidateId: "composed-failure",
        parentIds: Arr.empty(),
        predictorInstructions: Arr.make(
          new PredictorInstruction({ predictorName: root.name, instruction: "changed root" }),
          new PredictorInstruction({ predictorName: child.name, instruction: "changed child" })
        )
      })
      const metric = Metric.withFeedback(() =>
        Effect.gen(function*() {
          expect(yield* Ref.get(root.params)).toBe(rootParams)
          expect(yield* Ref.get(child.params)).toBe(childParams)
          return yield* new Gate2MetricFailure()
        }), "composedFailure")

      const failure = yield* evaluateCandidate(
        new GEPA.Options({
          module: root,
          trainset: Arr.make(
            new Example({ input: { question: "Compose this" }, labels: Option.some({ answer: "correct" }) })
          ),
          metric,
          maxIterations: 0
        }),
        candidate
      ).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.flip
      )

      expect(failure).toBeInstanceOf(Gate2MetricFailure)
      expect(Option.getOrThrow(Arr.head(yield* Ref.get(mock.calls))).prompt).toContain("changed child")
      expect(yield* Ref.get(root.params)).toEqual(rootParams)
      expect(yield* Ref.get(child.params)).toEqual(childParams)
    }))

  it.effect("restores every composed parameter owner after candidate evaluation is interrupted", () =>
    Effect.gen(function*() {
      const rootSignature = yield* makeQaSignature()
      const draftSignature = yield* makeDraftSignature()
      const child = yield* Module.predict("interrupt-child", draftSignature)
      const root = yield* Module.compose(
        new Module.ComposeOptions({
          name: "interrupt-program",
          signature: rootSignature,
          subModules: { child },
          forward: ({ input }) =>
            child.forward({ query: input.question, confidence: 9 }).pipe(
              Effect.map((result) => new AnswerResponse({ answer: result.draft }))
            )
        })
      )
      const rootParams = yield* Ref.get(root.params)
      const childParams = yield* Ref.get(child.params)
      const metricStarted = yield* Deferred.make<boolean>()
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.succeed(new DraftResponse({ draft: "correct", sources: Arr.make("trace-source") }))
      )
      const candidate = new ProgramCandidate({
        candidateId: "composed-interruption",
        parentIds: Arr.empty(),
        predictorInstructions: Arr.make(
          new PredictorInstruction({ predictorName: root.name, instruction: "interrupted root" }),
          new PredictorInstruction({ predictorName: child.name, instruction: "interrupted child" })
        )
      })
      const metric = Metric.withFeedback(
        () => Deferred.succeed(metricStarted, true).pipe(Effect.andThen(Effect.never)),
        "composedInterruption"
      )
      const fiber = yield* evaluateCandidate(
        new GEPA.Options({
          module: root,
          trainset: Arr.make(
            new Example({ input: { question: "Interrupt this" }, labels: Option.some({ answer: "correct" }) })
          ),
          metric,
          maxIterations: 0
        }),
        candidate
      ).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.forkScoped
      )

      yield* Deferred.await(metricStarted)
      expect(Option.getOrThrow(Arr.head(yield* Ref.get(mock.calls))).prompt).toContain("interrupted child")
      expect(yield* Ref.get(child.params)).toBe(childParams)
      yield* Fiber.interrupt(fiber)

      expect(yield* Ref.get(root.params)).toEqual(rootParams)
      expect(yield* Ref.get(child.params)).toEqual(childParams)
    }))

  it.effect("keeps full-valset row identities when evaluating a continuation window", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("counting-qa", signature)
      const originalParams = yield* Ref.get(module.params)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.succeed(new AnswerResponse({ answer: "correct" }))
      )
      const candidate = new ProgramCandidate({
        candidateId: "window-candidate",
        parentIds: Arr.empty(),
        predictorInstructions: Arr.make(
          new PredictorInstruction({
            predictorName: module.name,
            instruction: "window instruction"
          })
        )
      })
      const evaluation = yield* evaluateCandidate(
        new GEPA.Options({
          module,
          trainset: makeEvaluationExamples(),
          metric: Metric.withFeedback((example, prediction, context) =>
            Effect.gen(function*() {
              expect(yield* Ref.get(module.params)).toEqual(originalParams)
              return yield* Metric.exactMatch("answer").score(example, prediction, context)
            }), "immutable"),
          maxIterations: 0
        }),
        candidate,
        new CandidateEvaluationWindow({
          startIndex: 2,
          rowCount: Option.some(2)
        })
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))

      expect(evaluation.scores).toEqual(Arr.make(1, 1))
      expect(Arr.map(evaluation.samples, (sample) => sample.exampleId)).toEqual(
        Arr.make("example-2", "example-3")
      )
      expect(Arr.length(yield* Ref.get(mock.calls))).toBe(2)
      expect(yield* Ref.get(module.params)).toEqual(originalParams)
    }))

  it.effect("uses only the three-row gate-1 prefix when a public gepa mutation is rejected", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const evaluatedRows = yield* Ref.make(0)
      const module = yield* Module.compose(
        new Module.ComposeOptions({
          name: "composed-counting-qa",
          signature,
          subModules: Record.empty(),
          forward: () =>
            Ref.update(evaluatedRows, Num.increment).pipe(
              Effect.as(new AnswerResponse({ answer: "correct" }))
            )
        })
      )
      const originalParams = yield* Ref.get(module.params)
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed(improvingReflectiveResponse))

      yield* GEPA.run(
        new GEPA.Options({
          module,
          trainset: makeEvaluationExamples(),
          metric: Metric.exactMatch("answer"),
          maxIterations: 1,
          seed: 42
        })
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))

      expect(yield* Ref.get(evaluatedRows)).toBe(REJECTED_MUTATION_ROW_COUNT)
      expect(yield* Ref.get(module.params)).toEqual(originalParams)
    }))

  it.effect("streams gate work accurately and reuses the scored prefix after gate 1 passes", () =>
    Effect.gen(function*() {
      const rejected = yield* runCountingStream(false)
      const accepted = yield* runCountingStream(true)
      const rejectedAcceptance = yield* Effect.fromOption(rejected.acceptance)
      const acceptedAcceptance = yield* Effect.fromOption(accepted.acceptance)

      expect(rejected.evaluatedRows).toBe(REJECTED_MUTATION_ROW_COUNT)
      expect(rejectedAcceptance.accepted).toBe(false)
      expect(rejectedAcceptance.gate1Passed).toBe(false)
      expect(rejectedAcceptance.fullValsetEvaluated).toBe(false)

      expect(accepted.evaluatedRows).toBe(ACCEPTED_MUTATION_ROW_COUNT)
      expect(acceptedAcceptance.accepted).toBe(true)
      expect(acceptedAcceptance.gate1Passed).toBe(true)
      expect(acceptedAcceptance.fullValsetEvaluated).toBe(true)
    }))

  it.effect("restores parameters and preserves a checked failure from accepted gate-2 evaluation", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("counting-qa", signature)
      const originalParams = yield* Ref.get(module.params)
      const evaluatedRows = yield* Ref.make(0)
      const scoredRows = yield* Ref.make(0)
      const mock = yield* makeCountingModel(evaluatedRows, true)
      const metric = Metric.withFeedback(
        (example, prediction, context) =>
          Ref.updateAndGet(scoredRows, Num.increment).pipe(
            Effect.flatMap((rowCount) =>
              Bool.match(Num.Equivalence(rowCount, ACCEPTED_MUTATION_ROW_COUNT), {
                onFalse: () => Metric.exactMatch("answer").score(example, prediction, context),
                onTrue: () => Effect.fail(new Gate2MetricFailure())
              })
            )
          ),
        "gate2Failure"
      )

      const failure = yield* GEPA.run(
        new GEPA.Options({
          module,
          trainset: makeEvaluationExamples(),
          metric,
          maxIterations: 1,
          seed: 42
        })
      ).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.flip
      )

      expect(failure).toBeInstanceOf(Gate2MetricFailure)
      expect(yield* Ref.get(evaluatedRows)).toBe(ACCEPTED_MUTATION_ROW_COUNT)
      expect(yield* Ref.get(module.params)).toEqual(originalParams)
    }))

  it.effect("restores parameters when accepted gate-2 evaluation is interrupted", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("counting-qa", signature)
      const originalParams = yield* Ref.get(module.params)
      const gate2Started = yield* Deferred.make<boolean>()
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fromFunction((prompt) =>
          Match.value(prompt).pipe(
            Match.when(
              Str.includes("Your task is to write a new instruction"),
              () => Effect.succeed(improvingReflectiveResponse)
            ),
            Match.when(
              (candidate) =>
                Bool.every(
                  Arr.make(
                    Str.includes("Instructions: improved instruction")(candidate),
                    Str.includes("Question 4")(candidate)
                  )
                ),
              () => Deferred.succeed(gate2Started, true).pipe(Effect.andThen(Effect.never))
            ),
            Match.orElse((candidate) =>
              Effect.succeed(
                new AnswerResponse({
                  answer: Bool.match(Str.includes("Instructions: improved instruction")(candidate), {
                    onFalse: () => "incorrect",
                    onTrue: () => "correct"
                  })
                })
              )
            )
          )
        )
      )
      const fiber = yield* GEPA.run(
        new GEPA.Options({
          module,
          trainset: makeEvaluationExamples(),
          metric: Metric.exactMatch("answer"),
          maxIterations: 1,
          seed: 42
        })
      ).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.forkScoped
      )

      yield* Deferred.await(gate2Started)
      yield* Fiber.interrupt(fiber)

      expect(yield* Ref.get(module.params)).toEqual(originalParams)
    }))
})
