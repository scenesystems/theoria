/**
 * GEPA deterministic replay and fixture-manifest parity contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Layer, Option, Schema, Stream } from "effect"
import { Example } from "effect-dsp/Example"
import * as Metric from "effect-dsp/Metric"
import * as Module from "effect-dsp/Module"
import * as Optimizer from "effect-dsp/Optimizer"
import { MockLanguageModel } from "effect-dsp/test"

import {
  FixtureRegistry,
  GepaCatalogVersionedFixturesFixtureSchema,
  GepaReplayFrontierSnapshotsFixtureSchema,
  GepaReplayParamsFixtureSchema,
  GepaReplaySeedContractFixtureSchema
} from "../helpers/dspy-fixtures/index.js"
import { conciseFactsQaSignature } from "../helpers/qa-signatures.js"

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

const toUtf8Bytes = (value: string): ReadonlyArray<number> => Arr.fromIterable(Buffer.from(value, "utf8"))

const runSeededReplay = (moduleName: string, seed: number, maxIterations: number) =>
  Effect.gen(function*() {
    const signature = yield* conciseFactsQaSignature
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
      onNone: () => Effect.fail("GEPA replay failed: missing ParetoUpdated event"),
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
    "replays seeded runs with byte-stable outputs and fixture-manifest parity",
    () =>
      Effect.gen(function*() {
        const fixtureRegistry = FixtureRegistry.make()
        const rawCatalog = yield* fixtureRegistry.load("dspy.gepa.catalog.versioned-fixtures")
        const rawReplayContract = yield* fixtureRegistry.load("dspy.gepa.replay.seed-0.contract")
        const rawReplayFrontierSnapshots = yield* fixtureRegistry.load("dspy.gepa.replay.frontier-snapshots.seed-0")
        const rawReplayParams = yield* fixtureRegistry.load("dspy.gepa.replay.params.seed-0")
        const catalog = yield* Schema.decodeUnknown(GepaCatalogVersionedFixturesFixtureSchema)(rawCatalog)
        const replayFrontierSnapshots = yield* Schema.decodeUnknown(GepaReplayFrontierSnapshotsFixtureSchema)(
          rawReplayFrontierSnapshots
        )
        const replayParams = yield* Schema.decodeUnknown(GepaReplayParamsFixtureSchema)(rawReplayParams)
        const replayContract = yield* Schema.decodeUnknown(GepaReplaySeedContractFixtureSchema)(
          rawReplayContract
        )
        const catalogFixtureNames = Arr.map(catalog.payload.fixtures, (entry) => entry.name)

        expect(catalog.payload.fixtureSet).toBe("dspy.gepa")
        expect(catalog.payload.version).toBe(2)
        expect(catalog.payload.requiredFixtureCount).toBe(catalog.payload.fixtures.length)
        expect(replayContract.payload.requiredManifestFixtures).toEqual(catalogFixtureNames)
        expect(replayFrontierSnapshots.payload.seed).toBe(replayContract.payload.seed)
        expect(replayParams.payload.seed).toBe(replayContract.payload.seed)
        expect(replayParams.payload.moduleName).toBe(replayContract.payload.moduleName)

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
        expect(replayFrontierSnapshots.payload.snapshots.length).toBeGreaterThan(0)
        expect(replayParams.payload.stableJsonKeys).toEqual(["version", "modules", "metadata"])
      })
  )
})
