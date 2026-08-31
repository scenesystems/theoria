import { FileSystem, Path } from "@effect/platform"
import { Array as Arr, Console, Effect, Option } from "effect"
import { Application } from "typedoc"

import {
  attachLeadingModuleComment,
  hasCommentSummary,
  hasCommentTag,
  moduleReflection
} from "./comments.js"
import { makeApiDocLinks, type ApiDocLink } from "./links.js"
import {
  ApiReferenceGenerationError,
  type ApiReferenceManifest,
  type ApiReferenceModule,
  type ApiReferencePackage
} from "./model.js"
import {
  sha256File,
  writeApiManifest,
  writeApiPage,
  writeApiSearchIndex
} from "./output.js"
import { type ApiSearchIndex } from "./presentation-model.js"
import { makeRoutes, moduleDisplayName, moduleOutputPath } from "./reflections.js"
import { type ApiSourceModule, type ApiSourcePackage } from "./source.js"
import { bootstrapTypeDoc } from "./typedoc-application.js"
import { makeApiPresentation } from "./typedoc-presentation.js"

const repositoryUrl = "https://github.com/scenesystems/theoria"

const typeDocFailure = (packageName: string, detail: string): ApiReferenceGenerationError =>
  new ApiReferenceGenerationError({ packageName, detail })

const generateModule = (input: {
  readonly app: Application
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

    const generatedModule: ApiReferenceModule = {
      source: input.module.relative,
      sourceUrl,
      reflection: relativeOutput.split(path.sep).join("/"),
      reflectionSha256,
      reflectionId: reflection.value.id,
      routes
    }

    return { module: generatedModule, searchEntries: presentation.searchEntries }
  })

const generatePackage = (input: {
  readonly repositoryRoot: string
  readonly outputRoot: string
  readonly revision: string
  readonly links: ReadonlyArray<ApiDocLink>
  readonly sourcePackage: ApiSourcePackage
}) =>
  Effect.gen(function*() {
    const app = yield* bootstrapTypeDoc(input.repositoryRoot, input.revision, input.sourcePackage)

    if (app.logger.hasErrors()) {
      return yield* Effect.fail(typeDocFailure(input.sourcePackage.manifest.name, "TypeDoc initialization failed"))
    }

    const entrypoints = app.getEntryPoints()

    if (app.logger.hasErrors()) {
      return yield* Effect.fail(typeDocFailure(input.sourcePackage.manifest.name, "TypeDoc entrypoint resolution failed"))
    }

    if (entrypoints === undefined) {
      return yield* Effect.fail(typeDocFailure(input.sourcePackage.manifest.name, "TypeDoc found no entrypoints"))
    }

    yield* Effect.tryPromise({
      try: () => app.initializeRepositories(entrypoints),
      catch: () => typeDocFailure(input.sourcePackage.manifest.name, "source URL initialization failed")
    })

    const packageSlug = input.sourcePackage.directoryName
    const generatedModules = yield* Effect.forEach(
      input.sourcePackage.modules,
      (module) => generateModule({ ...input, app, entrypoints, packageSlug, module }),
      { concurrency: 1 }
    )
    const modules = Arr.map(generatedModules, (generated) => generated.module)

    yield* Console.log(
      `✓ ${input.sourcePackage.manifest.name}: ${String(modules.length)} semantic modules, ${String(modules.reduce((count, module) => count + module.routes.length, 0))} public routes`
    )

    const generatedPackage: ApiReferencePackage = {
      name: input.sourcePackage.manifest.name,
      version: input.sourcePackage.manifest.version,
      slug: packageSlug,
      description: input.sourcePackage.description,
      modules
    }

    return {
      package: generatedPackage,
      searchEntries: Arr.flatMap(generatedModules, (generated) => generated.searchEntries)
    }
  })

export const generateApiReference = (input: {
  readonly repositoryRoot: string
  readonly outputRoot: string
  readonly revision: string
  readonly sourcePackages: ReadonlyArray<ApiSourcePackage>
}) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const links = makeApiDocLinks(input.sourcePackages)
    yield* fileSystem.remove(input.outputRoot, { recursive: true, force: true }).pipe(Effect.orDie)
    yield* fileSystem.makeDirectory(input.outputRoot, { recursive: true }).pipe(Effect.orDie)

    const generatedPackages = yield* Effect.forEach(
      input.sourcePackages,
      (sourcePackage) => generatePackage({ ...input, links, sourcePackage }),
      { concurrency: 1 }
    )
    const packages = Arr.map(generatedPackages, (generated) => generated.package)
    const manifest: ApiReferenceManifest = {
      schemaVersion: 2,
      typedocVersion: Application.VERSION,
      revision: input.revision,
      packages
    }
    const searchIndex: ApiSearchIndex = {
      schemaVersion: 1,
      entries: Arr.flatMap(generatedPackages, (generated) => generated.searchEntries)
    }
    yield* writeApiManifest(input.outputRoot, manifest)
    yield* writeApiSearchIndex(input.outputRoot, searchIndex)

    return manifest
  })
