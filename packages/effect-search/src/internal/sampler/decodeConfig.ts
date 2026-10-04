/**
 * Sampler suggestion decoding against a compiled search-space schema.
 *
 * @since 0.1.0
 */
import { Effect, Schema } from "effect"

import { InvalidSamplerConfig } from "../../SearchError.js"
import type * as SearchSpace from "../../SearchSpace.js"
/**
 * Decodes a raw sampler suggestion against the search space schema, mapping parse failures to InvalidSamplerConfig.
 *
 * @since 0.1.0
 * @category utils
 */
export const decodeConfig = <
  SpaceSchema extends Schema.Codec<unknown, unknown, never, never>
>(
  samplerName: string,
  space: SearchSpace.SearchSpace<SpaceSchema>,
  raw: unknown,
  reason: string
): Effect.Effect<SpaceSchema["Type"], InvalidSamplerConfig> =>
  Schema.decodeUnknownEffect(space.schema)(raw).pipe(
    Effect.mapError(
      () =>
        new InvalidSamplerConfig({
          reason,
          sampler: samplerName
        })
    )
  )
