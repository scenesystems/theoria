import { Command, FileSystem, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Console, Effect, Record, Schema } from "effect"

const PACKAGE_NAME = "@scenesystems/digest"
const NOBLE_VERSION = "2.0.1"
const REPOSITORY_URL = "https://github.com/scenesystems/theoria.git"
const REPOSITORY_DIRECTORY = "packages/digest"
const HOMEPAGE = "https://github.com/scenesystems/theoria/tree/main/packages/digest"
const CHANGESET_PUBLISH =
  "bun run build && bun run publish:check --require-packed-manifest && bun run test && changeset publish"

const Repository = Schema.Struct({
  type: Schema.Literal("git"),
  url: Schema.Literal(REPOSITORY_URL),
  directory: Schema.Literal(REPOSITORY_DIRECTORY)
})

const Bugs = Schema.Struct({
  url: Schema.Literal("https://github.com/scenesystems/theoria/issues")
})

const SourceManifest = Schema.parseJson(
  Schema.Struct({
    name: Schema.Literal(PACKAGE_NAME),
    version: Schema.NonEmptyString,
    license: Schema.Literal("MIT"),
    homepage: Schema.Literal(HOMEPAGE),
    repository: Repository,
    bugs: Bugs,
    publishConfig: Schema.Struct({
      access: Schema.Literal("public"),
      provenance: Schema.Literal(false),
      directory: Schema.Literal("dist")
    }),
    exports: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    scripts: Schema.Record({ key: Schema.String, value: Schema.String }),
    dependencies: Schema.Record({ key: Schema.String, value: Schema.String })
  })
)

const PackedExport = Schema.Struct({
  types: Schema.Literal("./dist/dts/index.d.ts"),
  import: Schema.Literal("./dist/esm/index.js"),
  default: Schema.Literal("./dist/cjs/index.js")
})

const PackedManifest = Schema.parseJson(
  Schema.Struct({
    name: Schema.Literal(PACKAGE_NAME),
    version: Schema.NonEmptyString,
    license: Schema.Literal("MIT"),
    homepage: Schema.Literal(HOMEPAGE),
    repository: Repository,
    exports: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    dependencies: Schema.Record({ key: Schema.String, value: Schema.String }),
    peerDependencies: Schema.Record({ key: Schema.String, value: Schema.String })
  })
)

const CheckStage = Schema.Literal(
  "source-manifest",
  "source-exports",
  "source-scripts",
  "source-dependencies",
  "packed-manifest",
  "packed-exports",
  "packed-dependencies",
  "shared-release-check"
)

class DigestPublishReadinessError extends Schema.TaggedError<DigestPublishReadinessError>()(
  "DigestPublishReadinessError",
  { stage: CheckStage }
) {}

const fail = (stage: Schema.Schema.Type<typeof CheckStage>) =>
  Effect.fail(new DigestPublishReadinessError({ stage }))

const exactKeys = (record: Readonly<Record<string, unknown>>, expected: ReadonlyArray<string>): boolean => {
  const keys = Record.keys(record)
  return keys.length === expected.length && Arr.every(expected, (key) => Arr.contains(keys, key))
}

const decodeFile = <A, I>(filePath: string, schema: Schema.Schema<A, I>, stage: Schema.Schema.Type<typeof CheckStage>) =>
  FileSystem.FileSystem.pipe(
    Effect.flatMap((fileSystem) => fileSystem.readFileString(filePath)),
    Effect.flatMap(Schema.decodeUnknown(schema)),
    Effect.mapError(() => new DigestPublishReadinessError({ stage }))
  )

const assertSourceManifest = (manifest: Schema.Schema.Type<typeof SourceManifest>) =>
  Effect.gen(function*() {
    if (!exactKeys(manifest.exports, ["."]) || manifest.exports["."] !== "./src/index.ts") {
      return yield* fail("source-exports")
    }
    if (
      manifest.scripts["publish:check"] !== "bun run scripts/verify-publish-readiness.ts" ||
      manifest.scripts["changeset-publish"] !== CHANGESET_PUBLISH
    ) {
      return yield* fail("source-scripts")
    }
    if (!exactKeys(manifest.dependencies, ["@noble/hashes"]) || manifest.dependencies["@noble/hashes"] !== NOBLE_VERSION) {
      return yield* fail("source-dependencies")
    }
  })

const assertPackedManifest = (manifest: Schema.Schema.Type<typeof PackedManifest>) =>
  Effect.gen(function*() {
    if (!exactKeys(manifest.exports, ["."])) {
      return yield* fail("packed-exports")
    }
    yield* Schema.decodeUnknown(PackedExport)(manifest.exports["."]).pipe(
      Effect.mapError(() => new DigestPublishReadinessError({ stage: "packed-exports" }))
    )
    if (
      !exactKeys(manifest.dependencies, ["@noble/hashes"]) ||
      manifest.dependencies["@noble/hashes"] !== NOBLE_VERSION ||
      !exactKeys(manifest.peerDependencies, ["effect"]) ||
      manifest.peerDependencies.effect !== "^3.22.1"
    ) {
      return yield* fail("packed-dependencies")
    }
  })

const runSharedReleaseCheck = (root: string) =>
  Command.make("bun", "run", "crypto:release:check", "--package", PACKAGE_NAME).pipe(
    Command.workingDirectory(root),
    Command.stdout("inherit"),
    Command.stderr("inherit"),
    Command.exitCode,
    Effect.mapError(() => new DigestPublishReadinessError({ stage: "shared-release-check" })),
    Effect.flatMap((exitCode) => Number(exitCode) === 0 ? Effect.void : fail("shared-release-check"))
  )

const program = Effect.gen(function*() {
  const path = yield* Path.Path
  const packageRoot = yield* path.fromFileUrl(new URL("../", import.meta.url)).pipe(
    Effect.mapError(() => new DigestPublishReadinessError({ stage: "source-manifest" }))
  )
  const repositoryRoot = yield* path.fromFileUrl(new URL("../../../", import.meta.url)).pipe(
    Effect.mapError(() => new DigestPublishReadinessError({ stage: "shared-release-check" }))
  )
  const sourceManifest = yield* decodeFile(path.join(packageRoot, "package.json"), SourceManifest, "source-manifest")
  yield* assertSourceManifest(sourceManifest)

  if (Arr.contains(process.argv, "--require-packed-manifest")) {
    const packedManifest = yield* decodeFile(path.join(packageRoot, "dist/package.json"), PackedManifest, "packed-manifest")
    yield* assertPackedManifest(packedManifest)
    yield* runSharedReleaseCheck(repositoryRoot)
  }

  yield* Console.log("[publish:check] digest publish-readiness contracts passed")
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
