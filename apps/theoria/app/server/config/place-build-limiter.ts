import { Context, Effect, Layer } from "effect"

/**
 * Admission control for `POST /api/imagined-place/build`.
 *
 * The build is CPU-bound and anonymous, so the only actor identity available
 * is the client address. `admit` answers whether one more build may start for
 * that actor right now; a refusal carries how long the client should wait.
 *
 * Deployments provide the Cloudflare rate-limiting binding
 * (`app/server/platform/workers-rate-limit.ts`); local Bun runs and unit tests
 * use `unlimited`.
 */
export type Admission =
  | { readonly _tag: "Admitted" }
  | { readonly _tag: "Refused"; readonly retryAfterSeconds: number }

export class PlaceBuildLimiter extends Context.Tag("@theoria/app/server/config/PlaceBuildLimiter")<
  PlaceBuildLimiter,
  {
    readonly admit: (actor: string) => Effect.Effect<Admission>
  }
>() {}

export const admitted: Admission = { _tag: "Admitted" }

export const refused = (retryAfterSeconds: number): Admission => ({ _tag: "Refused", retryAfterSeconds })

/** Every build is admitted. For local development and tests of the build itself. */
export const unlimited: Layer.Layer<PlaceBuildLimiter> = Layer.succeed(
  PlaceBuildLimiter,
  PlaceBuildLimiter.of({ admit: () => Effect.succeed(admitted) })
)
