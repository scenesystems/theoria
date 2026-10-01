/**
 * Native optimization stop and intermediate-report reference models.
 *
 * @since 0.1.0
 */
import type * as Stop from "@scenesystems/effect-study/Stop"
import type { Option, Ref } from "effect"
import { Data, Schema } from "effect"

import { type Pruned, Report } from "../../../../Pruning.js"

/**
 * Native mutable reference holding an optional stop request for the optimization.
 *
 * @since 0.1.0
 * @category type-level
 */
export type StopRef = Stop.Ref

const Reports = Schema.Array(Report)
export type Reports = typeof Reports.Type

/**
 * Mutable reference container tracking intermediate reports and the pruning decision for a single trial.
 *
 * @since 0.1.0
 * @category models
 */
export class ReportRefs extends Data.Class<{
  readonly reportsRef: Ref.Ref<Reports>
  readonly pruneRef: Ref.Ref<Option.Option<Pruned>>
}> {}
