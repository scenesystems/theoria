import { FileSystem, Path } from "@effect/platform"
import { Effect, Option, Schema } from "effect"
import { type Application, normalizePath, type ProjectReflection } from "typedoc"

import {
  conversionRequestConfig,
  type ConvertedModule,
  type ConvertedPackage,
  convertedPackagePath,
  ConvertedPackageText,
  type ConvertedSourceProject
} from "./conversion.js"
import { convertApiPackage } from "./convert-package.js"
import { type ApiModuleConversion, type ApiSourceProject } from "./converted.js"
import { sourceDocumentationSlug } from "./documentation-routes.js"
import { ApiReferenceGenerationError } from "./model.js"
import { moduleOutputPath } from "./reflections.js"
import { loadApiSourcePackage } from "./source.js"
import { TypeDocProjectJsonText } from "./typedoc-json.js"

// Reflections are serialized against the repository root so the committed
// output does not depend on the directory the generator was started from.
const writeProject = (input: {
  readonly app: Application
  readonly repositoryRoot: string
  readonly outputDirectory: string
  readonly relativeOutput: string
  readonly project: ProjectReflection
}) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const absoluteOutput = path.join(input.outputDirectory, input.relativeOutput)
    const serialized = input.app.serializer.projectToObject(input.project, normalizePath(input.repositoryRoot))
    const text = yield* Schema.encode(TypeDocProjectJsonText)(serialized)
    yield* fileSystem.makeDirectory(path.dirname(absoluteOutput), { recursive: true })
    yield* fileSystem.writeFileString(absoluteOutput, text)
    return input.relativeOutput
  })

const writeModule = (input: {
  readonly app: Application
  readonly repositoryRoot: string
  readonly outputDirectory: string
  readonly packageSlug: string
  readonly module: ApiModuleConversion
}) =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    const project = yield* writeProject({
      ...input,
      relativeOutput: moduleOutputPath(path, input.packageSlug, input.module.source.canonicalSubpath),
      project: input.module.project
    })
    const sourceProjects = yield* Effect.forEach(input.module.sourceProjects, (sourceProject: ApiSourceProject) =>
      Effect.map(
        writeProject({
          ...input,
          relativeOutput: path.join(
            "packages",
            input.packageSlug,
            "sources",
            `${sourceDocumentationSlug(sourceProject.source)}.json`
          ),
          project: sourceProject.project
        }),
        (relativeOutput): ConvertedSourceProject => ({ source: sourceProject.source, project: relativeOutput })
      ))
    const converted: ConvertedModule = {
      source: input.module.source,
      project,
      routes: input.module.routes,
      sourceProjects
    }
    return converted
  })

/**
 * Converts the one package named by the conversion request and writes its
 * summary and serialized reflections into the requested output directory.
 * Runs in a process of its own; see ./conversion.ts.
 */
export const convertPackageProgram = Effect.gen(function*() {
  const request = yield* conversionRequestConfig
  const fileSystem = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const sourcePackage = yield* loadApiSourcePackage(
    path.join(request.repositoryRoot, "packages"),
    request.packageDirectory
  ).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () =>
          new ApiReferenceGenerationError({
            packageName: request.packageDirectory,
            detail: "is not a public package"
          }),
        onSome: Effect.succeed
      })
    )
  )
  const conversion = yield* convertApiPackage({ ...request, sourcePackage })
  const modules = yield* Effect.forEach(conversion.modules, (module) =>
    writeModule({
      app: conversion.app,
      repositoryRoot: request.repositoryRoot,
      outputDirectory: request.outputDirectory,
      packageSlug: sourcePackage.directoryName,
      module
    }))
  const converted: ConvertedPackage = { sourcePackage, modules }
  const text = yield* Schema.encode(ConvertedPackageText)(converted)
  yield* fileSystem.writeFileString(
    path.join(request.outputDirectory, convertedPackagePath(path, sourcePackage.directoryName)),
    text
  )
})
