/**
 * Intermediate-report decisions and synchronous pruning policies.
 *
 * @since 0.1.0
 */
import { Data, Effect, Layer, Match, Schema } from "effect"

import type { Direction } from "../../../contracts/Direction.js"

/**
 * Stores one intermediate objective measurement. Direct construction and schema
 * decoding check field types only. `ObjectiveTrialRuntime.report` separately
 * requires finite values at strictly increasing, non-negative integer steps.
 *
 * @since 0.1.0
 * @category models
 */
export class IntermediateReport extends Schema.Class<IntermediateReport>("effect-search/IntermediateReport")({
  /** Evaluation-defined progress index; runtime reporting requires a non-negative integer. */
  step: Schema.Number,
  /** Finite scalar measurement used by the pruning policy. */
  value: Schema.Number
}) {}

/**
 * Decodes a policy result: `Continue` leaves the trial eligible to report
 * again, while `Prune` records the triggering step plus human-readable reason
 * and policy provenance for trial state and emitted events.
 *
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
 * Records whether evaluation continues or ends at a reported step. A pruning
 * result retains its human-readable reason and policy name in the trial state.
 *
 * @since 0.1.0
 * @category type-level
 */
export type PruneDecision = Schema.Schema.Type<typeof PruneDecisionSchema>

/**
 * Selects the terminal branch with the triggering step, reason, and policy name.
 *
 * @since 0.1.0
 * @category type-level
 */
export type PrunedDecision = Data.TaggedEnum.Value<PruneDecision, "Prune">

const PruneDecisions = Data.taggedEnum<PruneDecision>()

/**
 * Constructors, a narrowing predicate, and exhaustive matching for prune
 * decisions.
 *
 * @since 0.1.0
 * @category constructors
 */
export const {
  /**
   * Keeps the current trial eligible to report another intermediate value.
   *
   * @since 0.1.0
   * @category constructors
   */
  Continue: ContinuePruneDecision,
  /**
   * Stops the current trial and preserves the supplied decision provenance.
   * Fields are not validated against the latest report.
   *
   * @since 0.1.0
   * @category constructors
   */
  Prune: PruneTrialDecision,
  /**
   * Builds a predicate for either decision tag, with type narrowing for a
   * selected tag.
   *
   * @typeParam Tag - Decision discriminator selected for narrowing.
   *
   * @since 0.1.0
   * @category guards
   */
  $is: isPruneDecision,
  /**
   * Builds a function requiring branches for continue and prune decisions.
   *
   * @typeParam Cases - Exhaustive handler record whose return values determine the result union.
   *
   * @since 0.1.0
   * @category pattern-matching
   */
  $match: matchPruneDecision
} = PruneDecisions

/**
 * Supplies a policy with all accepted reports in ascending step order and the
 * report just appended. Schema decoding does not verify that order or that
 * `latestReport` is the final array element.
 *
 * @since 0.1.0
 * @category models
 */
export class PruningPolicyContext extends Schema.Class<PruningPolicyContext>("effect-search/PruningPolicyContext")({
  /** Trial whose latest measurement triggered policy evaluation. */
  trialNumber: Schema.Number,
  /** All accepted measurements for the trial in ascending step order. */
  reports: Schema.Array(IntermediateReport),
  /** Measurement appended immediately before this policy call. */
  latestReport: IntermediateReport
}) {}

/**
 * Evaluates accepted intermediate reports synchronously. The name is copied into
 * diagnostics by policies that return a matching prune decision; the runtime
 * does not enforce that relationship.
 *
 * @since 0.1.0
 * @category models
 */
export class PruningPolicy extends Data.Class<{
  /** Stable policy identifier used in trial and event diagnostics. */
  readonly name: string
  /** Pure decision function called once for every accepted report. */
  readonly decide: (context: PruningPolicyContext) => PruneDecision
}> {}

/**
 * @since 0.1.0
 * @category services
 */
export class PruningPolicySpi extends Effect.Tag("effect-search/Study/PruningPolicySpi")<
  PruningPolicySpi,
  {
    /** Applies the configured policy once to an accepted intermediate report. */
    readonly decide: (context: PruningPolicyContext) => PruneDecision
  }
>() {}

/**
 * Makes one synchronous pruning policy available to trial reporting.
 * The Layer acquires no resources and has no typed acquisition failure.
 *
 * @since 0.1.0
 * @category layers
 */
export const PruningPolicySpiLayer = (policy: PruningPolicy): Layer.Layer<PruningPolicySpi> =>
  Layer.succeed(PruningPolicySpi, {
    decide: policy.decide
  })

/**
 * Reuses a policy named `"never-prune"` whose decision always continues.
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
 * Creates a policy that begins comparing at `minStep`. Minimization prunes when
 * the latest value is greater than or equal to `threshold`; maximization prunes
 * when it is less than or equal to the threshold. Inputs are stored without
 * finiteness or range validation.
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
