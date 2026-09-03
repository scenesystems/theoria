import { Array as Arr, Effect } from "effect"
import { Application, EntryPointStrategy } from "typedoc"

import { ApiReferenceGenerationError } from "./model.js"
import { type ApiSourcePackage } from "./source.js"

const repositoryUrl = "https://github.com/scenesystems/theoria"

/**
 * Source links are pinned to the revision being documented. The template is
 * supplied directly instead of letting TypeDoc discover it from git: TypeDoc
 * only recognises a `.git` directory, so discovery fails in git worktrees, and
 * the repository URL is fixed anyway.
 */
const sourceLinkTemplate = `${repositoryUrl}/blob/{gitRevision}/{path}#L{line}`

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
      disableGit: true,
      sourceLinkTemplate,
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
