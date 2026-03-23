/**
 * Budget tracking and enforcement for trial count and cost limits.
 *
 * @since 0.1.0
 */
import { Effect, Match, Number as Num, Option } from "effect"

import * as StudyEvent from "../../StudyEvent/index.js"
import type * as Trial from "../../Trial/index.js"
import { appendEvent } from "../events.js"
import type { OptimizeSettings } from "../options.js"
import { markBudgetExhausted } from "./completion.js"
import { readStudyState, type StudyRuntime } from "./runtimeState.js"

const isFiniteNonNegative = (value: number): boolean => Number.isFinite(value) && Num.greaterThanOrEqualTo(value, 0)

const maybeTrialCost = <Config>(trial: Trial.Trial<Config>): Option.Option<number> =>
  Option.fromNullable(trial.cost).pipe(
    Option.filter(isFiniteNonNegative)
  )

const maybeMaxCost = (settings: OptimizeSettings): Option.Option<number> =>
  Option.fromNullable(settings.maxCost).pipe(
    Option.filter(isFiniteNonNegative)
  )

const budgetExceeded = (cumulativeCost: number, maxCost: number): boolean => Num.greaterThan(cumulativeCost, maxCost)

const completionReasonOnExceeded = <Config>(
  runtime: StudyRuntime<Config>,
  cumulativeCost: number,
  maxCost: number
): Effect.Effect<boolean> =>
  Match.value(budgetExceeded(cumulativeCost, maxCost)).pipe(
    Match.when(true, () => markBudgetExhausted(runtime.completionReasonRef).pipe(Effect.as(true))),
    Match.orElse(() => Effect.succeed(false))
  )

/**
 * Reports whether the cumulative cost has exceeded the maxCost budget, marking the completion reason if so.
 *
 * @since 0.1.0
 * @category guards
 */
export const shouldSkipByMaxCost = <Config>(
  settings: OptimizeSettings,
  runtime: StudyRuntime<Config>
): Effect.Effect<boolean> =>
  maybeMaxCost(settings).pipe(
    Option.match({
      onNone: () => Effect.succeed(false),
      onSome: (maxCost) =>
        readStudyState(runtime).pipe(
          Effect.flatMap((state) => completionReasonOnExceeded(runtime, state.cumulativeCost, maxCost))
        )
    })
  )

/**
 * Emits a TrialCosted event for trials with a cost and marks budget exhausted if maxCost is exceeded.
 *
 * @since 0.1.0
 * @category utils
 */
export const emitTrialCostedAndMarkBudget = <Config>(
  settings: OptimizeSettings,
  runtime: StudyRuntime<Config>,
  trial: Trial.Trial<Config>
): Effect.Effect<void> =>
  maybeTrialCost(trial).pipe(
    Option.match({
      onNone: () => Effect.void,
      onSome: (cost) =>
        Effect.gen(function*() {
          const state = yield* readStudyState(runtime)
          const cumulativeCost = state.cumulativeCost
          yield* appendEvent(runtime, StudyEvent.TrialCosted({ trialNumber: trial.trialNumber, cost, cumulativeCost }))

          yield* maybeMaxCost(settings).pipe(
            Option.match({
              onNone: () => Effect.void,
              onSome: (maxCost) => completionReasonOnExceeded(runtime, cumulativeCost, maxCost).pipe(Effect.asVoid)
            })
          )
        })
    })
  )
