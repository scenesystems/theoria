/**
 * Compiles every `@example` authored in this repository's packages. Examples
 * are collected from the emitted docs data, written next to the package they
 * document so imports resolve the way they do for consumers, and compiled with
 * the same TypeScript 7 invocation as README examples.
 *
 * Declarations documented by dependencies (their `sourceUrl` points into
 * `node_modules/`) are skipped: Effect's Schema class members and `Data`
 * constructors carry examples we neither wrote nor can fix here.
 */

import { type CommandExecutor, type FileSystem, Path } from "@effect/platform"
import type { ApiDocumentation, ApiExample, ApiMember } from "@theoria/docs-model"
import { Array as Arr, Data, Effect, Option, Schema } from "effect"

import { Snippet, type SnippetTypecheckError, typecheckSnippets } from "../typecheck/snippets.js"
import type { DocsPage } from "./docs-data.js"

export class ApiExampleError extends Schema.TaggedError<ApiExampleError>()("ApiExampleError", {
  diagnostics: Schema.Array(Schema.String)
}) {}

class Authored extends Data.Class<{
  readonly slug: string
  readonly owner: string
  readonly sourceUrl: string
  readonly example: ApiExample
}> {}

const authoredHere = (sourceUrl: string): boolean => !sourceUrl.includes("/node_modules/")

const examplesOf = (slug: string, owner: string, sourceUrl: string, docs: ApiDocumentation) =>
  Arr.map(docs.examples, (example) => new Authored({ slug, owner, sourceUrl, example }))

const memberExamples = (slug: string, exportId: string, member: ApiMember): ReadonlyArray<Authored> =>
  member.inherited ? [] : [
    ...examplesOf(slug, `${exportId}.${member.name}`, member.sourceUrl, member.docs),
    ...Arr.flatMap(
      member.signatures,
      (signature) => examplesOf(slug, `${exportId}.${member.name}`, member.sourceUrl, signature.docs)
    )
  ]

const collectAuthored = (page: DocsPage): ReadonlyArray<Authored> => {
  const slug = page.pkg.slug
  return [
    ...examplesOf(
      slug,
      `${page.pkg.name}/${page.index.module.source}`,
      page.index.module.sourceUrl,
      page.index.module.docs
    ),
    ...Arr.flatMap(page.exports, (value) =>
      Arr.flatMap(value.facets, (facet) => [
        ...examplesOf(slug, value.id, facet.sourceUrl, facet.docs),
        ...Arr.flatMap(
          facet.signatures,
          (signature) => examplesOf(slug, value.id, signature.sourceUrl, signature.docs)
        ),
        ...Arr.flatMap(facet.members, (member) => memberExamples(slug, value.id, member))
      ]))
  ]
}

const repositoryPath = (sourceUrl: string): string =>
  Option.match(Option.fromNullable(/\/blob\/[0-9a-f]+\/(.+)$/u.exec(sourceUrl)?.[1]), {
    onNone: () => sourceUrl,
    onSome: (path) => path
  })

const toSnippet = (root: string, pathService: Path.Path, authored: Authored): Option.Option<Snippet> =>
  authored.example.language === "ts" && authored.example.code !== null
    ? Option.some(
      new Snippet({
        directory: pathService.join(root, "packages", authored.slug),
        location: `${repositoryPath(authored.sourceUrl)} @example (${authored.owner})`,
        language: "ts",
        code: authored.example.code
      })
    )
    : Option.none()

/**
 * Fails with every non-compiling or non-fenced authored example; succeeds with
 * the number of distinct snippets compiled.
 */
export const checkApiExamples = (
  root: string,
  pages: ReadonlyArray<DocsPage>
): Effect.Effect<
  number,
  ApiExampleError | SnippetTypecheckError,
  CommandExecutor.CommandExecutor | FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function*() {
    const pathService = yield* Path.Path
    const authored = Arr.filter(Arr.flatMap(pages, collectAuthored), (_) => authoredHere(_.sourceUrl))
    const unfenced = Arr.filterMap(authored, (_) =>
      _.example.language === "ts" && _.example.code !== null
        ? Option.none()
        : Option.some(`${repositoryPath(_.sourceUrl)} (${_.owner}): @example must be a fenced TypeScript block`))
    if (Arr.isNonEmptyReadonlyArray(unfenced)) return yield* new ApiExampleError({ diagnostics: unfenced })
    const compilable = Arr.filterMap(authored, (_) => toSnippet(root, pathService, _))
    const snippets = Arr.dedupeWith(
      compilable,
      (left, right) => left.directory === right.directory && left.code === right.code
    )
    yield* typecheckSnippets(root, ".api-example-typecheck-", snippets)
    return snippets.length
  })
