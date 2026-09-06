import type { Path } from "@effect/platform"
import { Array as Arr, Effect, Option } from "effect"
import { type DeclarationReflection, ReflectionKind } from "typedoc"

import { type ApiConvertedModule } from "./converted.js"
import { ApiReferenceGenerationError, type ApiReferenceImport, type ApiReferenceRoute } from "./model.js"
import { type ApiSourcePackage } from "./source.js"

export const routeSlug = (subpath: string): string => subpath === "." ? "" : subpath.replace(/^\.\//u, "")

export const apiPagePath = (packageSlug: string, slug: string): string =>
  `/docs/${packageSlug}/api${slug.length === 0 ? "" : `/${slug}`}`

export const pageOutputPath = (packageSlug: string, slug: string): string =>
  `packages/${packageSlug}/pages/${slug.length === 0 ? "index" : slug}.json`

export const moduleOutputPath = (path: Path.Path, packageSlug: string, subpath: string): string => {
  const segments = routeSlug(subpath).split("/").filter((segment) => segment.length > 0)
  return path.join(
    "packages",
    packageSlug,
    "modules",
    ...(segments.length === 0 ? ["index.json"] : [
      ...segments.slice(0, -1),
      `${segments.at(-1) ?? "index"}.json`
    ])
  )
}

export const moduleDisplayName = (packageName: string, subpath: string): string =>
  subpath === "." ? packageName : `${packageName}/${subpath.replace(/^\.\//u, "")}`

const firstSourceUrl = (reflection: DeclarationReflection): Option.Option<string> =>
  Arr.findFirst(reflection.sources ?? [], (source) => Option.fromNullable(source.url))

const reflectionsForImport = (
  reflection: DeclarationReflection,
  exportName: string
): ReadonlyArray<DeclarationReflection> => Arr.filter(reflection.children ?? [], (child) => child.name === exportName)

const makeImports = (
  packageName: string,
  module: ApiConvertedModule,
  reflection: DeclarationReflection,
  subpath: string
) => {
  const route = Arr.findFirst(module.routes, (candidate) => candidate.entrypoint.subpath === subpath)

  return Option.match(route, {
    onNone: () => Effect.succeed<ReadonlyArray<ApiReferenceImport>>([]),
    onSome: ({ publicExports }) =>
      Effect.forEach(publicExports, (entry) =>
        Effect.gen(function*() {
          const semanticReflections = reflectionsForImport(reflection, entry.exportName)

          if (semanticReflections.length === 0) {
            return yield* new ApiReferenceGenerationError({
              packageName,
              detail: `${subpath} export ${entry.exportName} has no semantic TypeDoc reflection`
            })
          }

          const reflections = yield* Effect.forEach(semanticReflections, (resolved) =>
            Option.match(firstSourceUrl(resolved), {
              onNone: () =>
                Effect.fail(
                  new ApiReferenceGenerationError({
                    packageName,
                    detail: `${subpath} export ${entry.exportName} has no revision-pinned source URL`
                  })
                ),
              onSome: (sourceUrl) =>
                Effect.succeed({
                  reflectionId: resolved.id,
                  reflectionKind: `${ReflectionKind.singularString(resolved.kind)}`,
                  sourceUrl
                })
            }))
          const apiImport: ApiReferenceImport = {
            name: entry.exportName,
            importKind: entry.kind,
            source: entry.sourceFile.relative,
            summary: entry.summary,
            since: entry.since,
            category: entry.category,
            reflections
          }

          return apiImport
        }))
  })
}

export const makeRoutes = (
  sourcePackage: ApiSourcePackage,
  module: ApiConvertedModule
) =>
  Effect.forEach(module.routes, ({ entrypoint }) =>
    Effect.map(
      makeImports(sourcePackage.manifest.name, module, module.reflection, entrypoint.subpath),
      (imports): ApiReferenceRoute => {
        const slug = routeSlug(entrypoint.subpath)

        return {
          subpath: entrypoint.subpath,
          slug,
          canonical: entrypoint.subpath === module.source.canonicalSubpath,
          path: apiPagePath(sourcePackage.directoryName, slug),
          page: pageOutputPath(sourcePackage.directoryName, slug),
          imports
        }
      }
    ))
