/**
 * Theoria Bun entrypoint: serves the built web bundle from `dist/`.
 *
 * Run from repo root:
 * `bun run app:theoria`
 */
import { HttpMiddleware, HttpServer } from "@effect/platform"
import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { Config, Effect, Layer } from "effect"

import { AppLayer, publicApp } from "./app/server/app.js"
import * as BunStaticStore from "./app/server/platform/bun-static-store.js"

const distRoot = decodeURIComponent(new URL("./dist/", import.meta.url).pathname)

const ServerLive = Layer.unwrapEffect(
  Config.integer("PORT").pipe(
    Config.withDefault(3876),
    Effect.map((port) => BunHttpServer.layer({ port, idleTimeout: 120 }))
  )
)

const HttpLive = HttpServer.serve(publicApp, HttpMiddleware.logger).pipe(
  HttpServer.withLogAddress,
  Layer.provide(AppLayer),
  Layer.provideMerge(BunStaticStore.layer(distRoot)),
  Layer.provide(ServerLive)
)

BunRuntime.runMain(Layer.launch(HttpLive))
