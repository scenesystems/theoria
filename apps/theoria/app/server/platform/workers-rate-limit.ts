import { Effect, Layer, Option, Predicate, Schema } from "effect"

import {
  admitted,
  PlaceBuildLimiter,
  PlaceBuildLimiterError,
  refused,
  unlimited
} from "../config/place-build-limiter.js"

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
export const RateLimitBinding = Schema.declare<{
  readonly limit: (options: { readonly key: string }) => Promise<{ readonly success: boolean }>
}>(
  (input): input is {
    readonly limit: (options: { readonly key: string }) => Promise<{ readonly success: boolean }>
  } => Predicate.hasProperty(input, "limit") && Predicate.isFunction(input.limit),
  { identifier: "RateLimitBinding" }
)
export type RateLimitBinding = typeof RateLimitBinding.Type

/**
 * Length of the limiter window, matching `ratelimits[].simple.period` in
 * `wrangler.jsonc`. The binding does not expose it at runtime, and a client
 * that waits one full window is always admitted again.
 */
export const windowSeconds = 60

export const make = (binding: RateLimitBinding) =>
  PlaceBuildLimiter.of({
    admit: (actor) =>
      Effect.tryPromise({
        try: () => binding.limit({ key: actor }),
        catch: (cause) => new PlaceBuildLimiterError({ detail: `rate-limit binding failed: ${String(cause)}` })
      }).pipe(Effect.map(({ success }) => success ? admitted : refused(windowSeconds)))
  })

export const layer = (binding: RateLimitBinding): Layer.Layer<PlaceBuildLimiter> =>
  Layer.succeed(PlaceBuildLimiter, make(binding))

/**
 * The limiter for a deployment whose `env` may lack the binding.
 *
 * A pull-request preview is deployed with the `wrangler.jsonc` from `main`, so
 * a Worker built from a branch that adds or renames the binding runs without
 * it until the branch merges. The limiter is a backstop, not a correctness
 * requirement, so a missing binding admits every build and is logged once per
 * isolate rather than failing each request.
 */
export const layerFromEnv = (binding: Option.Option<RateLimitBinding>): Layer.Layer<PlaceBuildLimiter> =>
  Option.match(binding, {
    onNone: () =>
      Layer.unwrapEffect(
        Effect.logWarning("PLACE_BUILD_LIMITER binding is missing; place builds are not rate limited").pipe(
          Effect.as(unlimited)
        )
      ),
    onSome: layer
  })
