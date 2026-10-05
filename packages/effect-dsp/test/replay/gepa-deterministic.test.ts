/**
 * GEPA deterministic replay and fixture-manifest parity contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import * as Utf8 from "@scenesystems/digest/Utf8"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as GEPA from "@scenesystems/effect-dsp/GEPA"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Data, Effect, Layer, Match, Option, Schema, Stream, String as Str } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import * as Response from "effect/ai/Response"

import { fixture } from "../kit/Fixtures.js"

const encodeSavedStateJson = Schema.encodeEffect(Schema.fromJsonString(Module.SavedState))
const ParetoSnapshotSchema = Schema.Struct({
  frontierIndices: Schema.Array(Schema.Finite),
  dominatedIndices: Schema.Array(Schema.Finite),
  parentWeights: Schema.Array(
    Schema.Struct({
      candidateIndex: Schema.Finite,
      weight: Schema.Finite
    })
  )
})
const encodeParetoSnapshotJson = Schema.encodeEffect(Schema.fromJsonString(ParetoSnapshotSchema))

class MissingParetoUpdatedEvent extends Data.TaggedError("MissingParetoUpdatedEvent") {}

class ReplayArtifacts extends Data.Class<{
  readonly savedStateBytes: ReadonlyArray<number>
  readonly paretoSnapshotBytes: ReadonlyArray<number>
}> {}

class AnswerResponse extends Schema.Class<AnswerResponse>("AnswerResponse")({
  answer: Schema.String
}) {}

const reflectiveResponse = Arr.of(
  Response.TextPart.make({
    metadata: {},
    text: "```\nAnswer each geography question with the concise, correct capital city.\n```"
  })
)

const responseForPrompt = (prompt: string) =>
  Match.value(prompt).pipe(
    Match.when(Str.includes("Your task is to write a new instruction"), () => reflectiveResponse),
    Match.when(Str.includes("France"), () => new AnswerResponse({ answer: "Paris" })),
    Match.when(Str.includes("Japan"), () => new AnswerResponse({ answer: "Tokyo" })),
    Match.orElse(() => new AnswerResponse({ answer: "Lyon" }))
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

const toUtf8Bytes = (value: string) => Effect.map(Utf8.encode(value), Arr.fromIterable)

const runSeededReplay = (moduleName: string, seed: number, maxIterations: number) =>
  Effect.gen(function*() {
    const signature = yield* makeQaSignature()
    const module = yield* Module.predict(moduleName, signature)
    const mock = yield* MockLanguageModel.make(
      MockLanguageModel.map(responseForPrompt)
    )
    const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)
    const events = yield* Stream.runCollect(
      GEPA.stream(
        new GEPA.Options({
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
          metric: Metric.exactMatch("answer"),
          maxIterations,
          seed
        })
      )
    ).pipe(Effect.provide(layer))
    const eventList = Arr.fromIterable(events)
    const finalPareto = Arr.last(Arr.filter(eventList, GEPA.events.$is("ParetoUpdated")))
    const savedState = yield* Module.save(module)
    const savedStateJson = yield* encodeSavedStateJson(savedState)

    return yield* Option.match(finalPareto, {
      onNone: () => Effect.fail(new MissingParetoUpdatedEvent()),
      onSome: (event) =>
        Effect.gen(function*() {
          const paretoJson = yield* encodeParetoSnapshotJson({
            frontierIndices: event.frontierIndices,
            dominatedIndices: event.dominatedIndices,
            parentWeights: event.parentWeights
          })
          const savedStateBytes = yield* toUtf8Bytes(savedStateJson)
          const paretoSnapshotBytes = yield* toUtf8Bytes(paretoJson)

          return new ReplayArtifacts({ savedStateBytes, paretoSnapshotBytes })
        })
    })
  })

describe("GEPA deterministic replay", () => {
  it.effect(
    "replays seeded runs with byte-stable outputs",
    () =>
      Effect.gen(function*() {
        const reference = yield* fixture("gepa-aggregate-best-001", "upstream-execution")
        const { seed } = yield* Schema.decodeUnknownEffect(Schema.Struct({ seed: Schema.Int }))(reference.payload)
        const firstRun = yield* runSeededReplay("qa", seed, 3)
        const secondRun = yield* runSeededReplay("qa", seed, 3)

        expect(secondRun.savedStateBytes).toEqual(firstRun.savedStateBytes)
        expect(secondRun.paretoSnapshotBytes).toEqual(firstRun.paretoSnapshotBytes)
      })
  )
})
