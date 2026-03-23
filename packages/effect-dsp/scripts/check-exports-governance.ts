import { FileSystem, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Console, Effect, Option, Order, Record, Schema } from "effect"

const ExportTargetSchema = Schema.Union(Schema.String, Schema.Null)
const ExportMapSchema = Schema.Record({ key: Schema.String, value: ExportTargetSchema })
const PackageManifestSchema = Schema.Struct({
  exports: Schema.optional(ExportMapSchema)
})

type ExportMap = Schema.Schema.Type<typeof ExportMapSchema>
type PackageManifest = Schema.Schema.Type<typeof PackageManifestSchema>

const EXPECTED_EXPORTS: ExportMap = {
  ".": "./src/index.ts",
  "./Signature": "./src/Signature/index.ts",
  "./Module": "./src/Module/index.ts",
  "./Optimizer": "./src/Optimizer/index.ts",
  "./Metric": "./src/Metric/index.ts",
  "./Evaluate": "./src/Evaluate/index.ts",
  "./Example": "./src/Example/index.ts",
  "./Trace": "./src/Trace/index.ts",
  "./Errors": "./src/Errors/index.ts",
  "./Cache": "./src/Cache/index.ts",
  "./contracts": "./src/contracts/index.ts",
  "./test": "./src/testing/index.ts",
  "./experimental": "./src/experimental/index.ts",
  "./internal/*": null,
  "./optimizers/*": null
}

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

const validateExportsGovernance = (manifest: PackageManifest): Array<string> => {
  const exportsMap = Option.getOrElse(Option.fromNullable(manifest.exports), () => ({}))
  const exportKeys = Record.keys(exportsMap)
  const wildcardErrors = Arr.contains(exportKeys, "./*")
    ? ["Wildcard subpath export './*' is forbidden. Use explicit stable exports."]
    : Arr.empty<string>()

  const expectedKeys = Arr.sort(Record.keys(EXPECTED_EXPORTS), Order.string)
  const actualKeys = Arr.sort(exportKeys, Order.string)

  const missingKeys = Arr.filter(expectedKeys, (key) => !Arr.contains(actualKeys, key))
  const unexpectedKeys = Arr.filter(actualKeys, (key) => !Arr.contains(expectedKeys, key))

  const missingErrors = Arr.isNonEmptyArray(missingKeys)
    ? [`Missing export keys: ${missingKeys.join(", ")}`]
    : Arr.empty<string>()

  const unexpectedErrors = Arr.isNonEmptyArray(unexpectedKeys)
    ? [`Unexpected export keys: ${unexpectedKeys.join(", ")}`]
    : Arr.empty<string>()

  const targetMismatchErrors = Arr.filterMap(expectedKeys, (key) =>
    exportsMap[key] === EXPECTED_EXPORTS[key]
      ? Option.none<string>()
      : Option.some(
        `Export target mismatch for '${key}': expected '${EXPECTED_EXPORTS[key]}', found '${String(exportsMap[key])}'`
      ))

  return [
    ...wildcardErrors,
    ...missingErrors,
    ...unexpectedErrors,
    ...targetMismatchErrors
  ]
}

const program = Effect.gen(function*() {
  const manifest = yield* readPackageManifest
  const errors = validateExportsGovernance(manifest)

  if (Arr.isNonEmptyArray(errors)) {
    return yield* Effect.fail(errors)
  }

  yield* Console.log("[exports-governance] Export contract checks passed")
})

const main = program.pipe(
  Effect.catchAll((errors) =>
    Console.error("[exports-governance] Export contract violations detected:").pipe(
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
