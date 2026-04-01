/**
 * Theoria app entrypoint.
 *
 * Run from repo root:
 * `bun run app:theoria`
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Layer } from "effect"

import { HttpLive } from "./app/server/app.js"

BunRuntime.runMain(Effect.scoped(Layer.launch(HttpLive)))
