import { Array as Arr, Effect, Match, Number as Num, Option } from "effect"

import { InvalidSamplerConfig, SamplerExhausted } from "../../Errors/index.js"
import type { GridConfig } from "../../internal/grid.js"

const exhaustedError = (nextTrialNumber: number, available: number): SamplerExhausted =>
  new SamplerExhausted({
    sampler: "grid",
    nextTrialNumber,
    available
  })

const missingConfigError = (): InvalidSamplerConfig =>
  new InvalidSamplerConfig({
    reason: "grid sampler index lookup returned no configuration",
    sampler: "grid"
  })

export const configAtCursor = (
  configs: ReadonlyArray<GridConfig>,
  nextTrialNumber: number
): Effect.Effect<GridConfig, SamplerExhausted | InvalidSamplerConfig> =>
  Match.value(
    Num.lessThanOrEqualTo(configs.length, 0) || Num.greaterThanOrEqualTo(nextTrialNumber, configs.length)
  ).pipe(
    Match.when(true, () => Effect.fail(exhaustedError(nextTrialNumber, configs.length))),
    Match.orElse(() =>
      Arr.get(configs, nextTrialNumber).pipe(
        Option.match({
          onNone: () => Effect.fail(missingConfigError()),
          onSome: Effect.succeed
        })
      )
    )
  )
