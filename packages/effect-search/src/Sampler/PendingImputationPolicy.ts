/**
 * Policies for representing in-flight trials in sampler models.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Effect, Layer, Schema } from "effect"

import { matchObjectiveSpec } from "../contracts/ObjectiveSpec.js"
import { ObjectiveValueSchema } from "../contracts/ObjectiveValue.js"

import type { SuggestContext } from "./SuggestContext.js"

/**
 * Associates a pending configuration with a synthetic objective value.
 *
 * @remarks
 * The Study context builder appends these values to completed observations
 * before invoking the sampler. It does not mark the underlying trials complete.
 * @since 0.1.0
 * @category models
 */
export class ImputedObservation extends Schema.Class<ImputedObservation>("effect-search/ImputedObservation")({
  /** Trial identity copied from the pending reservation. */
  trialNumber: Schema.Number,
  /** Reserved configuration associated with the synthetic value. */
  config: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  /** Synthetic scalar or objective vector presented to the sampler. */
  value: ObjectiveValueSchema
}) {}

/**
 * Defines how pending reservations contribute synthetic completed observations.
 *
 * @remarks
 * `impute` runs once while the Study runtime prepares each suggestion context.
 * The returned array is appended in order after real completed trials.
 * @since 0.1.0
 * @category models
 */
export class PendingImputationPolicy extends Data.Class<{
  /** Diagnostic label retained by the sampler. */
  readonly name: string
  /** Derives zero or more observations without modifying the supplied context. */
  readonly impute: (context: SuggestContext) => ReadonlyArray<ImputedObservation>
}> {}

/**
 * Supplies pending-trial imputation to the Study context builder.
 * @since 0.1.0
 * @category services
 */
export class PendingImputationPolicySpi extends Effect.Tag("effect-search/Sampler/PendingImputationPolicySpi")<
  PendingImputationPolicySpi,
  {
    /** Derives synthetic observations for the pending trials in one suggestion context. */
    readonly impute: (context: SuggestContext) => ReadonlyArray<ImputedObservation>
  }
>() {}

/**
 * Supplies {@link PendingImputationPolicySpi} from an existing policy value.
 *
 * @remarks
 * The Layer acquires no resources and retains the policy's `impute` function.
 *
 * @param policy - Policy delegated to by the service.
 * @since 0.1.0
 * @category layers
 */
export const PendingImputationPolicySpiLayer = (
  policy: PendingImputationPolicy
): Layer.Layer<PendingImputationPolicySpi> =>
  Layer.succeed(PendingImputationPolicySpi, {
    impute: policy.impute
  })

/**
 * Leaves pending trials out of the sampler's completed observations.
 *
 * @remarks
 * Pending reservations remain present in `SuggestContext.pending`.
 * @since 0.1.0
 * @category constructors
 */
export const noPendingImputationPolicy = new PendingImputationPolicy({
  name: "none",
  impute: () => []
})

const zeroObjectiveValue = (context: SuggestContext): number | ReadonlyArray<number> =>
  matchObjectiveSpec({
    Single: () => 0,
    Multi: ({ directions }) => Arr.makeBy(directions.length, () => 0)
  })(context.objectiveSpec)

/**
 * Assigns zero-valued synthetic observations to all pending trials.
 *
 * @remarks
 * A multi-objective context receives one zero per declared direction. The
 * values are appended to completed observations while the same reservations
 * remain in `pending`. Zero has no direction-aware interpretation, so this
 * policy does not guarantee that a sampler avoids equivalent suggestions.
 * @since 0.1.0
 * @category constructors
 */
export const pendingAsZeroImputationPolicy = new PendingImputationPolicy({
  name: "pending-zero",
  impute: (context) =>
    context.pending.map(
      (pending) =>
        new ImputedObservation({
          trialNumber: pending.trialNumber,
          config: pending.config,
          value: zeroObjectiveValue(context)
        })
    )
})
