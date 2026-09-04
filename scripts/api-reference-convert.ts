import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Effect } from "effect"

import { convertPackageProgram } from "./api-reference/convert-program.js"

BunRuntime.runMain(convertPackageProgram.pipe(Effect.provide(BunContext.layer)))
