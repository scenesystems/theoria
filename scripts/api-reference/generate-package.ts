import { FileSystem } from "@effect/platform"
import { Array as Arr, Console, Effect, Option, Order } from "effect"

import { type DocsPackageSummary } from "@theoria/docs-model"
import { writeBrowserGuides } from "./browser-output.js"
import { type ApiConvertedPackage } from "./converted.js"
import { generateApiModule } from "./generate-module.js"
import { buildPackageGuides, type PackageGuideExample } from "./guides.js"
import { type ApiDocLink } from "./links.js"
import { ApiReferenceGenerationError, type ApiReferencePackage } from "./model.js"

const repositoryUrl = "https://github.com/scenesystems/theoria"

const exampleTitle = (fileName: string): string => {
  const title = fileName
    .replace(/\.ts$/u, "")
    .replace(/^\d+-/u, "")
    .replace(/-/gu, " ")

  return title.length === 0 ? "Example" : `${title[0]?.toLocaleUpperCase("en-US") ?? ""}${title.slice(1)}`
}

const exampleSource = (source: string): string => source.replace(/^\/\*\*[\s\S]*?\*\/\s*/u, "")

export const generateApiPackage = (input: {
  readonly browserVersionRoot: string
  readonly repositoryRoot: string
  readonly outputRoot: string
  readonly revision: string
  readonly links: ReadonlyArray<ApiDocLink>
  readonly converted: ApiConvertedPackage
}) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const { app, sourcePackage } = input.converted
    const packageSlug = sourcePackage.directoryName
    const generatedModules = yield* Effect.forEach(
      input.converted.modules,
      (module) => generateApiModule({ ...input, app, packageSlug, sourcePackage, module }),
      { concurrency: 1 }
    )
    const modules = Arr.map(generatedModules, (generated) => generated.module)
    const markdown = yield* fileSystem.readFileString(`${sourcePackage.root}/README.md`).pipe(Effect.orDie)
    const exampleFiles = yield* fileSystem.readDirectory(`${sourcePackage.root}/examples`).pipe(
      Effect.orDie,
      Effect.map((entries) => Arr.sort(Arr.filter(entries, (entry) => entry.endsWith(".ts")), Order.string))
    )
    const exampleFile = yield* Option.match(Arr.head(exampleFiles), {
      onNone: () =>
        new ApiReferenceGenerationError({
          packageName: sourcePackage.manifest.name,
          detail: "public package has no TypeScript example"
        }),
      onSome: Effect.succeed
    })
    const source = yield* fileSystem.readFileString(`${sourcePackage.root}/examples/${exampleFile}`).pipe(
      Effect.orDie
    )
    const example: PackageGuideExample = { source: exampleSource(source), title: exampleTitle(exampleFile) }
    const guideData = buildPackageGuides({ ...input, sourcePackage, example: Option.some(example), markdown })
    yield* writeBrowserGuides({ ...input, ...guideData })

    yield* Console.log(
      `✓ ${sourcePackage.manifest.name}: ${String(modules.length)} semantic modules, ${
        String(modules.reduce((count, module) => count + module.routes.length, 0))
      } public routes`
    )

    const generatedPackage: ApiReferencePackage = {
      name: sourcePackage.manifest.name,
      version: sourcePackage.manifest.version,
      slug: packageSlug,
      description: sourcePackage.description,
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
      apiModules: Arr.flatMap(generatedModules, (generated) => generated.apiModules)
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
