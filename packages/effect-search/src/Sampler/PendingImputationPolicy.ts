/**
 * Pending trial imputation policies for sampler context construction.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Effect, Layer, Schema } from "effect"

import { matchObjectiveSpec } from "../contracts/ObjectiveSpec.js"
import { ObjectiveValueSchema } from "../contracts/ObjectiveValue.js"

import type { SuggestContext } from "./SuggestContext.js"

/**
 * A synthetic observation created by imputing an objective value for a pending
 * (in-flight) trial. Samplers treat imputed observations alongside real
 * completed trials so the surrogate model accounts for work already in
 * progress.
 *
 * @see {@link PendingImputationPolicy} strategy that produces these observations
 * @see {@link SuggestContext} source of the pending trials being imputed
 * @since 0.1.0
 * @category models
 */
export class ImputedObservation extends Schema.Class<ImputedObservation>("effect-search/ImputedObservation")({
  trialNumber: Schema.Number,
  config: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  value: ObjectiveValueSchema
}) {}

/**
 * Strategy for handling in-flight trials when a sampler builds its suggestion
 * context. The `impute` function receives the current {@link SuggestContext}
 * and returns synthetic {@link ImputedObservation} entries the sampler can
 * fold into its completed-trial set.
 *
 * @see {@link noPendingImputationPolicy} ignores pending trials entirely
 * @see {@link pendingAsZeroImputationPolicy} conservative zero-value imputation
 * @since 0.1.0
 * @category models
 */
export class PendingImputationPolicy extends Data.Class<{
  readonly name: string
  readonly impute: (context: SuggestContext) => ReadonlyArray<ImputedObservation>
}> {}

/**
 * Effect service tag for dependency-injecting a pending-trial imputation
 * strategy. Consumers request this tag to obtain an `impute` function
 * without knowing which policy is wired at runtime.
 *
 * @see {@link PendingImputationPolicySpiLayer} constructs a Layer from a policy instance
 * @see {@link PendingImputationPolicy} the value-level policy model
 * @since 0.1.0
 * @category services
 */
export class PendingImputationPolicySpi extends Effect.Tag("effect-search/Sampler/PendingImputationPolicySpi")<
  PendingImputationPolicySpi,
  {
    readonly impute: (context: SuggestContext) => ReadonlyArray<ImputedObservation>
  }
>() {}

/**
 * Constructs a {@link PendingImputationPolicySpi} Layer from a concrete
 * {@link PendingImputationPolicy} instance, wiring the policy's `impute`
 * function into the Effect service graph.
 *
 * @see {@link PendingImputationPolicySpi} the service tag this Layer satisfies
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
 * A no-op imputation policy that ignores pending trials entirely. The sampler
 * sees only truly completed observations, which is appropriate when parallel
 * evaluations are unlikely or when duplicate suggestions are acceptable.
 *
 * @see {@link PendingImputationPolicy} the strategy interface
 * @see {@link pendingAsZeroImputationPolicy} alternative that imputes zeros
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
 * Conservative imputation policy that assigns zero objective values to every
 * pending trial. For multi-objective specs the zero vector matches the
 * dimension count. This biases the sampler away from regions already being
 * explored, reducing redundant suggestions under heavy parallelism.
 *
 * @see {@link PendingImputationPolicy} the strategy interface
 * @see {@link noPendingImputationPolicy} alternative that skips imputation
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
