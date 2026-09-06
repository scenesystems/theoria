import { Command, type CommandExecutor, FileSystem, Path, Url } from "@effect/platform"
import type { PlatformError } from "@effect/platform/Error"
import { Effect, type ParseResult, Schema } from "effect"

import {
  conversionEnvironment,
  ConversionRequest,
  type ConvertedPackage,
  convertedPackagePath,
  ConvertedPackageText,
  encodeConversionRequest
} from "./conversion.js"
import { ApiReferenceGenerationError } from "./model.js"
import { type ApiSourcePackage } from "./source.js"

// One process holds one package's TypeScript program, up to about two
// gigabytes for the largest package. Three at a time overlaps the conversions
// while staying inside the memory of a four-core CI runner.
const conversionConcurrency = 3

const conversionScript = Effect.flatMap(
  Url.fromString("../api-reference-convert.ts", import.meta.url).pipe(Effect.orDie),
  (url) => Effect.flatMap(Path.Path, (path) => path.fromFileUrl(url))
)

const runConversion = (request: ConversionRequest, packageName: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const script = yield* conversionScript
    const encodedRequest = yield* encodeConversionRequest(request)
    const command = Command.make("bun", script).pipe(
      Command.workingDirectory(request.repositoryRoot),
      Command.env(conversionEnvironment(encodedRequest)),
      Command.stdout("inherit"),
      Command.stderr("inherit")
    )
    const exitCode = yield* Command.exitCode(command)

    if (Number(exitCode) !== 0) {
      return yield* new ApiReferenceGenerationError({
        packageName,
        detail: `conversion process exited with code ${String(exitCode)}`
      })
    }

    const text = yield* fileSystem.readFileString(
      path.join(request.outputDirectory, convertedPackagePath(path, request.packageDirectory))
    )
    return yield* Schema.decode(ConvertedPackageText)(text)
  })

/** Converts every package in its own process; each summary points at the reflections written under `conversionRoot`. */
export const convertApiPackages = (input: {
  readonly repositoryRoot: string
  readonly revision: string
  readonly conversionRoot: string
  readonly sourcePackages: ReadonlyArray<ApiSourcePackage>
}): Effect.Effect<
  ReadonlyArray<ConvertedPackage>,
  ApiReferenceGenerationError | ParseResult.ParseError | PlatformError,
  CommandExecutor.CommandExecutor | FileSystem.FileSystem | Path.Path
> =>
  Effect.forEach(
    input.sourcePackages,
    (sourcePackage) =>
      runConversion(
        new ConversionRequest({
          repositoryRoot: input.repositoryRoot,
          revision: input.revision,
          packageDirectory: sourcePackage.directoryName,
          outputDirectory: input.conversionRoot
        }),
        sourcePackage.manifest.name
      ),
    { concurrency: conversionConcurrency }
  )
