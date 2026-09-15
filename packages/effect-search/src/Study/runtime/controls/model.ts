/**
 * Native stop and intermediate-report reference models.
 *
 * @since 0.1.0
 */
import type * as Stop from "@scenesystems/effect-study/Stop"
import type { Option, Ref } from "effect"
import { Data, Schema } from "effect"

import { IntermediateReport, type PrunedDecision } from "../pruning.js"

/**
 * Native mutable reference holding an optional stop request for the study.
 *
 * @since 0.1.0
 * @category type-level
 */
export type StopRef = Stop.Ref

const IntermediateReports = Schema.Array(IntermediateReport)
type IntermediateReports = typeof IntermediateReports.Type

/**
 * Mutable reference container tracking intermediate reports and the pruning decision for a single trial.
 *
 * @since 0.1.0
 * @category models
 */
export class ReportRefs extends Data.Class<{
  readonly reportsRef: Ref.Ref<IntermediateReports>
  readonly pruneRef: Ref.Ref<Option.Option<PrunedDecision>>
}> {}
