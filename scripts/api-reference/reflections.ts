import type { Path } from "@effect/platform"
import { Array as Arr, Boolean as Bool, Effect, Option, String as Str } from "effect"
import { type DeclarationReflection, ReflectionKind } from "typedoc"

import { type ApiConvertedModule } from "./converted.js"
import { ApiReferenceGenerationError, type ApiReferenceImport, type ApiReferenceRoute } from "./model.js"
import { type ApiSourcePackage } from "./source.js"

export const routeSlug = (subpath: string): string =>
  Bool.match(Str.Equivalence(subpath, "."), { onTrue: () => "", onFalse: () => Str.replace(/^\.\//u, "")(subpath) })

export const apiPagePath = (packageSlug: string, slug: string): string =>
  `/docs/${packageSlug}/api${Bool.match(Str.isEmpty(slug), { onTrue: () => "", onFalse: () => `/${slug}` })}`

export const pageOutputPath = (packageSlug: string, slug: string): string =>
  `packages/${packageSlug}/pages/${Bool.match(Str.isEmpty(slug), { onTrue: () => "index", onFalse: () => slug })}.json`

export const moduleOutputPath = (path: Path.Path, packageSlug: string, subpath: string): string => {
  const segments = Arr.filter(Str.split(routeSlug(subpath), "/"), Str.isNonEmpty)
  const moduleSegments = Option.match(Arr.last(segments), {
    onNone: () => Arr.make("index.json"),
    onSome: (last) => Arr.append(Arr.dropRight(segments, 1), `${last}.json`)
  })
  return path.join(
    "packages",
    packageSlug,
    "modules",
    ...moduleSegments
  )
}

export const moduleDisplayName = (packageName: string, subpath: string): string =>
  Bool.match(Str.Equivalence(subpath, "."), {
    onTrue: () => packageName,
    onFalse: () => `${packageName}/${Str.replace(/^\.\//u, "")(subpath)}`
  })

const firstSourceUrl = (reflection: DeclarationReflection): Option.Option<string> =>
  Arr.findFirst(
    Option.fromNullable(reflection.sources).pipe(Option.getOrElse(Arr.empty)),
    (source) => Option.fromNullable(source.url)
  )

const reflectionsForImport = (
  reflection: DeclarationReflection,
  exportName: string
): ReadonlyArray<DeclarationReflection> =>
  Arr.filter(
    Option.fromNullable(reflection.children).pipe(Option.getOrElse(Arr.empty)),
    (child) => Str.Equivalence(child.name, exportName)
  )

const makeImports = (
  packageName: string,
  module: ApiConvertedModule,
  reflection: DeclarationReflection,
  subpath: string
) => {
  const route = Arr.findFirst(module.routes, (candidate) => Str.Equivalence(candidate.entrypoint.subpath, subpath))

  return Option.match(route, {
    onNone: () => Effect.succeed<ReadonlyArray<ApiReferenceImport>>([]),
    onSome: ({ publicExports }) =>
      Effect.forEach(publicExports, (entry) =>
        Effect.gen(function*() {
          const semanticReflections = reflectionsForImport(reflection, entry.exportName)

          yield* Effect.when(
            new ApiReferenceGenerationError({
              packageName,
              detail: `${subpath} export ${entry.exportName} has no semantic TypeDoc reflection`
            }),
            () => Arr.isEmptyReadonlyArray(semanticReflections)
          )

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
          canonical: Str.Equivalence(entrypoint.subpath, module.source.canonicalSubpath),
          path: apiPagePath(sourcePackage.directoryName, slug),
          page: pageOutputPath(sourcePackage.directoryName, slug),
          imports
        }
      }
    ))
