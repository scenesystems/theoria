import { describe, expect, it } from "@effect/vitest"
import { Effect, Ref } from "effect"
import { HttpClient, HttpClientResponse, HttpServerResponse } from "effect/http"
import { verify } from "./Website.js"

describe("website release verification", () => {
  it.effect("makes exactly the requested health attempts even with zero polling delay", () =>
    Effect.gen(function*() {
      const probes = yield* Ref.make(0)
      const client = HttpClient.make((request) =>
        Ref.update(probes, (count) => count + 1).pipe(
          Effect.as(HttpClientResponse.fromWeb(
            request,
            HttpServerResponse.toWeb(HttpServerResponse.jsonUnsafe({ meta: { buildSha: "old-build" } }))
          ))
        )
      )

      const failure = yield* verify("https://example.test", "new-build", true, 3, 0).pipe(
        Effect.provideService(HttpClient.HttpClient, client),
        Effect.flip
      )

      expect(yield* Ref.get(probes)).toBe(3)
      expect(failure.operation).toBe("verify")
      expect(failure.detail).toContain("within 3 attempts")
      expect(failure.detail).toContain("old-build")
    }))

  it.effect("rejects invalid attempt counts before making a request", () =>
    Effect.gen(function*() {
      const probes = yield* Ref.make(0)
      const client = HttpClient.make((request) =>
        Ref.update(probes, (count) => count + 1).pipe(
          Effect.as(HttpClientResponse.fromWeb(
            request,
            HttpServerResponse.toWeb(HttpServerResponse.empty())
          ))
        )
      )

      yield* verify("https://example.test", "new-build", true, 0, 0).pipe(
        Effect.provideService(HttpClient.HttpClient, client),
        Effect.flip
      )

      expect(yield* Ref.get(probes)).toBe(0)
    }))
})
