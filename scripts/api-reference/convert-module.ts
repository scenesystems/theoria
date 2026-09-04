import { Path } from "@effect/platform"
import { Array as Arr, Effect, Option } from "effect"
import { type Application, type DocumentationEntryPoint } from "typedoc"

import { type ConvertedRoute } from "./conversion.js"
import { ApiModuleConversion, ApiSourceProject } from "./converted.js"
import {
  hasSourceDocumentationPages,
  sourceDocumentationFiles,
  sourceDocumentationSlug
} from "./documentation-routes.js"
import { ApiReferenceGenerationError } from "./model.js"
import { moduleReflection, requireModuleComment, sourceFileModuleProject } from "./module-comment.js"
import { publicExportsFromReflection } from "./public-exports.js"
import { moduleDisplayName } from "./reflections.js"
import { type ApiSourceModule, type ApiSourcePackage } from "./source.js"

const typeDocFailure = (packageName: string, detail: string): ApiReferenceGenerationError =>
  new ApiReferenceGenerationError({ packageName, detail })

// Source files that get their own page are converted while the module's
// TypeScript program is loaded anyway.
const convertSourceProjects = (input: {
  readonly app: Application
  readonly entrypoint: DocumentationEntryPoint
  readonly sourcePackage: ApiSourcePackage
  readonly module: ApiSourceModule
  readonly routes: ReadonlyArray<ConvertedRoute>
}): Effect.Effect<ReadonlyArray<ApiSourceProject>, ApiReferenceGenerationError> => {
  if (!hasSourceDocumentationPages(input.sourcePackage, input.module)) {
    return Effect.succeed([])
  }

  const publicExports = Arr.flatMap(input.routes, (route) => route.publicExports)

  return Effect.forEach(sourceDocumentationFiles(input.module, publicExports), (sourceFile) =>
    Effect.map(
      sourceFileModuleProject({
        app: input.app,
        entrypoint: input.entrypoint,
        packageName: input.sourcePackage.manifest.name,
        displayName: sourceDocumentationSlug(sourceFile.relative),
        sourceFile
      }),
      (project) => new ApiSourceProject({ source: sourceFile.relative, project })
    ))
}

export const convertApiModule = (input: {
  readonly app: Application
  readonly entrypoints: ReadonlyArray<DocumentationEntryPoint>
  readonly sourcePackage: ApiSourcePackage
  readonly module: ApiSourceModule
}): Effect.Effect<ApiModuleConversion, ApiReferenceGenerationError, Path.Path> =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    const packageName = input.sourcePackage.manifest.name
    const entrypoint = Arr.findFirst(
      input.entrypoints,
      (candidate) => path.resolve(candidate.sourceFile.fileName) === path.resolve(input.module.absolute)
    )

    if (Option.isNone(entrypoint)) {
      return yield* typeDocFailure(packageName, `TypeDoc did not resolve ${input.module.relative}`)
    }

    entrypoint.value.displayName = moduleDisplayName(packageName, input.module.canonicalSubpath)
    const project = yield* Effect.try({
      try: () => input.app.converter.convert([entrypoint.value]),
      catch: () => typeDocFailure(packageName, `TypeDoc conversion failed for ${input.module.relative}`)
    })

    if (input.app.logger.hasErrors()) {
      return yield* typeDocFailure(
        packageName,
        `TypeDoc reported an error while converting ${input.module.relative}`
      )
    }

    const reflection = moduleReflection(project)

    if (Option.isNone(reflection)) {
      return yield* typeDocFailure(
        packageName,
        `TypeDoc did not create a module reflection for ${input.module.relative}`
      )
    }

    yield* requireModuleComment({ packageName, relative: input.module.relative, reflection: reflection.value })

    input.app.validate(project)

    if (input.app.logger.hasErrors()) {
      return yield* typeDocFailure(packageName, `TypeDoc validation failed for ${input.module.relative}`)
    }

    const routes = yield* Effect.forEach(input.module.routes, ({ entrypoint: routeEntrypoint }) =>
      Effect.map(
        publicExportsFromReflection({
          path,
          packageName,
          packageRoot: input.sourcePackage.root,
          entrypoint: routeEntrypoint,
          reflection: reflection.value
        }),
        (publicExports): ConvertedRoute => ({ entrypoint: routeEntrypoint, publicExports })
      ))
    const sourceProjects = yield* convertSourceProjects({
      app: input.app,
      entrypoint: entrypoint.value,
      sourcePackage: input.sourcePackage,
      module: input.module,
      routes
    })

    return new ApiModuleConversion({ source: input.module, project, routes, sourceProjects })
  })
