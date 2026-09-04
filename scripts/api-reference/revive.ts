import { FileSystem, Path } from "@effect/platform"
import type { PlatformError } from "@effect/platform/Error"
import { Context, Effect, Layer, Option, type ParseResult, Schema } from "effect"
import { Application, FileRegistry, normalizePath, type ProjectReflection } from "typedoc"

import { type ConvertedModule } from "./conversion.js"
import { ApiConvertedModule, ApiSourceComment } from "./converted.js"
import { ApiReferenceGenerationError, ApiReferenceToolchainError } from "./model.js"
import { moduleReflection } from "./module-comment.js"
import { type TypeDocProjectJson, TypeDocProjectJsonText } from "./typedoc-json.js"

/**
 * TypeDoc's serializer and deserializer, without a TypeScript program. The
 * generator revives the projects the conversion processes wrote and
 * serializes them again for the committed reflection files, so every
 * reflection id in the output comes from this one model.
 */
export class TypeDocReflections extends Context.Tag("@theoria/api-reference/TypeDocReflections")<
  TypeDocReflections,
  {
    readonly revive: (
      packageName: string,
      project: TypeDocProjectJson
    ) => Effect.Effect<ProjectReflection, ApiReferenceGenerationError>
    readonly serialize: (project: ProjectReflection) => TypeDocProjectJson
  }
>() {}

export const typeDocReflectionsLayer = (repositoryRoot: string) =>
  Layer.effect(
    TypeDocReflections,
    Effect.gen(function*() {
      const app = yield* Effect.tryPromise({
        try: () => Application.bootstrap({ disableGit: true, pretty: false, readme: "none" }),
        catch: (cause) => new ApiReferenceToolchainError({ detail: `TypeDoc initialization failed: ${String(cause)}` })
      })
      const projectRoot = normalizePath(repositoryRoot)

      return TypeDocReflections.of({
        revive: (packageName, project) =>
          Effect.try({
            // Each project is revived into a registry of its own, as it was serialized.
            try: () =>
              app.deserializer.reviveProject(project.name, project, { projectRoot, registry: new FileRegistry() }),
            catch: (cause) =>
              new ApiReferenceGenerationError({
                packageName,
                detail: `TypeDoc could not revive ${project.name}: ${String(cause)}`
              })
          }),
        serialize: (project) => app.serializer.projectToObject(project, projectRoot)
      })
    })
  )

const readProject = (packageName: string, absolutePath: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const reflections = yield* TypeDocReflections
    const text = yield* fileSystem.readFileString(absolutePath)
    const project = yield* Schema.decode(TypeDocProjectJsonText)(text)
    return yield* reflections.revive(packageName, project)
  })

/** Revives one converted module from the reflections its conversion process wrote under `conversionRoot`. */
export const reviveConvertedModule = (input: {
  readonly conversionRoot: string
  readonly packageName: string
  readonly module: ConvertedModule
}): Effect.Effect<
  ApiConvertedModule,
  ApiReferenceGenerationError | ParseResult.ParseError | PlatformError,
  FileSystem.FileSystem | Path.Path | TypeDocReflections
> =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    const missing = (detail: string) => new ApiReferenceGenerationError({ packageName: input.packageName, detail })
    const project = yield* readProject(input.packageName, path.join(input.conversionRoot, input.module.project))
    const reflection = yield* Option.match(moduleReflection(project), {
      onNone: () => missing(`${input.module.source.relative} has no module reflection after revival`),
      onSome: Effect.succeed
    })
    const sourceComments = yield* Effect.forEach(input.module.sourceProjects, (sourceProject) =>
      Effect.gen(function*() {
        const revived = yield* readProject(input.packageName, path.join(input.conversionRoot, sourceProject.project))
        const comment = yield* Option.match(
          Option.flatMap(moduleReflection(revived), (module) => Option.fromNullable(module.comment)),
          {
            onNone: () => missing(`${sourceProject.source} has no module comment after revival`),
            onSome: Effect.succeed
          }
        )
        return new ApiSourceComment({ source: sourceProject.source, comment })
      }))

    return new ApiConvertedModule({
      source: input.module.source,
      project,
      reflection,
      routes: input.module.routes,
      sourceComments
    })
  })
