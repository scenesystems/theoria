/**
 * Predict runtime policy contracts.
 *
 * @since 0.1.0
 */
import { Array as Arr, Match, Option } from "effect"
import * as Schedule from "effect/Schedule"
import type { ParseOutputError } from "../../Errors/module.js"

/**
 * Factory that produces a retry schedule for text output parse failures,
 * parameterized by maximum retry count.
 *
 * @since 0.1.0
 * @category models
 */
export type ParseRetryScheduleFactory = (
  maxRetries: number
) => Schedule.Schedule<unknown, unknown, never>

/**
 * Formats a `ParseOutputError` into feedback text appended to the next
 * prompt attempt during parse retries.
 *
 * @see {@link ParsePolicy}
 *
 * @since 0.1.0
 * @category models
 */
export type ParseFeedbackTemplate = (error: ParseOutputError) => string

/**
 * Complete parse retry configuration: maximum retries, schedule factory,
 * and feedback template.
 *
 * @see {@link PredictPolicy}
 *
 * @since 0.1.0
 * @category models
 */
export type ParsePolicy = Readonly<{
  readonly maxRetries: number
  readonly retrySchedule: ParseRetryScheduleFactory
  readonly feedbackTemplate: ParseFeedbackTemplate
}>

/**
 * Top-level policy for a predict module governing parse retry behavior.
 *
 * @see {@link makePredictPolicy}
 * @see {@link DEFAULT_PREDICT_POLICY}
 *
 * @since 0.1.0
 * @category models
 */
export type PredictPolicy = Readonly<{
  readonly parse: ParsePolicy
}>

/**
 * Partial parse policy — any omitted fields fall back to built-in defaults
 * when resolved via `makePredictPolicy`.
 *
 * @see {@link ParsePolicy}
 *
 * @since 0.1.0
 * @category models
 */
export type ParsePolicyOverrides = Readonly<{
  readonly maxRetries?: number
  readonly retrySchedule?: ParseRetryScheduleFactory
  readonly feedbackTemplate?: ParseFeedbackTemplate
}>

/**
 * Partial predict policy — wraps `ParsePolicyOverrides` for the top-level
 * `predict` constructor.
 *
 * @see {@link PredictPolicy}
 *
 * @since 0.1.0
 * @category models
 */
export type PredictPolicyOverrides = Readonly<{
  readonly parse?: ParsePolicyOverrides
}>

/**
 * Default maximum number of parse retries before giving up (3).
 *
 * @since 0.1.0
 * @category constants
 */
export const DEFAULT_PARSE_MAX_RETRIES = 3

/**
 * Initial backoff delay for parse retries (`"100 millis"`).
 *
 * @since 0.1.0
 * @category constants
 */
export const DEFAULT_PARSE_INITIAL_DELAY = "100 millis"

/**
 * Exponential backoff multiplier for parse retries (2×).
 *
 * @since 0.1.0
 * @category constants
 */
export const DEFAULT_PARSE_BACKOFF_FACTOR = 2

const EMPTY_PARSE_POLICY_OVERRIDES: ParsePolicyOverrides = {}
const EMPTY_PREDICT_POLICY_OVERRIDES: PredictPolicyOverrides = {}

const normalizeRetryCount = (value: number): number =>
  Match.value(value).pipe(
    Match.when((candidate) => candidate < 0, () => 0),
    Match.orElse((candidate) => candidate)
  )

/**
 * Default retry schedule — exponential backoff capped at `maxRetries`.
 *
 * @see {@link DEFAULT_PARSE_INITIAL_DELAY}
 * @see {@link DEFAULT_PARSE_BACKOFF_FACTOR}
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
 * Default feedback template — renders retry count, error message, and
 * per-field diagnostics into a multi-line string appended to the next
 * prompt attempt.
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
 * Build a complete predict policy by merging optional overrides with
 * defaults. Missing fields fall back to built-in values.
 *
 * @see {@link PredictPolicy}
 * @see {@link DEFAULT_PREDICT_POLICY}
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
 * Ready-to-use predict policy with 3 retries, exponential backoff, and
 * field-level diagnostic feedback.
 *
 * @see {@link makePredictPolicy}
 *
 * @since 0.1.0
 * @category constants
 */
export const DEFAULT_PREDICT_POLICY: PredictPolicy = makePredictPolicy()
