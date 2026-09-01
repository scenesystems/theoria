import { Command, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Console, Effect } from "effect"

import { generateApiReference } from "./api-reference/generate.js"
import { discoverApiSourcePackages } from "./api-reference/source.js"

const repositoryRootUrl = new URL("../", import.meta.url)

const program = Effect.gen(function*() {
  const path = yield* Path.Path
  const repositoryRoot = yield* path.fromFileUrl(repositoryRootUrl).pipe(Effect.orDie)
  const revision = yield* Command.make("git", "rev-parse", "HEAD").pipe(
    Command.workingDirectory(repositoryRoot),
    Command.string,
    Effect.orDie,
    Effect.map((output) => output.trim())
  )
  const sourcePackages = yield* discoverApiSourcePackages(path.join(repositoryRoot, "packages"))
  const manifest = yield* generateApiReference({
    repositoryRoot,
    outputRoot: path.join(repositoryRoot, "api-reference"),
    browserOutputRoot: path.join(repositoryRoot, "apps", "theoria", "public", "docs-data"),
    revision,
    sourcePackages
  })
  const moduleCount = manifest.packages.reduce((count, apiPackage) => count + apiPackage.modules.length, 0)
  const routeCount = manifest.packages.reduce(
    (count, apiPackage) => count + apiPackage.modules.reduce((subtotal, module) => subtotal + module.routes.length, 0),
    0
  )

  yield* Console.log(
    `Semantic API reference complete: ${String(manifest.packages.length)} packages, ${String(moduleCount)} modules, ${String(routeCount)} public routes -> api-reference/`
  )
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
