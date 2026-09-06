/**
 * Verifies canonical README TypeScript examples by extracting fenced blocks
 * marked `typecheck` and compiling them in-place next to their source README.
 */

import { Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Console, Effect, Order, Record, String as Str, Tuple } from "effect"

import {
  loadReadmeSnippets,
  projectRoot,
  ReadmeExampleCheckError,
  type ReadmeSnippet
} from "./readme-examples/snippets.js"
import { Snippet, typecheckSnippets } from "./typecheck/snippets.js"

const toSnippet = (pathService: Path.Path, snippet: ReadmeSnippet): Snippet =>
  new Snippet({
    directory: pathService.dirname(snippet.readme.absolutePath),
    location: `${snippet.readme.relativePath}:${String(snippet.line)}`,
    language: snippet.language,
    code: snippet.code
  })

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
  const pathService = yield* Path.Path
  const snippets = yield* loadReadmeSnippets
  if (!Arr.isNonEmptyReadonlyArray(snippets)) {
    return yield* new ReadmeExampleCheckError({
      message: "No README code fences marked with 'typecheck' were found."
    })
  }
  yield* typecheckSnippets(root, ".readme-typecheck-", Arr.map(snippets, (snippet) => toSnippet(pathService, snippet)))
  yield* Console.log(`Verified ${plural(snippets.length, "canonical README example")}.`)
  yield* Effect.forEach(
    summarizeByReadme(snippets),
    ([relativePath, count]) => Console.log(`- ${relativePath}: ${plural(count, "snippet")}`),
    { discard: true }
  )
})

const main = program.pipe(Effect.provide(BunContext.layer))

BunRuntime.runMain(main)
