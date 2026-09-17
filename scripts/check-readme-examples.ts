/**
 * Verifies canonical README TypeScript examples by extracting fenced blocks
 * marked `typecheck` and compiling them in-place next to their source README.
 */

import { Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import {
  Array as Arr,
  Boolean as Bool,
  Console,
  Effect,
  Number as Num,
  Order,
  Record,
  Schema,
  String as Str,
  Tuple
} from "effect"

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
    location: Arr.join(
      Tuple.make(snippet.readme.relativePath, Schema.encodeSync(Schema.NumberFromString)(snippet.line)),
      ":"
    ),
    language: snippet.language,
    code: snippet.code
  })

const summarizeByReadme = (snippets: Iterable<ReadmeSnippet>) =>
  Arr.sort(
    Arr.map(
      Record.toEntries(Arr.groupBy(snippets, (snippet) => snippet.readme.relativePath)),
      ([relativePath, group]) => Tuple.make(relativePath, Arr.length(group))
    ),
    Order.mapInput(Str.Order, Tuple.getFirst<string, number>)
  )

const plural = (count: number, noun: string): string =>
  Arr.join(
    Tuple.make(
      Schema.encodeSync(Schema.NumberFromString)(count),
      Bool.match(Num.Equivalence(count, 1), { onTrue: () => noun, onFalse: () => Str.concat(noun, "s") })
    ),
    " "
  )

const program = Effect.gen(function*() {
  const root = yield* projectRoot
  const pathService = yield* Path.Path
  const snippets = yield* loadReadmeSnippets.pipe(
    Effect.filterOrFail(Arr.isNonEmptyArray, () =>
      new ReadmeExampleCheckError({
        message: "No README code fences marked with 'typecheck' were found."
      }))
  )
  yield* typecheckSnippets(root, ".readme-typecheck-", Arr.map(snippets, (snippet) => toSnippet(pathService, snippet)))
  yield* Console.log(Arr.join(Arr.make("Verified ", plural(Arr.length(snippets), "canonical README example"), "."), ""))
  yield* Effect.forEach(
    summarizeByReadme(snippets),
    ([relativePath, count]) => Console.log(Arr.join(Arr.make("- ", relativePath, ": ", plural(count, "snippet")), "")),
    { discard: true }
  )
})

const main = program.pipe(Effect.provide(BunContext.layer))

BunRuntime.runMain(main)
