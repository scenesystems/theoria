import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Console, Effect } from "effect"

import { runPublishReadinessCli } from "../packages/source-proof/src/index.js"

const main = runPublishReadinessCli(Bun.argv.slice(2)).pipe(
  Effect.catchAll((error) =>
    Console.error(`[publish:check] ${error.message}`).pipe(
      Effect.andThen(Effect.sync(() => process.exit(1)))
    )),
  Effect.provide(BunContext.layer)
)

BunRuntime.runMain(main)
