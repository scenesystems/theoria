import { FileSystem, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Console, Data, Effect, Option } from "effect"

import {
  renderReleaseSinceSnapshotJson,
  stampCurrentPackageReleaseSinceSnapshot
} from "../packages/source-proof/src/index.js"

class ReleaseSnapshotCliError extends Data.TaggedError("ReleaseSnapshotCliError")<{
  readonly message: string
}> {}

const readFlagValue = (argv: ReadonlyArray<string>, flag: string): string | undefined =>
  Option.getOrUndefined(
    Arr.findFirst(argv, (argument) => argument.startsWith(`${flag}=`)).pipe(
      Option.map((argument) => argument.slice(flag.length + 1))
    )
  )

const main = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const cwd = yield* Effect.sync(() => process.cwd())
  const argv = Bun.argv.slice(2)
  const packageRoot = path.resolve(cwd, readFlagValue(argv, "--package-root") ?? ".")
  const snapshotsDirectoryFlag = readFlagValue(argv, "--snapshots-directory")
  const tsconfigPathFlag = readFlagValue(argv, "--tsconfig")
  const snapshotsDirectory = snapshotsDirectoryFlag === undefined
    ? path.join(packageRoot, "test/package/release-snapshots")
    : path.resolve(cwd, snapshotsDirectoryFlag)
  const tsconfigPath = tsconfigPathFlag === undefined
    ? undefined
    : path.resolve(cwd, tsconfigPathFlag)
  const snapshot = yield* stampCurrentPackageReleaseSinceSnapshot({
    packageRoot,
    snapshotsDirectory,
    tsconfigPath
  }).pipe(
    Effect.mapError((error) =>
      new ReleaseSnapshotCliError({
        message: `${error.tsconfigPath}: ${error.message}`
      })
    )
  )
  const encoded = yield* renderReleaseSinceSnapshotJson(snapshot)
  const outputPath = path.join(snapshotsDirectory, `${snapshot.releasedVersion}.json`)

  yield* fileSystem.makeDirectory(snapshotsDirectory, { recursive: true }).pipe(Effect.orDie)
  yield* fileSystem.writeFileString(outputPath, encoded).pipe(Effect.orDie)
  yield* Console.log(`[release-snapshots] wrote ${outputPath}`)
}).pipe(
  Effect.catchAll((error) =>
    Console.error(`[release-snapshots] ${error.message}`).pipe(
      Effect.andThen(Effect.sync(() => process.exit(1)))
    )),
  Effect.provide(BunContext.layer)
)

BunRuntime.runMain(main)
