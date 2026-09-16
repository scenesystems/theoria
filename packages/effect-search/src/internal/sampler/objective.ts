/**
 * Objective-shape helpers shared by advanced samplers.
 *
 * @since 0.1.0
 */
import { isFinite } from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Data, Effect, Match, Number as Num, Option } from "effect"

import type { Vector } from "../../Objective.js"

import type { Direction } from "../../Direction.js"
import type { SamplerConfig } from "../../internal/configAccess.js"
import { match } from "../../Objective.js"
import { toVector } from "../../Objective.js"
import type { Context } from "../../Sampler.js"
import { SamplerObjectiveUnsupported } from "../../SearchError.js"
import { minimumObserved } from "./math.js"

/**
 * Scalar trial observation normalized for shared advanced-sampler logic.
 *
 * @since 0.1.0
 * @category models
 */
export class ScalarObservation extends Data.Class<{
  readonly trialNumber: number
  readonly config: SamplerConfig
  readonly value: number
}> {}

const ensureSingleObjective = (
  sampler: string,
  context: Context
): Effect.Effect<Direction, SamplerObjectiveUnsupported> =>
  match({
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
    Match.orElse(() => Num.negate(value))
  )

const scalarFromObjective = (value: number | Vector): Option.Option<number> =>
  Arr.get(toVector(value), 0).pipe(
    Option.filter(isFinite)
  )

/**
 * Extracts finite scalar observations from completed trials and orients them
 * to minimization so advanced samplers can share one objective convention.
 *
 * @since 0.1.0
 * @category operations
 */
export const scalarObservationsFromContext = (
  sampler: string,
  context: Context
) =>
  ensureSingleObjective(sampler, context).pipe(
    Effect.map((direction) =>
      Arr.filterMap(context.completed, (trial) =>
        scalarFromObjective(trial.value).pipe(
          Option.map((value) =>
            new ScalarObservation({
              trialNumber: trial.trialNumber,
              config: trial.config,
              value: orientedValue(direction, value)
            })
          )
        ))
    )
  )

/**
 * Returns the best (lowest) oriented scalar value across observations.
 *
 * @since 0.1.0
 * @category operations
 */
export const bestObservedValue = (observationsInput: Iterable<ScalarObservation>): number => {
  const observations = Arr.fromIterable(observationsInput)
  return minimumObserved(Arr.map(observations, (observation) => observation.value), 0)
}
