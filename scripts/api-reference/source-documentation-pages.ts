import { Array as Arr, Effect, Option } from "effect"
import { Comment } from "typedoc"

import { type ApiPage } from "@theoria/docs-model"
import { type ApiConvertedModule } from "./converted.js"
import {
  hasSourceDocumentationPages,
  sourceDocumentationFiles,
  sourceDocumentationSlug
} from "./documentation-routes.js"
import { type ApiDocLink } from "./links.js"
import { ApiReferenceGenerationError, type ApiReferenceRoute } from "./model.js"
import { categoriesForExports } from "./presentation.js"
import { apiPagePath } from "./reflections.js"
import { type ApiSourcePackage } from "./source.js"
import { documentation } from "./typedoc-comments.js"

const repositoryUrl = "https://github.com/scenesystems/theoria"

const generationError = (packageName: string, detail: string): ApiReferenceGenerationError =>
  new ApiReferenceGenerationError({ packageName, detail })

const duplicateSlug = (sources: ReadonlyArray<string>): Option.Option<string> =>
  Arr.findFirst(
    sources,
    (source, index) =>
      Arr.some(sources.slice(index + 1), (candidate) =>
        sourceDocumentationSlug(candidate) === sourceDocumentationSlug(source))
  )

export const makeSourceDocumentationPages = (input: {
  readonly revision: string
  readonly links: ReadonlyArray<ApiDocLink>
  readonly sourcePackage: ApiSourcePackage
  readonly module: ApiConvertedModule
  readonly route: ApiReferenceRoute
  readonly page: ApiPage
}) => {
  if (!hasSourceDocumentationPages(input.sourcePackage, input.module.source)) {
    return Effect.succeed<ReadonlyArray<ApiPage>>([])
  }

  return Effect.gen(function*() {
    const sourceRoute = yield* Option.match(
      Arr.findFirst(input.module.routes, (candidate) => candidate.entrypoint.subpath === input.route.subpath),
      {
        onNone: () =>
          Effect.fail(generationError(
            input.sourcePackage.manifest.name,
            `${input.route.subpath} has no source route`
          )),
        onSome: Effect.succeed
      }
    )
    const sources = Arr.map(
      sourceDocumentationFiles(input.module.source, sourceRoute.publicExports),
      (sourceFile) => sourceFile.relative
    )
    const collision = duplicateSlug(sources)

    if (Option.isSome(collision)) {
      return yield* generationError(
        input.sourcePackage.manifest.name,
        `source documentation path collides for ${collision.value}`
      )
    }

    return yield* Effect.forEach(sources, (source) =>
      Effect.gen(function*() {
        const publicExports = Arr.filter(sourceRoute.publicExports, (entry) => entry.sourceFile.relative === source)
        const exports = Arr.filter(input.page.exports, (apiExport) =>
          Arr.some(publicExports, (entry) =>
            entry.exportName === apiExport.name && entry.kind === apiExport.importKind))

        if (exports.length !== publicExports.length) {
          return yield* generationError(
            input.sourcePackage.manifest.name,
            `${source} documentation projection omitted a public export`
          )
        }

        const slug = sourceDocumentationSlug(source)
        const comment = yield* Option.match(
          Arr.findFirst(input.module.sourceComments, (candidate) =>
            candidate.source === source),
          {
            onNone: () =>
              Effect.fail(generationError(
                input.sourcePackage.manifest.name,
                `${source} was not converted for source documentation`
              )),
            onSome: (converted) => Effect.succeed(converted.comment)
          }
        )
        const since = Comment.combineDisplayParts(comment.getTag("@since")?.content).trim()
        const path = apiPagePath(input.sourcePackage.directoryName, slug)
        const sourceUrl =
          `${repositoryUrl}/blob/${input.revision}/packages/${input.sourcePackage.directoryName}/${source}`

        const page: ApiPage = {
          schemaVersion: 2,
          kind: "api-module",
          path,
          canonical: true,
          canonicalPath: path,
          aliases: [],
          package: input.page.package,
          module: {
            kind: "source",
            name: slug,
            subpath: input.route.subpath,
            slug,
            source,
            docs: documentation(comment, {
              packageName: input.sourcePackage.manifest.name,
              route: input.route,
              links: input.links
            }),
            since,
            sourceUrl
          },
          categories: categoriesForExports(exports),
          exports
        }

        return page
      }))
  })
}
