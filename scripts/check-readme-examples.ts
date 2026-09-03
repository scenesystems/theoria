/**
 * Verifies canonical README TypeScript examples by extracting fenced blocks
 * marked `typecheck` and compiling them in-place next to their source README.
 */

import { Command, FileSystem, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import type { PlatformError } from "@effect/platform/Error"
import { Array as Arr, Console, Data, Effect, Order, Record, Stream, String as Str, Tuple } from "effect"
import type { Scope } from "effect"

import {
  loadReadmeSnippets,
  projectRoot,
  ReadmeExampleCheckError,
  type ReadmeSnippet
} from "./readme-examples/snippets.js"

class TempSnippet extends Data.Class<{
  readonly snippet: ReadmeSnippet
  readonly tempPath: string
}> {}

const COMPILER_FLAGS = Str.split(
  "--noEmit --ignoreConfig --pretty false --strict --skipLibCheck --target ES2022 --lib ES2022 --module NodeNext "
    + "--moduleResolution NodeNext --moduleDetection force --verbatimModuleSyntax --isolatedModules --resolveJsonModule "
    + "--exactOptionalPropertyTypes --noFallthroughCasesInSwitch --noUncheckedIndexedAccess --noImplicitOverride --jsx react-jsx",
  " "
)

const materializeSnippet = (
  snippet: ReadmeSnippet
): Effect.Effect<TempSnippet, never, FileSystem.FileSystem | Path.Path | Scope.Scope> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const pathService = yield* Path.Path
    const tempPath = yield* fileSystem.makeTempFileScoped({
      directory: pathService.dirname(snippet.readme.absolutePath),
      prefix: ".readme-typecheck-",
      suffix: `.${snippet.language}`
    }).pipe(Effect.orDie)
    const header = `// Extracted from ${snippet.readme.relativePath}:${String(snippet.line)}\n`
    yield* fileSystem.writeFileString(tempPath, `${header}${snippet.code}`).pipe(Effect.orDie)
    return new TempSnippet({ snippet, tempPath })
  })

const rewriteCompilerOutput = (
  root: string,
  pathService: Path.Path,
  output: string,
  snippets: ReadonlyArray<TempSnippet>
): string =>
  Arr.reduce(snippets, output, (current, { snippet, tempPath }) => {
    const location = `${snippet.readme.relativePath}:${String(snippet.line)}`
    return current.replaceAll(tempPath, location).replaceAll(pathService.relative(root, tempPath), location)
  })

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
    const running = yield* Command.start(command)
    const [exitCode, stdout, stderr] = yield* Effect.all(
      [running.exitCode, collectText(running.stdout), collectText(running.stderr)],
      { concurrency: "unbounded" }
    )
    if (Number(exitCode) === 0) return
    const compilerOutput = rewriteCompilerOutput(root, pathService, `${stdout}${stderr}`, snippets).trim()
    return yield* new ReadmeExampleCheckError({
      message: Str.isNonEmpty(compilerOutput)
        ? compilerOutput
        : "README example typecheck failed with no compiler output",
      exitCode: Number(exitCode)
    })
  }).pipe(Effect.scoped)

const summarizeByReadme = (snippets: ReadonlyArray<ReadmeSnippet>): ReadonlyArray<readonly [string, number]> =>
  Arr.sort(
    Arr.map(
      Record.toEntries(Arr.groupBy(snippets, (snippet) => snippet.readme.relativePath)),
      ([relativePath, group]) => Tuple.make(relativePath, group.length)
    ),
    Order.mapInput(Str.Order, ([relativePath]: readonly [string, number]) => relativePath)
  )

const plural = (count: number, noun: string): string => `${String(count)} ${noun}${count === 1 ? "" : "s"}`

const program = Effect.gen(function*() {
  const root = yield* projectRoot
  const snippets = yield* loadReadmeSnippets
  if (!Arr.isNonEmptyReadonlyArray(snippets)) {
    return yield* new ReadmeExampleCheckError({
      message: "No README code fences marked with 'typecheck' were found.",
      exitCode: 1
    })
  }
  const materialized = yield* Effect.forEach(snippets, materializeSnippet, { concurrency: "unbounded" })
  yield* runCompiler(root, materialized)
  yield* Console.log(`Verified ${plural(snippets.length, "canonical README example")}.`)
  yield* Effect.forEach(
    summarizeByReadme(snippets),
    ([relativePath, count]) => Console.log(`- ${relativePath}: ${plural(count, "snippet")}`),
    { discard: true }
  )
}).pipe(Effect.scoped)

const main = program.pipe(
  Effect.catchTag(
    "ReadmeExampleCheckError",
    (error) => Console.error(error.message).pipe(Effect.andThen(Effect.sync(() => process.exit(error.exitCode))))
  ),
  Effect.provide(BunContext.layer)
)

BunRuntime.runMain(main)
