/**
 * Contract for deterministic Amp implementation-strategy corpus import.
 */
import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import * as Experimental from "effect-dsp/experimental"

const datasetSnapshotUrl = new URL(
  "../../fixtures/open-agent-trace/amp/implementationStrategy/dataset.json",
  import.meta.url
)
const ImplementationStrategy = Experimental.OpenAgentTrace.ImplementationStrategy

const loadDatasetSnapshot = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const snapshotPath = yield* path.fromFileUrl(datasetSnapshotUrl).pipe(Effect.orDie)
  const raw = yield* fileSystem.readFileString(snapshotPath).pipe(Effect.orDie)

  return yield* Schema.decodeUnknown(Schema.parseJson(Schema.Unknown))(raw)
})

describe("OpenAgentTrace/ampImport", () => {
  it.effect("compiles checked-in Amp captures plus label sidecars into a deterministic coding prompt dataset", () =>
    Effect.gen(function*() {
      const dataset = yield* ImplementationStrategy.loadDataset()
      const encodedDataset = yield* Schema.encode(Experimental.OpenAgentTrace.CodingPromptDataset)(dataset)
      const snapshot = yield* loadDatasetSnapshot

      expect(encodedDataset).toEqual(snapshot)
      expect(dataset.surfaceId).toBe(ImplementationStrategy.surfaceId)
      expect(dataset.cases).toHaveLength(8)
      expect(dataset.splitSummary).toEqual({ train: 3, validation: 3, holdout: 2 })
      expect(dataset.cases.map((promptCase) => promptCase.task.sessionId)).toEqual([
        "T-019d8314-fca6-75bd-b996-2adcb0f10fa2",
        "T-019d8314-fca6-75bd-b996-2adcb0f10fa2",
        "T-019d8314-fca6-75bd-b996-2adcb0f10fa2",
        "T-019d835c-a550-74a6-ac6a-e9ad5c506595",
        "T-019d835c-a550-74a6-ac6a-e9ad5c506595",
        "T-019d835c-a550-74a6-ac6a-e9ad5c506595",
        "T-019d835c-ae70-72d8-9c4e-aa9b0f5000bf",
        "T-019d835c-ae70-72d8-9c4e-aa9b0f5000bf"
      ])
    }).pipe(Effect.provide(BunContext.layer)))
})
