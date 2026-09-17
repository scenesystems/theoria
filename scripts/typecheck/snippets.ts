/**
 * Compiles extracted TypeScript snippets by writing each one to a scoped
 * temp file inside the directory it belongs to (so workspace packages and
 * self-references resolve exactly as they do for consumers) and spawning the
 * repository's TypeScript 7 compiler with `--ignoreConfig`.
 */

import { Command, type CommandExecutor, FileSystem, Path } from "@effect/platform"
import type { PlatformError } from "@effect/platform/Error"
import { Array, Boolean, Effect, Number, pipe, Schema, Stream, String } from "effect"
import type { Scope } from "effect"

const SnippetLanguage = Schema.Literal("ts", "tsx")

export type SnippetLanguage = typeof SnippetLanguage.Type

export class Snippet extends Schema.Class<Snippet>("Snippet")({
  directory: Schema.String,
  location: Schema.String,
  language: SnippetLanguage,
  code: Schema.String
}) {}

const Snippets = Schema.Array(Snippet)

export class SnippetTypecheckError extends Schema.TaggedError<SnippetTypecheckError>()("SnippetTypecheckError", {
  message: Schema.String
}) {}

class TempSnippet extends Schema.Class<TempSnippet>("TempSnippet")({
  snippet: Snippet,
  tempPath: Schema.String
}) {}

const TempSnippets = Schema.Array(TempSnippet)

const COMPILER_FLAGS = pipe(
  Array.make(
    "--noEmit --ignoreConfig --pretty false --strict --skipLibCheck --target ES2022 --lib ES2022 --module NodeNext",
    "--moduleResolution NodeNext --moduleDetection force --verbatimModuleSyntax --isolatedModules --resolveJsonModule",
    "--exactOptionalPropertyTypes --noFallthroughCasesInSwitch --noUncheckedIndexedAccess --noImplicitOverride --jsx react-jsx"
  ),
  Array.join(" "),
  String.split(" ")
)

const materialize = (
  prefix: string,
  snippet: Snippet
): Effect.Effect<TempSnippet, PlatformError, FileSystem.FileSystem | Scope.Scope> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const tempPath = yield* fileSystem.makeTempFileScoped({
      directory: snippet.directory,
      prefix,
      suffix: String.concat(".", snippet.language)
    })
    yield* fileSystem.writeFileString(
      tempPath,
      Array.join(Array.make("// Extracted from ", snippet.location, "\n", snippet.code), "")
    )
    return new TempSnippet({ snippet, tempPath })
  })

const rewriteCompilerOutput = (
  root: string,
  pathService: Path.Path,
  output: string,
  snippets: typeof TempSnippets.Type
): string =>
  Array.reduce(snippets, output, (current, { snippet, tempPath }) =>
    pipe(
      current,
      String.replaceAll(tempPath, snippet.location),
      String.replaceAll(pathService.relative(root, tempPath), snippet.location)
    ))

const runCompiler = (root: string, snippets: typeof TempSnippets.Type) =>
  Effect.gen(function*() {
    const pathService = yield* Path.Path
    const command = Command.make("bunx", "tsc", ...COMPILER_FLAGS, ...Array.map(snippets, (_) => _.tempPath)).pipe(
      Command.workingDirectory(root),
      Command.stdout("pipe"),
      Command.stderr("pipe")
    )
    const running = yield* Command.start(command)
    const { exitCode, stderr, stdout } = yield* Effect.all(
      {
        exitCode: running.exitCode,
        stdout: running.stdout.pipe(Stream.decodeText(), Stream.mkString),
        stderr: running.stderr.pipe(Stream.decodeText(), Stream.mkString)
      },
      { concurrency: "unbounded" }
    )
    return yield* Effect.if(Number.Equivalence(exitCode, 0), {
      onTrue: () => Effect.void,
      onFalse: () => {
        const compilerOutput = String.trim(
          rewriteCompilerOutput(root, pathService, String.concat(stdout, stderr), snippets)
        )
        return Effect.fail(
          new SnippetTypecheckError({
            message: Boolean.match(String.isNonEmpty(compilerOutput), {
              onTrue: () => compilerOutput,
              onFalse: () => "Snippet typecheck failed with no compiler output"
            })
          })
        )
      }
    })
  })

/**
 * Materializes every snippet under `prefix` in its own directory, compiles
 * them together in one compiler invocation rooted at `root`, and removes the
 * temp files afterwards. Compiler output refers to snippet locations rather
 * than temp paths.
 */
export const typecheckSnippets = (
  root: string,
  prefix: string,
  snippets: typeof Snippets.Type
): Effect.Effect<
  void,
  SnippetTypecheckError | PlatformError,
  CommandExecutor.CommandExecutor | FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function*() {
    const materialized = yield* Effect.forEach(snippets, (snippet) => materialize(prefix, snippet), {
      concurrency: "unbounded"
    })
    yield* runCompiler(root, materialized)
  }).pipe(Effect.scoped)
