import { FileSystem } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Console, Effect } from "effect"

import { renderTextTokensCss } from "../app/web/text/textTokens.js"

const outputPath = "app/web/text-tokens.generated.css"

const program = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  yield* fileSystem.writeFileString(outputPath, renderTextTokensCss())
  yield* Console.log(`Rendered ${outputPath}`)
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
