/**
 * Compiles extracted TypeScript snippets by writing each one to a scoped
 * temp file inside the directory it belongs to (so workspace packages and
 * self-references resolve exactly as they do for consumers) and spawning the
 * repository's TypeScript 7 compiler with `--ignoreConfig`.
 */

import { Command, type CommandExecutor, FileSystem, Path } from "@effect/platform"
import type { PlatformError } from "@effect/platform/Error"
import { Array as Arr, Data, Effect, Stream, String as Str } from "effect"
import type { Scope } from "effect"

export type SnippetLanguage = "ts" | "tsx"

export class Snippet extends Data.Class<{
  readonly directory: string
  readonly location: string
  readonly language: SnippetLanguage
  readonly code: string
}> {}

export class SnippetTypecheckError extends Data.TaggedError("SnippetTypecheckError")<{
  readonly message: string
  readonly exitCode: number
}> {}

class TempSnippet extends Data.Class<{
  readonly snippet: Snippet
  readonly tempPath: string
}> {}

const COMPILER_FLAGS = Str.split(
  "--noEmit --ignoreConfig --pretty false --strict --skipLibCheck --target ES2022 --lib ES2022 --module NodeNext "
    + "--moduleResolution NodeNext --moduleDetection force --verbatimModuleSyntax --isolatedModules --resolveJsonModule "
    + "--exactOptionalPropertyTypes --noFallthroughCasesInSwitch --noUncheckedIndexedAccess --noImplicitOverride --jsx react-jsx",
  " "
)

const materialize = (
  prefix: string,
  snippet: Snippet
): Effect.Effect<TempSnippet, never, FileSystem.FileSystem | Scope.Scope> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const tempPath = yield* fileSystem.makeTempFileScoped({
      directory: snippet.directory,
      prefix,
      suffix: `.${snippet.language}`
    }).pipe(Effect.orDie)
    yield* fileSystem.writeFileString(tempPath, `// Extracted from ${snippet.location}\n${snippet.code}`).pipe(
      Effect.orDie
    )
    return new TempSnippet({ snippet, tempPath })
  })

const rewriteCompilerOutput = (
  root: string,
  pathService: Path.Path,
  output: string,
  snippets: ReadonlyArray<TempSnippet>
): string =>
  Arr.reduce(snippets, output, (current, { snippet, tempPath }) =>
    current
      .replaceAll(tempPath, snippet.location)
      .replaceAll(pathService.relative(root, tempPath), snippet.location))

const collectText = (stream: Stream.Stream<Uint8Array, PlatformError>) =>
  Stream.decodeText(stream).pipe(Stream.runFold("", (acc, chunk) => `${acc}${chunk}`))

const runCompiler = (root: string, snippets: ReadonlyArray<TempSnippet>) =>
  Effect.gen(function*() {
    const pathService = yield* Path.Path
    const command = Command.make("bunx", "tsc", ...COMPILER_FLAGS, ...Arr.map(snippets, (_) => _.tempPath)).pipe(
      Command.workingDirectory(root),
      Command.stdout("pipe"),
      Command.stderr("pipe")
    )
    const running = yield* Command.start(command).pipe(Effect.orDie)
    const [exitCode, stdout, stderr] = yield* Effect.all(
      [running.exitCode, collectText(running.stdout), collectText(running.stderr)],
      { concurrency: "unbounded" }
    ).pipe(Effect.orDie)
    if (Number(exitCode) === 0) return
    const compilerOutput = rewriteCompilerOutput(root, pathService, `${stdout}${stderr}`, snippets).trim()
    return yield* new SnippetTypecheckError({
      message: Str.isNonEmpty(compilerOutput) ? compilerOutput : "Snippet typecheck failed with no compiler output",
      exitCode: Number(exitCode)
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
  snippets: ReadonlyArray<Snippet>
): Effect.Effect<void, SnippetTypecheckError, CommandExecutor.CommandExecutor | FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const materialized = yield* Effect.forEach(snippets, (snippet) => materialize(prefix, snippet), {
      concurrency: "unbounded"
    })
    yield* runCompiler(root, materialized)
  }).pipe(Effect.scoped)
