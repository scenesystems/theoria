import { Array as Arr, Effect, Option, String as Str } from "effect"

import { type ApiPage, type DocsApiModuleSummary, type DocsGuideSummary, type GuidePage } from "@theoria/docs-model"
import { browserApiExportPath, makeBrowserApiExportPage, makeBrowserApiModuleIndex } from "./browser-model.js"
import { type ApiReferenceRoute } from "./model.js"
import { writeDocsApiExportPage, writeDocsApiModuleIndex, writeGuidePage } from "./output.js"
import { pageOutputPath } from "./reflections.js"

const docText = (page: ApiPage): string =>
  Str.trim(Arr.join(Arr.map(page.module.docs.summary, (part) => part.text), ""))

const moduleSummary = (
  page: ApiPage,
  revision: string,
  outputPath: string
): DocsApiModuleSummary => ({
  kind: page.module.kind,
  name: page.module.name,
  subpath: page.module.subpath,
  slug: page.module.slug,
  source: page.module.source,
  path: page.canonicalPath,
  asset: `/docs-data/${revision}/${outputPath}`,
  aliases: page.aliases,
  summary: docText(page),
  since: page.module.since,
  exportCount: Arr.length(page.exports),
  categories: Arr.map(page.categories, (category) => category.name)
})

export const writeBrowserApiModule = (input: {
  readonly browserVersionRoot: string
  readonly packageName: string
  readonly routes: ReadonlyArray<ApiReferenceRoute>
  readonly pages: ReadonlyArray<ApiPage>
  readonly sourcePages: ReadonlyArray<ApiPage>
  readonly revision: string
}) =>
  Effect.gen(function*() {
    const canonical = Arr.findFirst(
      Arr.zip(input.routes, input.pages),
      ([route]) => route.canonical
    )

    const [route, page] = yield* Option.match(canonical, {
      onNone: () => Effect.dieMessage(`${input.packageName} module has no canonical documentation route`),
      onSome: Effect.succeed
    })
    const moduleIndex = makeBrowserApiModuleIndex(page, input.revision, route.page)
    yield* Effect.forEach(
      page.exports,
      (apiExport) =>
        writeDocsApiExportPage(
          input.browserVersionRoot,
          browserApiExportPath(route.page, apiExport.anchor),
          makeBrowserApiExportPage(apiExport)
        ),
      { concurrency: 16, discard: true }
    )
    yield* writeDocsApiModuleIndex(input.browserVersionRoot, route.page, moduleIndex)
    const sourceModules = yield* Effect.forEach(input.sourcePages, (sourcePage) => {
      const outputPath = pageOutputPath(sourcePage.package.slug, sourcePage.module.slug)
      const sourceIndex = makeBrowserApiModuleIndex(
        sourcePage,
        input.revision,
        outputPath,
        route.page
      )

      return writeDocsApiModuleIndex(input.browserVersionRoot, outputPath, sourceIndex).pipe(
        Effect.as(moduleSummary(sourcePage, input.revision, outputPath))
      )
    })

    return Arr.prepend(sourceModules, moduleSummary(page, input.revision, route.page))
  })

const relativeGuideAsset = (revision: string, asset: string): string =>
  Str.replace(`/docs-data/${revision}/`, "")(asset)

export const writeBrowserGuides = (input: {
  readonly browserVersionRoot: string
  readonly revision: string
  readonly pages: ReadonlyArray<GuidePage>
  readonly overview: DocsGuideSummary
  readonly guides: ReadonlyArray<DocsGuideSummary>
}) =>
  Effect.forEach(
    Arr.zip(input.pages, Arr.prepend(input.guides, input.overview)),
    ([page, summary]) =>
      writeGuidePage(
        input.browserVersionRoot,
        relativeGuideAsset(input.revision, summary.asset),
        page
      ),
    { discard: true }
  )
