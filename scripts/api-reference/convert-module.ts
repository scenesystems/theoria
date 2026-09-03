import { FileSystem, Path } from "@effect/platform"
import { Array as Arr, Effect, Option } from "effect"
import { type Application } from "typedoc"

import {
  attachLeadingModuleComment,
  hasCommentSummary,
  hasCommentTag,
  moduleReflection
} from "./comments.js"
import { type ApiConvertedModule } from "./converted.js"
import { ApiReferenceGenerationError } from "./model.js"
import { publicExportsFromReflection } from "./public-exports.js"
import { moduleDisplayName } from "./reflections.js"
import { type ApiSourceModule, type ApiSourcePackage } from "./source.js"

const typeDocFailure = (packageName: string, detail: string): ApiReferenceGenerationError =>
  new ApiReferenceGenerationError({ packageName, detail })

export const convertApiModule = (input: {
  readonly app: Application
  readonly entrypoints: NonNullable<ReturnType<Application["getEntryPoints"]>>
  readonly sourcePackage: ApiSourcePackage
  readonly module: ApiSourceModule
}): Effect.Effect<ApiConvertedModule, ApiReferenceGenerationError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const packageName = input.sourcePackage.manifest.name
    const entrypoint = Arr.findFirst(input.entrypoints, (candidate) =>
      path.resolve(candidate.sourceFile.fileName) === path.resolve(input.module.absolute))

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

    const source = yield* fileSystem.readFileString(input.module.absolute).pipe(Effect.orDie)
    attachLeadingModuleComment({
      app: input.app,
      project,
      reflection: reflection.value,
      source,
      sourcePath: input.module.absolute
    })

    if (!hasCommentSummary(reflection.value) || !hasCommentTag(reflection.value, "@since")) {
      return yield* typeDocFailure(
        packageName,
        `${input.module.relative} is missing module ${hasCommentSummary(reflection.value) ? "@since" : "summary"}`
      )
    }

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
        (publicExports) => ({ entrypoint: routeEntrypoint, publicExports })
      ))

    return { source: input.module, project, reflection: reflection.value, routes }
  })
