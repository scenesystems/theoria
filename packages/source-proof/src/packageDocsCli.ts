import type { FileSystem, Path } from "@effect/platform"
import { Array as Arr, Console, Data, Effect, Match, Option, Schema } from "effect"

import { type PackageName, packageNameOption, PackageNameSchema } from "./identifiers.js"
import { loadPackageDocsCorpus, packageDocsBundle, packageDocsCatalog, searchPackageDocs } from "./packageDocs.js"
import {
  PackageDocsBundleSchema,
  PackageDocsCatalogEntrySchema,
  PackageDocsQuerySchema,
  PackageDocsSearchResultSchema
} from "./packageDocsSchema.js"

class PackageDocsCliError extends Data.TaggedError("PackageDocsCliError")<{
  readonly message: string
}> {}

const PackageDocsCatalogJson = Schema.parseJson(Schema.Array(PackageDocsCatalogEntrySchema))
const PackageDocsBundleJson = Schema.parseJson(PackageDocsBundleSchema)
const PackageDocsSearchResultsJson = Schema.parseJson(Schema.Array(PackageDocsSearchResultSchema))

const NullablePackageNameSchema = Schema.Union(PackageNameSchema, Schema.Null)
const NullableStringSchema = Schema.Union(Schema.String, Schema.Null)
const PackageDocsCliModeSchema = Schema.Literal("catalog", "bundle", "search")
const PackageDocsCliCommandSchema = Schema.Struct({
  mode: PackageDocsCliModeSchema,
  packageId: NullablePackageNameSchema,
  query: NullableStringSchema,
  limit: Schema.Number
})

type PackageDocsCliCommand = typeof PackageDocsCliCommandSchema.Type

const readFlagValue = (argv: ReadonlyArray<string>, flag: string): Option.Option<string> => {
  const inlineValue = Arr.findFirst(argv, (argument) => argument.startsWith(`${flag}=`)).pipe(
    Option.map((argument) => argument.slice(flag.length + 1))
  )

  return Option.isSome(inlineValue)
    ? inlineValue
    : Match.value(argv.indexOf(flag)).pipe(
      Match.when(-1, () => Option.none()),
      Match.orElse((flagIndex) => Option.fromNullable(argv[flagIndex + 1]))
    )
}

const hasFlag = (argv: ReadonlyArray<string>, flag: string): boolean =>
  argv.includes(flag) || argv.some((argument) => argument.startsWith(`${flag}=`))

const decodePackageId = (
  value: Option.Option<string>
): Effect.Effect<PackageName | null, PackageDocsCliError> =>
  Option.match(value, {
    onNone: () => Effect.succeed(null),
    onSome: (rawValue) =>
      Option.match(packageNameOption(rawValue), {
        onNone: () => Effect.fail(new PackageDocsCliError({ message: `invalid package id: ${rawValue}` })),
        onSome: (packageId) => Effect.succeed(packageId)
      })
  })

const decodeLimit = (value: Option.Option<string>): Effect.Effect<number, PackageDocsCliError> =>
  Option.match(value, {
    onNone: () => Effect.succeed(10),
    onSome: (rawValue) => {
      const parsed = Number(rawValue)

      return Number.isInteger(parsed) && parsed > 0
        ? Effect.succeed(parsed)
        : Effect.fail(new PackageDocsCliError({ message: `invalid --limit value: ${rawValue}` }))
    }
  })

const validateView = (value: Option.Option<string>): Effect.Effect<void, PackageDocsCliError> =>
  Option.match(value, {
    onNone: () => Effect.void,
    onSome: (rawValue) =>
      Match.value(rawValue).pipe(
        Match.when("agent", () => Effect.void),
        Match.when("operator", () => Effect.void),
        Match.orElse(() => Effect.fail(new PackageDocsCliError({ message: `unsupported --view value: ${rawValue}` })))
      )
  })

const packageDocsCliCommand = (input: PackageDocsCliCommand): PackageDocsCliCommand =>
  Schema.decodeUnknownSync(PackageDocsCliCommandSchema)(input)

const parseCliCommand = (
  argv: ReadonlyArray<string>
): Effect.Effect<PackageDocsCliCommand, PackageDocsCliError> =>
  Effect.gen(function*() {
    const catalogRequested = hasFlag(argv, "--catalog")
    const rawPackageId = readFlagValue(argv, "--package")
    const searchQuery = readFlagValue(argv, "--search")
    const packageId = yield* decodePackageId(rawPackageId)
    const limit = yield* decodeLimit(readFlagValue(argv, "--limit"))

    yield* validateView(readFlagValue(argv, "--view"))

    const modeCount = Number(catalogRequested) + Number(Option.isSome(searchQuery)) + Number(
      Option.isNone(searchQuery) && Option.isSome(rawPackageId)
    )

    if (modeCount !== 1) {
      return yield* Effect.fail(
        new PackageDocsCliError({
          message: "choose exactly one retrieval mode: --catalog, --package <package-id>, or --search <query>"
        })
      )
    }

    if (Option.isSome(searchQuery)) {
      const trimmedQuery = searchQuery.value.trim()

      if (trimmedQuery.length === 0) {
        return yield* Effect.fail(new PackageDocsCliError({ message: "--search requires a non-empty query" }))
      }

      return packageDocsCliCommand({
        mode: "search",
        packageId,
        query: trimmedQuery,
        limit
      })
    }

    if (catalogRequested) {
      return packageDocsCliCommand({
        mode: "catalog",
        packageId: null,
        query: null,
        limit
      })
    }

    return packageDocsCliCommand({
      mode: "bundle",
      packageId,
      query: null,
      limit
    })
  })

const renderCatalogJson = Schema.encodeSync(PackageDocsCatalogJson)
const renderBundleJson = Schema.encodeSync(PackageDocsBundleJson)
const renderSearchResultsJson = Schema.encodeSync(PackageDocsSearchResultsJson)

const renderCliOutput = (
  command: PackageDocsCliCommand
): Effect.Effect<string, PackageDocsCliError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const corpus = yield* loadPackageDocsCorpus()

    return yield* Match.value(command.mode).pipe(
      Match.when("catalog", () => Effect.succeed(renderCatalogJson(packageDocsCatalog(corpus)))),
      Match.when("bundle", () =>
        Option.match(Option.fromNullable(command.packageId), {
          onNone: () => Effect.fail(new PackageDocsCliError({ message: "--package is required for bundle lookup" })),
          onSome: (packageId) =>
            Option.match(packageDocsBundle(corpus, packageId), {
              onNone: () => Effect.fail(new PackageDocsCliError({ message: `unknown package: ${packageId}` })),
              onSome: (bundle) => Effect.succeed(renderBundleJson(bundle))
            })
        })),
      Match.when("search", () => {
        const query = Schema.decodeUnknownSync(PackageDocsQuerySchema)({
          query: command.query,
          packageId: command.packageId,
          limit: command.limit
        })

        return Effect.succeed(renderSearchResultsJson(searchPackageDocs(corpus, query)))
      }),
      Match.exhaustive
    )
  })

/**
 * Runs the root-owned package-doc CLI against the canonical package-doc corpus.
 *
 * @since 0.0.0
 * @category queries
 */
export const runPackageDocsCli = (
  argv: ReadonlyArray<string>
): Effect.Effect<void, PackageDocsCliError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const command = yield* parseCliCommand(argv)
    const output = yield* renderCliOutput(command)

    yield* Console.log(output)
  })
