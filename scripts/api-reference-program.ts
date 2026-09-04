import { Command, Path, Url } from "@effect/platform"
import { Console, Effect } from "effect"

import { checkApiReferenceConsistency } from "./api-reference/consistency.js"
import { loadDocsData } from "./api-reference/docs-data.js"
import { checkApiExamples } from "./api-reference/examples.js"
import { generateApiReference } from "./api-reference/generate.js"
import { checkHostLimits } from "./api-reference/host-limits.js"
import { discoverApiSourcePackages } from "./api-reference/source.js"

export const apiReferenceProgram = Effect.gen(function*() {
  yield* checkHostLimits
  const path = yield* Path.Path
  const repositoryRoot = yield* Effect.flatMap(Url.fromString("../", import.meta.url), path.fromFileUrl).pipe(
    Effect.orDie
  )
  const revision = yield* Command.make("git", "rev-parse", "HEAD").pipe(
    Command.workingDirectory(repositoryRoot),
    Command.string,
    Effect.orDie,
    Effect.map((output) => output.trim())
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
      error._tag === "ApiExampleError"
        ? Effect.forEach(error.diagnostics, (diagnostic) => Console.error(diagnostic))
        : Console.error(error.message)
    )
  )
  const moduleCount = manifest.packages.reduce((count, apiPackage) => count + apiPackage.modules.length, 0)
  const routeCount = manifest.packages.reduce(
    (count, apiPackage) => count + apiPackage.modules.reduce((subtotal, module) => subtotal + module.routes.length, 0),
    0
  )

  yield* Console.log(
    `Semantic API reference complete: ${String(manifest.packages.length)} packages, ${String(moduleCount)} modules, ${
      String(routeCount)
    } public routes, ${String(symbolCount)} search symbols and ${
      String(exampleCount)
    } authored examples verified -> api-reference/`
  )
})
