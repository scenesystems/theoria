/**
 * Theoria Bun entrypoint for local development: serves the built web bundle
 * from `dist/`, falling back to `public/` so the docs data is available before
 * `vite build` (the API is usable during development without a web build).
 * Deployments run the same app as a Cloudflare Worker (`worker.ts`).
 *
 * Run from repo root:
 * `bun run app:theoria`
 */
import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { Config, Effect, Layer, Path } from "effect"
import { HttpMiddleware, HttpServer, Url } from "effect/http"

import { AppLayer, publicApp } from "./app/server/app.js"
import { unlimited as UnlimitedPlaceBuilds } from "./app/server/config/place-build-limiter.js"
import * as BunStaticStore from "./app/server/platform/bun-static-store.js"

/** `dist/` first so a web build wins; `public/` beneath it carries the docs data before `vite build` runs. */
const staticRoots = Effect.gen(function*() {
  const path = yield* Path.Path
  const resolve = (relative: string) =>
    Effect.flatMap(Effect.fromResult(Url.fromString(relative, import.meta.url)), path.fromFileUrl)
  return [yield* resolve("./dist/"), yield* resolve("./public/")]
})

const ServerLive = Layer.unwrap(
  Config.Int("PORT").pipe(
    Config.withDefault(3876),
    Effect.map((port) => BunHttpServer.layer({ port, idleTimeout: 120 }))
  )
)

const HttpLive = HttpServer.serve(publicApp, HttpMiddleware.logger).pipe(
  HttpServer.withLogAddress,
  Layer.provide(AppLayer),
  Layer.provideMerge(Layer.unwrap(Effect.map(staticRoots, BunStaticStore.layer))),
  // Local development has no edge in front of it; abuse protection is a deployment concern.
  Layer.provideMerge(UnlimitedPlaceBuilds),
  Layer.provide(ServerLive)
)

BunRuntime.runMain(Layer.launch(HttpLive))
