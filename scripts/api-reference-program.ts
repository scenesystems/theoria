import { Command, Path, Url } from "@effect/platform"
import { Array as Arr, Console, Effect, Match, Number, String } from "effect"

import { checkApiReferenceConsistency } from "./api-reference/consistency.js"
import { loadDocsData } from "./api-reference/docs-data.js"
import { checkApiExamples } from "./api-reference/examples.js"
import { generateApiReference } from "./api-reference/generate.js"
import { discoverApiSourcePackages } from "./api-reference/source.js"

export const apiReferenceProgram = Effect.gen(function*() {
  const path = yield* Path.Path
  const repositoryRoot = yield* Effect.flatMap(
    Url.fromString("../", import.meta.url).pipe(Effect.orDie),
    path.fromFileUrl
  )
  const revision = yield* Command.make("git", "rev-parse", "HEAD").pipe(
    Command.workingDirectory(repositoryRoot),
    Command.string,
    Effect.map(String.trim)
  )
  const sourcePackages = yield* discoverApiSourcePackages(path.join(repositoryRoot, "packages"))
  const browserOutputRoot = path.join(repositoryRoot, "apps", "theoria", "public", "docs-data")
  const manifest = yield* generateApiReference({
    repositoryRoot,
    outputRoot: path.join(repositoryRoot, "api-reference"),
    browserOutputRoot,
    revision,
    sourcePackages
  })
  const docsData = yield* loadDocsData(browserOutputRoot)
  const symbolCount = yield* checkApiReferenceConsistency(manifest, docsData).pipe(
    Effect.tapError((error) => Effect.forEach(error.diagnostics, (diagnostic) => Console.error(diagnostic)))
  )
  const exampleCount = yield* checkApiExamples(repositoryRoot, docsData.pages).pipe(
    Effect.tapError((error) =>
      Match.value(error).pipe(
        Match.tag(
          "ApiExampleError",
          (failure) => Effect.forEach(failure.diagnostics, (diagnostic) => Console.error(diagnostic), { discard: true })
        ),
        Match.orElse((failure) => Console.error(failure.message))
      )
    )
  )
  const moduleCount = Arr.reduce(
    manifest.packages,
    0,
    (count, apiPackage) => Number.sum(count, Arr.length(apiPackage.modules))
  )
  const routeCount = Arr.reduce(
    manifest.packages,
    0,
    (count, apiPackage) =>
      Number.sum(
        count,
        Arr.reduce(apiPackage.modules, 0, (subtotal, module) => Number.sum(subtotal, Arr.length(module.routes)))
      )
  )

  yield* Console.log(
    `Semantic API reference complete: ${
      Arr.length(manifest.packages)
    } packages, ${moduleCount} modules, ${routeCount} public routes, ${symbolCount} search symbols and ${exampleCount} authored examples verified -> api-reference/`
  )
})
