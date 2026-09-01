import { FileSystem, Path } from "@effect/platform"
import { Array as Arr, Effect, Option } from "effect"
import { type Application } from "typedoc"

import { writeBrowserApiModule } from "./browser-output.js"
import {
  attachLeadingModuleComment,
  hasCommentSummary,
  hasCommentTag,
  moduleReflection
} from "./comments.js"
import { type ApiDocLink } from "./links.js"
import {
  ApiReferenceGenerationError,
  type ApiReferenceModule
} from "./model.js"
import { sha256File, writeApiPage } from "./output.js"
import { makeRoutes, moduleDisplayName, moduleOutputPath } from "./reflections.js"
import { type ApiSourceModule, type ApiSourcePackage } from "./source.js"
import { makeApiPresentation } from "./typedoc-presentation.js"

const repositoryUrl = "https://github.com/scenesystems/theoria"

const typeDocFailure = (packageName: string, detail: string): ApiReferenceGenerationError =>
  new ApiReferenceGenerationError({ packageName, detail })

export const generateApiModule = (input: {
  readonly app: Application
  readonly browserVersionRoot: string
  readonly entrypoints: NonNullable<ReturnType<Application["getEntryPoints"]>>
  readonly outputRoot: string
  readonly packageSlug: string
  readonly revision: string
  readonly links: ReadonlyArray<ApiDocLink>
  readonly sourcePackage: ApiSourcePackage
  readonly module: ApiSourceModule
}) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const entrypoint = Arr.findFirst(input.entrypoints, (candidate) =>
      path.resolve(candidate.sourceFile.fileName) === path.resolve(input.module.absolute))

    if (Option.isNone(entrypoint)) {
      return yield* Effect.fail(typeDocFailure(
        input.sourcePackage.manifest.name,
        `TypeDoc did not resolve ${input.module.relative}`
      ))
    }

    entrypoint.value.displayName = moduleDisplayName(
      input.sourcePackage.manifest.name,
      input.module.canonicalSubpath
    )
    const project = yield* Effect.try({
      try: () => input.app.converter.convert([entrypoint.value]),
      catch: () => typeDocFailure(
        input.sourcePackage.manifest.name,
        `TypeDoc conversion failed for ${input.module.relative}`
      )
    })

    if (input.app.logger.hasErrors()) {
      return yield* Effect.fail(typeDocFailure(
        input.sourcePackage.manifest.name,
        `TypeDoc reported an error while converting ${input.module.relative}`
      ))
    }

    const reflection = moduleReflection(project)

    if (Option.isNone(reflection)) {
      return yield* Effect.fail(typeDocFailure(
        input.sourcePackage.manifest.name,
        `TypeDoc did not create a module reflection for ${input.module.relative}`
      ))
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
      return yield* Effect.fail(typeDocFailure(
        input.sourcePackage.manifest.name,
        `${input.module.relative} is missing module ${hasCommentSummary(reflection.value) ? "@since" : "summary"}`
      ))
    }

    input.app.validate(project)

    if (input.app.logger.hasErrors()) {
      return yield* Effect.fail(typeDocFailure(
        input.sourcePackage.manifest.name,
        `TypeDoc validation failed for ${input.module.relative}`
      ))
    }

    const relativeOutput = moduleOutputPath(path, input.packageSlug, input.module.canonicalSubpath)
    const absoluteOutput = path.join(input.outputRoot, relativeOutput)
    yield* fileSystem.makeDirectory(path.dirname(absoluteOutput), { recursive: true }).pipe(Effect.orDie)
    yield* Effect.tryPromise({
      try: () => input.app.generateJson(project, absoluteOutput),
      catch: () => typeDocFailure(
        input.sourcePackage.manifest.name,
        `could not write reflection for ${input.module.relative}`
      )
    })

    const reflectionSha256 = yield* sha256File(absoluteOutput)
    const sourceUrl = `${repositoryUrl}/blob/${input.revision}/packages/${input.packageSlug}/${input.module.relative}`
    const routes = yield* makeRoutes(input.sourcePackage, input.module, reflection.value)
    const presentation = yield* makeApiPresentation({
      packageName: input.sourcePackage.manifest.name,
      packageVersion: input.sourcePackage.manifest.version,
      packageSlug: input.packageSlug,
      packageDescription: input.sourcePackage.description,
      moduleReflection: reflection.value,
      moduleSourceUrl: sourceUrl,
      routes,
      links: input.links
    })
    yield* Effect.forEach(
      Arr.zip(routes, presentation.pages),
      ([route, page]) => writeApiPage(input.outputRoot, route.page, page)
    )
    const apiModule = yield* writeBrowserApiModule({
      browserVersionRoot: input.browserVersionRoot,
      packageName: input.sourcePackage.manifest.name,
      routes,
      pages: presentation.pages,
      revision: input.revision
    })

    const generatedModule: ApiReferenceModule = {
      source: input.module.relative,
      sourceUrl,
      reflection: relativeOutput.split(path.sep).join("/"),
      reflectionSha256,
      reflectionId: reflection.value.id,
      routes
    }

    return { module: generatedModule, apiModule, searchEntries: presentation.searchEntries }
  })
