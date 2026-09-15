/**
 * Compiles extracted TypeScript snippets by writing each one to a scoped
 * temp file inside the directory it belongs to (so workspace packages and
 * self-references resolve exactly as they do for consumers) and spawning the
 * repository's TypeScript 7 compiler with `--ignoreConfig`.
 */

import { Command, type CommandExecutor, FileSystem, Path } from "@effect/platform"
import type { PlatformError } from "@effect/platform/Error"
import { Array as Arr, Boolean as Bool, Effect, Number as Num, Schema, Stream, String as Str, Tuple } from "effect"
import type { Scope } from "effect"

export const SnippetLanguage = Schema.Literal("ts", "tsx")
export type SnippetLanguage = typeof SnippetLanguage.Type

export class Snippet extends Schema.Class<Snippet>("Snippet")({
  directory: Schema.String,
  location: Schema.String,
  language: SnippetLanguage,
  code: Schema.String
}) {}

export class SnippetTypecheckError extends Schema.TaggedError<SnippetTypecheckError>()("SnippetTypecheckError", {
  message: Schema.String
}) {}

class TempSnippet extends Schema.Class<TempSnippet>("TempSnippet")({
  snippet: Snippet,
  tempPath: Schema.String
}) {}

const COMPILER_FLAGS = Str.split(
  Arr.join(
    Arr.make(
      "--noEmit --ignoreConfig --pretty false --strict --skipLibCheck --target ES2022 --lib ES2022 --module NodeNext",
      "--moduleResolution NodeNext --moduleDetection force --verbatimModuleSyntax --isolatedModules --resolveJsonModule",
      "--exactOptionalPropertyTypes --noFallthroughCasesInSwitch --noUncheckedIndexedAccess --noImplicitOverride --jsx react-jsx"
    ),
    " "
  ),
  " "
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
      suffix: Str.concat(".", snippet.language)
    })
    yield* fileSystem.writeFileString(
      tempPath,
      Arr.join(Arr.make(Str.concat("// Extracted from ", snippet.location), snippet.code), "\n")
    )
    return new TempSnippet({ snippet, tempPath })
  })

const rewriteCompilerOutput = (
  root: string,
  pathService: Path.Path,
  output: string,
  snippets: Iterable<TempSnippet>
): string =>
  Arr.reduce(
    snippets,
    output,
    (current, { snippet, tempPath }) =>
      Str.replaceAll(pathService.relative(root, tempPath), snippet.location)(
        Str.replaceAll(tempPath, snippet.location)(current)
      )
  )

const collectText = (stream: Stream.Stream<Uint8Array, PlatformError>) =>
  Stream.decodeText(stream).pipe(Stream.runFold("", (acc, chunk) => Str.concat(acc, chunk)))

const runCompiler = (root: string, snippets: Schema.Schema.Type<Schema.Array$<typeof TempSnippet>>) =>
  Effect.gen(function*() {
    const pathService = yield* Path.Path
    const command = Command.make("bunx", "tsc", ...COMPILER_FLAGS, ...Arr.map(snippets, (_) => _.tempPath)).pipe(
      Command.workingDirectory(root),
      Command.stdout("pipe"),
      Command.stderr("pipe")
    )
    const running = yield* Command.start(command)
    const [exitCode, stdout, stderr] = yield* Effect.all(
      Tuple.make(running.exitCode, collectText(running.stdout), collectText(running.stderr)),
      { concurrency: "unbounded" }
    )
    return yield* Effect.if(Num.Equivalence(exitCode, 0), {
      onTrue: () => Effect.void,
      onFalse: () => {
        const compilerOutput = Str.trim(rewriteCompilerOutput(root, pathService, Str.concat(stdout, stderr), snippets))
        return new SnippetTypecheckError({
          message: Bool.match(Str.isNonEmpty(compilerOutput), {
            onTrue: () => compilerOutput,
            onFalse: () => "Snippet typecheck failed with no compiler output"
          })
        })
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
  snippets: Iterable<Snippet>
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
