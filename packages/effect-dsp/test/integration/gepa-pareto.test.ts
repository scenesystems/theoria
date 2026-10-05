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

const reflectiveResponse = Arr.of(
  Response.makePart("text", {
    text: "```\nAnswer geography questions with concise, factually correct capital city names.\n```"
  })
)

const responseForPrompt = (prompt: string) =>
  Match.value(prompt).pipe(
    Match.when(Str.includes("Your task is to write a new instruction"), () => reflectiveResponse),
    Match.when(Str.includes("France"), () => AnswerResponse.make({ answer: "Paris" })),
    Match.when(Str.includes("Japan"), () => AnswerResponse.make({ answer: "Tokyo" })),
    Match.orElse(() => AnswerResponse.make({ answer: "Lyon" }))
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
      const initialRootParams = yield* Ref.get(root.params)
      const initialChildParams = yield* Ref.get(child.params)
      const improvedChildInstruction = "Use the weighted query to produce the correct executable child draft."
      const composedMock = yield* MockLanguageModel.make(
        MockLanguageModel.fromFunction((prompt) =>
          Match.value(prompt).pipe(
            Match.when(
              (text) =>
                Bool.and(
                  Str.includes("Your task is to write a new instruction")(text),
                  Str.includes("Target predictor: child-drafter")(text)
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
              output: { answer: "correct" }
            })
          ),
          metric: Metric.exactMatch("answer"),
          maxIterations: 2,
          seed: 42
        }),
        (event) => Ref.update(recorded, Arr.append(event))
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, composedMock.service))
      const finalOutput = yield* compiled.program.forward({ question: "What result should the child produce?" }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, composedMock.service)
      )
      const childParams = Option.getOrThrow(Record.get(compiled.parameters, "composed-qa.child"))
      const rootParams = yield* Ref.get(root.params)
      const mutationEvents = Arr.filter(yield* Ref.get(recorded), GEPA.events.$is("MutationProposed"))
      const childReflection = yield* Effect.fromOption(
        yield* Ref.get(composedMock.calls).pipe(
          Effect.map((calls) =>
            Arr.findFirst(calls, (call) => Str.includes("Target predictor: child-drafter")(call.prompt))
          )
        )
      )
      expect(Arr.map(mutationEvents, (event) => event.predictorName)).toEqual(
        Arr.make("child-drafter", "child-drafter")
      )
      expect(childParams.instructions).toBe(improvedChildInstruction)
      expect(yield* Ref.get(child.params)).toBe(initialChildParams)
      expect(rootParams).toEqual(initialRootParams)
      expect(childParams.demos).toEqual(initialChildParams.demos)
      expect(finalOutput.answer).toBe("correct")
      expect(childReflection.prompt).toContain("## Inputs (Actual Target Predictor Execution)")
      expect(childReflection.prompt).toContain("\"confidence\":\"7\"")
      expect(childReflection.prompt).toContain("\"sources\":[\"child-trace-source\"]")
      expect(childReflection.prompt).toContain("Expected Output (Program-level; Not a Child Predictor Label)")
    }))

  it.effect(
    "runs end-to-end with deterministic mock LM and feedback-aware metric",
    () =>
      Effect.gen(function*() {
        const reference = yield* fixture("gepa-aggregate-best-001", "upstream-execution")
        const { seed } = yield* Schema.decodeUnknownEffect(Schema.Struct({ seed: Schema.Int }))(reference.payload)
        const signature = yield* makeQaSignature()
        const module = yield* Module.predict("qa", signature)
        const mock = yield* MockLanguageModel.make(
          MockLanguageModel.map(responseForPrompt)
        )
        const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)
        const feedbackMetric = Metric.fromEffect(
          "feedbackExactMatch",
          (prediction: typeof AnswerResponse.Type, expected) =>
            Effect.sync(() => {
              const predicted = prediction.answer
              const expectedAnswer = expected.answer
              const correct = Str.Equivalence(predicted, expectedAnswer)

              return Bool.match(correct, {
                onFalse: () =>
                  new Metric.Result({
                    score: 0,
                    feedback: Arr.join(Arr.make("expected ", expectedAnswer, ", got ", predicted), "")
                  }),
                onTrue: () =>
                  new Metric.Result({
                    score: 1,
                    feedback: "correct"
                  })
              })
            })
        )

        const events = yield* Stream.runCollect(
          GEPA.stream(
            new GEPA.Options({
              module,
              trainset: Arr.make(
                new Example({
                  input: { question: "What is the capital of France?" },
                  output: { answer: "Paris" }
                }),
                new Example({
                  input: { question: "What is the capital of Japan?" },
                  output: { answer: "Tokyo" }
                }),
                new Example({
                  input: { question: "What is the capital of Germany?" },
                  output: { answer: "Berlin" }
                })
              ),
              metric: feedbackMetric,
              maxIterations: 3,
              seed
            })
          )
        ).pipe(Effect.provide(layer))

        const eventList = Arr.fromIterable(events)
        const paretoEvents = Arr.filter(eventList, GEPA.events.$is("ParetoUpdated"))
        const params = yield* Ref.get(module.params)

        expect(Num.isGreaterThan(Arr.length(paretoEvents), 0)).toBe(true)
        expect(Num.isGreaterThan(Str.length(params.instructions), 0)).toBe(true)
        expect(Option.isSome(Arr.findFirst(eventList, GEPA.events.$is("AcceptanceEvaluated")))).toBe(true)
      })
  )
})
