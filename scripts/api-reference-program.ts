import { Command, Path } from "@effect/platform"
import { Console, Effect } from "effect"

import { checkApiReferenceConsistency } from "./api-reference/consistency.js"
import { generateApiReference } from "./api-reference/generate.js"
import { discoverApiSourcePackages } from "./api-reference/source.js"

const repositoryRootUrl = new URL("../", import.meta.url)

export const apiReferenceProgram = Effect.gen(function*() {
  const path = yield* Path.Path
  const repositoryRoot = yield* path.fromFileUrl(repositoryRootUrl).pipe(Effect.orDie)
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
  const symbolCount = yield* checkApiReferenceConsistency({ manifest, browserOutputRoot }).pipe(
    Effect.tapError((error) => Effect.forEach(error.diagnostics, (diagnostic) => Console.error(diagnostic)))
  )
  const moduleCount = manifest.packages.reduce((count, apiPackage) => count + apiPackage.modules.length, 0)
  const routeCount = manifest.packages.reduce(
    (count, apiPackage) => count + apiPackage.modules.reduce((subtotal, module) => subtotal + module.routes.length, 0),
    0
  )

  yield* Console.log(
    `Semantic API reference complete: ${String(manifest.packages.length)} packages, ${String(moduleCount)} modules, ${
      String(routeCount)
    } public routes, ${String(symbolCount)} search symbols verified -> api-reference/`
  )
})
