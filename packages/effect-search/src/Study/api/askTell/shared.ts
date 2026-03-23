/**
 * Shared helpers for validating objective values and updating trial state in ask/tell mode.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Match, Option } from "effect"

import { matchObjectiveSpec } from "../../../contracts/ObjectiveSpec.js"
import type { ObjectiveValue } from "../../../contracts/ObjectiveValue.js"
import { InvalidObjectiveValue, type SearchError } from "../../../Errors/index.js"
import type * as SearchSpace from "../../../SearchSpace/index.js"
import type * as Trial from "../../../Trial/index.js"
import { emitLifecycleEvents } from "../../events.js"
import type { OptimizeSettings } from "../../options.js"
import { modifyStudyState, readStudyState } from "../../runtime/runtimeState.js"
import { trialToSnapshot } from "../../snapshot/stateCodec.js"
import { pendingTrialByNumber, withFinalizedTrial } from "../../state.js"
import { appendTrialIfAvailable } from "../../studyStorage.js"
import { completeIfBudgetReached, invalid } from "./lifecycle.js"
import type { HandleRuntime, StudyHandle } from "./model.js"
import { stateOf } from "./model.js"

/**
 * Validates that an objective value matches the study's objective spec (single vs multi, correct arity).
 *
 * @since 0.1.0
 * @category utils
 */
export const validateObjectiveValue = (
  objectiveSpec: OptimizeSettings["objectiveSpec"],
  trialNumber: number,
  value: ObjectiveValue
): Effect.Effect<void, InvalidObjectiveValue> =>
  matchObjectiveSpec({
    Single: () =>
      Match.value(value).pipe(
        Match.when(Match.number, () => Effect.void),
        Match.orElse(() => Effect.fail(new InvalidObjectiveValue({ trialNumber, value })))
      ),
    Multi: ({ directions }) =>
      Match.value(
        Arr.isArray(value) && value.length === directions.length && value.every((entry) => Number.isFinite(entry))
      ).pipe(
        Match.when(true, () => Effect.void),
        Match.orElse(() => Effect.fail(new InvalidObjectiveValue({ trialNumber, value })))
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
  readStudyState(state.runtime).pipe(
    Effect.flatMap((studyState) =>
      Option.match(pendingTrialByNumber(studyState, trialNumber), {
        onNone: () => Effect.fail(invalid(`Study.${operation} trial ${trialNumber} is not reserved`)),
        onSome: Effect.succeed
      })
    )
  )

/**
 * Moves a trial from pending to finalized, persists the snapshot, emits lifecycle events, and completes if budget is met.
 *
 * @since 0.1.0
 * @category utils
 */
export const finalizeTrial = <Space extends SearchSpace.SearchSpace>(
  handle: StudyHandle<Space>,
  trial: Trial.Trial<SearchSpace.Type<Space>>
): Effect.Effect<void> =>
  Effect.gen(function*() {
    const state = stateOf(handle)
    yield* modifyStudyState(state.runtime, (studyState) =>
      Effect.succeed([undefined, withFinalizedTrial(studyState, trial)]))
    yield* appendTrialIfAvailable(trialToSnapshot(trial))
    yield* emitLifecycleEvents(state.settings.objectiveSpec, trial, state.runtime)
    yield* completeIfBudgetReached(state)
  })
