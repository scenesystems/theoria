/**
 * Random parameter sampling — iterates search space parameters respecting conditional activation.
 *
 * @since 0.1.0
 */
import { Effect, Match } from "effect"

import type { InvalidSamplerConfig } from "../../Errors/index.js"
import type * as Rng from "../../internal/rng.js"
import * as SearchSpace from "../../SearchSpace/index.js"
import { configObject, type ConfigValues, emptyConfigValues, setConfigValue } from "./config.js"
import { sampleDistribution } from "./distribution.js"

/**
 * Iterates search space parameters in order, sampling each active parameter's
 * distribution and skipping conditionally inactive ones based on
 * already-sampled values.
 *
 * The fold accumulates sampled values so that later conditional-activation
 * checks can reference earlier parameter values.
 *
 * @see {@link sampleDistribution} for per-distribution random draws
 * @see {@link ConfigValues} for the accumulator type
 * @since 0.1.0
 * @category sampling
 */
export const sampleParameters = (
  rng: Rng.Rng,
  parameters: ReadonlyArray<SearchSpace.ParameterMetadata>
): Effect.Effect<ConfigValues, InvalidSamplerConfig> =>
  Effect.reduce(
    parameters,
    emptyConfigValues(),
    (raw, parameter) =>
      Match.value(SearchSpace.isParameterActive(parameter, configObject(raw))).pipe(
        Match.when(false, () => Effect.succeed(raw)),
        Match.orElse(() =>
          sampleDistribution(rng, parameter.distribution).pipe(
            Effect.map((value) => setConfigValue(raw, parameter.name, value))
          )
        )
      )
  )
