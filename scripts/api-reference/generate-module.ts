import { Path } from "@effect/platform"
import { Array as Arr, Effect, Option } from "effect"

import { writeBrowserApiModule } from "./browser-output.js"
import { type ApiConvertedModule } from "./converted.js"
import { documentationPathForExport } from "./documentation-routes.js"
import { type ApiDocLink } from "./links.js"
import { ApiReferenceGenerationError, type ApiReferenceModule } from "./model.js"
import { sha256File, writeApiPage, writeReflection } from "./output.js"
import { makeRoutes, moduleOutputPath } from "./reflections.js"
import { TypeDocReflections } from "./revive.js"
import { makeSourceDocumentationPages } from "./source-documentation-pages.js"
import { type ApiSourcePackage } from "./source.js"
import { makeApiPresentation } from "./typedoc-presentation.js"

const repositoryUrl = "https://github.com/scenesystems/theoria"

const typeDocFailure = (packageName: string, detail: string): ApiReferenceGenerationError =>
  new ApiReferenceGenerationError({ packageName, detail })

export const generateApiModule = (input: {
  readonly browserVersionRoot: string
  readonly outputRoot: string
  readonly packageSlug: string
  readonly revision: string
  readonly links: ReadonlyArray<ApiDocLink>
  readonly sourcePackage: ApiSourcePackage
  readonly module: ApiConvertedModule
}) =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    const reflections = yield* TypeDocReflections
    const packageName = input.sourcePackage.manifest.name
    const { project, reflection, source } = input.module
    const relativeOutput = moduleOutputPath(path, input.packageSlug, source.canonicalSubpath)
    yield* writeReflection(input.outputRoot, relativeOutput, reflections.serialize(project))

    const reflectionSha256 = yield* sha256File(path.join(input.outputRoot, relativeOutput))
    const sourceUrl = `${repositoryUrl}/blob/${input.revision}/packages/${input.packageSlug}/${source.relative}`
    const routes = yield* makeRoutes(input.sourcePackage, input.module)
    const presentation = yield* makeApiPresentation({
      packageName,
      packageVersion: input.sourcePackage.manifest.version,
      packageSlug: input.packageSlug,
      packageDescription: input.sourcePackage.description,
      moduleSource: source.relative,
      moduleReflection: reflection,
      moduleSourceUrl: sourceUrl,
      routes,
      links: input.links
    })
    const canonical = yield* Option.match(
      Arr.findFirst(Arr.zip(routes, presentation.pages), ([route]) => route.canonical),
      {
        onNone: () => typeDocFailure(packageName, `${source.relative} has no canonical presentation page`),
        onSome: Effect.succeed
      }
    )
    const [canonicalRoute, canonicalPage] = canonical
    const sourcePages = yield* makeSourceDocumentationPages({
      revision: input.revision,
      links: input.links,
      sourcePackage: input.sourcePackage,
      module: input.module,
      route: canonicalRoute,
      page: canonicalPage
    })
    yield* Effect.forEach(
      Arr.zip(routes, presentation.pages),
      ([route, page]) => writeApiPage(input.outputRoot, route.page, page)
    )
    const apiModules = yield* writeBrowserApiModule({
      browserVersionRoot: input.browserVersionRoot,
      packageName,
      routes,
      pages: presentation.pages,
      sourcePages,
      revision: input.revision
    })

    const generatedModule: ApiReferenceModule = {
      source: source.relative,
      sourceUrl,
      reflection: relativeOutput.split(path.sep).join("/"),
      reflectionSha256,
      reflectionId: reflection.id,
      routes
    }

    const canonicalExports = Option.match(
      Arr.findFirst(input.module.routes, (route) => route.entrypoint.subpath === canonicalRoute.subpath),
      { onNone: () => [], onSome: (route) => route.publicExports }
    )
    const searchEntries = Arr.map(presentation.searchEntries, (entry) => {
      if (entry.kind !== "symbol") {
        return entry
      }

      return Option.match(
        Arr.findFirst(canonicalExports, (publicExport) => publicExport.exportName === entry.name),
        {
          onNone: () => entry,
          onSome: (publicExport) => ({
            ...entry,
            path: documentationPathForExport({ sourcePackage: input.sourcePackage, module: source, publicExport })
          })
        }
      )
    })

    return { module: generatedModule, apiModules, searchEntries }
  })
