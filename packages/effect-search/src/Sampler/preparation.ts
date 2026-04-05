/**
 * Prepared suggestion state and typed suggestion diagnostics.
 *
 * @since 0.3.0
 */
import { Array as Arr, Data, Number as Num, Schema } from "effect"

import type { SuggestContext } from "./SuggestContext.js"

/**
 * Runtime-prepared sampler state derived from a concrete suggestion context.
 *
 * @since 0.3.0
 * @category models
 */
export class PreparedSuggestionState extends Data.Class<{
  readonly kind: string
  readonly context: SuggestContext
  readonly state: unknown
}> {}

/**
 * Typed summary of the suggestion path used for a reserved trial.
 *
 * @since 0.3.0
 * @category schemas
 */
export const SuggestionDiagnosticsSchema = Schema.Struct({
  samplerKind: Schema.String,
  preparedStateKind: Schema.String,
  reusedPreparedState: Schema.Boolean,
  completedCount: Schema.Number,
  pendingCount: Schema.Number,
  imputedCompletedCount: Schema.Number,
  belowCount: Schema.Number,
  aboveCount: Schema.Number
})

/**
 * @since 0.3.0
 * @category type-level
 */
export type SuggestionDiagnostics = Schema.Schema.Type<typeof SuggestionDiagnosticsSchema>

const imputedCompletedCountFromContext = (context: SuggestContext): number =>
  Arr.reduce(
    context.pending,
    0,
    (count, pending) =>
      Arr.some(context.completed, (completed) => completed.trialNumber === pending.trialNumber)
        ? Num.increment(count)
        : count
  )

/**
 * Constructs a typed suggestion-diagnostics payload from the resolved sampler path.
 *
 * @since 0.3.0
 * @category constructors
 */
export const makeSuggestionDiagnostics = (
  samplerKind: string,
  preparedStateKind: string,
  reusedPreparedState: boolean,
  context: SuggestContext,
  belowCount = 0,
  aboveCount = 0
): SuggestionDiagnostics => ({
  samplerKind,
  preparedStateKind,
  reusedPreparedState,
  completedCount: context.completed.length,
  pendingCount: context.pending.length,
  imputedCompletedCount: imputedCompletedCountFromContext(context),
  belowCount,
  aboveCount
})
