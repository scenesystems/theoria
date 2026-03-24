/**
 * Shared utility for decoding raw sampler configuration against a search space schema, mapping parse failures to InvalidSamplerConfig.
 *
 * @since 0.1.0
 */
import { Effect, Schema } from "effect"

import { InvalidSamplerConfig } from "../../Errors/index.js"
import type * as SearchSpace from "../../SearchSpace/index.js"

/**
 * Decodes a raw sampler suggestion against the search space schema, mapping parse failures to InvalidSamplerConfig.
 *
 * @since 0.1.0
 * @category utils
 */
export const decodeConfig = <Space extends SearchSpace.SearchSpace>(
  samplerName: string,
  space: Space,
  raw: unknown,
  reason: string
): Effect.Effect<SearchSpace.Type<Space>, InvalidSamplerConfig> =>
  Schema.decodeUnknown(space.schema)(raw).pipe(
    Effect.mapError(
      () =>
        new InvalidSamplerConfig({
          reason,
          sampler: samplerName
        })
    )
  )
