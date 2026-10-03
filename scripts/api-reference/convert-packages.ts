import { Console, Effect, FileSystem, Number as Num, Path, Schema } from "effect"
import { Url } from "effect/http"
import type { BadArgument, PlatformError } from "effect/PlatformError"
import { ChildProcess, type ChildProcessSpawner } from "effect/process"

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
const numberText = Schema.encodeSync(Schema.FiniteFromString)

const conversionScript = Effect.flatMap(
  Url.fromString("../api-reference-convert.ts", import.meta.url).pipe(Effect.fromResult, Effect.orDie),
  (url) => Effect.flatMap(Path.Path, (path) => path.fromFileUrl(url))
)

const runConversion = (request: ConversionRequest, packageName: string) =>
  Effect.scoped(Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const script = yield* conversionScript
    const encodedRequest = yield* encodeConversionRequest(request)
    const running = yield* ChildProcess.make("bun", [script], {
      cwd: request.repositoryRoot,
      env: conversionEnvironment(encodedRequest),
      extendEnv: true,
      stdout: "inherit",
      stderr: "inherit"
    })
    const exitCode = yield* running.exitCode

    yield* (Num.Equivalence(exitCode, 0)
      ? Effect.void
      : Console.error(`API conversion failed for ${packageName} with exit code ${numberText(exitCode)}`).pipe(
        Effect.andThen(Effect.fail(
          new ApiReferenceGenerationError({
            packageName,
            detail: `conversion process exited with code ${numberText(exitCode)}`
          })
        ))
      ))

    const text = yield* fileSystem.readFileString(
      path.join(request.outputDirectory, convertedPackagePath(path, request.packageDirectory))
    )
    return yield* Schema.decodeEffect(ConvertedPackageText)(text)
  }))

/** Converts every package in its own process; each summary points at the reflections written under `conversionRoot`. */
export const convertApiPackages = (input: {
  readonly repositoryRoot: string
  readonly revision: string
  readonly conversionRoot: string
  readonly sourcePackages: ReadonlyArray<ApiSourcePackage>
}): Effect.Effect<
  ReadonlyArray<ConvertedPackage>,
  ApiReferenceGenerationError | BadArgument | Schema.SchemaError | PlatformError,
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
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
