/**
 * GEPA deterministic replay and fixture-manifest parity contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Optimizer from "@scenesystems/effect-dsp/Optimizer"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { MockLanguageModel } from "@scenesystems/effect-dsp/test"
import { Array as Arr, Data, Effect, Layer, Option, Schema, Stream } from "effect"

import { GepaReplaySeedContractFixtureSchema, loadFixture } from "../helpers/dspy-fixtures/index.js"

const encodeSavedStateJson = Schema.encode(Schema.parseJson(Module.SavedState))
const ParetoSnapshotSchema = Schema.Struct({
  frontierIndices: Schema.Array(Schema.Number),
  dominatedIndices: Schema.Array(Schema.Number),
  parentWeights: Schema.Array(
    Schema.Struct({
      candidateIndex: Schema.Number,
      weight: Schema.Number
    })
  )
})
const encodeParetoSnapshotJson = Schema.encode(Schema.parseJson(ParetoSnapshotSchema))

class MissingParetoUpdatedEvent extends Data.TaggedError("MissingParetoUpdatedEvent")<Record<never, never>> {}

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

const toUtf8Bytes = (value: string): ReadonlyArray<number> => Arr.fromIterable(Buffer.from(value, "utf8"))

const runSeededReplay = (moduleName: string, seed: number, maxIterations: number) =>
  Effect.gen(function*() {
    const signature = yield* makeQaSignature()
    const module = yield* Module.predict(moduleName, signature)
    const mock = yield* MockLanguageModel.make(
      MockLanguageModel.map((prompt) =>
        prompt.includes("France")
          ? { answer: "Paris" }
          : prompt.includes("Japan")
          ? { answer: "Tokyo" }
          : { answer: "Lyon" }
      )
    )
    const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)
    const events = yield* Stream.runCollect(
      Optimizer.gepaStream({
        module,
        trainset: Arr.make(
          new Example({ input: { question: "What is the capital of France?" }, output: { answer: "Paris" } }),
          new Example({ input: { question: "What is the capital of Japan?" }, output: { answer: "Tokyo" } }),
          new Example({ input: { question: "What is the capital of Germany?" }, output: { answer: "Berlin" } })
        ),
        metric: Metric.exactMatch("answer"),
        maxIterations,
        seed
      })
    ).pipe(Effect.provide(layer))
    const eventList = Arr.fromIterable(events)
    const finalPareto = Arr.last(Arr.filter(eventList, Optimizer.GEPAEvent.$is("ParetoUpdated")))
    const savedState = yield* Module.save(module)
    const savedStateJson = yield* encodeSavedStateJson(savedState)

    return yield* Option.match(finalPareto, {
      onNone: () => Effect.fail(new MissingParetoUpdatedEvent()),
      onSome: (event) =>
        encodeParetoSnapshotJson({
          frontierIndices: event.frontierIndices,
          dominatedIndices: event.dominatedIndices,
          parentWeights: event.parentWeights
        }).pipe(
          Effect.map((paretoJson) => ({
            savedStateBytes: toUtf8Bytes(savedStateJson),
            paretoSnapshotBytes: toUtf8Bytes(paretoJson)
          }))
        )
    })
  })

describe("GEPA deterministic replay", () => {
  it.effect(
    "replays seeded runs with byte-stable outputs",
    () =>
      Effect.gen(function*() {
        const rawReplayContract = yield* loadFixture("dspy.gepa.replay.seed-0.contract")
        const replayContract = yield* Schema.decodeUnknown(GepaReplaySeedContractFixtureSchema)(
          rawReplayContract
        )

        const firstRun = yield* runSeededReplay(
          replayContract.payload.moduleName,
          replayContract.payload.seed,
          replayContract.payload.maxIterations
        )
        const secondRun = yield* runSeededReplay(
          replayContract.payload.moduleName,
          replayContract.payload.seed,
          replayContract.payload.maxIterations
        )

        expect(secondRun.savedStateBytes).toEqual(firstRun.savedStateBytes)
        expect(secondRun.paretoSnapshotBytes).toEqual(firstRun.paretoSnapshotBytes)
      })
  )
})
