import { Effect, Layer } from "effect"

import { admitted, PlaceBuildLimiter, refused } from "../config/place-build-limiter.js"

/**
 * `PlaceBuildLimiter` backed by a Cloudflare Workers rate-limiting binding.
 *
 * The binding is declared in `wrangler.jsonc` (`ratelimits[].name =
 * "PLACE_BUILD_LIMITER"`) and reaches the Worker as `env.PLACE_BUILD_LIMITER`.
 * Each call to `limit` consumes one token for the key, so admission is asked
 * once per build request, before the body is read. Counters live per
 * Cloudflare location and are eventually consistent; this is abuse
 * protection, not accounting.
 *
 * The structural `RateLimitBinding` type keeps this module independent of
 * `@cloudflare/workers-types`; the generated `RateLimit` type is assignable.
 */
export type RateLimitBinding = {
  readonly limit: (options: { readonly key: string }) => Promise<{ readonly success: boolean }>
}

/**
 * Length of the limiter window, matching `ratelimits[].simple.period` in
 * `wrangler.jsonc`. The binding does not expose it at runtime, and a client
 * that waits one full window is always admitted again.
 */
export const windowSeconds = 60

export const make = (binding: RateLimitBinding) =>
  PlaceBuildLimiter.of({
    admit: (actor) =>
      Effect.promise(() => binding.limit({ key: actor })).pipe(
        Effect.map(({ success }) => success ? admitted : refused(windowSeconds))
      )
  })

export const layer = (binding: RateLimitBinding): Layer.Layer<PlaceBuildLimiter> =>
  Layer.succeed(PlaceBuildLimiter, make(binding))
