import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Console, Effect } from "effect"

import { runPackageDocsCli } from "../packages/source-proof/src/index.js"

const main = runPackageDocsCli(Bun.argv.slice(2)).pipe(
  Effect.catchAll((error) =>
    Console.error(`[docs:packages] ${error.message}`).pipe(
      Effect.andThen(Effect.sync(() => process.exit(1)))
    )),
  Effect.provide(BunContext.layer)
)

BunRuntime.runMain(main)
