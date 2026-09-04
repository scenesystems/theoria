import { Effect, Option } from "effect"

import { convertApiModule } from "./convert-module.js"
import { ApiPackageConversion } from "./converted.js"
import { ApiReferenceGenerationError } from "./model.js"
import { type ApiSourcePackage } from "./source.js"
import { bootstrapTypeDoc } from "./typedoc-application.js"

export const convertApiPackage = (input: {
  readonly repositoryRoot: string
  readonly revision: string
  readonly sourcePackage: ApiSourcePackage
}) =>
  Effect.gen(function*() {
    const packageName = input.sourcePackage.manifest.name
    const app = yield* bootstrapTypeDoc(input.repositoryRoot, input.revision, input.sourcePackage)

    if (app.logger.hasErrors()) {
      return yield* new ApiReferenceGenerationError({ packageName, detail: "TypeDoc initialization failed" })
    }

    const resolvedEntrypoints = Option.fromNullable(app.getEntryPoints())

    if (app.logger.hasErrors()) {
      return yield* new ApiReferenceGenerationError({ packageName, detail: "TypeDoc entrypoint resolution failed" })
    }

    const entrypoints = yield* resolvedEntrypoints.pipe(
      Effect.mapError(() => new ApiReferenceGenerationError({ packageName, detail: "TypeDoc found no entrypoints" }))
    )

    yield* Effect.tryPromise({
      try: () => app.initializeRepositories(entrypoints),
      catch: () => new ApiReferenceGenerationError({ packageName, detail: "source URL initialization failed" })
    })

    const modules = yield* Effect.forEach(
      input.sourcePackage.modules,
      (module) => convertApiModule({ app, entrypoints, sourcePackage: input.sourcePackage, module })
    )

    return new ApiPackageConversion({ app, sourcePackage: input.sourcePackage, modules })
  })
