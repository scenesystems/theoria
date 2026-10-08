/**
 * GEPA deterministic replay over the selected, result-bound program.
 */
import { describe, expect, it } from "@effect/vitest"
import * as Utf8 from "@scenesystems/digest/Utf8"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as GEPA from "@scenesystems/effect-dsp/GEPA"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Boolean as Bool, Data, Effect, Match, Option, Record, Ref, Schema, String as Str } from "effect"
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

class ReplayArtifacts extends Data.Class<{
  readonly selectedInstruction: string
  readonly originalInstruction: string
  readonly bestCandidateId: string
  readonly selectedStateBytes: ReadonlyArray<number>
  readonly callerStateBytes: ReadonlyArray<number>
  readonly paretoSnapshotBytes: ReadonlyArray<number>
}> {}

class AnswerResponse extends Schema.Class<AnswerResponse>("AnswerResponse")({
  answer: Schema.String
}) {}

const evolvedInstruction = "Answer each geography question with the concise, correct capital city."

const reflectiveResponse = Arr.of(
  Response.TextPart.make({
    metadata: {},
    text: `\`\`\`\n${evolvedInstruction}\n\`\`\``
  })
)

// Only the evolved instruction answers the Germany row correctly, so the seed scores
// [1, 1, 0] and the reflected child scores [1, 1, 1].
const responseForPrompt = (prompt: string) =>
  Match.value(prompt).pipe(
    Match.when(Str.includes("Your task is to write a new instruction"), () => reflectiveResponse),
    Match.when(Str.includes("France"), () => new AnswerResponse({ answer: "Paris" })),
    Match.when(Str.includes("Japan"), () => new AnswerResponse({ answer: "Tokyo" })),
    Match.orElse((text) =>
      new AnswerResponse({
        answer: Bool.match(Str.includes(evolvedInstruction)(text), { onFalse: () => "Lyon", onTrue: () => "Berlin" })
      })
    )
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
    const originalInstruction = (yield* Ref.get(module.parameters)).instructions
    const mock = yield* MockLanguageModel.make(
      MockLanguageModel.map(responseForPrompt)
    )
    const recorded = yield* Ref.make(Arr.empty<GEPA.Event>())
    const result = yield* GEPA.runWithEvents(
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
        maxMetricCalls: 30,
        maxIterations,
        seed
      }),
      (event) => Ref.update(recorded, Arr.append(event))
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
    const eventList = yield* Ref.get(recorded)
    const finalPareto = yield* Option.match(Arr.last(Arr.filter(eventList, GEPA.events.$is("ParetoUpdated"))), {
      onNone: () => Effect.sync(() => expect.fail("GEPA emitted no ParetoUpdated event")),
      onSome: Effect.succeed
    })
    const completed = yield* Option.match(
      Arr.last(Arr.filter(eventList, GEPA.events.$is("OptimizationCompleted"))),
      {
        onNone: () => Effect.sync(() => expect.fail("GEPA emitted no OptimizationCompleted event")),
        onSome: Effect.succeed
      }
    )
    const selected = yield* Option.match(Record.get(result.parameters, moduleName), {
      onNone: () => Effect.sync(() => expect.fail(`result parameters omit ${moduleName}`)),
      onSome: Effect.succeed
    })
    // Bytes come from the result-bound program, not from the untouched caller module.
    const selectedState = yield* Module.save(result.program)
    expect(selectedState.parameters).toEqual(result.parameters)
    const paretoJson = yield* encodeParetoSnapshotJson({
      frontierIndices: finalPareto.frontierIndices,
      dominatedIndices: finalPareto.dominatedIndices,
      parentWeights: finalPareto.parentWeights
    })
    return new ReplayArtifacts({
      selectedInstruction: selected.instructions,
      originalInstruction,
      bestCandidateId: completed.bestCandidateId,
      selectedStateBytes: yield* toUtf8Bytes(yield* encodeSavedStateJson(selectedState)),
      callerStateBytes: yield* toUtf8Bytes(yield* encodeSavedStateJson(yield* Module.save(module))),
      paretoSnapshotBytes: yield* toUtf8Bytes(paretoJson)
    })
  })

describe("GEPA deterministic replay", () => {
  it.effect(
    "replays seeded runs with byte-stable selected programs after a nontrivial accepted mutation",
    () =>
      Effect.gen(function*() {
        const reference = yield* fixture("gepa-aggregate-best-001", "upstream-execution")
        const { seed } = yield* Schema.decodeUnknownEffect(Schema.Struct({ seed: Schema.Int }))(reference.payload)
        const firstRun = yield* runSeededReplay("qa", seed, 3)
        const secondRun = yield* runSeededReplay("qa", seed, 3)

        // The seed aggregates 2/3 and the reflected child 3/3, so candidate-1 is selected.
        expect(firstRun.bestCandidateId).toBe("candidate-1")
        expect(firstRun.selectedInstruction).toBe(evolvedInstruction)
        expect(firstRun.selectedInstruction).not.toBe(firstRun.originalInstruction)
        expect(firstRun.selectedStateBytes).not.toEqual(firstRun.callerStateBytes)
        expect(secondRun.bestCandidateId).toBe(firstRun.bestCandidateId)
        expect(secondRun.selectedStateBytes).toEqual(firstRun.selectedStateBytes)
        expect(secondRun.paretoSnapshotBytes).toEqual(firstRun.paretoSnapshotBytes)
        expect(secondRun.callerStateBytes).toEqual(firstRun.callerStateBytes)
      })
  )
})
