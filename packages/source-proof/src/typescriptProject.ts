import { Path } from "@effect/platform"
import { Data, Effect, Option } from "effect"
import * as ts from "typescript"

/**
 * Typed failure for invalid TypeScript project configuration.
 *
 * @since 0.0.0
 * @category errors
 */
export class TypeScriptProjectError extends Data.TaggedError("TypeScriptProjectError")<{
  readonly tsconfigPath: string
  readonly message: string
}> {}

const diagnosticsHost: ts.FormatDiagnosticsHost = {
  getCanonicalFileName: (fileName) => fileName,
  getCurrentDirectory: () => process.cwd(),
  getNewLine: () => "\n"
}

const formatDiagnostics = (diagnostics: ReadonlyArray<ts.Diagnostic>): string =>
  ts.formatDiagnosticsWithColorAndContext(diagnostics, diagnosticsHost)

/**
 * Creates a TypeScript program from a package tsconfig for semantic export resolution.
 *
 * @since 0.0.0
 * @category parsing
 */
export const typeScriptProgramFromConfig = (
  tsconfigPath: string
): Effect.Effect<ts.Program, TypeScriptProjectError, Path.Path> =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile)
    const configError = Option.fromNullable(configFile.error)

    if (Option.isSome(configError)) {
      return yield* Effect.fail(
        new TypeScriptProjectError({
          tsconfigPath,
          message: formatDiagnostics([configError.value])
        })
      )
    }

    const parsed = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      path.dirname(tsconfigPath),
      undefined,
      tsconfigPath
    )

    if (parsed.errors.length > 0) {
      return yield* Effect.fail(
        new TypeScriptProjectError({
          tsconfigPath,
          message: formatDiagnostics(parsed.errors)
        })
      )
    }

    return ts.createProgram({
      rootNames: parsed.fileNames,
      options: parsed.options,
      ...Option.match(Option.fromNullable(parsed.projectReferences), {
        onNone: () => ({}),
        onSome: (projectReferences) => ({ projectReferences })
      })
    })
  })
