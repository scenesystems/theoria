import { FileSystem } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Console, Effect } from "effect"

import { renderLayoutTokensCss } from "../app/web/layout/layoutTokens.js"

const outputPath = "app/web/layout-tokens.generated.css"

const program = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  yield* fileSystem.writeFileString(outputPath, renderLayoutTokensCss())
  yield* Console.log(`Rendered ${outputPath}`)
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
