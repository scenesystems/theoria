import { FileSystem } from "@effect/platform"
import { Array as Arr, Console, Effect, Option, Order } from "effect"

import { type DocsPackageSummary } from "@theoria/docs-model"
import { writeBrowserGuides } from "./browser-output.js"
import { generateApiModule } from "./generate-module.js"
import { buildPackageGuides, type PackageGuideExample } from "./guides.js"
import { type ApiDocLink } from "./links.js"
import {
  ApiReferenceGenerationError,
  type ApiReferencePackage
} from "./model.js"
import { type ApiSourcePackage } from "./source.js"
import { bootstrapTypeDoc } from "./typedoc-application.js"

const repositoryUrl = "https://github.com/scenesystems/theoria"

const typeDocFailure = (packageName: string, detail: string): ApiReferenceGenerationError =>
  new ApiReferenceGenerationError({ packageName, detail })

const exampleTitle = (fileName: string): string => {
  const title = fileName
    .replace(/\.ts$/u, "")
    .replace(/^\d+-/u, "")
    .replace(/-/gu, " ")

  return title.length === 0 ? "Example" : `${title[0]?.toLocaleUpperCase("en-US") ?? ""}${title.slice(1)}`
}

const exampleSource = (source: string): string =>
  source.replace(/^\/\*\*[\s\S]*?\*\/\s*/u, "")

export const generateApiPackage = (input: {
  readonly browserVersionRoot: string
  readonly repositoryRoot: string
  readonly outputRoot: string
  readonly revision: string
  readonly links: ReadonlyArray<ApiDocLink>
  readonly sourcePackage: ApiSourcePackage
}) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
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
      (module) => generateApiModule({ ...input, app, entrypoints, packageSlug, module }),
      { concurrency: 1 }
    )
    const modules = Arr.map(generatedModules, (generated) => generated.module)
    const markdown = yield* fileSystem.readFileString(`${input.sourcePackage.root}/README.md`).pipe(Effect.orDie)
    const exampleFiles = yield* fileSystem.readDirectory(`${input.sourcePackage.root}/examples`).pipe(
      Effect.orDie,
      Effect.map((entries) => Arr.sort(Arr.filter(entries, (entry) => entry.endsWith(".ts")), Order.string))
    )
    const exampleFile = yield* Option.match(Arr.head(exampleFiles), {
      onNone: () => Effect.fail(typeDocFailure(
        input.sourcePackage.manifest.name,
        "public package has no TypeScript example"
      )),
      onSome: Effect.succeed
    })
    const source = yield* fileSystem.readFileString(`${input.sourcePackage.root}/examples/${exampleFile}`).pipe(
      Effect.orDie
    )
    const example: PackageGuideExample = { source: exampleSource(source), title: exampleTitle(exampleFile) }
    const guideData = buildPackageGuides({ ...input, example: Option.some(example), markdown })
    yield* writeBrowserGuides({ ...input, ...guideData })

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
    const docsPackage: DocsPackageSummary = {
      name: generatedPackage.name,
      version: generatedPackage.version,
      slug: packageSlug,
      description: generatedPackage.description,
      npmUrl: `https://www.npmjs.com/package/${generatedPackage.name}`,
      repositoryUrl: `${repositoryUrl}/tree/${input.revision}/packages/${packageSlug}`,
      overview: guideData.overview,
      guides: guideData.guides,
      apiModules: Arr.map(generatedModules, (generated) => generated.apiModule)
    }

    return {
      package: generatedPackage,
      docsPackage,
      searchEntries: [
        ...guideData.searchEntries,
        ...Arr.flatMap(generatedModules, (generated) => generated.searchEntries)
      ]
    }
  })
