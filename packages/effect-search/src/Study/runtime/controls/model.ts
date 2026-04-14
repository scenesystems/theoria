/**
 * Data classes for stop request and intermediate report reference containers.
 *
 * @since 0.1.0
 */
import { Data, Effect, Option, Ref } from "effect"

import type { IntermediateReport, PrunedDecision, StopRequest } from "../pruning.js"

/**
 * Mutable reference container holding an optional stop request for the study.
 *
 * @since 0.1.0
 * @category models
 */
export class StopRef extends Data.Class<{
  readonly ref: Ref.Ref<Option.Option<StopRequest>>
}> {
  /**
   * Allocate a fresh stop reference initialized to no active stop request.
   *
   * @since 0.1.0
   * @category constructors
   */
  static readonly allocate: Effect.Effect<StopRef> = Ref.make<Option.Option<StopRequest>>(Option.none()).pipe(
    Effect.map((ref) => new StopRef({ ref }))
  )
}

/**
 * Mutable reference container tracking intermediate reports and the pruning decision for a single trial.
 *
 * @since 0.1.0
 * @category models
 */
export class ReportRefs extends Data.Class<{
  readonly reportsRef: Ref.Ref<ReadonlyArray<IntermediateReport>>
  readonly pruneRef: Ref.Ref<Option.Option<PrunedDecision>>
}> {
  /**
   * Allocate fresh per-trial report refs with empty reports and no prune decision.
   *
   * @since 0.1.0
   * @category constructors
   */
  static readonly allocate: Effect.Effect<ReportRefs> = Effect.gen(function*() {
    return new ReportRefs({
      reportsRef: yield* Ref.make<ReadonlyArray<IntermediateReport>>([]),
      pruneRef: yield* Ref.make<Option.Option<PrunedDecision>>(Option.none())
    })
  })
}
