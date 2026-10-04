import { BunRuntime, BunServices } from "@effect/platform-bun"
import { Cause, Console, Effect } from "effect"

import { convertPackageProgram } from "./api-reference/convert-program.js"

BunRuntime.runMain(
  convertPackageProgram.pipe(
    Effect.tapCause((cause) => Console.error(Cause.pretty(cause))),
    Effect.provide(BunServices.layer)
  )
)
