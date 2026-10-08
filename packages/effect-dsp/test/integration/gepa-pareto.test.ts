/**
 * GEPA integration contract.
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
  Effect,
  Layer,
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
import { fixture } from "../kit/Fixtures.js"

const AnswerResponse = Schema.Struct({
  answer: Signature.describe(Schema.String, "A concise factual answer")
})

const DraftResponse = Schema.Struct({
  draft: Signature.describe(Schema.String, "An intermediate draft"),
  sources: Signature.describe(Schema.Array(Schema.String), "Evidence identifiers")
})

const reflectedInstruction = "Answer geography questions with concise, factually correct capital city names."

const reflectiveResponse = Arr.of(
  Response.makePart("text", {
    text: `\`\`\`\n${reflectedInstruction}\n\`\`\``
  })
)

// Germany is answered correctly only under the reflected instruction.
const responseForPrompt = (prompt: string) =>
  Match.value(prompt).pipe(
    Match.when(Str.includes("Your task is to write a new instruction"), () => reflectiveResponse),
    Match.when(Str.includes("France"), () => AnswerResponse.make({ answer: "Paris" })),
    Match.when(Str.includes("Japan"), () => AnswerResponse.make({ answer: "Tokyo" })),
    Match.orElse((text) =>
      AnswerResponse.make({
        answer: Bool.match(Str.includes(reflectedInstruction)(text), { onFalse: () => "Lyon", onTrue: () => "Berlin" })
      })
    )
  )

const makeQaSignature = () =>
  Signature.make(
    "Answer questions with concise facts",
    {
      question: Signature.describe(Schema.String, "The question to answer")
    },
    AnswerResponse.fields
  )

describe("GEPA integration", () => {
  it.effect("optimizes an executable heterogeneous child and retains its winning instruction", () =>
    Effect.gen(function*() {
      const rootSignature = yield* makeQaSignature()
      const childSignature = yield* Signature.make(
        "Draft a weighted response",
        {
          query: Signature.describe(Schema.String, "Query for the drafting predictor"),
          confidence: Signature.describe(Schema.FiniteFromString, "Confidence weight")
        },
        DraftResponse.fields
      )
      const child = yield* Module.predict("child-drafter", childSignature)
      const root = yield* Module.compose(
        new Module.ComposeOptions({
          name: "composed-qa",
          signature: rootSignature,
          subModules: { child },
          forward: ({ input }) =>
            child.forward({ query: input.question, confidence: 7 }).pipe(
              Effect.map((draft) => AnswerResponse.make({ answer: draft.draft }))
            )
        })
      )
      const initialRootParameters = yield* Ref.get(root.parameters)
      const initialChildParameters = yield* Ref.get(child.parameters)
      const improvedChildInstruction = "Use the weighted query to produce the correct executable child draft."
      const composedMock = yield* MockLanguageModel.make(
        MockLanguageModel.fromFunction((prompt) =>
          Match.value(prompt).pipe(
            Match.when(
              (text) =>
                Bool.and(
                  Str.includes("Your task is to write a new instruction")(text),
                  Str.includes("Target predictor: composed-qa.child")(text)
                ),
              () =>
                Effect.succeed(
                  Arr.of(
                    Response.makePart("text", {
                      text: Arr.join(Arr.make("```", improvedChildInstruction, "```"), "\n")
                    })
                  )
                )
            ),
            Match.when(
              Str.includes("Your task is to write a new instruction"),
              () => Effect.succeed(Arr.of(Response.makePart("text", { text: "```\nunused root mutation\n```" })))
            ),
            Match.orElse((text) =>
              Effect.succeed(
                DraftResponse.make({
                  draft: Bool.match(Str.includes(improvedChildInstruction)(text), {
                    onFalse: () => "incorrect",
                    onTrue: () => "correct"
                  }),
                  sources: Arr.make("child-trace-source")
                })
              )
            )
          )
        )
      )
      const recorded = yield* Ref.make(Arr.empty<GEPA.Event>())
      const compiled = yield* GEPA.runWithEvents(
        new GEPA.Options({
          module: root,
          trainset: Arr.make(
            new Example({
              input: { question: "What result should the child produce?" },
              labels: Option.some({ answer: "correct" })
            })
          ),
          metric: Metric.exactMatch("answer"),
          maxMetricCalls: 10,
          maxIterations: 2,
          seed: 42
        }),
        (event) => Ref.update(recorded, Arr.append(event))
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, composedMock.service))
      const finalOutput = yield* compiled.program.forward({ question: "What result should the child produce?" }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, composedMock.service)
      )
      const childParameters = Option.getOrThrow(Record.get(compiled.parameters, "composed-qa.child"))
      const rootParameters = yield* Ref.get(root.parameters)
      const mutationEvents = Arr.filter(yield* Ref.get(recorded), GEPA.events.$is("MutationProposed"))
      const childReflection = yield* Effect.fromOption(
        yield* Ref.get(composedMock.calls).pipe(
          Effect.map((calls) =>
            Arr.findFirst(calls, (call) => Str.includes("Target predictor: composed-qa.child")(call.prompt))
          )
        )
      )
      // skipPerfectScore defaults to true: the accepted child scores 1 in iteration 2, so no second proposal.
      expect(Arr.map(mutationEvents, (event) => event.predictorName)).toEqual(Arr.make("composed-qa.child"))
      expect(childParameters.instructions).toBe(improvedChildInstruction)
      expect(yield* Ref.get(child.parameters)).toBe(initialChildParameters)
      expect(rootParameters).toEqual(initialRootParameters)
      expect(childParameters.demos).toEqual(initialChildParameters.demos)
      expect(finalOutput.answer).toBe("correct")
      expect(childReflection.prompt).toContain("## Inputs (Actual Target Predictor Execution)")
      expect(childReflection.prompt).toContain("\"confidence\":\"7\"")
      expect(childReflection.prompt).toContain("\"sources\":[\"child-trace-source\"]")
      expect(childReflection.prompt).toContain("Expected Output (Program-level; Not a Child Predictor Label)")
    }))

  it.effect(
    "runs end-to-end with deterministic mock LM and feedback-aware metric and returns the hand-derived best candidate",
    () =>
      Effect.gen(function*() {
        const reference = yield* fixture("gepa-aggregate-best", "upstream-execution")
        const { seed } = yield* Schema.decodeUnknownEffect(Schema.Struct({ seed: Schema.Int }))(reference.payload)
        const signature = yield* makeQaSignature()
        const module = yield* Module.predict("qa", signature)
        const mock = yield* MockLanguageModel.make(
          MockLanguageModel.map(responseForPrompt)
        )
        const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)
        const feedbackMetric = Metric.withFeedback((example, result) =>
          Effect.gen(function*() {
            const prediction = yield* Schema.decodeUnknownEffect(Schema.toType(AnswerResponse))(result.output)
            const expected = yield* Schema.decodeUnknownEffect(AnswerResponse)(
              Option.getOrElse(example.labels, () => ({}))
            )
            const predicted = prediction.answer
            const expectedAnswer = expected.answer
            const correct = Str.Equivalence(predicted, expectedAnswer)

            return Bool.match(correct, {
              onFalse: () =>
                new Metric.Score({
                  value: 0,
                  feedback: Option.some(Arr.join(Arr.make("expected ", expectedAnswer, ", got ", predicted), ""))
                }),
              onTrue: () => new Metric.Score({ value: 1, feedback: Option.some("correct") })
            })
          }), "feedbackExactMatch")

        const options = new GEPA.Options({
          module,
          trainset: Arr.make(
            new Example({
              input: { question: "What is the capital of France?" },
              labels: Option.some({ answer: "Paris" })
            }),
            new Example({
              input: { question: "What is the capital of Japan?" },
              labels: Option.some({ answer: "Tokyo" })
            }),
            new Example({
              input: { question: "What is the capital of Germany?" },
              labels: Option.some({ answer: "Berlin" })
            })
          ),
          metric: feedbackMetric,
          maxMetricCalls: 30,
          maxIterations: 3,
          seed
        })
        const callerBefore = yield* Ref.get(module.parameters)
        const recorded = yield* Ref.make(Arr.empty<GEPA.Event>())
        const result = yield* GEPA.runWithEvents(options, (event) => Ref.update(recorded, Arr.append(event))).pipe(
          Effect.provide(layer)
        )
        const streamed = yield* Stream.runCollect(GEPA.stream(options)).pipe(Effect.provide(layer))

        const eventList = yield* Ref.get(recorded)
        const paretoEvents = Arr.filter(eventList, GEPA.events.$is("ParetoUpdated"))
        const state = yield* Option.match(result.report.state, {
          onNone: () => Effect.sync(() => expect.fail("GEPA report retained no final state")),
          onSome: Effect.succeed
        })
        const selected = yield* Option.match(Record.get(result.parameters, "qa"), {
          onNone: () => Effect.sync(() => expect.fail("GEPA result omitted the qa predictor")),
          onSome: Effect.succeed
        })
        const germany = yield* result.program.forward({ question: "What is the capital of Germany?" }).pipe(
          Effect.provide(layer)
        )

        // Hand-derived validation table (trainset doubles as valset): only the reflected
        // instruction answers Germany, so the seed scores [1, 1, 0] and the child [1, 1, 1].
        const expectedScores = [[1, 1, 0], [1, 1, 1]]
        const expectedBest = Option.getOrThrow(
          Arr.reduce(
            expectedScores,
            Option.none<{ index: number; total: number }>(),
            (best, scores, index) => {
              const total = Arr.reduce(scores, 0, Num.sum)
              return Option.match(best, {
                onNone: () => Option.some({ index, total }),
                onSome: (current) =>
                  Bool.match(total > current.total, {
                    onFalse: () => best,
                    onTrue: () => Option.some({ index, total })
                  })
              })
            }
          )
        )
        expect(expectedBest.index).toBe(1)
        expect(state.scoreVectors).toEqual(expectedScores)
        expect(
          Arr.map(
            state.candidates,
            (candidate) => Arr.map(candidate.predictorInstructions, (entry) => entry.instruction)
          )
        ).toEqual([
          [callerBefore.instructions],
          [reflectedInstruction]
        ])
        expect(result.report.optimizationBestCandidateId).toBe(`candidate-${expectedBest.index}`)
        expect(selected.instructions).toBe(reflectedInstruction)
        expect(selected.instructions).not.toBe(callerBefore.instructions)
        expect(germany.answer).toBe("Berlin")
        expect(
          Arr.getSomes(Arr.map(eventList, (event) =>
            Match.value(event).pipe(
              Match.tag("AcceptanceEvaluated", (acceptance) =>
                Option.some({
                  accepted: acceptance.accepted,
                  before: acceptance.previousSubsampleSum,
                  after: acceptance.mutatedSubsampleSum
                })),
              Match.orElse(() => Option.none())
            )))
        ).toEqual([{ accepted: true, before: 2, after: 3 }])
        expect(Arr.length(paretoEvents)).toBe(3)
        expect(Option.getOrThrow(Arr.last(paretoEvents)).frontierIndices).toEqual([1])
        expect(Arr.fromIterable(streamed)).toEqual(eventList)
        expect(yield* Ref.get(module.parameters)).toEqual(callerBefore)
        expect(Num.isGreaterThan(Arr.length(paretoEvents), 0)).toBe(true)
        expect(Num.isGreaterThan(Str.length(selected.instructions), 0)).toBe(true)
      })
  )
})
