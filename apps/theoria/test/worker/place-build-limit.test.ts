// @vitest-environment node
import { BunContext } from "@effect/platform-bun"
import { expect, layer } from "@effect/vitest"
import { resolveRootFrom } from "@theoria/source-proof"
import { Clock, Duration, Effect, Option } from "effect"
import * as Arr from "effect/Array"
import { type Unstable_Config, unstable_readConfig } from "wrangler"

import { json, productionHost, Site, SiteLive } from "./site.js"

type Limiter = Unstable_Config["ratelimits"][number]

const placeBuildLimiter = (config: Unstable_Config): Option.Option<Limiter> =>
  Arr.findFirst(config.ratelimits, (limiter) => limiter.name === "PLACE_BUILD_LIMITER")

/**
 * The production limit, read through Wrangler so the test follows
 * `wrangler.jsonc` rather than restating it.
 */
const configuredLimit = resolveRootFrom(new URL("../../", import.meta.url)).pipe(
  Effect.map((projectRoot) => unstable_readConfig({ config: `${projectRoot}/wrangler.jsonc` }, { hideWarnings: true })),
  Effect.flatMap((config) =>
    Option.match(placeBuildLimiter(config), {
      onNone: () => Effect.dieMessage("wrangler.jsonc declares no PLACE_BUILD_LIMITER binding"),
      onSome: (limiter) => Effect.succeed({ limit: limiter.simple.limit, periodSeconds: limiter.simple.period })
    })
  ),
  Effect.provide(BunContext.layer)
)

/**
 * Counters roll over on wall-clock window boundaries. A run that straddled one
 * would see the count reset midway, so start only when the whole run fits in
 * the current window.
 */
const awaitRoomInWindow = (periodSeconds: number, marginSeconds: number) =>
  Clock.currentTimeMillis.pipe(
    Effect.flatMap((nowMs) => {
      const periodMs = periodSeconds * 1000
      const remainingMs = periodMs - (nowMs % periodMs)
      return remainingMs < marginSeconds * 1000 ? Effect.sleep(Duration.millis(remainingMs)) : Effect.void
    })
  )

layer(SiteLive, { timeout: "2 minutes" })("Place build rate limit in workerd", (it) => {
  // Runs on the live clock: the Worker's counters follow wall-clock windows,
  // which the test clock cannot advance.
  it.effect("admits the configured number of builds per client address, then answers 429 until the window ends", () =>
    Effect.gen(function*() {
      const site = yield* Site
      const { limit, periodSeconds } = yield* configuredLimit
      yield* awaitRoomInWindow(periodSeconds, 15)

      // An empty body is rejected as invalid before any building happens, but
      // it still costs the caller a token: admission is decided before the
      // body is read, so malformed floods are bounded too. The body is empty
      // rather than merely invalid because a refused request leaves its body
      // unread, and miniflare's internal keep-alive hop can drop the next
      // request when unread bytes remain on the connection.
      const attempt = (address: string) =>
        site.fetch(`${productionHost}/api/imagined-place/build`, {
          method: "POST",
          headers: { "content-type": "application/json", "cf-connecting-ip": address },
          body: ""
        })

      const admitted = yield* Effect.forEach(Arr.replicate("198.51.100.10", limit), attempt)
      expect(Arr.map(admitted, (response) => response.status)).toEqual(Arr.replicate(400, limit))

      const refused = yield* attempt("198.51.100.10")
      expect(refused.status).toBe(429)
      expect(refused.headers.get("retry-after")).toBe(String(periodSeconds))
      expect(refused.headers.get("cache-control")).toBe("no-store")
      expect(yield* json(refused)).toMatchObject({
        ok: false,
        error: { code: "rate-limited", retryable: true }
      })

      // Another address has its own budget.
      const neighbour = yield* attempt("198.51.100.11")
      expect(neighbour.status).toBe(400)
    }).pipe(Effect.withClock(Clock.make())))
})
