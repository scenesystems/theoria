import { FileSystem, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Console, Effect, Schema } from "effect"

import {
  BrowserParityArtifactJsonSchema,
  browserParityArtifactRelativePath,
  type BrowserParityArtifactType,
  BrowserSupportManifest,
  renderBrowserParityArtifact
} from "effect-text/browser"

const normalizeArtifactText = (text: string): string => text.trimEnd()

const artifactFileUrl = (profileId: BrowserParityArtifactType["profileId"]): URL =>
  new URL(`./artifacts/${profileId}.json`, import.meta.url)

const encodedArtifact = (artifact: BrowserParityArtifactType): Effect.Effect<string> =>
  Schema.encode(BrowserParityArtifactJsonSchema)(artifact).pipe(Effect.orDie, Effect.map((json) => `${json}\n`))

const writeArtifact = (
  artifact: BrowserParityArtifactType
): Effect.Effect<void, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const pathService = yield* Path.Path
    const artifactPath = yield* pathService.fromFileUrl(artifactFileUrl(artifact.profileId)).pipe(Effect.orDie)

    yield* fileSystem.makeDirectory(pathService.dirname(artifactPath), { recursive: true }).pipe(Effect.orDie)
    yield* fileSystem.writeFileString(artifactPath, yield* encodedArtifact(artifact)).pipe(Effect.orDie)
    yield* Console.log(`wrote ${browserParityArtifactRelativePath(artifact.profileId)}`)
  })

const verifyArtifact = (
  artifact: BrowserParityArtifactType
): Effect.Effect<void, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const pathService = yield* Path.Path
    const artifactPath = yield* pathService.fromFileUrl(artifactFileUrl(artifact.profileId)).pipe(Effect.orDie)
    const expected = normalizeArtifactText(yield* encodedArtifact(artifact))
    const actual = normalizeArtifactText(yield* fileSystem.readFileString(artifactPath).pipe(Effect.orDie))

    yield* actual === expected
      ? Console.log(`verified ${browserParityArtifactRelativePath(artifact.profileId)}`)
      : Effect.dieMessage(`Browser accuracy artifact drift detected for ${artifact.profileId}`)
  })

export const verifyBrowserAccuracyArtifacts = (): Effect.Effect<void, never, FileSystem.FileSystem | Path.Path> =>
  Effect.forEach(
    BrowserSupportManifest.profiles,
    (profile) => renderBrowserParityArtifact(profile).pipe(Effect.flatMap(verifyArtifact)),
    { discard: true }
  )

export const refreshBrowserAccuracyArtifacts = (): Effect.Effect<void, never, FileSystem.FileSystem | Path.Path> =>
  Effect.forEach(
    BrowserSupportManifest.profiles,
    (profile) => renderBrowserParityArtifact(profile).pipe(Effect.flatMap(writeArtifact)),
    { discard: true }
  )

const program = process.argv.includes("--write") ? refreshBrowserAccuracyArtifacts() : verifyBrowserAccuracyArtifacts()

if (import.meta.main) {
  BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
}
