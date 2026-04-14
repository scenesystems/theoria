/**
 * Typed summary of the sampler path used for a reserved trial.
 *
 * @since 0.3.0
 */
import { Array as Arr, Number as Num, Schema } from "effect"

/**
 * Stable diagnostics describing how the next suggestion was prepared.
 *
 * @since 0.3.0
 * @category models
 */
export class SuggestionDiagnostics extends Schema.Class<SuggestionDiagnostics>("SuggestionDiagnostics")({
  samplerKind: Schema.String,
  preparedStateKind: Schema.String,
  reusedPreparedState: Schema.Boolean,
  completedCount: Schema.Number,
  pendingCount: Schema.Number,
  imputedCompletedCount: Schema.Number,
  belowCount: Schema.Number,
  aboveCount: Schema.Number
}) {
  /**
   * Projects typed suggestion diagnostics from the resolved sampler path and suggestion context.
   *
   * @since 0.3.0
   * @category constructors
   */
  static fromContext(
    samplerKind: string,
    preparedStateKind: string,
    reusedPreparedState: boolean,
    context: {
      readonly completed: ReadonlyArray<{ readonly trialNumber: number }>
      readonly pending: ReadonlyArray<{ readonly trialNumber: number }>
    },
    belowCount = 0,
    aboveCount = 0
  ): SuggestionDiagnostics {
    return SuggestionDiagnostics.make({
      samplerKind,
      preparedStateKind,
      reusedPreparedState,
      completedCount: context.completed.length,
      pendingCount: context.pending.length,
      imputedCompletedCount: imputedCompletedCountFromContext(context),
      belowCount,
      aboveCount
    })
  }
}

const imputedCompletedCountFromContext = (context: {
  readonly completed: ReadonlyArray<{ readonly trialNumber: number }>
  readonly pending: ReadonlyArray<{ readonly trialNumber: number }>
}): number =>
  Arr.reduce(
    context.pending,
    0,
    (count, pending) =>
      Arr.some(context.completed, (completed) => completed.trialNumber === pending.trialNumber)
        ? Num.increment(count)
        : count
  )
