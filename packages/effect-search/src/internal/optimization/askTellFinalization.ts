/**
 * Validates objective values and updates trial state in optimization ask/tell mode.
 *
 * @since 0.1.0
 */
import * as History from "@scenesystems/effect-study/History"
import { Array as Arr, Boolean as Bool, Effect, Match, Option, Schema, Tuple } from "effect"

import * as GenericStudy from "@scenesystems/effect-study/Study"
import { match } from "../../Objective.js"
import type { Value } from "../../Objective.js"
import { InvalidObjectiveValue, type SearchError } from "../../SearchError.js"
import type * as SearchSpace from "../../SearchSpace.js"
import type * as Trial from "../../Trial.js"
import { completeIfBudgetReached, invalid } from "./askTellLifecycle.js"
import type { HandleRuntime } from "./askTellState.js"
import { emitLifecycleEvents } from "./events.js"
import { pendingTrialByNumber } from "./history.js"
import { journalTrial } from "./journal.js"
import type { OptimizeSettings } from "./options/plan.js"

/**
 * Validates that an objective value matches the optimization's objective spec (single vs multi, correct arity).
 *
 * @since 0.1.0
 * @category utils
 */
export const validateValue = (
  objectiveSpec: OptimizeSettings["objectiveSpec"],
  trialNumber: number,
  value: Value
): Effect.Effect<void, InvalidObjectiveValue> =>
  match({
    Single: () =>
      Effect.fail(new InvalidObjectiveValue({ trialNumber, value })).pipe(
        Effect.when(Effect.sync(() => Bool.not(Schema.is(Schema.Finite)(value)))),
        Effect.asVoid
      ),
    Multi: ({ directions }) =>
      Effect.fail(new InvalidObjectiveValue({ trialNumber, value })).pipe(
        Effect.when(Effect.sync(() =>
          Bool.not(
            Schema.is(
              Schema.Array(Schema.Finite).check(Schema.isBetweenLength(Arr.length(directions), Arr.length(directions)))
            )(
              value
            )
          )
        )),
        Effect.asVoid
      )
  })(objectiveSpec)

/**
 * Retrieves a reserved trial by number from the pending trials map, failing if it does not exist.
 *
 * @since 0.1.0
 * @category utils
 */
export const pendingTrial = <Space extends SearchSpace.SearchSpace>(
  state: HandleRuntime<Space>,
  trialNumber: number,
  operation: string
): Effect.Effect<Trial.Trial<SearchSpace.Type<Space>>, SearchError> =>
  GenericStudy.read(state.runtime.study).pipe(
    Effect.flatMap((studyState) =>
      Effect.fromOption(
        pendingTrialByNumber(studyState.history, trialNumber),
        () =>
          invalid(
            Arr.join(
              Arr.make(
                "Optimization.",
                operation,
                " trial ",
                Schema.encodeSync(Schema.FiniteFromString)(trialNumber),
                " is not reserved"
              ),
              ""
            )
          )
      )
    )
  )

/**
 * Moves a trial from pending to finalized while journaling it with the sampler checkpoint, emits lifecycle events, and completes if budget is met.
 *
 * @since 0.1.0
 * @category utils
 */
export const finalizeTrial = <Space extends SearchSpace.SearchSpace>(
  state: HandleRuntime<Space>,
  trial: Trial.Trial<SearchSpace.Type<Space>>
): Effect.Effect<void, SearchError> =>
  Effect.gen(function*() {
    // Defer fiber interruption until the durable append and in-memory history update finish.
    // Storage failure leaves history unchanged; this is not an OS-crash transaction.
    yield* Effect.uninterruptible(GenericStudy.modify(state.runtime.study, (runtimeState) =>
      Match.value(runtimeState.lifecycle).pipe(
        Match.when("Running", () =>
          Option.match(pendingTrialByNumber(runtimeState.history, trial.trialNumber), {
            onNone: () => Effect.fail(invalid(`Optimization trial ${trial.trialNumber} is not reserved`)),
            onSome: () =>
              journalTrial(state.optimizePlan.sampler, trial).pipe(
                Effect.as(Tuple.make(
                  undefined,
                  new GenericStudy.State({
                    lifecycle: runtimeState.lifecycle,
                    history: History.set(runtimeState.history, trial)
                  })
                ))
              )
          })),
        Match.orElse((lifecycle) =>
          Effect.fail(invalid(`Optimization finalization requires a running handle (current lifecycle: ${lifecycle})`))
        )
      )))
    yield* emitLifecycleEvents(state.settings.objectiveSpec, trial, state.runtime)
    yield* completeIfBudgetReached(state)
  })
