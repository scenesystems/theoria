import { Array as Arr, Effect } from "effect"
import { Application, EntryPointStrategy } from "typedoc"

import { ApiReferenceGenerationError } from "./model.js"
import { type ApiSourcePackage } from "./source.js"

export const bootstrapTypeDoc = (
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
    catch: () => new ApiReferenceGenerationError({
      packageName: sourcePackage.manifest.name,
      detail: "TypeDoc initialization failed"
    })
  })
