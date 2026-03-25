/**
 * Objective-shape helpers shared by advanced samplers.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Effect, Match, Number as Num, Option } from "effect"

import type { Direction } from "../../contracts/Direction.js"
import { matchObjectiveSpec } from "../../contracts/ObjectiveSpec.js"
import { normalizeObjectiveVector } from "../../contracts/ObjectiveValue.js"
import { SamplerObjectiveUnsupported } from "../../Errors/index.js"
import type { SamplerConfig } from "../../internal/configAccess.js"
import type { SuggestContext } from "../../Sampler/index.js"

export class ScalarObservation extends Data.Class<{
  readonly config: SamplerConfig
  readonly value: number
}> {}

const ensureSingleObjective = (
  sampler: string,
  context: SuggestContext
): Effect.Effect<Direction, SamplerObjectiveUnsupported> =>
  matchObjectiveSpec({
    Single: ({ direction }) => Effect.succeed(direction),
    Multi: () =>
      Effect.fail(
        new SamplerObjectiveUnsupported({
          sampler,
          objective: "Multi",
          reason: "currently supports only single-objective studies"
        })
      )
  })(context.objectiveSpec)

const orientedValue = (direction: Direction, value: number): number =>
  Match.value(direction).pipe(
    Match.when("minimize", () => value),
    Match.orElse(() => -value)
  )

const scalarFromObjective = (value: number | ReadonlyArray<number>): Option.Option<number> =>
  Arr.get(normalizeObjectiveVector(value), 0).pipe(
    Option.filter(Number.isFinite)
  )

export const scalarObservationsFromContext = (
  sampler: string,
  context: SuggestContext
): Effect.Effect<Array<ScalarObservation>, SamplerObjectiveUnsupported> =>
  ensureSingleObjective(sampler, context).pipe(
    Effect.map((direction) =>
      Arr.filterMap(context.completed, (trial) =>
        scalarFromObjective(trial.value).pipe(
          Option.map((value) =>
            new ScalarObservation({
              config: trial.config,
              value: orientedValue(direction, value)
            })
          )
        ))
    )
  )

export const bestObservedValue = (observations: ReadonlyArray<ScalarObservation>): number =>
  Arr.head(observations).pipe(
    Option.match({
      onNone: () => 0,
      onSome: (first) =>
        Arr.reduce(
          Arr.drop(observations, 1),
          first.value,
          (current, observation) => Num.min(current, observation.value)
        )
    })
  )
