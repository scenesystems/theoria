import { Path } from "@effect/platform"
import { Array as Arr, Boolean as Bool, Effect, Option, String as Str } from "effect"
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
  return Bool.match(hasSourceDocumentationPages(input.sourcePackage, input.module), {
    onFalse: () => Effect.succeed(Arr.empty<ApiSourceProject>()),
    onTrue: () => {
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
  })
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
      (candidate) => Str.Equivalence(path.resolve(candidate.sourceFile.fileName), path.resolve(input.module.absolute))
    )

    const resolvedEntrypoint = yield* Option.match(entrypoint, {
      onNone: () => typeDocFailure(packageName, `TypeDoc did not resolve ${input.module.relative}`),
      onSome: Effect.succeed
    })

    resolvedEntrypoint.displayName = moduleDisplayName(packageName, input.module.canonicalSubpath)
    const project = yield* Effect.try({
      try: () => input.app.converter.convert(Arr.make(resolvedEntrypoint)),
      catch: () => typeDocFailure(packageName, `TypeDoc conversion failed for ${input.module.relative}`)
    })

    yield* Effect.when(
      typeDocFailure(
        packageName,
        `TypeDoc reported an error while converting ${input.module.relative}`
      ),
      () => input.app.logger.hasErrors()
    )

    const reflection = yield* Option.match(moduleReflection(project), {
      onNone: () =>
        typeDocFailure(
          packageName,
          `TypeDoc did not create a module reflection for ${input.module.relative}`
        ),
      onSome: Effect.succeed
    })

    yield* requireModuleComment({ packageName, relative: input.module.relative, reflection })

    input.app.validate(project)

    yield* Effect.when(
      typeDocFailure(packageName, `TypeDoc validation failed for ${input.module.relative}`),
      () => input.app.logger.hasErrors()
    )

    const routes = yield* Effect.forEach(input.module.routes, ({ entrypoint: routeEntrypoint }) =>
      Effect.map(
        publicExportsFromReflection({
          path,
          packageName,
          packageRoot: input.sourcePackage.root,
          entrypoint: routeEntrypoint,
          reflection
        }),
        (publicExports): ConvertedRoute => ({ entrypoint: routeEntrypoint, publicExports })
      ))
    const sourceProjects = yield* convertSourceProjects({
      app: input.app,
      entrypoint: resolvedEntrypoint,
      sourcePackage: input.sourcePackage,
      module: input.module,
      routes
    })

    return new ApiModuleConversion({ source: input.module, project, routes, sourceProjects })
  })
