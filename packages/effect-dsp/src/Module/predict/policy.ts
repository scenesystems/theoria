/**
 * Text-output parse retries and diagnostic feedback policies.
 *
 * @since 0.1.0
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Data, Match, Option } from "effect"
import * as Schedule from "effect/Schedule"
import type { ParseOutputError } from "../../Errors/module.js"

/**
 * Builds the Effect schedule applied after text-output parse failures.
 *
 * @param maxRetries - Retry count resolved by the predict policy. Custom
 *   factories receive a non-negative integer.
 * @returns A schedule whose recurrences and delays control parse retries.
 *
 * @since 0.1.0
 * @category models
 */
export type ParseRetryScheduleFactory = (
  maxRetries: number
) => Schedule.Schedule<unknown, unknown, never>

/**
 * Formats one parse failure for the next text-generation prompt.
 *
 * @remarks
 * A synchronous exception in the callback becomes an Effect defect.
 *
 * @param error - Previous parse failure, including field diagnostics and retry count.
 * @returns Prompt text appended to the next attempt.
 *
 * @since 0.1.0
 * @category models
 */
export type ParseFeedbackTemplate = (error: ParseOutputError) => string

/**
 * Fixes parse retry count, timing, and feedback rendering for a predictor.
 *
 * @since 0.1.0
 * @category models
 */
export class ParsePolicy extends Data.Class<{
  /** Maximum additional parse attempts as a non-negative integer. */
  readonly maxRetries: number
  /** Factory invoked with `maxRetries` when a text parse operation begins. */
  readonly retrySchedule: ParseRetryScheduleFactory
  /** Callback invoked to render diagnostics before each retry. */
  readonly feedbackTemplate: ParseFeedbackTemplate
}> {}

/**
 * Fixes the parse policy applied by a predictor after option defaults resolve.
 *
 * @since 0.1.0
 * @category models
 */
export class PredictPolicy extends Data.Class<{
  /** Text-output parse policy. */
  readonly parse: ParsePolicy
}> {}

/**
 * Selectively replaces built-in text parse policy fields.
 *
 * @since 0.1.0
 * @category models
 */
export class ParsePolicyOverrides extends Data.Class<{
  /** Additional attempts; finite values round down, while invalid values become zero. */
  readonly maxRetries?: number
  /** Complete replacement for the default exponential schedule factory. */
  readonly retrySchedule?: ParseRetryScheduleFactory
  /** Complete replacement for field-diagnostic feedback rendering. */
  readonly feedbackTemplate?: ParseFeedbackTemplate
}> {}

/**
 * Selectively replaces policies used by one predictor.
 *
 * @since 0.1.0
 * @category models
 */
export class PredictPolicyOverrides extends Data.Class<{
  /** Text-output parse overrides. */
  readonly parse?: ParsePolicyOverrides
}> {}

/**
 * Maximum additional parse attempts used when no override is supplied: `3`.
 *
 * @since 0.1.0
 * @category constants
 */
export const DEFAULT_PARSE_MAX_RETRIES = 3

/**
 * Initial delay used by the default parse retry schedule: `"100 millis"`.
 *
 * @since 0.1.0
 * @category constants
 */
export const DEFAULT_PARSE_INITIAL_DELAY = "100 millis"

/**
 * Delay multiplier used by the default exponential parse schedule: `2`.
 *
 * @since 0.1.0
 * @category constants
 */
export const DEFAULT_PARSE_BACKOFF_FACTOR = 2

const EMPTY_PARSE_POLICY_OVERRIDES: ParsePolicyOverrides = {}
const EMPTY_PREDICT_POLICY_OVERRIDES: PredictPolicyOverrides = {}

const normalizeRetryCount = (value: number): number =>
  Match.value(value).pipe(
    Match.when(Numeric.isFinite, (candidate) => Numeric.max(0, Numeric.floor(candidate))),
    Match.orElse(() => 0)
  )

/**
 * Creates the default exponential parse retry schedule.
 *
 * @remarks
 * Finite counts are rounded down and normalized to at least zero. Non-finite
 * counts become zero. The first delay is 100 milliseconds and each subsequent
 * delay is twice the preceding delay. Recurrence stops after the normalized
 * number of retries.
 *
 * @param maxRetries - Maximum schedule recurrences after normalization.
 * @returns An exponential schedule intersected with the recurrence limit.
 *
 * @since 0.1.0
 * @category constructors
 */
export const defaultParseRetrySchedule: ParseRetryScheduleFactory = (maxRetries) =>
  Schedule.intersect(
    Schedule.exponential(DEFAULT_PARSE_INITIAL_DELAY, DEFAULT_PARSE_BACKOFF_FACTOR),
    Schedule.recurs(normalizeRetryCount(maxRetries))
  )

const formatFieldDiagnostic = (diagnostic: ParseOutputError["fieldDiagnostics"][number]): string =>
  `- ${diagnostic.field} (${diagnostic.issue}): ${diagnostic.message}`

/**
 * Formats parse diagnostics for the next prompt attempt.
 *
 * @remarks
 * The first line contains the retry count and error message. It is followed by
 * a `Field diagnostics:` line and one line per diagnostic. An empty diagnostic
 * array produces `- none`.
 *
 * @param error - Parse failure from the preceding attempt.
 * @returns Newline-separated retry feedback without redaction.
 *
 * @since 0.1.0
 * @category constructors
 */
export const defaultParseFeedbackTemplate: ParseFeedbackTemplate = (error) => {
  const diagnostics = Arr.map(error.fieldDiagnostics, formatFieldDiagnostic)

  return Arr.join(
    Arr.appendAll(
      [
        `Parse error (${Option.getOrElse(error.retryCount, () => 0)}): ${error.message}`,
        "Field diagnostics:"
      ],
      Option.match(Arr.head(diagnostics), {
        onNone: () => ["- none"],
        onSome: () => diagnostics
      })
    ),
    "\n"
  )
}

const resolveParsePolicy = (overrides: ParsePolicyOverrides): ParsePolicy => ({
  maxRetries: normalizeRetryCount(
    Option.getOrElse(Option.fromNullable(overrides.maxRetries), () => DEFAULT_PARSE_MAX_RETRIES)
  ),
  retrySchedule: Option.getOrElse(
    Option.fromNullable(overrides.retrySchedule),
    () => defaultParseRetrySchedule
  ),
  feedbackTemplate: Option.getOrElse(
    Option.fromNullable(overrides.feedbackTemplate),
    () => defaultParseFeedbackTemplate
  )
})

/**
 * Resolves optional predictor policy fields against built-in defaults.
 *
 * @remarks
 * Retry counts become non-negative integers; non-finite values become zero.
 * Custom schedule and feedback functions are retained by identity.
 *
 * @param overrides - Nested parse policy replacements.
 * @returns A complete policy suitable for predictor construction.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makePredictPolicy = (
  overrides: PredictPolicyOverrides = EMPTY_PREDICT_POLICY_OVERRIDES
): PredictPolicy => ({
  parse: resolveParsePolicy(
    Option.getOrElse(
      Option.fromNullable(overrides.parse),
      () => EMPTY_PARSE_POLICY_OVERRIDES
    )
  )
})

/**
 * Uses three parse retries, exponential delays, and field-diagnostic feedback.
 *
 * @since 0.1.0
 * @category constants
 */
export const DEFAULT_PREDICT_POLICY: PredictPolicy = makePredictPolicy()
