/**
 * Data classes for stop request and intermediate report reference containers.
 *
 * @since 0.1.0
 */
import type { Option, Ref } from "effect"
import { Data } from "effect"

import type { IntermediateReport, PrunedDecision, StopRequest } from "../pruning.js"

/**
 * Mutable reference container holding an optional stop request for the study.
 *
 * @since 0.1.0
 * @category models
 */
export class StopRef extends Data.Class<{
  readonly ref: Ref.Ref<Option.Option<StopRequest>>
}> {}

/**
 * Mutable reference container tracking intermediate reports and the pruning decision for a single trial.
 *
 * @since 0.1.0
 * @category models
 */
export class ReportRefs extends Data.Class<{
  readonly reportsRef: Ref.Ref<ReadonlyArray<IntermediateReport>>
  readonly pruneRef: Ref.Ref<Option.Option<PrunedDecision>>
}> {}
