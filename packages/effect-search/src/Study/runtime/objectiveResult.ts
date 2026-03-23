/**
 * Exit-level accessors for objective attempt results.
 *
 * @since 0.1.0
 */
import { Exit, Match, Option } from "effect"

import type { ObjectiveValue } from "../../contracts/ObjectiveValue.js"
import type { TrialError } from "../../Errors/Study.js"
import type { ObjectiveAttempt } from "./trialEvaluation.js"

/**
 * @since 0.1.0
 * @category utils
 */
export const objectiveExitValue = (
  objectiveExit: Exit.Exit<ObjectiveAttempt, TrialError>
): Exit.Exit<ObjectiveValue, TrialError> =>
  Match.value(objectiveExit).pipe(
    Match.tag("Success", ({ value }) => Exit.succeed(value.value)),
    Match.tag("Failure", ({ cause }) => Exit.failCause(cause)),
    Match.exhaustive
  )

/**
 * @since 0.1.0
 * @category utils
 */
export const objectiveRetryCount = (objectiveExit: Exit.Exit<ObjectiveAttempt, TrialError>): number =>
  Match.value(objectiveExit).pipe(
    Match.tag("Success", ({ value }) => value.retryCount),
    Match.tag("Failure", () => 0),
    Match.exhaustive
  )

/**
 * @since 0.1.0
 * @category utils
 */
export const objectiveCost = (objectiveExit: Exit.Exit<ObjectiveAttempt, TrialError>): Option.Option<number> =>
  Match.value(objectiveExit).pipe(
    Match.tag("Success", ({ value }) => Option.fromNullable(value.cost)),
    Match.tag("Failure", () => Option.none()),
    Match.exhaustive
  )

/**
 * @since 0.1.0
 * @category utils
 */
export const objectiveVariance = (objectiveExit: Exit.Exit<ObjectiveAttempt, TrialError>): Option.Option<number> =>
  Match.value(objectiveExit).pipe(
    Match.tag("Success", ({ value }) => Option.fromNullable(value.variance)),
    Match.tag("Failure", () => Option.none()),
    Match.exhaustive
  )

/**
 * @since 0.1.0
 * @category utils
 */
export const objectiveEvaluationCount = (objectiveExit: Exit.Exit<ObjectiveAttempt, TrialError>): number =>
  Match.value(objectiveExit).pipe(
    Match.tag("Success", ({ value }) => value.evaluationCount),
    Match.tag("Failure", () => 1),
    Match.exhaustive
  )
