import { FileSystem, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Console, Effect, Option, Record, Schema } from "effect"

const DependencyMapSchema = Schema.Record({ key: Schema.String, value: Schema.String })

const PackageManifestSchema = Schema.Struct({
  peerDependencies: Schema.optional(DependencyMapSchema),
  dependencies: Schema.optional(DependencyMapSchema)
})

type DependencyMap = Schema.Schema.Type<typeof DependencyMapSchema>
type PackageManifest = Schema.Schema.Type<typeof PackageManifestSchema>

const REQUIRED_PEER_DEPENDENCIES = ["effect", "@effect/ai"]
const REQUIRED_RUNTIME_DEPENDENCIES = ["@scenesystems/digest", "effect-math", "effect-search"]

const PACKAGE_JSON_FILE = "package.json"

const decodeManifestJson = Schema.decodeUnknown(Schema.parseJson(PackageManifestSchema))

const readPackageManifest = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const cwd = yield* Effect.sync(() => process.cwd())
  const packageJsonPath = path.join(cwd, PACKAGE_JSON_FILE)
  const source = yield* fs.readFileString(packageJsonPath)

  return yield* decodeManifestJson(source)
})

const getDependencies = (manifest: PackageManifest, section: "peerDependencies" | "dependencies"): DependencyMap =>
  Option.getOrElse(Option.fromNullable(manifest[section]), () => ({}))

const findMissing = (dependencies: DependencyMap, required: ReadonlyArray<string>): Array<string> =>
  Arr.filter(required, (name) => Option.isNone(Option.fromNullable(dependencies[name])))

const findUnexpected = (dependencies: DependencyMap, allowed: ReadonlyArray<string>): Array<string> =>
  Arr.filter(Record.keys(dependencies), (name) => !Arr.contains(allowed, name))

const reportMissing = (section: string, missing: ReadonlyArray<string>): Array<string> =>
  Arr.isNonEmptyArray(missing)
    ? [`${section} is missing: ${missing.join(", ")}`]
    : Arr.empty()

const validateDependencyGovernance = (manifest: PackageManifest): Array<string> => {
  const peerDependencies = getDependencies(manifest, "peerDependencies")
  const runtimeDependencies = getDependencies(manifest, "dependencies")

  const unexpectedRuntimeDependencies = findUnexpected(runtimeDependencies, REQUIRED_RUNTIME_DEPENDENCIES)
  const unexpectedRuntimeErrors = Arr.isNonEmptyArray(unexpectedRuntimeDependencies)
    ? [`dependencies contains unexpected runtime packages: ${unexpectedRuntimeDependencies.join(", ")}`]
    : Arr.empty<string>()

  const effectPeerError = Option.match(Option.fromNullable(peerDependencies.effect), {
    onNone: () => Arr.empty<string>(),
    onSome: (effectPeerRange) =>
      effectPeerRange.startsWith("^3.")
        ? Arr.empty<string>()
        : [`peerDependencies.effect must target major 3 via '^3.x', found '${effectPeerRange}'`]
  })

  const effectAiPeerError = Option.match(Option.fromNullable(peerDependencies["@effect/ai"]), {
    onNone: () => Arr.empty<string>(),
    onSome: (effectAiPeerRange) =>
      effectAiPeerRange.startsWith(">=")
        ? Arr.empty<string>()
        : [`peerDependencies.@effect/ai must be an open lower-bound range (>=), found '${effectAiPeerRange}'`]
  })

  return [
    ...reportMissing("peerDependencies", findMissing(peerDependencies, REQUIRED_PEER_DEPENDENCIES)),
    ...reportMissing("dependencies", findMissing(runtimeDependencies, REQUIRED_RUNTIME_DEPENDENCIES)),
    ...unexpectedRuntimeErrors,
    ...effectPeerError,
    ...effectAiPeerError
  ]
}

const program = Effect.gen(function*() {
  const manifest = yield* readPackageManifest
  const errors = validateDependencyGovernance(manifest)

  if (Arr.isNonEmptyArray(errors)) {
    return yield* Effect.fail(errors)
  }

  yield* Console.log("[dependency-governance] Dependency matrix checks passed")
})

const main = program.pipe(
  Effect.catchAll((errors) =>
    Console.error("[dependency-governance] Dependency matrix violations detected:").pipe(
      Effect.andThen(
        Effect.forEach(errors, (error) => Console.error(`- ${error}`), {
          discard: true
        })
      ),
      Effect.andThen(Effect.sync(() => process.exit(1)))
    )
  ),
  Effect.provide(BunContext.layer)
)

BunRuntime.runMain(main)
