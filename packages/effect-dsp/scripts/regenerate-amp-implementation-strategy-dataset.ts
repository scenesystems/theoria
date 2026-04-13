/**
 * Rebuild the checked-in Amp implementation-strategy dataset artifact.
 *
 * Run: bun run packages/effect-dsp/scripts/regenerate-amp-implementation-strategy-dataset.ts
 */
import { FileSystem, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Effect, Schema } from "effect"

import * as Experimental from "../src/experimental/index.ts"

const datasetFixtureUrl = new URL("../fixtures/open-agent-trace/amp/implementationStrategy/dataset.json", import.meta.url)
const objectString = (value: unknown): string => Schema.encodeSync(Schema.parseJson(Schema.Unknown))(value)

const program = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const datasetPath = yield* path.fromFileUrl(datasetFixtureUrl)
  const dataset = yield* Experimental.OpenAgentTrace.ImplementationStrategy.loadDataset()
  const encodedDataset = yield* Schema.encode(Experimental.OpenAgentTrace.CodingPromptDataset)(dataset)

  yield* fileSystem.writeFileString(datasetPath, `${objectString(encodedDataset)}\n`)
  yield* Effect.log("regenerate-amp-implementation-strategy-dataset", {
    datasetPath,
    caseCount: dataset.cases.length,
    splitSummary: dataset.splitSummary
  })
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
