import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Effect } from "effect"

import { apiReferenceProgram } from "./api-reference-program.js"

BunRuntime.runMain(apiReferenceProgram.pipe(Effect.provide(BunContext.layer)))
