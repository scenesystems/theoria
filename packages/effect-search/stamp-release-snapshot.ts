import { FileSystem, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Console, Effect } from "effect"

import {
  renderReleaseSinceSnapshotJson,
  resolveRootFrom,
  stampCurrentPackageReleaseSinceSnapshot
} from "../source-proof/src/index.js"

const packageRootUrl = new URL("./", import.meta.url)

const main = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const root = yield* resolveRootFrom(packageRootUrl)
  const snapshotsDirectory = path.join(root, "test/package/release-snapshots")
  const snapshot = yield* stampCurrentPackageReleaseSinceSnapshot({ packageRoot: root })
  const encoded = yield* renderReleaseSinceSnapshotJson(snapshot)
  const outputPath = path.join(snapshotsDirectory, `${snapshot.releasedVersion}.json`)

  yield* fileSystem.makeDirectory(snapshotsDirectory, { recursive: true }).pipe(Effect.orDie)
  yield* fileSystem.writeFileString(outputPath, encoded).pipe(Effect.orDie)
}).pipe(
  Effect.catchAll((error) =>
    Console.error(`${error.tsconfigPath}: ${error.message}`).pipe(
      Effect.andThen(Effect.sync(() => process.exit(1)))
    )),
  Effect.provide(BunContext.layer)
)

BunRuntime.runMain(main)
