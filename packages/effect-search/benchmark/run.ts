import { BunRuntime } from "@effect/platform-bun"
import { Console, Effect } from "effect"

import { benchProgram } from "./main.js"

const main = benchProgram.pipe(
  Effect.catchAll((violations) =>
    Console.error("[effect-search/bench] Benchmark envelope violations detected").pipe(
      Effect.andThen(
        Effect.forEach(violations, (violation) => Console.error(`- ${violation}`), {
          discard: true
        })
      ),
      Effect.andThen(Effect.sync(() => process.exit(1)))
    )
  )
)

BunRuntime.runMain(main)
