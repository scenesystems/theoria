/**
 * Mutable MIPROv2 Phase 3 search state.
 *
 * @since 0.4.0
 * @internal
 */
import { Array as Arr, Data, Effect, Option, Ref } from "effect"
import type { BestAveragingCandidate } from "./runtime/model.js"

/** Mutable refs shared by Phase 3 trial evaluations.
 * @since 0.4.0
 * @category refs
 */
export class TrialRefs extends Data.Class<{
  readonly trialCounter: Ref.Ref<number>
  readonly bestScoreRef: Ref.Ref<Option.Option<number>>
  readonly bestAveragingRef: Ref.Ref<Option.Option<BestAveragingCandidate>>
  readonly fullEvalTrialsRef: Ref.Ref<ReadonlyArray<number>>
  readonly minibatchTrialsRef: Ref.Ref<ReadonlyArray<number>>
}> {}

/** Allocates fresh mutable state for one Phase 3 search.
 * @since 0.4.0
 * @category constructors
 */
export const makeTrialRefs: Effect.Effect<TrialRefs> = Effect.gen(function*() {
  const trialCounter = yield* Ref.make(0)
  const bestScoreRef = yield* Ref.make<Option.Option<number>>(Option.none())
  const bestAveragingRef = yield* Ref.make<Option.Option<BestAveragingCandidate>>(Option.none())
  const fullEvalTrialsRef = yield* Ref.make<ReadonlyArray<number>>(Arr.empty())
  const minibatchTrialsRef = yield* Ref.make<ReadonlyArray<number>>(Arr.empty())

  return new TrialRefs({
    trialCounter,
    bestScoreRef,
    bestAveragingRef,
    fullEvalTrialsRef,
    minibatchTrialsRef
  })
})
