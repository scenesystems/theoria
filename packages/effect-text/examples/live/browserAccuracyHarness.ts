import { FileSystem, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Console, Effect, Schema } from "effect"
import * as Arr from "effect/Array"

import { Browser, Text } from "../../src/index.js"

import {
  browserAccuracyArtifactRelativePath,
  browserAccuracyCaseIds,
  browserAccuracyCasesForProfile,
  browserAccuracyLayer,
  type BrowserAccuracyResolvedCase
} from "./browserAccuracyFixtures.js"
import {
  type BrowserAccuracyArtifactCaseType,
  BrowserAccuracyArtifactJsonSchema,
  type BrowserAccuracyArtifactType
} from "./browserAccuracySchema.js"

const normalizeArtifactText = (text: string): string => text.trimEnd()

const ensureProfileCaseSet = (profile: Browser.BrowserSupportProfileType): Effect.Effect<void> =>
  Arr.every(browserAccuracyCaseIds, (caseId) => profile.parityCases.includes(caseId)) &&
    profile.parityCases.length === browserAccuracyCaseIds.length
    ? Effect.void
    : Effect.dieMessage(`Browser parity case mismatch for profile: ${profile.id}`)

const renderArtifactCase = (
  profile: Browser.BrowserSupportProfileType,
  entry: BrowserAccuracyResolvedCase
): Effect.Effect<BrowserAccuracyArtifactCaseType> =>
  Text.prepareWithSegments(entry.prepare).pipe(
    Effect.provide(browserAccuracyLayer(profile)),
    Effect.map((prepared) => ({
      caseId: entry.caseId,
      prepare: entry.prepare,
      request: entry.request,
      summary: Text.layout(prepared, entry.request),
      lines: Text.layoutLines(prepared, entry.request)
    })),
    Effect.orDie
  )

export const renderBrowserAccuracyArtifact = (
  profile: Browser.BrowserSupportProfileType
): Effect.Effect<BrowserAccuracyArtifactType> =>
  Effect.gen(function*() {
    yield* ensureProfileCaseSet(profile)

    return {
      profileId: profile.id,
      fontFamily: profile.defaultFontFamily,
      fontSelection: profile.fontSelection,
      fontStack: profile.fontStack,
      parityCases: profile.parityCases,
      cases: yield* Effect.forEach(
        browserAccuracyCasesForProfile(profile),
        (entry) => renderArtifactCase(profile, entry)
      )
    }
  })

const artifactFileUrl = (profileId: Browser.BrowserSupportProfileIdType): URL =>
  new URL(`./artifacts/${profileId}.json`, import.meta.url)

const encodedArtifact = (artifact: BrowserAccuracyArtifactType): Effect.Effect<string> =>
  Schema.encode(BrowserAccuracyArtifactJsonSchema)(artifact).pipe(Effect.orDie, Effect.map((json) => `${json}\n`))

const writeArtifact = (
  artifact: BrowserAccuracyArtifactType
): Effect.Effect<void, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const pathService = yield* Path.Path
    const artifactPath = yield* pathService.fromFileUrl(artifactFileUrl(artifact.profileId)).pipe(Effect.orDie)

    yield* fileSystem.makeDirectory(pathService.dirname(artifactPath), { recursive: true }).pipe(Effect.orDie)
    yield* fileSystem.writeFileString(artifactPath, yield* encodedArtifact(artifact)).pipe(Effect.orDie)
    yield* Console.log(`wrote ${browserAccuracyArtifactRelativePath(artifact.profileId)}`)
  })

const verifyArtifact = (
  artifact: BrowserAccuracyArtifactType
): Effect.Effect<void, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const pathService = yield* Path.Path
    const artifactPath = yield* pathService.fromFileUrl(artifactFileUrl(artifact.profileId)).pipe(Effect.orDie)
    const expected = normalizeArtifactText(yield* encodedArtifact(artifact))
    const actual = normalizeArtifactText(yield* fileSystem.readFileString(artifactPath).pipe(Effect.orDie))

    yield* actual === expected
      ? Console.log(`verified ${browserAccuracyArtifactRelativePath(artifact.profileId)}`)
      : Effect.dieMessage(`Browser accuracy artifact drift detected for ${artifact.profileId}`)
  })

export const verifyBrowserAccuracyArtifacts = (): Effect.Effect<void, never, FileSystem.FileSystem | Path.Path> =>
  Effect.forEach(
    Browser.BrowserSupportManifest.profiles,
    (profile) => renderBrowserAccuracyArtifact(profile).pipe(Effect.flatMap(verifyArtifact)),
    { discard: true }
  )

export const refreshBrowserAccuracyArtifacts = (): Effect.Effect<void, never, FileSystem.FileSystem | Path.Path> =>
  Effect.forEach(
    Browser.BrowserSupportManifest.profiles,
    (profile) => renderBrowserAccuracyArtifact(profile).pipe(Effect.flatMap(writeArtifact)),
    { discard: true }
  )

const program = process.argv.includes("--write") ? refreshBrowserAccuracyArtifacts() : verifyBrowserAccuracyArtifacts()

if (import.meta.main) {
  BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
}
