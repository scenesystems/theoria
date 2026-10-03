import { expect, it } from "@effect/vitest"
import { Data, Deferred, Effect, Fiber, Schema } from "effect"
import { HttpServerResponse } from "effect/http"

import { Success } from "../../app/contracts/envelope.js"
import { makeWorkerHandler } from "../../app/server/worker.js"
import { webRequest } from "./platform/web-request.js"

/** The handler's Promise rejected; the host would see this as a failed request. */
class HandlerRejected extends Data.TaggedError("HandlerRejected")<{ readonly cause: unknown }> {}

it.effect("bindings the schema rejects fail the first request instead of raising out of fetch", () =>
  Effect.gen(function*() {
    const worker = makeWorkerHandler({})

    const rejection = yield* Effect.flip(
      Effect.tryPromise({
        try: () => worker.handler(webRequest("http://127.0.0.1/api/health/live", { method: "GET" })),
        catch: (cause) => new HandlerRejected({ cause })
      })
    )
    yield* Effect.promise(() => worker.dispose())

    expect(String(rejection.cause)).toContain("SchemaError")
    expect(String(rejection.cause)).toContain("[\"ASSETS\"]")
  }))

it.effect("independent handlers retain their own configuration and concurrent requests retain their own policy", () =>
  Effect.gen(function*() {
    const context = yield* Effect.context()
    const acquire = (buildSha: string) =>
      Effect.acquireRelease(
        Effect.sync(() =>
          makeWorkerHandler({
            BUILD_SHA: buildSha,
            ASSETS: {
              fetch: () =>
                Effect.runPromiseWith(context)(
                  Effect.succeed(HttpServerResponse.toWeb(HttpServerResponse.empty({ status: 404 })))
                )
            }
          })
        ),
        (worker) => Effect.promise(() => worker.dispose())
      )
    const first = yield* acquire("first-build")
    const second = yield* acquire("second-build")
    const responses = yield* Effect.all([
      Effect.promise(() =>
        first.handler(webRequest("https://theoria.scenesystems.io/api/health/live", { method: "GET" }))
      ),
      Effect.promise(() => second.handler(webRequest("https://preview.example/api/health/live", { method: "GET" })))
    ], { concurrency: "unbounded" })
    const [firstBody, secondBody] = yield* Effect.forEach(
      responses,
      (response) =>
        Effect.promise(() => response.text()).pipe(
          Effect.flatMap(Schema.decodeEffect(Schema.fromJsonString(Success(Schema.Unknown))))
        )
    )
    expect(firstBody?.meta.buildSha).toBe("first-build")
    expect(secondBody?.meta.buildSha).toBe("second-build")
    expect(firstBody?.meta.requestId).not.toBe(secondBody?.meta.requestId)
    expect(responses[0].headers.get("x-robots-tag")).toBeNull()
    expect(responses[1].headers.get("x-robots-tag")).toContain("noindex")
  }).pipe(Effect.scoped))

it.effect("aborting an asset request interrupts its transport and runs cleanup", () =>
  Effect.gen(function*() {
    const context = yield* Effect.context()
    const started = yield* Deferred.make<void>()
    const cleaned = yield* Deferred.make<void>()
    const worker = yield* Effect.acquireRelease(
      Effect.sync(() =>
        makeWorkerHandler({
          ASSETS: {
            fetch: (_url: URL, { signal }: { readonly signal: AbortSignal }) =>
              Effect.runPromiseWith(context)(
                Effect.andThen(Deferred.succeed(started, undefined), Effect.never).pipe(
                  Effect.ensuring(Deferred.succeed(cleaned, undefined))
                ),
                { signal }
              )
          }
        })
      ),
      (worker) => Effect.promise(() => worker.dispose())
    )
    const request = yield* Effect.tryPromise({
      try: (signal) => worker.handler(webRequest("https://preview.example/assets/slow.txt", { method: "GET", signal })),
      catch: (cause) => new HandlerRejected({ cause })
    }).pipe(Effect.forkScoped)
    yield* Deferred.await(started)
    yield* Fiber.interrupt(request)
    yield* Deferred.await(cleaned)
    expect(yield* Deferred.isDone(cleaned)).toBe(true)
  }).pipe(Effect.scoped))
