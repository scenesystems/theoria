import { FileSystem, Path } from "@effect/platform"
import { Array as Arr, Console, Effect, Option, Schema } from "effect"
import {
  Application,
  EntryPointStrategy
} from "typedoc"

import {
  attachLeadingModuleComment,
  hasCommentSummary,
  hasCommentTag,
  moduleReflection
} from "./comments.js"
import {
  ApiReferenceGenerationError,
  type ApiReferenceManifest,
  ApiReferenceManifestJson,
  type ApiReferenceModule,
  type ApiReferencePackage
} from "./model.js"
import { makeRoutes, moduleDisplayName, moduleOutputPath } from "./reflections.js"
import { type ApiSourceModule, type ApiSourcePackage } from "./source.js"

const repositoryUrl = "https://github.com/scenesystems/theoria"

const typeDocFailure = (packageName: string, detail: string): ApiReferenceGenerationError =>
  new ApiReferenceGenerationError({ packageName, detail })

const sha256File = (filePath: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const bytes = yield* fileSystem.readFile(filePath).pipe(Effect.orDie)

    return yield* Effect.sync(() => new Bun.CryptoHasher("sha256").update(bytes).digest("hex"))
  })

const bootstrapTypeDoc = (
  repositoryRoot: string,
  revision: string,
  sourcePackage: ApiSourcePackage
) =>
  Effect.tryPromise({
    try: () => Application.bootstrap({
      name: sourcePackage.manifest.name,
      entryPoints: Arr.map(sourcePackage.modules, (module) => module.absolute),
      entryPointStrategy: EntryPointStrategy.Resolve,
      tsconfig: `${sourcePackage.root}/tsconfig.src.json`,
      basePath: repositoryRoot,
      displayBasePath: repositoryRoot,
      gitRevision: revision,
      alwaysCreateEntryPointModule: true,
      excludeInternal: true,
      excludePrivate: true,
      excludeProtected: true,
      pretty: false,
      readme: "none",
      validation: {
        invalidLink: false,
        notDocumented: false,
        notExported: false
      },
      treatWarningsAsErrors: true
    }),
    catch: () => typeDocFailure(sourcePackage.manifest.name, "TypeDoc initialization failed")
  })

const generateModule = (input: {
  readonly app: Application
  readonly entrypoints: NonNullable<ReturnType<Application["getEntryPoints"]>>
  readonly outputRoot: string
  readonly packageSlug: string
  readonly revision: string
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

    const generatedModule: ApiReferenceModule = {
      source: input.module.relative,
      sourceUrl,
      reflection: relativeOutput.split(path.sep).join("/"),
      reflectionSha256,
      reflectionId: reflection.value.id,
      routes
    }

    return generatedModule
  })

const generatePackage = (input: {
  readonly repositoryRoot: string
  readonly outputRoot: string
  readonly revision: string
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
    const modules = yield* Effect.forEach(
      input.sourcePackage.modules,
      (module) => generateModule({ ...input, app, entrypoints, packageSlug, module }),
      { concurrency: 1 }
    )

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

    return generatedPackage
  })

export const generateApiReference = (input: {
  readonly repositoryRoot: string
  readonly outputRoot: string
  readonly revision: string
  readonly sourcePackages: ReadonlyArray<ApiSourcePackage>
}) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    yield* fileSystem.remove(input.outputRoot, { recursive: true, force: true }).pipe(Effect.orDie)
    yield* fileSystem.makeDirectory(input.outputRoot, { recursive: true }).pipe(Effect.orDie)

    const packages = yield* Effect.forEach(
      input.sourcePackages,
      (sourcePackage) => generatePackage({ ...input, sourcePackage }),
      { concurrency: 1 }
    )
    const manifest: ApiReferenceManifest = {
      schemaVersion: 1,
      typedocVersion: Application.VERSION,
      revision: input.revision,
      packages
    }
    const manifestJson = yield* Schema.encode(ApiReferenceManifestJson)(manifest).pipe(Effect.orDie)
    yield* fileSystem.writeFileString(path.join(input.outputRoot, "manifest.json"), `${manifestJson}\n`).pipe(Effect.orDie)

    return manifest
  })
