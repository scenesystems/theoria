/**
 * GEPA orchestration contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import * as Response from "@effect/ai/Response"
import { describe, expect, it } from "@effect/vitest"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Optimizer from "@scenesystems/effect-dsp/Optimizer"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { MockLanguageModel } from "@scenesystems/effect-dsp/test"
import {
  Array as Arr,
  Boolean as Bool,
  Data,
  Deferred,
  Effect,
  Fiber,
  Inspectable,
  Layer,
  Match,
  Number as Num,
  Option,
  Order,
  Record,
  Ref,
  Schema,
  Stream,
  String as Str
} from "effect"
import { PredictorInstruction, ProgramCandidate } from "../../../src/optimizers/GEPA/model.js"
import { CandidateEvaluationWindow, evaluateCandidate } from "../../../src/optimizers/GEPA/runtime/evaluate.js"
import { GepaOrchestrationEventOrderFixtureSchema, loadFixture } from "../../helpers/dspy-fixtures/index.js"

class AnswerResponse extends Schema.Class<AnswerResponse>("AnswerResponse")({
  answer: Schema.String
}) {}

class DraftResponse extends Schema.Class<DraftResponse>("DraftResponse")({
  draft: Schema.String,
  sources: Schema.Array(Schema.String)
}) {}

class Gate2MetricFailure extends Data.TaggedError("Gate2MetricFailure") {}

const reflectiveResponse = Arr.of(
  Response.textPart({
    text: "```\nAnswer each question concisely using the most accurate fact available.\n```"
  })
)

const improvingReflectiveResponse = Arr.of(
  Response.textPart({
    text: "```\nimproved instruction\n```"
  })
)

const FULL_VALSET_ROW_COUNT = 4
const INITIAL_AND_REFLECTION_PARENT_ROW_COUNT = Num.multiply(2, FULL_VALSET_ROW_COUNT)
const REJECTED_MUTATION_ROW_COUNT = Num.sum(INITIAL_AND_REFLECTION_PARENT_ROW_COUNT, 3)
const ACCEPTED_MUTATION_ROW_COUNT = Num.sum(INITIAL_AND_REFLECTION_PARENT_ROW_COUNT, FULL_VALSET_ROW_COUNT)

const responseForPrompt = (prompt: string) =>
  Match.value(prompt).pipe(
    Match.when(Str.includes("Your task is to write a new instruction"), () => reflectiveResponse),
    Match.orElse(() => new AnswerResponse({ answer: "Paris" }))
  )

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
      confidence: Signature.describe(Schema.NumberFromString, "Integer confidence weight")
    },
    {
      draft: Signature.describe(Schema.String, "Draft answer"),
      sources: Signature.describe(Schema.Array(Schema.String), "Sources used by the draft")
    }
  )

const makeEvaluationExamples = () =>
  Arr.map(Arr.range(1, FULL_VALSET_ROW_COUNT), (index) =>
    new Example({
      input: { question: Str.concat("Question ", Inspectable.toStringUnknown(index)) },
      output: { answer: "correct" }
    }))

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
      Optimizer.gepaStream({
        module,
        trainset: makeEvaluationExamples(),
        metric: Metric.exactMatch("answer"),
        maxIterations: 1,
        seed: 42
      })
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
    const eventList = Arr.fromIterable(events)

    return Data.struct({
      acceptance: Arr.findFirst(eventList, Optimizer.GEPAEvent.$is("AcceptanceEvaluated")),
      evaluatedRows: yield* Ref.get(evaluatedRows)
    })
  })

const scoreAnswer = (prediction: AnswerResponse, expected: AnswerResponse) =>
  new Metric.Result({
    score: Bool.match(Str.Equivalence(prediction.answer, expected.answer), {
      onFalse: () => 0,
      onTrue: () => 1
    })
  })

describe("Optimizer.gepa orchestration", () => {
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
      const observedCandidate = yield* Ref.make(false)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed(new DraftResponse({ draft: "correct", sources: Arr.make("trace-source") }))
      )
      const candidate = new ProgramCandidate({
        candidateId: "composed-failure",
        parentIds: Arr.empty(),
        predictorInstructions: Arr.make(
          new PredictorInstruction({ predictorName: root.name, instruction: "changed root" }),
          new PredictorInstruction({ predictorName: child.name, instruction: "changed child" })
        )
      })
      const metric = Metric.fromEffect(
        "composedFailure",
        () =>
          Effect.all({ root: Ref.get(root.params), child: Ref.get(child.params) }).pipe(
            Effect.flatMap((current) =>
              Ref.set(
                observedCandidate,
                Bool.and(
                  Str.Equivalence(current.root.instructions, "changed root"),
                  Str.Equivalence(current.child.instructions, "changed child")
                )
              )
            ),
            Effect.zipRight(Effect.fail(new Gate2MetricFailure()))
          )
      )

      const failure = yield* evaluateCandidate(
        {
          module: root,
          trainset: Arr.make(
            new Example({ input: { question: "Compose this" }, output: { answer: "correct" } })
          ),
          metric,
          maxIterations: 0
        },
        candidate
      ).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.flip
      )

      expect(failure).toBeInstanceOf(Gate2MetricFailure)
      expect(yield* Ref.get(observedCandidate)).toBe(true)
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
        MockLanguageModel.fixed(new DraftResponse({ draft: "correct", sources: Arr.make("trace-source") }))
      )
      const candidate = new ProgramCandidate({
        candidateId: "composed-interruption",
        parentIds: Arr.empty(),
        predictorInstructions: Arr.make(
          new PredictorInstruction({ predictorName: root.name, instruction: "interrupted root" }),
          new PredictorInstruction({ predictorName: child.name, instruction: "interrupted child" })
        )
      })
      const metric = Metric.fromEffect(
        "composedInterruption",
        () =>
          Effect.all({ root: Ref.get(root.params), child: Ref.get(child.params) }).pipe(
            Effect.flatMap((current) =>
              Effect.if(
                Bool.and(
                  Str.Equivalence(current.root.instructions, "interrupted root"),
                  Str.Equivalence(current.child.instructions, "interrupted child")
                ),
                {
                  onFalse: () => Effect.never,
                  onTrue: () => Deferred.succeed(metricStarted, true).pipe(Effect.zipRight(Effect.never))
                }
              )
            )
          )
      )
      const fiber = yield* evaluateCandidate(
        {
          module: root,
          trainset: Arr.make(
            new Example({ input: { question: "Interrupt this" }, output: { answer: "correct" } })
          ),
          metric,
          maxIterations: 0
        },
        candidate
      ).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.fork
      )

      yield* Deferred.await(metricStarted)
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
        MockLanguageModel.fixed(new AnswerResponse({ answer: "correct" }))
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
        {
          module,
          trainset: makeEvaluationExamples(),
          metric: Metric.exactMatch("answer"),
          maxIterations: 0
        },
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
      const mock = yield* MockLanguageModel.make(MockLanguageModel.fixed(improvingReflectiveResponse))

      yield* Optimizer.gepa({
        module,
        trainset: makeEvaluationExamples(),
        metric: Metric.exactMatch("answer"),
        maxIterations: 1,
        seed: 42
      }).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))

      expect(yield* Ref.get(evaluatedRows)).toBe(REJECTED_MUTATION_ROW_COUNT)
      expect(yield* Ref.get(module.params)).toEqual(originalParams)
    }))

  it.effect("streams gate work accurately and reuses the scored prefix after gate 1 passes", () =>
    Effect.gen(function*() {
      const rejected = yield* runCountingStream(false)
      const accepted = yield* runCountingStream(true)
      const rejectedAcceptance = yield* rejected.acceptance
      const acceptedAcceptance = yield* accepted.acceptance

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
      const metric = Metric.fromEffect(
        "gate2Failure",
        (prediction: AnswerResponse, expected) =>
          Ref.updateAndGet(scoredRows, Num.increment).pipe(
            Effect.flatMap((rowCount) =>
              Effect.if(Num.Equivalence(rowCount, ACCEPTED_MUTATION_ROW_COUNT), {
                onFalse: () => Effect.succeed(scoreAnswer(prediction, expected)),
                onTrue: () => Effect.fail(new Gate2MetricFailure())
              })
            )
          )
      )

      const failure = yield* Optimizer.gepa({
        module,
        trainset: makeEvaluationExamples(),
        metric,
        maxIterations: 1,
        seed: 42
      }).pipe(
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
              () => Deferred.succeed(gate2Started, true).pipe(Effect.zipRight(Effect.never))
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
      const fiber = yield* Optimizer.gepa({
        module,
        trainset: makeEvaluationExamples(),
        metric: Metric.exactMatch("answer"),
        maxIterations: 1,
        seed: 42
      }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.fork
      )

      yield* Deferred.await(gate2Started)
      yield* Fiber.interrupt(fiber)

      expect(yield* Ref.get(module.params)).toEqual(originalParams)
    }))

  it.effect("runs merge-check → reflective mutation → acceptance → Pareto update in canonical order", () =>
    Effect.gen(function*() {
      const rawEventOrderFixture = yield* loadFixture("dspy.gepa.orchestration.event-order.seed-0")
      const eventOrderFixture = yield* Schema.decodeUnknown(GepaOrchestrationEventOrderFixtureSchema)(
        rawEventOrderFixture
      )
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const mock = yield* MockLanguageModel.make(MockLanguageModel.map(responseForPrompt))
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)
      const events = yield* Stream.runCollect(
        Optimizer.gepaStream({
          module,
          trainset: Arr.make(
            new Example({
              input: { question: "What is the capital of France?" },
              output: { answer: "London" }
            }),
            new Example({
              input: { question: "What is the capital of Japan?" },
              output: { answer: "Berlin" }
            })
          ),
          metric: Metric.exactMatch("answer"),
          maxIterations: 2,
          seed: 42
        })
      ).pipe(Effect.provide(layer))

      const eventList = Arr.fromIterable(events)
      const tags = Arr.map(eventList, (event) => event._tag)
      // Where each stage of an iteration first appears; upstream's order is the fixture's.
      const firstAppearance = Option.all(
        Arr.map(
          eventOrderFixture.payload.expectedWithinIterationOrder,
          (tag) => Arr.findFirstIndex(tags, (candidate) => Str.Equivalence(candidate, tag))
        )
      )

      expect(Option.isSome(firstAppearance)).toBe(true)
      expect(Option.map(firstAppearance, Arr.sort(Order.number))).toEqual(firstAppearance)
      expect(Arr.head(tags)).toEqual(
        Option.some(Arr.headNonEmpty(eventOrderFixture.payload.expectedWithinIterationOrder))
      )
      expect(Arr.last(tags)).toEqual(Option.some(eventOrderFixture.payload.expectedTerminalTag))
    }))
})
