import { FileSystem, Path, Url } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit, Schema } from "effect"
import * as Arr from "effect/Array"
import * as Browser from "../../src/Browser/index.js"

import {
  BrowserParityArtifactJsonSchema,
  browserParityArtifactRelativePath,
  browserParityCaseIds,
  BrowserParityCasesMissing,
  renderBrowserParityArtifact
} from "../../src/Browser/index.js"

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
  it.effect("renders the checked-in synthetic artifact for every shipped browser profile", () =>
    Effect.forEach(
      Browser.BrowserSupportManifest.profiles,
      (profile) =>
        Effect.gen(function*() {
          const artifact = yield* readSyntheticRegressionArtifact(profile.id)
          expect(yield* renderBrowserParityArtifact(profile)).toEqual(artifact)
        }),
      { discard: true }
    ))

  it.effect("a profile that declares only some released scenarios fails before preparation", () =>
    Effect.forEach(
      Browser.BrowserSupportManifest.profiles,
      (profile) =>
        Effect.gen(function*() {
          const declared = Arr.take(profile.parityCases, 1)
          const exit = yield* Effect.exit(renderBrowserParityArtifact({ ...profile, parityCases: declared }))

          expect(exit).toStrictEqual(
            Exit.fail(
              new BrowserParityCasesMissing({
                profileId: profile.id,
                missing: Arr.filter(browserParityCaseIds, (caseId) => !Arr.contains(declared, caseId))
              })
            )
          )
        }),
      { discard: true }
    ))
})
