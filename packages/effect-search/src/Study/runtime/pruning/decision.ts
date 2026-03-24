/**
 * Prune decision models, schemas, and pruning policy service definition.
 *
 * @since 0.1.0
 */
import { Data, Effect, Layer, Match, Schema } from "effect"

import type { Direction } from "../../../contracts/Direction.js"

/**
 * A report of intermediate objective value at a step.
 *
 * @since 0.1.0
 * @category models
 */
export class IntermediateReport extends Schema.Class<IntermediateReport>("effect-search/IntermediateReport")({
  step: Schema.Number,
  value: Schema.Number
}) {}

/**
 * @since 0.1.0
 * @category schemas
 */
export const PruneDecisionSchema = Schema.Union(
  Schema.TaggedStruct("Continue", {}),
  Schema.TaggedStruct("Prune", {
    step: Schema.Number,
    reason: Schema.String,
    policy: Schema.String
  })
)

/**
 * @since 0.1.0
 * @category type-level
 */
export type PruneDecision = Schema.Schema.Type<typeof PruneDecisionSchema>

/**
 * @since 0.1.0
 * @category type-level
 */
export type PrunedDecision = Data.TaggedEnum.Value<PruneDecision, "Prune">

const PruneDecisions = Data.taggedEnum<PruneDecision>()

/**
 * Destructured constructors, guards, and pattern matcher for the {@link PruneDecision} tagged union.
 *
 * @since 0.1.0
 * @category constructors
 */
export const {
  /**
   * @since 0.1.0
   * @category constructors
   */
  Continue: ContinuePruneDecision,
  /**
   * @since 0.1.0
   * @category constructors
   */
  Prune: PruneTrialDecision,
  /**
   * @since 0.1.0
   * @category guards
   */
  $is: isPruneDecision,
  /**
   * @since 0.1.0
   * @category pattern-matching
   */
  $match: matchPruneDecision
} = PruneDecisions

/**
 * @since 0.1.0
 * @category models
 */
export class PruningPolicyContext extends Schema.Class<PruningPolicyContext>("effect-search/PruningPolicyContext")({
  trialNumber: Schema.Number,
  reports: Schema.Array(IntermediateReport),
  latestReport: IntermediateReport
}) {}

/**
 * @since 0.1.0
 * @category models
 */
export class PruningPolicy extends Data.Class<{
  readonly name: string
  readonly decide: (context: PruningPolicyContext) => PruneDecision
}> {}

/**
 * @since 0.1.0
 * @category services
 */
export class PruningPolicySpi extends Effect.Tag("effect-search/Study/PruningPolicySpi")<
  PruningPolicySpi,
  {
    readonly decide: (context: PruningPolicyContext) => PruneDecision
  }
>() {}

/**
 * @since 0.1.0
 * @category layers
 */
export const PruningPolicySpiLayer = (policy: PruningPolicy): Layer.Layer<PruningPolicySpi> =>
  Layer.succeed(PruningPolicySpi, {
    decide: policy.decide
  })

/**
 * A pruning policy that never prunes.
 *
 * @since 0.1.0
 * @category constructors
 */
export const neverPruningPolicy = new PruningPolicy({
  name: "never-prune",
  decide: () => ContinuePruneDecision()
})

const directionFactor = (direction: Direction): number =>
  Match.value(direction).pipe(
    Match.when("minimize", () => 1),
    Match.when("maximize", () => -1),
    Match.exhaustive
  )

/**
 * A pruning policy that prunes when value exceeds threshold.
 *
 * @since 0.1.0
 * @category constructors
 */
export const thresholdPruningPolicy = (
  threshold: number,
  direction: Direction = "minimize",
  minStep = 0
): PruningPolicy =>
  new PruningPolicy({
    name: "threshold",
    decide: ({ latestReport }) =>
      latestReport.step < minStep
        ? ContinuePruneDecision()
        : latestReport.value * directionFactor(direction) >= threshold * directionFactor(direction)
        ? PruneTrialDecision({
          step: latestReport.step,
          reason: `threshold(${threshold})`,
          policy: "threshold"
        })
        : ContinuePruneDecision()
  })
