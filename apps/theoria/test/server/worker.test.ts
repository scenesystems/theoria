import { expect, it } from "@effect/vitest"
import { Data, Effect } from "effect"

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

    expect(String(rejection.cause)).toContain("ParseError")
    expect(String(rejection.cause)).toContain("[\"ASSETS\"]")
  }))
