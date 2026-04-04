import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import * as Browser from "../../src/Browser/index.js"

import { readProjectFile } from "@theoria/source-proof"
import {
  BrowserParityArtifactJsonSchema,
  browserParityArtifactRelativePath,
  browserParityCaseIds,
  browserParityCasesForProfile,
  browserParityLayer
} from "../../src/Browser/index.js"
import { Text } from "../../src/index.js"

const packageRootUrl = new URL("../../", import.meta.url)

const readBrowserAccuracyArtifact = (profileId: Browser.BrowserSupportProfileIdType) =>
  readProjectFile(packageRootUrl, browserParityArtifactRelativePath(profileId)).pipe(
    Effect.flatMap((content) => Schema.decode(BrowserParityArtifactJsonSchema)(content).pipe(Effect.orDie)),
    Effect.provide(BunContext.layer)
  )

describe("Text browser parity contracts", () => {
  it.effect("matches the checked-in browser accuracy artifacts for every shipped browser profile", () =>
    Effect.forEach(
      Browser.BrowserSupportManifest.profiles,
      (profile) =>
        Effect.gen(function*() {
          const artifact = yield* readBrowserAccuracyArtifact(profile.id)
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

          expect(artifact.profileId).toBe(profile.id)
          expect(artifact.fontFamily).toBe(profile.defaultFontFamily)
          expect(artifact.fontSelection).toBe(profile.fontSelection)
          expect(artifact.fontStack).toEqual(profile.fontStack)
          expect(artifact.parityCases).toEqual(browserParityCaseIds)
          expect(artifact.parityCases).toEqual(profile.parityCases)
          expect(actualCases).toEqual(artifact.cases)
        }),
      { discard: true }
    ))
})
