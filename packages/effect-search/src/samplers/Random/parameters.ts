import { Effect, Match } from "effect"

import type { InvalidSamplerConfig } from "../../Errors/index.js"
import type * as Rng from "../../internal/rng.js"
import * as SearchSpace from "../../SearchSpace/index.js"
import { configObject, type ConfigValues, emptyConfigValues, setConfigValue } from "./config.js"
import { sampleDistribution } from "./distribution.js"

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
