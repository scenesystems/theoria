import { FileSystem, Path, Url } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import * as Browser from "../../src/Browser/index.js"

import {
  BrowserParityArtifactJsonSchema,
  browserParityArtifactRelativePath,
  browserParityCasesForProfile,
  browserParityLayer
} from "../../src/Browser/index.js"
import { Text } from "../../src/index.js"

const readSyntheticRegressionArtifact = (profileId: Browser.BrowserSupportProfileIdType) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const packageRoot = yield* path.fromFileUrl(yield* Url.fromString("../../", import.meta.url))
    const content = yield* fileSystem.readFileString(
      path.join(packageRoot, browserParityArtifactRelativePath(profileId))
    )
    return yield* Schema.decode(BrowserParityArtifactJsonSchema)(content)
  }).pipe(Effect.provide(BunContext.layer))

describe("Text synthetic browser regression contracts", () => {
  it.effect("matches the checked-in synthetic artifacts for every shipped browser profile", () =>
    Effect.forEach(
      Browser.BrowserSupportManifest.profiles,
      (profile) =>
        Effect.gen(function*() {
          const artifact = yield* readSyntheticRegressionArtifact(profile.id)
          const layer = browserParityLayer(profile)
          const actualCases = yield* Effect.forEach(browserParityCasesForProfile(profile), (entry) =>
            Text.prepareWithSegments(entry.prepare).pipe(
              Effect.provide(layer),
              Effect.map((prepared) => ({
                caseId: entry.caseId,
                prepare: entry.prepare,
                request: entry.request,
                summary: Text.layout(prepared, entry.request),
                lines: Text.layoutLines(prepared, entry.request)
              }))
            ))

          expect(actualCases).toEqual(artifact.cases)
        }),
      { discard: true }
    ))
})
