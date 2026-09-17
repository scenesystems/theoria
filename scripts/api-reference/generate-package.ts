import { FileSystem } from "@effect/platform"
import { Array as Arr, Boolean as Bool, Console, Effect, Number as Num, Option, Order, pipe, Schema } from "effect"
import * as Str from "effect/String"

import { type DocsPackageSummary } from "@theoria/docs-model"
import { writeBrowserGuides } from "./browser-output.js"
import { type ConvertedPackage } from "./conversion.js"
import { generateApiModule } from "./generate-module.js"
import { buildPackageGuides, type PackageGuideExample } from "./guides.js"
import { type ApiDocLink } from "./links.js"
import { ApiReferenceGenerationError, type ApiReferencePackage } from "./model.js"
import { reviveConvertedModule } from "./revive.js"

const repositoryUrl = "https://github.com/scenesystems/theoria"
const numberText = Schema.encodeSync(Schema.NumberFromString)

const exampleTitle = (fileName: string): string => {
  const title = pipe(
    fileName,
    Str.replace(/\.ts$/u, ""),
    Str.replace(/^\d+-/u, ""),
    Str.replace(/-/gu, " ")
  )

  return Bool.match(Str.isEmpty(title), {
    onTrue: () => "Example",
    onFalse: () => Str.concat(Str.toUpperCase(Str.slice(0, 1)(title)), Str.slice(1)(title))
  })
}

const exampleSource = Str.replace(/^\/\*\*[\s\S]*?\*\/\s*/u, "")

export const generateApiPackage = (input: {
  readonly browserVersionRoot: string
  readonly repositoryRoot: string
  readonly outputRoot: string
  readonly revision: string
  readonly links: ReadonlyArray<ApiDocLink>
  readonly conversionRoot: string
  readonly converted: ConvertedPackage
}) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const { sourcePackage } = input.converted
    const packageName = sourcePackage.manifest.name
    const packageSlug = sourcePackage.directoryName
    // Modules are revived one at a time: only the module whose pages are being
    // written has its reflections in memory.
    const generatedModules = yield* Effect.forEach(input.converted.modules, (converted) =>
      Effect.flatMap(
        reviveConvertedModule({ conversionRoot: input.conversionRoot, packageName, module: converted }),
        (module) => generateApiModule({ ...input, packageSlug, sourcePackage, module })
      ))
    const modules = Arr.map(generatedModules, (generated) => generated.module)
    const markdown = yield* fileSystem.readFileString(`${sourcePackage.root}/README.md`)
    const exampleFiles = yield* fileSystem.readDirectory(`${sourcePackage.root}/examples`).pipe(
      Effect.map((entries) => Arr.sort(Arr.filter(entries, Str.endsWith(".ts")), Order.string))
    )
    const exampleFile = yield* Option.match(Arr.head(exampleFiles), {
      onNone: () =>
        new ApiReferenceGenerationError({
          packageName: sourcePackage.manifest.name,
          detail: "public package has no TypeScript example"
        }),
      onSome: Effect.succeed
    })
    const source = yield* fileSystem.readFileString(`${sourcePackage.root}/examples/${exampleFile}`)
    const example: PackageGuideExample = { source: exampleSource(source), title: exampleTitle(exampleFile) }
    const guideData = buildPackageGuides({ ...input, sourcePackage, example: Option.some(example), markdown })
    yield* writeBrowserGuides({ ...input, ...guideData })

    yield* Console.log(
      `✓ ${sourcePackage.manifest.name}: ${numberText(Arr.length(modules))} semantic modules, ${
        numberText(Arr.reduce(modules, 0, (count, module) => Num.sum(count, Arr.length(module.routes))))
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
      searchEntries: Arr.appendAll(
        guideData.searchEntries,
        Arr.flatMap(generatedModules, (generated) => generated.searchEntries)
      )
    }
  })
