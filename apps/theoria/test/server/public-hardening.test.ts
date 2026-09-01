import { Headers as HttpHeaders, HttpServerRequest, HttpServerResponse } from "@effect/platform"
import { describe, expect, it } from "@effect/vitest"
import { ConfigProvider, Effect, Either, Fiber, Option, Stream, TestClock } from "effect"

import { RuntimeInfo, RuntimeInfoLive } from "../../app/server/config/runtime.js"
import { ExecutionPolicy, ExecutionPolicyLive } from "../../app/server/demos/policy.js"
import { DemoRateLimiterLive } from "../../app/server/demos/rate-limiter.js"
import { authorizeDemoRequest, type DemoRouteAccess } from "../../app/server/routes/demo-access.js"
import { cacheControlForPath, isHtmlPath } from "../../app/server/routes/static.js"
import { securityHeaders } from "../../app/server/security-headers.js"

const config = (values: unknown) => ConfigProvider.fromJson(values).pipe(ConfigProvider.constantCase)

const request = (method: string, headers: Readonly<Record<string, string>> = {}) =>
  HttpServerRequest.fromWeb(
    new Request("https://theoria.scenesystems.io/api/demos/effect-dsp/stream", { method })
  ).modify({
    headers: HttpHeaders.fromInput(headers),
    remoteAddress: "203.0.113.10"
  })

const streamRoute: DemoRouteAccess = {
  id: "effect-dsp",
  endpoint: "stream"
}

describe("server/public-hardening", () => {
  it.effect("holds a lane permit for its scope and rejects excess work without queuing", () =>
    Effect.gen(function*() {
      const policy = yield* ExecutionPolicy
      const rejected = yield* Effect.scoped(
        Effect.gen(function*() {
          yield* policy.acquireLane("provider")
          return yield* Effect.either(policy.acquireLane("provider"))
        })
      )
      const admittedAfterRelease = yield* Effect.scoped(
        Effect.either(policy.acquireLane("provider"))
      )

      expect(Either.isLeft(rejected)).toBe(true)
      expect(Either.isRight(admittedAfterRelease)).toBe(true)
    }).pipe(
      Effect.provide(ExecutionPolicyLive),
      Effect.withConfigProvider(config({ THEORIA_PROVIDER_CONCURRENCY: 1 }))
    ))

  it.effect("interrupts a stream at the configured full-lifetime timeout", () =>
    Effect.gen(function*() {
      const policy = yield* ExecutionPolicy
      const fiber = yield* policy.timeoutStream("local", Stream.never).pipe(
        Stream.runDrain,
        Effect.fork
      )

      yield* TestClock.adjust("11 millis")
      const error = yield* Fiber.join(fiber).pipe(Effect.flip)

      expect(error._tag).toBe("ExecutionTimedOut")
      expect(error.lane).toBe("local")
    }).pipe(
      Effect.provide(ExecutionPolicyLive),
      Effect.withConfigProvider(config({ THEORIA_LOCAL_TIMEOUT_MS: 10 }))
    ))

  it.effect("enforces methods, cross-site blocking, and per-client preview provider limits", () =>
    Effect.gen(function*() {
      const wrongMethod = yield* authorizeDemoRequest(streamRoute, request("POST"))
      const crossSite = yield* authorizeDemoRequest(
        streamRoute,
        request("GET", { "sec-fetch-site": "cross-site" })
      )
      const first = yield* authorizeDemoRequest(streamRoute, request("GET"))
      const second = yield* authorizeDemoRequest(streamRoute, request("GET"))

      expect(Option.getOrThrow(wrongMethod).code).toBe("method-not-allowed")
      expect(Option.getOrThrow(crossSite).code).toBe("cross-site-request")
      expect(Option.isNone(first)).toBe(true)
      expect(Option.getOrThrow(second).code).toBe("rate-limited")
      expect(Option.getOrThrow(second).retryAfterSeconds).toBe(60)
    }).pipe(
      Effect.provide(DemoRateLimiterLive),
      Effect.withConfigProvider(config({
        NODE_ENV: "development",
        THEORIA_PROVIDER_REQUESTS_PER_MINUTE: 1,
        THEORIA_RATE_LIMIT_WINDOW_MS: 60_000
      }))
    ))

  it.effect("sets global browser security headers", () =>
    Effect.gen(function*() {
      const response = yield* securityHeaders(Effect.succeed(HttpServerResponse.text("ok"))).pipe(
        Effect.provideService(HttpServerRequest.HttpServerRequest, request("GET"))
      )

      expect(response.headers["content-security-policy"]).toContain("frame-ancestors 'none'")
      expect(response.headers["strict-transport-security"]).toContain("max-age=31536000")
      expect(response.headers["x-content-type-options"]).toBe("nosniff")
      expect(response.headers["x-frame-options"]).toBe("DENY")
    }))

  it("caches only fingerprinted assets immutably", () => {
    expect(cacheControlForPath("/index.html")).toBe("no-cache")
    expect(cacheControlForPath("/docs-data/manifest.json")).toBe("no-cache")
    expect(cacheControlForPath("/assets/index-ABC123.js")).toBe("public, max-age=31536000, immutable")
    expect(cacheControlForPath("/docs-data/0123456789abcdef/packages/digest/pages/index.json"))
      .toBe("public, max-age=31536000, immutable")
    expect(cacheControlForPath("/robots.txt")).toBe("public, max-age=3600")
  })

  it("serves documentation deep links through the application shell", () => {
    expect(isHtmlPath("/docs", "production")).toBe(true)
    expect(isHtmlPath("/docs/effect-search/getting-started", "production")).toBe(true)
    expect(isHtmlPath("/docs/effect-search/api/Study", "production")).toBe(true)
    expect(isHtmlPath("/docs-data/manifest.json", "production")).toBe(false)
  })

  it.effect("prefers Railway deployment identity over a local build label", () =>
    Effect.gen(function*() {
      const runtime = yield* RuntimeInfo

      expect(runtime.buildSha).toBe("railway-commit")
    }).pipe(
      Effect.provide(RuntimeInfoLive),
      Effect.withConfigProvider(config({
        BUILD_SHA: "dev-local",
        RAILWAY_GIT_COMMIT_SHA: "railway-commit"
      }))
    ))
})
