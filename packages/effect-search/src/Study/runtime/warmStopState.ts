/**
 * Warm stop-state recovery from canonical trial history.
 *
 * @since 0.3.0
 */
import { Array as Arr, Data, Match, Option } from "effect"

import type { Direction } from "../../contracts/Direction.js"
import * as Trial from "../../Trial/index.js"
import { betterByDirection } from "../best.js"

/**
 * Runtime-only recovered stop-state derived from completed numeric trials.
 *
 * @since 0.3.0
 * @category models
 */
export class WarmStopState extends Data.Class<{
  readonly bestValue: Option.Option<number>
  readonly noImprovementCount: number
}> {}

const nextWarmStopState = <Config>(
  direction: Direction,
  state: WarmStopState,
  trial: Trial.Trial<Config>
): WarmStopState =>
  Trial.matchState({
    Running: () => state,
    Pruned: () => state,
    Failed: () => state,
    Cancelled: () => state,
    Completed: ({ value }) =>
      Match.value(value).pipe(
        Match.when(
          Match.number,
          (numericValue) =>
            Option.match(state.bestValue, {
              onNone: () => new WarmStopState({ bestValue: Option.some(numericValue), noImprovementCount: 0 }),
              onSome: (bestValue) =>
                Match.value(betterByDirection(direction, numericValue, bestValue)).pipe(
                  Match.when(
                    true,
                    () => new WarmStopState({ bestValue: Option.some(numericValue), noImprovementCount: 0 })
                  ),
                  Match.orElse(
                    () =>
                      new WarmStopState({
                        bestValue: state.bestValue,
                        noImprovementCount: state.noImprovementCount + 1
                      })
                  )
                )
            })
        ),
        Match.orElse(() => state)
      )
  })(trial.state)

/**
 * Rebuilds best-value and no-improvement-window counters from canonical trial order.
 *
 * @since 0.3.0
 * @category constructors
 */
export const warmStopStateFromTrials = <Config>(
  direction: Direction,
  trials: ReadonlyArray<Trial.Trial<Config>>
): WarmStopState =>
  Arr.reduce(
    trials,
    new WarmStopState({ bestValue: Option.none(), noImprovementCount: 0 }),
    (state, trial) => nextWarmStopState(direction, state, trial)
  )
